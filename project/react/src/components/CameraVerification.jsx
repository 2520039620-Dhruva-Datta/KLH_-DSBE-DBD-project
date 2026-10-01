import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router';
import API from '../data/api.js';
import Icon from './Icon.jsx';
import {Alert,Button,Field} from './ui/index.jsx';
import {useLanguage} from '../context/LanguageContext.jsx';
import {verificationArea} from '../lib/camera.js';

const guidance={FORWARD:'Look directly at the camera',LEFT:'Slowly turn your head to your left',RIGHT:'Slowly turn your head to your right',CLOSER:'Move slightly closer, keeping your face in the frame',BLINK:'Blink several times, fully and naturally, while looking at the camera'};
const shortLabel={FORWARD:'Look ahead',LEFT:'Turn left',RIGHT:'Turn right',CLOSER:'Move closer',BLINK:'Blink'};
const feedback={BLINK_NOT_SEEN:'We could not see you blink. Keep looking at the camera and blink fully, two or three times, while the eye animation plays.',NO_FACE:'No face was detected. Keep your face inside the oval.',MULTIPLE_FACES:'Only one face should be inside the oval. People in the background, outside it, are fine.',FACE_OUTSIDE:'Move your face into the oval.',MOVE_CLOSER:'Move closer so your face fills the oval.',MOVE_BACK:'Move back so your whole face is visible.',RESOLUTION:'Choose a camera with at least 320 × 240 resolution.',LIGHTING:'Improve the lighting. Avoid a bright light behind you.',BLUR:'Hold still and allow the camera to focus.',LOOK_FORWARD:'Look directly at the camera and keep your head level.',TURN_LESS:'You turned a little too far. Turn gently, keeping both eyes visible.',LEVEL_HEAD:'Keep your head level rather than tilted.',FOLLOW_CHALLENGE:'Follow the current instruction during the countdown, then hold still.',FACE_CHANGED:'The face changed between steps. Keep only one person in view and try this step again.',FACE_NOT_MATCHED:'This face did not match the enrolled template.',EXPOSURE_CORRECTED:'Step accepted. The lighting was dim, so exposure was safely adjusted.',MODEL_ERROR:'The face model could not process this image. Try again or use assisted verification.',INVALID_FRAME:'A camera frame could not be read. Try again.'};
const TERMINAL=['COMPLETED','FAILED','EXPIRED','CANCELLED','BLOCKED'];
const FRAMES=5,FRAME_GAP=220,COUNTDOWN=3,MAX_SIDE=960;
// The blink step samples a ~2 second burst: frequent enough to catch eyelids
// mid-blink, small enough (640 px) to upload and analyse quickly.
const BLINK_FRAMES=18,BLINK_GAP=110,BLINK_SIDE=640;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const flowStep=state=>state==='ACCOUNT_IDENTIFIED'?0:['CONSENT_ACCEPTED','CAMERA_STARTED'].includes(state)?1:2;

// Scale the live frame without distorting it: the server measures face size and
// pose, so the aspect ratio must match what the camera actually delivers.
function frameSize(video,max=MAX_SIDE){const w=video.videoWidth||640,h=video.videoHeight||480,scale=Math.min(1,max/Math.max(w,h));return [Math.round(w*scale),Math.round(h*scale)];}

// The server's eye-openness measurement for each frame of the blink step, drawn
// as a waveform: every dip it counted as a blink is marked.
function BlinkSignature({blink,t}){
  const W=320,H=76,pad=10,n=blink.trace.length,x=i=>pad+i*(W-2*pad)/Math.max(1,n-1),y=v=>pad+(1-v)*(H-2*pad);
  const segments=[];let run=[];
  blink.trace.forEach((v,i)=>{if(v===null){if(run.length)segments.push(run);run=[];}else run.push(x(i).toFixed(1)+','+y(v).toFixed(1));});
  if(run.length)segments.push(run);
  const passed=blink.count>=blink.required,summary=blink.count+' '+t(blink.count===1?'blink detected':'blinks detected')+' · '+blink.required+' '+t('needed');
  return <figure className={'blink-signature '+(passed?'is-ok':'is-warn')}>
    <figcaption><span className="blink-signature-ico"><Icon name={passed?'eye':'eyeOff'} size={18}/></span><span className="blink-signature-text"><b>{t('Blink signature')}</b><small>{summary}</small></span>{passed&&<Icon name="checkCircle" size={22} className="blink-signature-ok"/>}</figcaption>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Eye openness measured across the blink capture')+': '+summary}>
      <line className="blink-threshold" x1={pad} x2={W-pad} y1={y(0.6)} y2={y(0.6)}/>
      {segments.map((points,i)=><polyline key={i} className="blink-wave" points={points.join(' ')} pathLength="1"/>)}
      {blink.closed.map((i,k)=><circle key={i} className="blink-dip" style={{animationDelay:600+k*140+'ms'}} cx={x(i)} cy={y(blink.trace[i])} r="5"/>)}
    </svg>
    <p className="blink-legend"><span>{t('Eyes open')}</span><span>{t('Closed — counted as a blink')}</span></p>
  </figure>;
}

