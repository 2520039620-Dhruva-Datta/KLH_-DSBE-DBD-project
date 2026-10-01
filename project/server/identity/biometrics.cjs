'use strict';
const {spawn}=require('node:child_process'),path=require('node:path'),fs=require('node:fs'),readline=require('node:readline'),crypto=require('node:crypto');
const {config}=require('../config.cjs'),V=require('../validation.cjs');

// Keep the worker warm between verifications; model loading is the slowest step.
const IDLE_MS=15*60000,REQUEST_MS=40000,START_MS=45000;
// Yaw (landmark-derived, roughly nose offset / eye distance) below which a frame
// counts as frontal. Only frontal frames are enrolled and matched: SFace scores
// fall sharply with head rotation, so turned frames prove liveness, not identity.
const FRONTAL_YAW=0.2;
// Same-person check between steps, against the averaged first frontal step. On the
// fictional fixtures a genuine face scores ~0.80 when turned and a different person
// ~0.56 when frontal, so turned steps get a little slack while staying above that.
const CONTINUITY={frontal:0.65,turned:0.6};

let child,ready,waiting=new Map(),idle;
const unavailable=message=>Object.assign(Error(message),{status:503});

function rejectAll(message){for(const p of waiting.values())p.reject(unavailable(message));waiting.clear();}
function stop(){if(child)child.kill();child=null;ready=null;clearTimeout(idle);rejectAll('Face processing stopped. Try again or choose assisted verification.');}
function start(){
  if(ready)return ready;
  const python=process.env.FACE_PYTHON||(process.platform==='win32'?path.join(config.root,'.runtime/python/python.exe'):'python3');
  const proc=spawn(python,['-u',path.join(__dirname,'face_worker.py')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  child=proc;
  // Events from a replaced worker must never touch the current one.
  const current=()=>child===proc;
  ready=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{if(!current())return;reject(unavailable('Face models could not start. Choose assisted verification.'));stop();},START_MS);
    readline.createInterface({input:proc.stdout}).on('line',line=>{
      let d;try{d=JSON.parse(line);}catch{return;}
      if(d.ready){clearTimeout(timeout);resolve(d);return;}
      const p=current()&&waiting.get(d.id);
      if(p){waiting.delete(d.id);p.resolve(d);}
    });
    proc.stderr.on('data',()=>{/* Model diagnostics contain no user images and are intentionally not echoed. */});
    proc.on('error',()=>{clearTimeout(timeout);reject(unavailable('Face runtime unavailable. Run npm run setup:biometrics.'));if(current())stop();});
    proc.on('exit',()=>{clearTimeout(timeout);reject(unavailable('Face runtime stopped.'));if(!current())return;child=null;ready=null;rejectAll('Face processor unavailable.');});
  });
  ready.catch(()=>{});
  return ready;
}
function keepAlive(){clearTimeout(idle);idle=setTimeout(stop,IDLE_MS);idle.unref();}
// Start loading models ahead of the first capture, e.g. at server start or when a
// citizen turns on the camera. Failures surface on the real request instead.
function warm(){if(!health().installed)return;start().then(keepAlive,()=>{});}
// The verification area is the on-screen oval mapped onto the camera frame, as
// fractions of the frame: {cx,cy,rx,ry}. Faces outside it are ignored, so
// bystanders in the background never fail a check. It is bounded here and in the
// worker, so a client cannot widen it to the whole frame or shrink it to nothing.
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
function area(value){
  if(value==null)return null;
  const v=['cx','cy','rx','ry'].map(k=>Number(value?.[k]));
  if(typeof value!=='object'||v.some(x=>!Number.isFinite(x)))V.fail('Invalid verification area.');
  return {cx:clamp(v[0],0.2,0.8),cy:clamp(v[1],0.2,0.8),rx:clamp(v[2],0.08,0.5),ry:clamp(v[3],0.1,0.6)};
}
async function analyze(frames,region=null){
  if(waiting.size>=3)V.fail('Face processing is busy. Try again shortly.',503);
  await start();
  const proc=child,id=crypto.randomUUID();
  clearTimeout(idle);
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{waiting.delete(id);reject(unavailable('Face processing timed out. Please try again.'));if(child===proc)stop();},REQUEST_MS);
    waiting.set(id,{resolve:data=>{clearTimeout(timeout);keepAlive();resolve(data);},reject:e=>{clearTimeout(timeout);reject(e);}});
    proc.stdin.write(JSON.stringify({id,frames,...(region&&{region})})+'\n');
  });
}
function cosine(a,b){if(!Array.isArray(a)||a.length!==b?.length)return -1;let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]**2;bb+=b[i]**2;}return dot/Math.sqrt(aa*bb||1);}
function mean(frames){const out=frames[0].map((_,i)=>frames.reduce((s,f)=>s+f[i],0)/frames.length),norm=Math.sqrt(out.reduce((s,x)=>s+x*x,0));return out.map(v=>v/norm);}
const threshold=()=>Number(process.env.FACE_MATCH_THRESHOLD||0.65);
// Match the averaged frontal probe against the enrolled template, and require most
// individual frontal frames to agree so one lucky frame cannot carry a match.
function matches(frames,template){
  if(frames.length<3)return false;
  const t=threshold(),agreeing=frames.filter(f=>cosine(f,template)>=t-0.08).length;
  return cosine(mean(frames),template)>=t&&agreeing>=Math.ceil(frames.length*0.6);
}
// Closed eyes shift the embedding a little, so blink frames get the turned-step slack.
function continuous(embedding,reference,action){return cosine(embedding,reference)>=(action==='FORWARD'?CONTINUITY.frontal:CONTINUITY.turned);}
// Blink liveness. The worker reports each frame's eye aspect ratio (eyelid gap /
// eye width: ~0.3 open, under 0.15 closed). Each frame is judged against the
// person's own open-eye level in the same sequence, so narrow and wide eyes behave
// alike, and hysteresis between the closed and open marks stops jitter counting
// twice. A blink counts when the eyes close after being seen open; a still photo
// or a looped image without eyelid movement never does.
const BLINK={frames:[12,24],required:2,closed:0.6,open:0.8,minOpen:0.18};
function blinks(results){
  const values=results.map(r=>r?.ok&&Number.isFinite(r.eyes)?r.eyes:null),known=values.filter(v=>v!==null).sort((a,b)=>a-b);
  const open=known.length>=6?known[Math.floor((known.length-1)*0.8)]:0,usable=open>=BLINK.minOpen;
  const trace=values.map(v=>v===null||!usable?null:Math.round(Math.min(1,v/open)*100)/100),closed=[];
  let state='';
  trace.forEach((v,i)=>{if(v===null)return;if(v>=BLINK.open)state='open';else if(v<=BLINK.closed&&state==='open'){state='closed';closed.push(i);}});
  return {count:closed.length,required:BLINK.required,trace,closed};
}
function actionPassed(action,results,baseline){if(action==='BLINK')return blinks(results).count>=BLINK.required;const good=results.filter(r=>r.ok);if(good.length<2)return false;return good.every(r=>action==='FORWARD'?Math.abs(r.yaw)<0.20:action==='LEFT'?r.yaw>0.22:action==='RIGHT'?r.yaw< -0.22:action==='CLOSER'?Math.abs(r.yaw)<0.25&&r.size>baseline*1.15:false);}
// Each step gets a short-lived nonce; a stalled step can be refreshed (see service).
const CHALLENGE_MS=180000;
function shuffle(list){for(let i=list.length-1;i>0;i--){const j=crypto.randomInt(i+1);[list[i],list[j]]=[list[j],list[i]];}return list;}
// Two random movements, plus the blink check when its model is installed, in a
// random order between the opening and closing frontal steps.
function challenges(){const moves=shuffle(['LEFT','RIGHT','CLOSER']).slice(0,2),middle=health().blink?shuffle([...moves,'BLINK']):moves;return {actions:['FORWARD',...middle,'FORWARD'],index:0,nonce:crypto.randomBytes(24).toString('hex'),expires:Date.now()+CHALLENGE_MS};}
function health(){const dir=process.env.FACE_MODEL_DIR||path.join(config.root,'.runtime/face-models'),blink=fs.existsSync(path.join(dir,'face-mesh.tflite'));return {installed:fs.existsSync(path.join(dir,'sface.onnx')),blink,model:'YuNet + SFace; OpenVINO age range'+(blink?'; MediaPipe face mesh blink check':''),threshold:threshold()};}
module.exports={analyze,area,cosine,mean,matches,continuous,blinks,actionPassed,challenges,stop,warm,health,FRONTAL_YAW,CHALLENGE_MS,BLINK};
