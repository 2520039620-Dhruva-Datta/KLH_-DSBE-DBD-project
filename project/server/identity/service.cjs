'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {pool,rows,transaction,normalize}=require('../db.cjs'),V=require('../validation.cjs'),S=require('../security.cjs'),R=require('../repository.cjs'),{config}=require('../config.cjs');
const C=require('./crypto.cjs'),B=require('./biometrics.cjs'),Auth=require('./auth.cjs'),MFA=require('./mfa.cjs'),Risk=require('./risk.cjs'),Audit=require('./audit.cjs'),{provider}=require('./providers.cjs');
const POLICY='2026-09-28',MAX_ATTEMPTS=12,terminal=['FAILED','EXPIRED','BLOCKED','CANCELLED','COMPLETED'];
const publicState=s=>({id:s.id,state:s.state,kind:s.kind,expires_at:s.expires_at,attempts:s.attempts,max_attempts:MAX_ATTEMPTS,challenge:s.state==='CAMERA_STARTED'?{action:s.challenge.actions[s.challenge.index],nonce:s.challenge.nonce,step:s.challenge.index+1,total:s.challenge.actions.length,expires_at:new Date(s.challenge.expires).toISOString()}:null,age_consistency:s.age_consistency,provider:'sandbox'});
async function get(req,c=pool,lock=false){const token=String(req.get('X-Identity-Token')||req.body?.token||'');if(!/^[a-f0-9]{64}$/.test(token))V.fail('This recovery session is unavailable.',404);const [s]=await rows(c,'SELECT * FROM identity_verification_sessions WHERE id=? AND token_hash=?'+(lock?' FOR UPDATE':''),[req.params.id,C.hash(token)]);if(!s||s.device_hash!==C.hash(req.deviceToken)||s.bound_session_hash&&s.bound_session_hash!==C.hash(req.sessionToken||''))V.fail('This recovery session is unavailable.',404);if(s.kind==='ASSISTED'){const [m]=await rows(c,'SELECT enabled FROM mfa_methods WHERE user_id=?',[req.user?.id||0]);if(!req.sessionRow?.mfa_verified||!m?.enabled)V.fail('Active MFA is required for the assisted visit.',403);const [valid]=await rows(c,"SELECT a.id FROM verification_appointments a JOIN agent_devices d ON d.id=a.agent_device_id JOIN verification_agents ag ON ag.user_id=a.agent_id WHERE a.verification_session_id=? AND a.agent_id=? AND a.status='VERIFICATION_STARTED' AND d.status='APPROVED' AND d.device_hash=? AND ag.status='APPROVED' AND ag.authorized_until>=UTC_DATE()",[s.id,req.user?.id||0,C.hash(req.deviceToken)]);if(!valid)V.fail('The assisted visit or device is no longer authorized.',403);}if(new Date(s.expires_at)<new Date()&&!terminal.includes(s.state)){await c.execute("UPDATE identity_verification_sessions SET state='EXPIRED',evidence_cipher=NULL WHERE id=?",[s.id]);s.state='EXPIRED';}return s;}
function expect(s,...states){if(!states.includes(s.state))V.fail('This action is not available in the current verification state.',409);}
async function start(req){const d=V.fields(req.body,['kind','email','dob']),kind=d.kind||'RECOVERY';if(!['ENROLLMENT','VERIFICATION','RECOVERY'].includes(kind))V.fail('Invalid verification type.');let u=req.user;
 if(kind!=='RECOVERY'){if(!u||u.role!=='citizen')V.fail('Sign in as a citizen to manage face enrollment.',401);Auth.recent(req);if(kind==='ENROLLMENT'){const dob=V.date(d.dob);if(dob>new Date().toISOString().slice(0,10)||new Date(dob).getUTCFullYear()<1900)V.fail('Enter a valid synthetic date of birth.');await provider().ensure(pool,u.id,dob);}}
 else{const email=V.email(d.email);[u]=await rows(pool,"SELECT * FROM users WHERE email=? AND role='citizen' AND active=TRUE",[email]);}
 const id=crypto.randomUUID(),token=C.token(),risk=u?await Auth.signals(req,u.id):{level:'LOW',reasons:[]};
 req.risk=risk;await transaction(async c=>{await c.execute('INSERT INTO identity_verification_sessions(id,token_hash,user_id,actor_id,kind,device_hash,bound_session_hash,challenge,expires_at,risk_level,risk_reasons) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[id,C.hash(token),u?.id||null,req.user?.id||null,kind,C.hash(req.deviceToken),kind==='RECOVERY'?null:C.hash(req.sessionToken),JSON.stringify(B.challenges()),new Date(Date.now()+10*60000),risk.level,JSON.stringify(risk.reasons)]);await c.execute("UPDATE identity_verification_sessions SET state='ACCOUNT_IDENTIFIED' WHERE id=?",[id]);await Audit.event(req,'IDENTITY_RECOVERY_STARTED','INFO',{kind},c,u?.id);});
 return {id,token,state:'ACCOUNT_IDENTIFIED',policy_version:POLICY,expires_in:600,notice:'Synthetic identity only. AMAP does not access UIDAI.'};
}
async function consent(req){const s=await get(req);expect(s,'ACCOUNT_IDENTIFIED');V.fields(req.body,['accepted','age_accepted','policy_version']);if(req.body.accepted!==true||req.body.age_accepted!==true||req.body.policy_version!==POLICY)V.fail('Accept the current face and age-processing consent to continue.');await transaction(async c=>{const locked=await get(req,c,true);expect(locked,'ACCOUNT_IDENTIFIED');if(locked.user_id)for(const type of [locked.kind==='ENROLLMENT'?'FACE_ENROLLMENT':'FACE_VERIFICATION','AGE_CONSISTENCY'])await c.execute('INSERT INTO consent_records(user_id,type,policy_version) VALUES(?,?,?)',[locked.user_id,type,POLICY]);await c.execute("UPDATE identity_verification_sessions SET state='CONSENT_ACCEPTED' WHERE id=?",[s.id]);await Audit.event(req,'CONSENT_ACCEPTED','SUCCESS',{policy:POLICY},c,s.user_id);});return {state:'CONSENT_ACCEPTED'};}
async function camera(req){const s=await get(req);expect(s,'CONSENT_ACCEPTED');if(!B.health().installed)V.fail('Face models are unavailable. Choose assisted verification.',503);B.warm();const challenge=B.challenges();await pool.execute("UPDATE identity_verification_sessions SET state='CAMERA_STARTED',challenge=? WHERE id=? AND state='CONSENT_ACCEPTED'",[JSON.stringify(challenge),s.id]);await Audit.event(req,'CAMERA_VERIFICATION_STARTED','INFO',{},pool,s.user_id);return publicState({...s,state:'CAMERA_STARTED',challenge});}
const emptyEvidence=()=>({frames:[],frontal:[],reference:null,hashes:[],ages:[],baseline:0});
const nextChallenge=challenge=>({...challenge,nonce:crypto.randomBytes(24).toString('hex'),expires:Date.now()+B.CHALLENGE_MS});
// Only failed captures and refreshed (expired) steps use up attempts; completing a
// step never does, so a citizen always gets the full retry budget.
async function failStep(c,req,s,locked,code,good){
 const attempts=locked.attempts+1,next=attempts>=MAX_ATTEMPTS?'FAILED':'CAMERA_STARTED',challenge=nextChallenge(locked.challenge);
 await c.execute('UPDATE identity_verification_sessions SET state=?,attempts=?,challenge=?,evidence_cipher=IF(?=\'FAILED\',NULL,evidence_cipher) WHERE id=?',[next,attempts,JSON.stringify(challenge),next,s.id]);
 await Audit.event(req,good>=3?'LIVENESS_FAILED':'FACE_QUALITY_FAILED','FAILURE',{reason:code},c,s.user_id);
 return {...locked,state:next,attempts,challenge,feedback:code,accepted:false};
}
async function capture(req){
 V.fields(req.body,['nonce','frames','region']);const region=B.area(req.body.region),s=await get(req);expect(s,'CAMERA_STARTED');
 if(s.attempts>=MAX_ATTEMPTS)V.fail('Choose assisted verification after repeated failed attempts.',429);
 if(req.body.nonce!==s.challenge.nonce)V.fail('This camera step changed. Refresh the verification to continue.',409);
 if(Date.now()>s.challenge.expires)V.fail('This camera step timed out. Refresh the step to continue.',409);
 const action=s.challenge.actions[s.challenge.index],blinking=action==='BLINK',[fewest,most]=blinking?B.BLINK.frames:[3,5];
 if(!Array.isArray(req.body.frames)||req.body.frames.length<fewest||req.body.frames.length>most)V.fail(blinking?'Capture a short blink sequence of '+fewest+' to '+most+' frames.':'Capture three to five frames for this challenge.');
 const hashes=req.body.frames.map(f=>C.hash(f)),seen=s.evidence_cipher?C.open(s.evidence_cipher).hashes:[];
 if(new Set(hashes).size!==hashes.length||hashes.some(h=>seen.includes(h)))V.fail('Repeated image detected. Use a live camera sequence.',400);
 const analyzed=await B.analyze(req.body.frames,region),results=analyzed.results||[],good=results.filter(r=>r.ok);
 // The blink step is judged on the whole sequence, in capture order.
 const blink=blinking&&!analyzed.code?B.blinks(results):null;
 const state=await transaction(async c=>{
  const locked=await get(req,c,true);expect(locked,'CAMERA_STARTED');
  if(locked.challenge.nonce!==req.body.nonce)V.fail('This challenge has already been used.',409);
  const old={...emptyEvidence(),...(locked.evidence_cipher?C.open(locked.evidence_cipher):{})};
  // Sessions started before frontal tracking stored no reference; their first frame is frontal.
  const reference=old.reference||old.frames[0];
  let code=analyzed.code;
  // A blink sequence tolerates a few unusable frames (motion blur mid-blink); a pose step does not.
  if(!code)code=blinking?(good.length<results.length*0.75?results.find(r=>!r.ok)?.code:null):results.find(r=>!r.ok)?.code;
  if(!code&&blinking&&blink.count<B.BLINK.required)code='BLINK_NOT_SEEN';
  if(!code&&!blinking&&!(good.length>=3&&B.actionPassed(action,good,old.baseline)))code='FOLLOW_CHALLENGE';
  // A different face at any step cannot satisfy the current challenge sequence.
  if(!code&&reference&&!good.every(r=>B.continuous(r.embedding,reference,action)))code='FACE_CHANGED';
  if(code)return failStep(c,req,s,locked,code,good.length);
  // Evidence from a blink sequence comes only from its open-eye frames.
  const open=blinking?good.filter(r=>blink.trace[results.indexOf(r)]>=B.BLINK.open):good;
  const best=(open.length>=3?open:good).sort((a,b)=>b.quality-a.quality).slice(0,3),challenge=nextChallenge(locked.challenge);
  if(blinking){old.blinks=blink.count;await c.execute('UPDATE identity_verification_sessions SET blink_count=? WHERE id=?',[blink.count,s.id]);await Audit.event(req,'BLINK_LIVENESS_PASSED','SUCCESS',{blinks:blink.count},c,s.user_id);}
  old.frames.push(...best.map(r=>r.embedding));
  old.frontal.push(...best.filter(r=>Math.abs(r.yaw)<B.FRONTAL_YAW).map(r=>r.embedding));
  old.hashes.push(...hashes);old.ages.push(...best.map(r=>r.age_range).filter(Boolean));
  if(!old.reference)old.reference=B.mean(best.map(r=>r.embedding));
  if(!old.baseline)old.baseline=best.reduce((n,r)=>n+r.size,0)/best.length;
  challenge.index++;
  const feedback=best.some(r=>r.preprocessed)?'EXPOSURE_CORRECTED':'ACCEPTED';
  if(challenge.index<challenge.actions.length){await c.execute('UPDATE identity_verification_sessions SET challenge=?,evidence_cipher=?,quality_passed=TRUE WHERE id=?',[JSON.stringify(challenge),C.seal(old),s.id]);return {...locked,challenge,feedback,accepted:true};}
  await c.execute("UPDATE identity_verification_sessions SET state='LIVENESS_PASSED',liveness_passed=TRUE,quality_passed=TRUE WHERE id=?",[s.id]);await Audit.event(req,'LIVENESS_PASSED','SUCCESS',{},c,s.user_id);
  const [profile]=s.user_id?await rows(c,'SELECT * FROM identity_profiles WHERE user_id=?',[s.user_id]):[],[template]=s.user_id?await rows(c,'SELECT * FROM face_templates WHERE user_id=?',[s.user_id]):[];
  const probe=old.frontal.length>=3?old.frontal:old.frames,facePassed=!!profile&&(s.kind==='ENROLLMENT'||!!template&&B.matches(probe,C.open(template.template_cipher)));
  let age='UNCERTAIN';if(profile&&old.ages.length){const ageYears=(Date.now()-new Date(profile.dob).getTime())/(365.2425*86400000);if(old.ages.filter(([lo,hi])=>ageYears>=lo-5&&ageYears<=hi+5).length>=Math.ceil(old.ages.length/2))age='CONSISTENT';}
  if(facePassed){await c.execute("UPDATE identity_verification_sessions SET state='FACE_VERIFIED',face_passed=TRUE,age_consistency=? WHERE id=?",[age,s.id]);await Audit.event(req,'FACE_VERIFIED','SUCCESS',{},c,s.user_id);}else await Audit.event(req,'FACE_REJECTED','FAILURE',{},c,s.user_id);
  await Audit.event(req,age==='CONSISTENT'?'AGE_CONSISTENCY_PASSED':'AGE_CONSISTENCY_UNCERTAIN','INFO',{},c,s.user_id);
  const [m]=s.user_id?await rows(c,'SELECT enabled FROM mfa_methods WHERE user_id=?',[s.user_id]):[],[device]=s.user_id?await rows(c,'SELECT trusted FROM trusted_devices WHERE user_id=? AND token_hash=? AND revoked_at IS NULL',[s.user_id,C.hash(req.deviceToken)]):[];
  let next=s.kind==='ENROLLMENT'&&facePassed?'VERIFIED':Risk.policy({quality:true,liveness:true,face:facePassed,risk:s.risk_level,age,trusted:!!device?.trusted,mfaEnrolled:!!m?.enabled,mfa:false,assisted:s.kind==='ASSISTED'});if(next==='REJECTED')next='FAILED';if(next==='IN_PERSON_VERIFICATION_REQUIRED')next='ADDITIONAL_VERIFICATION_REQUIRED';
  await c.execute('UPDATE identity_verification_sessions SET state=?,evidence_cipher=?,age_consistency=? WHERE id=?',[next,next==='FAILED'?null:C.seal(old),age,s.id]);
  return {...locked,state:next,age_consistency:age,feedback:facePassed?feedback:'FACE_NOT_MATCHED',accepted:true};
 });
 // The blink trace is relative eye openness per frame (no image data), shown to the
 // citizen as feedback; null marks frames the model could not use.
 return {...publicState(state),accepted:state.accepted,feedback:state.feedback||state.state,...(blink&&{blink:{count:blink.count,required:blink.required,trace:blink.trace,closed:blink.closed}})};
}
// Issues a fresh nonce for the current step after it timed out (for example while
// the citizen repositioned a phone). A live step is returned unchanged, which lets
// a client that lost a response resynchronise without spending an attempt.
async function refresh(req){
 const s=await get(req);expect(s,'CAMERA_STARTED');
 if(Date.now()<=s.challenge.expires)return publicState(s);
 return publicState(await transaction(async c=>{
  const locked=await get(req,c,true);expect(locked,'CAMERA_STARTED');
  if(Date.now()<=locked.challenge.expires)return locked;
  const attempts=locked.attempts+1,next=attempts>=MAX_ATTEMPTS?'FAILED':'CAMERA_STARTED',challenge=nextChallenge(locked.challenge);
  await c.execute('UPDATE identity_verification_sessions SET state=?,attempts=?,challenge=?,evidence_cipher=IF(?=\'FAILED\',NULL,evidence_cipher) WHERE id=?',[next,attempts,JSON.stringify(challenge),next,s.id]);
  await Audit.event(req,'CAMERA_CHALLENGE_REFRESHED','INFO',{},c,s.user_id);
  return {...locked,state:next,attempts,challenge};
 }));
}
async function mfa(req){const s=await get(req);expect(s,'MFA_REQUIRED');if(!s.user_id)V.fail('Verification unavailable.',400);await pool.execute('UPDATE identity_verification_sessions SET attempts=attempts+1 WHERE id=?',[s.id]);if(s.attempts>=16)V.fail('Too many verification attempts.',429);try{await transaction(async c=>{const locked=await get(req,c,true);expect(locked,'MFA_REQUIRED');const method=await MFA.verify(c,s.user_id,req.body.code);await c.execute("UPDATE identity_verification_sessions SET state='MFA_VERIFIED',mfa_passed=TRUE WHERE id=?",[s.id]);await Audit.event(req,method==='RECOVERY_CODE'?'RECOVERY_CODE_USED':'MFA_VERIFIED','SUCCESS',{},c,s.user_id);const next=s.risk_level==='LOW'?'VERIFIED':'ADDITIONAL_VERIFICATION_REQUIRED';await c.execute('UPDATE identity_verification_sessions SET state=? WHERE id=?',[next,s.id]);});}catch(e){await Audit.event(req,'MFA_FAILED','FAILURE',{},pool,s.user_id);throw e;}return publicState(await get(req));}
async function sendAdditional(req){const s=await get(req);expect(s,'ADDITIONAL_VERIFICATION_REQUIRED');if(s.risk_level!=='LOW'||!s.user_id||!s.face_passed||!s.liveness_passed)V.fail('Please use assisted verification for this recovery.',409);if(config.production)V.fail('Email delivery must be configured. Assisted verification remains available.',503);const code=crypto.randomBytes(8).toString('hex').toUpperCase();await pool.execute('INSERT INTO auth_challenges(token_hash,user_id,purpose,device_hash,expires_at) VALUES(?,?,?,?,?)',[C.hash(s.id+code),s.user_id,'RECOVERY_EMAIL',s.device_hash,new Date(Date.now()+5*60000)]);const [u]=await rows(pool,'SELECT email FROM users WHERE id=?',[s.user_id]);const dir=path.join(config.root,'.runtime/outbox');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,crypto.randomUUID()+'.json'),JSON.stringify({to:u.email,subject:'Additional sandbox recovery verification',session:s.id,code,expires_minutes:5}),{mode:0o600});return {message:'A local development message has been prepared. No external email was sent.'};}
async function additional(req){const s=await get(req);expect(s,'ADDITIONAL_VERIFICATION_REQUIRED');if(s.risk_level!=='LOW'||s.attempts>=18)V.fail('Use assisted verification for this request.',409);await pool.execute('UPDATE identity_verification_sessions SET attempts=attempts+1 WHERE id=?',[s.id]);await transaction(async c=>{const locked=await get(req,c,true);expect(locked,'ADDITIONAL_VERIFICATION_REQUIRED');const [r]=await rows(c,"SELECT * FROM auth_challenges WHERE token_hash=? AND user_id=? AND purpose='RECOVERY_EMAIL' FOR UPDATE",[C.hash(s.id+String(req.body.code).toUpperCase()),s.user_id]);if(!r||r.used_at||new Date(r.expires_at)<new Date()||r.device_hash!==s.device_hash)V.fail('This verification code is invalid or expired.');const [m]=await rows(c,'SELECT enabled FROM mfa_methods WHERE user_id=?',[s.user_id]);if(m?.enabled&&!s.mfa_passed)V.fail('Complete authenticator verification first.',409);await c.execute('UPDATE auth_challenges SET used_at=UTC_TIMESTAMP(3) WHERE token_hash=?',[r.token_hash]);await c.execute("UPDATE identity_verification_sessions SET state='VERIFIED' WHERE id=?",[s.id]);});return {state:'VERIFIED'};}
async function complete(req){return transaction(async c=>{const s=await get(req,c,true);expect(s,'VERIFIED');if(s.consumed_at||!s.user_id||!s.face_passed||!s.liveness_passed)V.fail('Verification cannot be completed.',409);const evidence=C.open(s.evidence_cipher);if(s.kind==='ENROLLMENT'){const template=B.mean(evidence.frontal?.length>=3?evidence.frontal:evidence.frames);await c.execute('INSERT INTO face_templates(user_id,template_cipher,model) VALUES(?,?,?) ON DUPLICATE KEY UPDATE template_cipher=VALUES(template_cipher),model=VALUES(model),enrolled_at=UTC_TIMESTAMP(3)',[s.user_id,C.seal(template),'opencv-sface-2021dec']);}
 await c.execute("UPDATE identity_profiles SET status='VERIFIED',last_verified_at=UTC_TIMESTAMP(3) WHERE user_id=?",[s.user_id]);await c.execute("UPDATE identity_verification_sessions SET state='COMPLETED',consumed_at=UTC_TIMESTAMP(3),evidence_cipher=NULL WHERE id=?",[s.id]);await Audit.event(req,s.kind==='ENROLLMENT'?'FACE_ENROLLED':'IDENTITY_RECOVERY_COMPLETED','SUCCESS',{method:s.kind},c,s.user_id);await R.notify(c,s.user_id,null,'Identity verification completed','A sandbox identity verification was completed. Review Digital Identity if this was not you.');return s.kind==='ASSISTED'?{state:'COMPLETED',provider:'sandbox'}:{state:'COMPLETED',...await provider().result(c,s.user_id)};});}
module.exports={POLICY,start,get,publicState,expect,consent,camera,capture,refresh,mfa,sendAdditional,additional,complete};
