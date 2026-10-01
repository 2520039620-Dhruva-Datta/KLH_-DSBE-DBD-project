'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const B=require('../server/identity/biometrics.cjs'),{report}=require('./live-support.cjs');
(async()=>{let checks=0;const f=JSON.parse(fs.readFileSync(path.join(__dirname,'../.test-tools/identity/face-inputs.json'),'utf8')),results={};try{
 for(const key of ['FORWARD','LEFT','RIGHT','CLOSER','WRONG','BLACK','BLUR','MULTIPLE','CROWDED','BYSTANDER','DIM45','DIM50','DIM55','DIM60']){
  const r=await B.analyze(f[key].slice(0,3));results[key]=r.results;
 }
 function check(v,message){checks++;assert.ok(v,message);}
 for(const action of ['FORWARD','LEFT','RIGHT','CLOSER'])check(B.actionPassed(action,results[action],results.FORWARD[0].size),'Measured pose: '+action);
 check(results.FORWARD.every(r=>r.ok&&Array.isArray(r.age_range)&&r.age_range.length===2),'Age model must actually load');
 check(!B.matches(results.WRONG.map(r=>r.embedding),B.mean(results.FORWARD.map(r=>r.embedding))),'Different fictional person is rejected');
 check(results.BLACK.every(r=>!r.ok),'Black frames rejected');check(results.BLUR.every(r=>!r.ok),'Blurry frames rejected');check(results.MULTIPLE.every(r=>!r.ok),'Faces outside the oval are not accepted');check(results.CROWDED.every(r=>r.code==='MULTIPLE_FACES'),'Two faces inside the oval are rejected');check(results.BYSTANDER.every(r=>r.ok&&B.cosine(r.embedding,B.mean(results.FORWARD.map(x=>x.embedding)))>0.9),'A bystander outside the oval is ignored and the subject is measured');const wide=(await B.analyze(f.BYSTANDER.slice(0,3),{cx:.5,cy:.5,rx:.5,ry:.6})).results;check(wide.every(r=>r.code==='MULTIPLE_FACES'),'The area decides: the same bystander inside a wider area counts');
 check(['DIM45','DIM50','DIM55','DIM60'].some(k=>results[k].some(r=>r.ok&&r.preprocessed)),'Bounded exposure correction is exercised on actual model inputs');
 // Blink liveness on actual face-mesh inference: synthetic eyelids close and reopen.
 const blink=(await B.analyze(f.BLINK)).results,stare=(await B.analyze(f.STARE)).results,closed=(await B.analyze(f.CLOSED.slice(0,3))).results;
 check(results.FORWARD.every(r=>r.eyes>0.25),'open eyes measured');check(closed.every(r=>r.ok&&r.eyes<0.15),'closed eyelids measured');
 check(B.blinks(blink).count===3,'three blinks in the blink sequence');check(B.blinks(stare).count===0,'no blink in a staring sequence');
 check(closed.every(r=>B.continuous(r.embedding,B.mean(results.FORWARD.map(x=>x.embedding)),'BLINK')),'closed-eye frames stay the same person');
 results.BLINK=blink;
 const safe=Object.fromEntries(Object.entries(results).map(([key,rs])=>[key,rs.map(({embedding,...r})=>r)]));
 report('identity-model-inference.json',{passed:true,checks,results:safe,scope:'AI-generated fictional test portraits; no physical-camera or real-population accuracy claim'});
 console.log('PASS real face-model inference:',checks,'checks');
 }finally{B.stop();}})().catch(e=>{console.error(e);process.exitCode=1;});
