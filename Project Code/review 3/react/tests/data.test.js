import test from 'node:test';
import assert from 'node:assert/strict';
import {generateSeed} from '../src/data/seed.js';
import Store from '../src/data/store.js';
import API from '../src/data/api.js';
API.LATENCY=0;
const signIn=async(role)=>{const account=role.toLowerCase();const session=await API.auth.login(account+'@demo.gov',account+'123',role);API.token=session.token;return session.user;};
test('seed is deterministic, referentially complete and never future dated',()=>{
  const anchor=Date.UTC(2026,8,10,12),a=generateSeed(anchor),b=generateSeed(anchor);
  assert.deepEqual(a,b);assert.ok(a.applications.length>=346);assert.equal(a.services.length,26);
  for(const row of a.applications){assert.ok(a.users.some(u=>u.id===row.user_id));assert.ok(a.services.some(s=>s.id===row.service_id));assert.ok(Date.parse(row.submitted_at)<=anchor);assert.ok(a.status_logs.some(l=>l.application_id===row.id));}
});
test('application lifecycle, assignment, privacy, notifications and SLA snapshots',async()=>{
  Store.reset();const citizen=await signIn('CITIZEN');
  const doc={name:'Identity proof',file_name:'identity.png',mime:'image/png',size_kb:0.07,content:'data:image/png;base64,iVBORw0KGgo='};
  const application=await API.applications.create({service_id:1,subject:'Lifecycle verification',documents:[doc],form_data:{email:citizen.email}});
  const tracking=await API.applications.track(application.ref);const publicJSON=JSON.stringify(tracking);
  assert.ok(!publicJSON.includes(citizen.full_name));assert.ok(!publicJSON.includes(citizen.email));assert.ok(!publicJSON.includes('citizen123'));assert.equal(tracking.status,'SUBMITTED');
  const officer=await signIn('OFFICER');await assert.rejects(API.applications.transition(application.id,'APPROVED',officer,'Documents checked and confirmed to be complete.'),/transition|cannot|review|Take up/i);
  await API.applications.assign([application.id],officer.id,'Assigned for careful review of supporting documents.');
  assert.equal((await API.applications.get(application.id)).status,'SUBMITTED');
  await API.applications.transition(application.id,'UNDER_REVIEW',officer,'Taking up the submitted application for document review.');
  await API.applications.transition(application.id,'NEEDS_INFO',officer,'Please provide a clear copy of your supporting address proof.');
  await signIn('CITIZEN');await API.applications.transition(application.id,'UNDER_REVIEW',citizen,'I have clarified the requested details for your review.');
  await signIn('OFFICER');await API.applications.transition(application.id,'APPROVED',officer,'All documents are verified and the application meets the requirements.');
  assert.ok((await API.applications.get(application.id)).decided_at);
  await assert.rejects(API.applications.transition(application.id,'REJECTED',officer,'This must not modify a completed application.'),/closed|transition|cannot/i);
  await signIn('CITIZEN');assert.ok((await API.notifications.list(citizen.id)).some(n=>n.title==='Application approved'));
  assert.ok((await API.applications.logs(application.id)).length>=6);
  const another=await API.applications.create({service_id:1});await signIn('OFFICER');await API.applications.transition(another.id,'UNDER_REVIEW',officer,'Taking up this application for the first review.');await API.applications.transition(another.id,'NEEDS_INFO',officer,'Please provide another document to support this request.');await signIn('CITIZEN');await API.applications.transition(another.id,'WITHDRAWN',citizen,'I no longer require this service and withdraw my request.');
  assert.equal((await API.applications.get(another.id)).status,'WITHDRAWN');
});
test('grievances, staff creation and filtered pagination use the API contract',async()=>{
  const citizen=await signIn('CITIZEN');const g=await API.grievances.create({department_id:1,category:'Service Delay',subject:'Application timeline clarification',description:'Please explain the current progress of my service request.'});
  await signIn('OFFICER');await API.grievances.update(g.id,{status:'IN_PROGRESS'});await API.grievances.update(g.id,{status:'RESOLVED',resolution:'The records were checked and the requested clarification was provided.'});assert.equal((await API.grievances.logs(g.id)).length,3);
  await signIn('ADMIN');const dep=await API.departments.save({name:'Verification Department',code:'VERIFY',description:'Testing department creation.'});const service=await API.services.save({department_id:dep.id,name:'Verification service',code:'VERIFY-S',fee:20,sla_days:4,docs:['Identity proof'],is_active:1});assert.equal(service.department_id,dep.id);
  await API.users.save({full_name:'Verification Officer',email:'verification-officer@demo.gov',role:'OFFICER',department_id:dep.id,password:'Verify123!',status:'ACTIVE'});
  assert.equal((await API.auth.login('verification-officer@demo.gov','Verify123!','OFFICER')).user.department_id,dep.id);
  const page=await API.applications.list({department_id:1,limit:3,officer_id:'unassigned'});assert.ok(page.rows.length<=3);assert.ok(page.rows.every(r=>r.department_id===1&&!r.officer_id));
  const k=await API.analytics.kpis({department_id:1});const status=await API.analytics.byStatus({department_id:1});assert.equal(k.total,status.reduce((n,r)=>n+r.value,0));
  const processing=await API.analytics.processing({department_id:1});const rows=await API.applications.list({department_id:1});assert.equal(processing.reduce((n,r)=>n+r.value,0),rows.filter(r=>r.decided_at).length);
  await signIn('CITIZEN');await assert.rejects(API.users.list(),/access/);await assert.rejects(API.users.get(citizen.id+1),/cannot/);
});