// History-table cell: liveness outcome plus the measured blink count, when the
// session had a blink step.
export function LivenessCell({row}){
  const {t}=useLanguage();
  return <span className="liveness-cell">{t(row.liveness_passed?'Passed':'Not passed')}{row.blink_count!=null&&<span className="liveness-blinks"><Icon name="eye" size={13}/>{row.blink_count} {t(row.blink_count===1?'blink':'blinks')}</span>}</span>;
}

export default function CameraVerification({initial,onComplete,onCancel,agent=false}){
  const {t}=useLanguage();
  const [session,setSession]=useState(initial),[busy,setBusy]=useState(false),[phase,setPhase]=useState('idle'),[count,setCount]=useState(0);
  const [error,setError]=useState(''),[message,setMessage]=useState(''),[tone,setTone]=useState('');
  const [connected,setConnected]=useState(false),[mirrored,setMirrored]=useState(!agent),[accepted,setAccepted]=useState(false),[ageAccepted,setAgeAccepted]=useState(false);
  const [code,setCode]=useState(''),[cameras,setCameras]=useState([]),[device,setDevice]=useState(''),[now,setNow]=useState(Date.now());
  const [blink,setBlink]=useState(null),[progress,setProgress]=useState(0);
  const video=useRef(null),stage=useRef(null),stream=useRef(null),alive=useRef(true),state=useRef(session),cancelTimer=useRef(null);
  state.current=session;
  const endpoint=(action,body)=>API.identity('POST','/sessions/'+state.current.id+'/'+action,body,state.current.token);
  const merge=next=>{state.current={...state.current,...next};setSession(state.current);return state.current;};
  const say=(text,kind='')=>{setMessage(text);setTone(kind);};

  function stop(){stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;if(video.current)video.current.srcObject=null;if(alive.current){setConnected(false);setPhase('idle');}}
  // React StrictMode mounts, unmounts and remounts once in development. Cancelling
  // on the first simulated unmount would kill a live server session, so the cancel
  // is deferred and skipped when the component comes straight back.
  useEffect(()=>{
    alive.current=true;clearTimeout(cancelTimer.current);
    return()=>{alive.current=false;stream.current?.getTracks().forEach(track=>track.stop());cancelTimer.current=setTimeout(()=>{const s=state.current;if(!alive.current&&!TERMINAL.includes(s.state))API.identity('DELETE','/sessions/'+s.id,undefined,s.token).catch(()=>{});},0);};
  },[]);
  // Drives the per-step countdown display.
  useEffect(()=>{if(session.state!=='CAMERA_STARTED')return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[session.state]);

  async function run(fn,{stopCamera=false}={}){
    setBusy(true);setError('');
    try{return await fn();}
    catch(e){if(alive.current){setError(e.message);if(stopCamera)stop();setPhase(connected?'ready':'idle');}return null;}
    finally{if(alive.current)setBusy(false);}
  }
  async function consent(){await run(async()=>merge(await endpoint('consent',{accepted,age_accepted:ageAccepted,policy_version:state.current.policy_version})));}
  async function start(){await run(async()=>{
    if(!window.isSecureContext)throw Error(t('Use localhost or HTTPS to access the camera.'));
    if(!navigator.mediaDevices?.getUserMedia)throw Error(t('This browser cannot access a camera. Choose assisted verification.'));
    stop();say(t('Starting the camera…'));
    let media;
    try{media=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:1280},height:{ideal:720},...(device?{deviceId:{exact:device}}:{facingMode:agent?'environment':'user'})}});}
    catch(e){throw Error(t(({NotAllowedError:'Camera permission was denied. You can allow it in browser settings or choose assisted verification.',NotFoundError:'No camera is available. Use another device or choose assisted verification.',NotReadableError:'The camera is busy or disconnected. Close other camera applications and try again.',OverconstrainedError:'The selected camera is unavailable. Choose another camera.'})[e.name]||'The camera could not start. Choose assisted verification.'));}
    if(!alive.current){media.getTracks().forEach(track=>track.stop());return;}
    stream.current=media;
    const track=media.getVideoTracks()[0],facing=track.getSettings?.().facingMode;
    setMirrored(facing?facing==='user':!agent);
    track.onended=()=>{if(alive.current){setError(t('The camera disconnected. Reconnect it and try again.'));stop();}};
    video.current.srcObject=media;await video.current.play();
    setCameras((await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput'));
    if(state.current.state==='CONSENT_ACCEPTED')merge(await endpoint('camera',{}));
    setConnected(true);setPhase('ready');
    say(t('Camera connected. Place your face inside the oval, then start the step.'));
  },{stopCamera:true});}

  // Re-reads the authoritative session after a conflict, and replaces a timed-out
  // step so the citizen can carry on without restarting the whole verification.
  async function resync(){
    let current=merge(await API.identity('GET','/sessions/'+state.current.id,undefined,state.current.token));
    if(current.state==='CAMERA_STARTED'&&Date.parse(current.challenge.expires_at)<=Date.now()+1500)current=merge(await endpoint('challenge',{}));
    return current;
  }
  async function capture(){await run(async()=>{
    if(!stream.current?.active||video.current.readyState<2)throw Error(t('The camera stream is not ready.'));
    if(Date.parse(state.current.challenge?.expires_at)<=Date.now()+1500){await resync();say(t('This step timed out, so a fresh one was issued.'));}
    if(state.current.state!=='CAMERA_STARTED')return;
    const action=state.current.challenge.action,blinking=action==='BLINK';
    if(blinking)setBlink(null);
    setPhase('countdown');
    for(let n=COUNTDOWN;n>0;n--){if(!alive.current)return;setCount(n);say(t(guidance[action])+' · '+n);await wait(1000);}
    setPhase(blinking?'blinking':'capturing');say(t(blinking?'Blink now — keep blinking until the bar fills…':'Hold still…'));setProgress(0);
    const [width,height]=frameSize(video.current,blinking?BLINK_SIDE:MAX_SIDE),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d'),frames=[],region=verificationArea(stage.current,video.current,mirrored),total=blinking?BLINK_FRAMES:FRAMES,gap=blinking?BLINK_GAP:FRAME_GAP,started=performance.now();
    for(let i=0;i<total;i++){
      if(!alive.current||!stream.current?.active)throw Error(t('Camera capture stopped.'));
      ctx.drawImage(video.current,0,0,width,height);frames.push(canvas.toDataURL('image/jpeg',blinking?0.85:0.88));
      setProgress((i+1)/total);
      // A fixed schedule keeps the blink samples evenly spaced however long encoding takes.
      await wait(Math.max(0,started+(i+1)*gap-performance.now()));
    }
    setPhase('checking');say(t(blinking?'Measuring eyelid movement across the sequence on the server…':'Checking image quality and the movement on the server…'));
    const slow=setTimeout(()=>{if(alive.current)say(t('Preparing the face models. The first check can take a little longer…'));},3500);
    let next;
    try{next=await endpoint('frames',{nonce:state.current.challenge.nonce,frames,region});}
    catch(e){if(e.status===409){await resync();throw Error(t('That step expired or changed. A fresh step is ready; please try again.'));}throw e;}
    finally{clearTimeout(slow);frames.length=0;}
    if(!alive.current)return;
    const passed=next.accepted&&next.feedback!=='FACE_NOT_MATCHED',{blink:measured,...rest}=next;
    if(measured)setBlink(measured);
    merge(rest);
    if(next.state!=='CAMERA_STARTED'){stop();say(t(passed?'All camera steps are complete.':feedback[next.feedback]||'Verification could not be completed.'),passed?'ok':'warn');return;}
    setPhase(passed?'success':'retry');
    const accepted=measured?t('Blink check passed')+': '+measured.count+' '+t('blinks detected')+'. '+t('Follow the next instruction.'):t(next.feedback==='EXPOSURE_CORRECTED'?feedback.EXPOSURE_CORRECTED:'Step accepted. Follow the next instruction.');
    say(passed?accepted:t(feedback[next.feedback]||'Please try this step again.'),passed?'ok':'warn');
    await wait(900);if(alive.current)setPhase('ready');
  });}
  async function verifyCode(action){await run(async()=>{merge(await endpoint(action,{code}));setCode('');});}
  async function finish(){await run(async()=>{stop();const result=await endpoint('complete',{});merge({...result,state:'COMPLETED'});onComplete?.(result);});}
  function cancel(){stop();merge({state:'CANCELLED'});API.identity('DELETE','/sessions/'+state.current.id,undefined,state.current.token).catch(()=>{});onCancel?.();}

  const challenge=session.challenge,total=challenge?.total||4,secondsLeft=challenge?Math.max(0,Math.round((Date.parse(challenge.expires_at)-now)/1000)):0;
  const attemptsLeft=session.max_attempts!=null?Math.max(0,session.max_attempts-(session.attempts||0)):null;
  const camera=['CONSENT_ACCEPTED','CAMERA_STARTED'].includes(session.state),working=busy&&['countdown','capturing','blinking','checking'].includes(phase);
  const steps=[t('Consent'),t('Camera check'),t('Confirm')],flow=flowStep(session.state);

  return <div className="camera-verification" data-phase={phase}>
    <ol className="cv-flow" aria-label={t('Verification progress')}>{steps.map((label,i)=><li key={label} className={i<flow||session.state==='COMPLETED'?'is-done':i===flow?'is-current':''} aria-current={i===flow?'step':undefined}><span className="cv-flow-dot">{i<flow?<Icon name="check" size={14}/>:i+1}</span>{label}</li>)}</ol>
    {error&&<Alert type="danger">{error}</Alert>}

    {session.state==='ACCOUNT_IDENTIFIED'&&<section className="cv-consent">
      <h3>{t('Before we use your camera')}</h3>
      <ul className="cv-facts">
        <li><Icon name="scanFace"/><span>{t('Your face will be compared only with the account you claimed. A broad age-consistency signal supports the review; it does not prove identity.')}</span></li>
        <li><Icon name="lock"/><span>{t('Synthetic AMAP identity only. Webcam verification is not certified biometric hardware. Raw frames are processed temporarily and are not stored as video.')}</span></li>
        <li><Icon name="clock"/><span>{t('It takes about a minute: a few short steps (look ahead, turn or move, and blink), with a countdown before each one.')}</span></li>
        <li><Icon name="eye"/><span>{t('The blink check asks you to blink a few times. The server measures your eyelids moving, which a printed photo or a still image cannot do.')}</span></li>
      </ul>
      <label className="check"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>{t('I consent to temporary face processing and protected template storage when enrolling.')}</span></label>
      <label className="check"><input type="checkbox" checked={ageAccepted} onChange={e=>setAgeAccepted(e.target.checked)}/><span>{t('I consent to age-consistency processing under policy')} {session.policy_version}.</span></label>
      <Button busy={busy} disabled={!accepted||!ageAccepted} onClick={consent} icon="arrowRight">{t('Accept and continue')}</Button>
    </section>}

    {camera&&<section className="cv-camera">
      <div ref={stage} className={'camera-stage'+(mirrored?' is-mirrored':'')+(connected?' is-live':'')} data-phase={phase} data-action={challenge?.action||''}>
        <video ref={video} muted playsInline aria-label={t('Live camera preview')}/>
        <svg className="camera-guide" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><mask id="cv-oval"><rect width="400" height="300" fill="#fff"/><ellipse cx="200" cy="146" rx="84" ry="108" fill="#000"/></mask></defs><rect className="guide-shade" width="400" height="300" mask="url(#cv-oval)"/><ellipse className="guide-ring" cx="200" cy="146" rx="84" ry="108"/></svg>
        {!connected&&<div className="camera-placeholder"><Icon name="camera" size={34}/><p>{t('Camera is off')}</p><small>{t('Good light on your face, nothing covering it, and a plain background help.')}</small></div>}
        {connected&&challenge&&<div className="camera-hud"><span className="hud-chip">{t('Step')} {challenge.step} / {challenge.total}</span>{secondsLeft>0&&<span className={'hud-chip'+(secondsLeft<=30?' is-warn':'')}><Icon name="clock" size={14}/>{Math.floor(secondsLeft/60)}:{String(secondsLeft%60).padStart(2,'0')}</span>}</div>}
        {connected&&phase==='countdown'&&<div className="camera-cue" aria-hidden="true"><span className="cue-arrow"><Icon name={{LEFT:'arrowLeft',RIGHT:'arrowRight',CLOSER:'zoomIn',FORWARD:'scanFace',BLINK:'eye'}[challenge?.action]||'scanFace'} size={30}/></span><b key={count}>{count}</b></div>}
        {connected&&phase==='blinking'&&<div className="camera-cue is-blink" aria-hidden="true">
          <span className="blink-cue"><svg className="blink-eye" viewBox="0 0 80 48"><g className="blink-lid"><path className="blink-eye-white" d="M6 24C18 7 62 7 74 24C62 41 18 41 6 24Z"/><circle className="blink-eye-iris" cx="40" cy="24" r="10.5"/><circle className="blink-eye-pupil" cx="40" cy="24" r="4.5"/></g></svg><span>{t('Blink')} · {t('Blink')} · {t('Blink')}</span></span>
          <span className="blink-progress"><span style={{transform:`scaleX(${progress})`}}/></span>
        </div>}
        {connected&&['capturing','checking'].includes(phase)&&<div className="camera-cue is-quiet" aria-hidden="true"><span className="spinner"/></div>}
        {connected&&phase==='success'&&<div className="camera-cue is-ok" aria-hidden="true"><Icon name="check" size={40}/></div>}
      </div>
      {challenge&&<ol className="cv-steps" style={{'--steps':total}} aria-label={t('Camera steps')}>{Array.from({length:total},(_,i)=>{const step=i+1,current=step===challenge.step;return <li key={i} className={step<challenge.step?'is-done':current?'is-current':''}><span/>{current?t(shortLabel[challenge.action]):step<challenge.step?t('Done'):t('Step')+' '+step}</li>;})}</ol>}
      {challenge&&<p className="camera-instruction">{t(guidance[challenge.action])}</p>}
      {cameras.length>1&&<Field label={t('Camera')} as="select" value={device} onChange={e=>{stop();setDevice(e.target.value);}}>{cameras.map((c,i)=><option key={c.deviceId} value={c.deviceId}>{c.label||t('Camera')+' '+(i+1)}</option>)}</Field>}
      <div className="cv-actions">
        <Button busy={working} disabled={busy} className="btn-lg" icon={connected?'scanFace':'camera'} onClick={connected?capture:start}>{t(connected?'Start this step':'Start camera')}</Button>
        {connected&&<Button variant="ghost" disabled={working} onClick={stop}>{t('Stop camera')}</Button>}
      </div>
      {attemptsLeft!=null&&attemptsLeft<=6&&<p className="hint">{attemptsLeft} {t('retries left before assisted verification is required.')}</p>}
    </section>}
    {blink&&!['FAILED','BLOCKED','EXPIRED','CANCELLED'].includes(session.state)&&<BlinkSignature blink={blink} t={t}/>}

    <p role="status" aria-live="polite" className={'cv-status'+(message?' is-on':'')+(tone?' is-'+tone:'')}>{message}</p>

    {session.state==='MFA_REQUIRED'&&<form className="cv-panel" onSubmit={e=>{e.preventDefault();verifyCode('mfa');}}><Alert>{t('Complete verification with your authenticator or a single-use recovery code.')}</Alert><Field label={t('Authenticator or recovery code')} value={code} onChange={e=>setCode(e.target.value)} required autoComplete="one-time-code" inputMode="text"/><Button busy={busy} type="submit">{t('Verify code')}</Button></form>}
    {session.state==='ADDITIONAL_VERIFICATION_REQUIRED'&&<div className="cv-panel"><Alert>{t('More assurance is needed. Use a recovery code sent to your registered email, or request assisted verification.')}</Alert><Button variant="outline" busy={busy} onClick={()=>run(async()=>{const r=await endpoint('send-code',{});say(r.message);})}>{t('Prepare email code')}</Button><form onSubmit={e=>{e.preventDefault();verifyCode('additional');}}><Field label={t('Email recovery code')} value={code} onChange={e=>setCode(e.target.value)} required autoComplete="one-time-code"/><Button busy={busy} type="submit">{t('Verify recovery code')}</Button></form></div>}
    {session.state==='VERIFIED'&&<div className="cv-result is-ok"><span className="cv-result-icon"><Icon name="checkCircle" size={34}/></span><div><h3>{t('Checks passed')}</h3><p>{t('The server accepted the verification evidence. Complete the request to save enrollment or retrieve your masked sandbox identity.')}</p><Button busy={busy} className="mt-4" onClick={finish}>{t('Complete verification')}</Button></div></div>}
    {['FAILED','BLOCKED','EXPIRED'].includes(session.state)&&<div className="cv-result is-warn"><span className="cv-result-icon"><Icon name="alert" size={30}/></span><div><h3>{t('This attempt could not complete')}</h3><p>{t('Start a new attempt or use assisted verification.')}</p><Button variant="outline" className="mt-4" onClick={cancel} icon="refresh">{t('Start a new attempt')}</Button></div></div>}

    <div className="camera-fallback"><Button variant="ghost" disabled={busy} onClick={cancel}>{t('Cancel')}</Button><Link to="/identity/appointments">{t('Request in-person verification / visit a center')}</Link><p className="hint">{t('No usable camera? Try another device. If you cannot sign in, password recovery can restore access before booking assistance.')}</p></div>
  </div>;
}
