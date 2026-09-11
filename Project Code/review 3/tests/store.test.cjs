const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),KEY='civicdesk.data.v1';
function environment(data,options={}){
  const memory=new Map(data?[[KEY,JSON.stringify(data)]]:[]);let quota=Boolean(options.full);
  const localStorage={getItem(k){if(options.blocked)throw Error('Storage denied');return memory.get(k)||null;},setItem(k,v){if(options.blocked)throw Error('Storage denied');if(quota)throw Object.assign(Error('Full'),{name:'QuotaExceededError'});memory.set(k,v);}};
  class FixedDate extends Date {constructor(...args){super(...(args.length?args:[options.clock]));}static now(){return new Date(options.clock).getTime();}}
  const c={console,Date:options.clock?FixedDate:Date,Math,JSON,Set,Map,Number,String,Boolean,Error,Infinity,btoa,atob,localStorage};c.window=c;vm.createContext(c);
  for(const file of ['icons','seed','store'])vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),c,{filename:file+'.js'});
  return {c,store:c.Store,raw:()=>JSON.parse(memory.get(KEY)),quota:()=>{quota=true;}};
}
const env=environment(),{store,c}=env,data=env.raw();
const citizen=store.auth.login({email:'citizen@demo.gov',password:'citizen123',role:'citizen'}),officer=store.auth.login({email:'officer@demo.gov',password:'officer123',role:'officer'}),admin=store.auth.login({email:'admin@demo.gov',password:'admin123',role:'admin'});
assert.equal(JSON.stringify(c.Seed.generate(data.anchor)),JSON.stringify(c.Seed.generate(data.anchor)));
assert.equal(data.applications.length,420);assert.equal(data.users.length,50);assert.equal(data.services.length,25);assert.equal(data.departments.length,8);assert.ok(data.grievances.length>=40);assert.ok(c.Icons.names.length>=80);
assert.equal(new Set(data.applications.map(a=>a.reference)).size,420);
const allowed={SUBMITTED:['UNDER_REVIEW','WITHDRAWN'],UNDER_REVIEW:['APPROVED','REJECTED','NEEDS_INFO','FORWARDED','WITHDRAWN'],NEEDS_INFO:['UNDER_REVIEW'],FORWARDED:['UNDER_REVIEW'],APPROVED:[],REJECTED:[],WITHDRAWN:[]};
for(const a of data.applications){
  const logs=data.status_logs.filter(l=>l.application_id===a.id),s=data.services.find(s=>s.id===a.service_id);
  assert.equal(logs[0].from_status,null);assert.equal(logs[0].to_status,'SUBMITTED');assert.equal(logs.at(-1).to_status,a.status);
  for(let i=1;i<logs.length;i++){assert.equal(logs[i].from_status,logs[i-1].to_status);assert.ok(allowed[logs[i].from_status].includes(logs[i].to_status));assert.ok(logs[i].created_at>=logs[i-1].created_at);}
  for(const label of s.required_documents)assert.ok(data.documents.some(d=>d.application_id===a.id&&d.label===label));
  if(a.officer_id)assert.equal(data.users.find(u=>u.id===a.officer_id).department_id,a.department_id);
  assert.equal(data.notifications.filter(n=>n.application_id===a.id).length,logs.length);
}
assert.ok(store.applications.list({},citizen).length>20);assert.ok(store.applications.list({},officer).length>40);
let transitions=0;
for(const from of Object.keys(allowed))for(const to of Object.keys(allowed))for(const role of ['citizen','officer','admin']){
  const copy=JSON.parse(JSON.stringify(data));const a=copy.applications[0];Object.assign(a,{citizen_id:1,department_id:1,service_id:3,status:from,officer_id:2,decided_at:['APPROVED','REJECTED','WITHDRAWN'].includes(from)?a.updated_at:null});
  const test=environment(copy),u=role==='citizen'?citizen:role==='officer'?officer:admin,valid=allowed[from].includes(to)&&((to==='WITHDRAWN'||from==='NEEDS_INFO')?role==='citizen':role!=='citizen');
  const call=()=>test.store.applications.transition(a.id,{status:to,remarks:'Verified the application details and supporting evidence carefully.',department_id:1},u);
  if(valid){const result=call();assert.equal(result.status,to);assert.equal(test.raw().status_logs.length,copy.status_logs.length+1);assert.equal(test.raw().notifications.length,copy.notifications.length+1);}else{assert.throws(call);assert.equal(JSON.stringify(test.raw()),JSON.stringify(copy));}transitions++;
}
const doc={label:'Identity proof',name:'identity.txt',mime:'text/plain',size:12,content:'data:text/plain;base64,'+btoa('Demo ID file')};
const request={service_id:3,form_data:{full_name:citizen.name,email:citizen.email,phone:citizen.phone,address:citizen.address,purpose:'I need this certificate for an educational application.'},documents:[doc]};
assert.throws(()=>store.applications.create({...request,documents:[]},citizen),/required documents/);
const a=store.applications.create(request,citizen);assert.equal(a.status,'SUBMITTED');
assert.throws(()=>store.applications.transition(a.id,{status:'APPROVED',remarks:'This must not skip initial review verification.'},officer));
assert.throws(()=>store.applications.transition(a.id,{status:'UNDER_REVIEW',remarks:'ok'},officer),/Remarks/);
const outsider=store.auth.login({email:'citizen1@demo.gov',password:'citizen123',role:'citizen'});assert.throws(()=>store.applications.get(a.id,outsider));assert.throws(()=>store.documents.get(store.applications.get(a.id,citizen).documents[0].id,outsider));
store.applications.transition(a.id,{status:'UNDER_REVIEW',remarks:'Initial document verification has started for this request.'},officer);
store.applications.transition(a.id,{status:'NEEDS_INFO',remarks:'Please clarify your address proof for this application.'},officer);
assert.throws(()=>store.applications.transition(a.id,{status:'WITHDRAWN',remarks:'Cannot withdraw while awaiting additional information.'},citizen));
store.applications.transition(a.id,{status:'UNDER_REVIEW',remarks:'Here is the requested clarification and supporting evidence.',documents:[doc]},citizen);
store.applications.transition(a.id,{status:'FORWARDED',department_id:2,remarks:'Municipal specialists must verify this application next.'},officer);
assert.throws(()=>store.applications.get(a.id,officer));
const nextOfficer=store.users.list({role:'officer',department_id:2},admin)[0];store.applications.transition(a.id,{status:'UNDER_REVIEW',remarks:'The receiving department has taken up this verification.'},nextOfficer);
store.applications.transition(a.id,{status:'APPROVED',remarks:'All submitted evidence has been verified and meets the criteria.'},nextOfficer);
assert.ok(store.applications.get(a.id,citizen).decided_at);assert.ok(!store.applications.get(a.id,citizen).isOverdue);
const track=store.applications.track(a.reference);assert.ok(!JSON.stringify(track).includes(citizen.name));assert.ok(!JSON.stringify(track).includes(citizen.email));assert.equal(track.form_data,undefined);assert.equal(track.documents,undefined);
const open=store.applications.create(request,citizen),before=JSON.stringify(env.raw());assert.throws(()=>store.applications.assign([open.id,a.id],2,admin));assert.equal(JSON.stringify(env.raw()),before);
const g=store.grievances.create({application_id:open.id,subject:'Please clarify the service timeline',description:'The expected completion date needs clarification for my application.'},citizen);assert.throws(()=>store.grievances.update(g.id,{status:'RESOLVED',resolution:'This cannot skip taking up the grievance first.'},officer));store.grievances.update(g.id,{status:'IN_PROGRESS'},officer);store.grievances.update(g.id,{status:'RESOLVED',resolution:'The timeline was confirmed and explained to the applicant.'},officer);assert.equal(store.grievances.list({},citizen).find(x=>x.id===g.id).status,'RESOLVED');
const aggregate=store.analytics.dashboard({},admin),list=store.applications.list({},admin);assert.equal(aggregate.kpis.total,list.length);assert.equal(aggregate.status.reduce((n,s)=>n+s.value,0),list.length);assert.equal(aggregate.departments.reduce((n,d)=>n+d.total,0),list.length);assert.equal(aggregate.services.reduce((n,s)=>n+s.total,0),list.length);assert.equal(aggregate.sla.distribution.reduce((n,b)=>n+b.value,0),aggregate.kpis.decided);
const filtered=store.analytics.dashboard({department_id:1,from:new Date().toISOString().slice(0,10)},admin);assert.equal(filtered.kpis.total,store.applications.list({department_id:1,from:new Date().toISOString().slice(0,10)},admin).length);
const fixed=environment(data,{clock:'2026-09-08T20:00:00Z'}),range={from:'2025-09-08',to:'2026-09-08'},months=fixed.store.analytics.monthly(range,admin);assert.equal(months.length,13);assert.equal(months[0].key,'2025-09');assert.equal(months.at(-1).key,'2026-09');assert.equal(months.reduce((sum,m)=>sum+m.submitted,0),fixed.store.applications.list(range,admin).length);assert.equal(fixed.store.analytics.monthly({},admin).at(-1).key,'2026-09');assert.equal(fixed.store.analytics.daily({to:'2026-08-31'},admin).at(-1).key,'2026-08-31');
const fallback=environment(null,{blocked:true});assert.equal(fallback.store.storageMode,'memory');assert.equal(fallback.store.analytics.public().applications,420);fallback.store.preferences.set({theme:'dark'});assert.equal(fallback.store.preferences.get().theme,'dark');
const fullOnStartup=environment(null,{full:true});assert.equal(fullOnStartup.store.storageMode,'memory');assert.equal(fullOnStartup.store.analytics.public().applications,420);assert.equal(fullOnStartup.store.auth.login({email:'citizen@demo.gov',password:'citizen123',role:'citizen'}).id,1);
const quota=environment(),quotaUser=quota.store.auth.me(citizen),old=quota.store.analytics.public().applications;quota.quota();assert.throws(()=>quota.store.applications.create(request,quotaUser),/storage is full/);assert.equal(quota.store.analytics.public().applications,old);
assert.throws(()=>store.users.update(admin.id,{active:false},admin));assert.throws(()=>store.departments.remove(1,admin));assert.throws(()=>store.services.remove(3,admin));
console.log('PASS: deterministic fixture and all references; '+transitions+' transition/role cases; citizen → forward → approval; grievances; masking; access; aggregate consistency; atomic rollback; quota and memory fallback.');
