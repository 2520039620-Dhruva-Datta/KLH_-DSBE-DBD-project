import Store from './store.js';
// Archive method names and unpaged return shapes are preserved. An explicit
// limit/offset opts into { rows, total, offset, limit, counts } for list screens.
export const API = {MODE:import.meta.env?.VITE_API_MODE || 'demo', BASE:import.meta.env?.VITE_API_BASE || 'http://localhost:8080/api', LATENCY:120, token:null};
const listeners = new Set();
const emit = () => listeners.forEach(fn => fn());
Store.onChange(emit);
API.subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); }; // Client invalidation, no REST request.
const qs = o => { const p = new URLSearchParams(); Object.entries(o || {}).forEach(([k,v]) => {if(v != null && v !== '') p.set(k,Array.isArray(v) ? v.join(',') : v);}); return p.size ? '?' + p : ''; };
const clean = u => {if(!u) return null; const {password,...rest} = u; return rest;};
function current() { const id = /^demo-token-(\d+)$/.exec(API.token || '')?.[1]; const u = id && Store.user(id); if(!u || u.status !== 'ACTIVE') throw Error('Please sign in again.'); return u; }
function staff(admin=false) {const u=current(); if(!(admin ? u.role==='ADMIN' : ['OFFICER','ADMIN'].includes(u.role))) throw Error('You do not have access to this action.'); return u;}
function scope(f={}) {const u=current(); return {...f,...(u.role==='CITIZEN' ? {user_id:u.id} : u.role==='OFFICER' ? {department_id:u.department_id} : {})};}
function owned(id) {const u=current(), a=Store.application(id)||Store.applicationByRef(id); if(!a || (u.role==='CITIZEN' && a.user_id!==u.id) || (u.role==='OFFICER' && a.department_id!==u.department_id)) throw Error('This application is not available to your account.'); return a;}
function ownUser(id) {const u=current(); if(u.id!==Number(id) && u.role!=='ADMIN') throw Error('You cannot change this account.'); return u;}
async function call(method,path,body,produce) {
  if(API.MODE==='live') {
    const options={method,headers:{Accept:'application/json'},credentials:'include'};
    if(API.token) options.headers.Authorization='Bearer '+API.token;
    if(body!=null && !['GET','HEAD'].includes(method)) {options.headers['Content-Type']='application/json';options.body=JSON.stringify(body);}
    const r=await fetch(API.BASE.replace(/\/$/,'')+path,options), data=r.status===204 ? null : await r.json().catch(()=>null);
    if(!r.ok) throw Error(data?.message || data?.error || `Request failed (${r.status}).`);
    if(method!=='GET') emit(); return data;
  }
  // Device preferences commit immediately in demo mode, so a reload cannot lose
  // a just-clicked reading/theme choice. Live mode keeps the HTTP contract.
  if(!path.startsWith('/preferences/'))await new Promise(resolve=>setTimeout(resolve,API.LATENCY));
  return produce();
}
API.auth={
  // POST /auth/login
  login:(email,password,role)=>call('POST','/auth/login',{email,password,role},()=>{const u=Store.userByEmail(email); if(!u || u.password!==password) throw Error('Invalid email or password.'); if(u.status!=='ACTIVE') throw Error('This account has been deactivated.'); if(role && u.role!==role) throw Error('Choose the correct role for this account.'); return {token:'demo-token-'+u.id,user:clean(u)};}),
  // POST /auth/register
  register:data=>call('POST','/auth/register',data,()=>{if(!data.full_name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email||'') || (data.password||'').length<8) throw Error('Enter a name, valid email and password of at least 8 characters.'); const u=Store.saveUser({...data,email:data.email.trim().toLowerCase(),role:'CITIZEN',department_id:null,status:'ACTIVE'}); Store.pushNotification(u.id,'Welcome to AMAP','Your account is ready. You can now apply for a service.','success','/citizen'); return {user:clean(u)};}),
  // GET /auth/me
  me:()=>call('GET','/auth/me',null,()=>clean(current())),
  // POST /auth/logout
  logout:()=>call('POST','/auth/logout',null,()=>({ok:true})),
  // PATCH /users/:id
  updateProfile:(id,changes)=>call('PATCH',`/users/${id}`,changes,()=>{ownUser(id); const allowed=['full_name','phone','city','address','id_last4']; return clean(Store.saveUser({id:Number(id),...Object.fromEntries(Object.entries(changes).filter(([k])=>allowed.includes(k)))}));}),
  // PATCH /users/:id/password
  changePassword:(id,currentPassword,next)=>call('PATCH',`/users/${id}/password`,{current:currentPassword,next},()=>{ownUser(id); if(Store.user(id)?.password!==currentPassword) throw Error('Current password is incorrect.'); if(next.length<8) throw Error('Use at least 8 characters.'); Store.saveUser({id:Number(id),password:next}); return {ok:true};})
};
API.departments={
  // GET /departments
  list:()=>call('GET','/departments',null,()=>Store.departments()),
  // GET /departments/:id
  get:id=>call('GET',`/departments/${id}`,null,()=>Store.department(id)),
  // POST /departments; PUT /departments/:id
  save:data=>call(data.id?'PUT':'POST','/departments'+(data.id?'/'+data.id:''),data,()=>{staff(true); if(!data.name?.trim()||!data.code?.trim()) throw Error('A name and code are required.'); if(Store.departments().some(d=>d.code===data.code && d.id!==data.id)) throw Error('That department code is already in use.'); return Store.saveDepartment({...data});}),
  // DELETE /departments/:id
  remove:id=>call('DELETE',`/departments/${id}`,null,()=>{staff(true);if(!Store.deleteDepartment(id)) throw Error('This department has related records. Keep its history intact.');return {ok:true};}),
  // GET /analytics/departments
  stats:()=>call('GET','/analytics/departments',null,()=>Store.analytics.byDepartment())
};
API.services={
  // GET /services; GET /departments/:id/services
  list:deptId=>call('GET',typeof deptId==='object'&&deptId?'/services'+qs(deptId):deptId?`/departments/${deptId}/services`:'/services',null,()=>typeof deptId==='object'&&deptId?Store.queryServices(deptId):Store.services(deptId)),
  // GET /services/:id
  get:id=>call('GET',`/services/${id}`,null,()=>Store.service(id)),
  // POST /services; PUT /services/:id
  save:data=>call(data.id?'PUT':'POST','/services'+(data.id?'/'+data.id:''),data,()=>{staff(true); const s={...(data.id?Store.service(data.id):{}),...data};if(!s.name?.trim()||!s.code?.trim()||!Store.department(s.department_id)||s.fee<0||s.sla_days<1||s.sla_days>365) throw Error('Enter a valid service, department, fee and timeline.');if(Store.services().some(r=>r.code===s.code&&r.id!==s.id)) throw Error('That service code is already in use.');return Store.saveService({...data});}),
  // DELETE /services/:id
  remove:id=>call('DELETE',`/services/${id}`,null,()=>{staff(true);if(!Store.deleteService(id)) throw Error('This service has application history. Deactivate it instead.');return {ok:true};})
};
API.applications={
  // GET /applications
  list:f=>call('GET','/applications'+qs(f),null,()=>Store.queryApplications(scope(f))),
  // GET /applications/:id
  get:id=>call('GET',`/applications/${encodeURIComponent(id)}`,null,()=>owned(id)),
  // GET /applications/track/:ref
  track:ref=>call('GET',`/applications/track/${encodeURIComponent(ref)}`,null,()=>{
    const a=Store.applicationByRef(ref); if(!a)return null;
    const [local,domain]=a.citizen.email.split('@');
    return {id:a.id,ref:a.ref,status:a.status,statusLabel:a.statusLabel,service:a.service,department:a.department,submitted_at:a.submitted_at,updated_at:a.updated_at,decided_at:a.decided_at,sla_days:a.sla_days,ageDays:a.ageDays,isOpen:a.isOpen,isOverdue:a.isOverdue,processingDays:a.processingDays,citizen:{full_name:a.citizen.full_name.trim().split(/\s+/).map(n=>n[0]+'.').join(' '),email:local[0]+'***@'+domain[0]+'***.'+domain.split('.').pop()},logs:Store.statusLogs(a.id).map(l=>({id:l.id,from_status:l.from_status,to_status:l.to_status,actor_role:l.actor_role,created_at:l.created_at,remarks:l.from_status===l.to_status?'Application record updated.':'Status updated to '+(Store.STATUS_LABEL[l.to_status]||l.to_status)+'.'}))};
  }),
  // GET /applications/track/examples
  samples:()=>call('GET','/applications/track/examples',null,()=>Store.applications({user_id:1}).slice(0,3).map(a=>({ref:a.ref}))),
  // POST /applications
  create:data=>call('POST','/applications',data,()=>{const u=current();if(u.role!=='CITIZEN')throw Error('Only citizens can apply.');return Store.createApplication({...data,user_id:u.id});}),
  // PATCH /applications/:id/status
  transition:(id,status,actor,remarks,extra={})=>call('PATCH',`/applications/${id}/status`,{status,remarks,extra},()=>{owned(id);return Store.transition(id,status,current(),remarks,extra);}),
  // PATCH /applications/assign
  assign:(ids,officer_id,remarks)=>call('PATCH','/applications/assign',{ids,officer_id,remarks},()=>Store.assign(ids,officer_id,staff(),remarks)),
  // GET /applications/:id/logs
  logs:id=>call('GET',`/applications/${id}/logs`,null,()=>{owned(id);return Store.statusLogs(id).map(l=>({...l,actor_name:l.actor_id?Store.user(l.actor_id)?.full_name:'System'}));}),
  // GET /applications/:id/documents
  documents:id=>call('GET',`/applications/${id}/documents`,null,()=>{owned(id);return Store.documents(id);}),
  // POST /applications/:id/documents
  addDocuments:(id,documents)=>call('POST',`/applications/${id}/documents`,{documents},()=>{owned(id);if(current().role!=='CITIZEN')throw Error('Only the applicant can upload documents.');return Store.addDocuments(id,documents);}),
  // PATCH /documents/:id
  verifyDocument:(id,verified)=>call('PATCH',`/documents/${id}`,{verified},()=>{const u=staff(),d=Store.raw().documents.find(d=>d.id===Number(id));if(!d)throw Error('Document not found.');owned(d.application_id);return Store.verifyDocument(id,verified,u);})
};
API.grievances={
  // GET /grievances
  list:f=>call('GET','/grievances'+qs(f),null,()=>Store.queryGrievances(scope(f))),
  // POST /grievances
  create:data=>call('POST','/grievances',data,()=>{const u=current();if(u.role!=='CITIZEN')throw Error('Only citizens can file grievances.');return Store.createGrievance({...data,user_id:u.id},u);}),
  // PATCH /grievances/:id
  update:(id,changes)=>call('PATCH',`/grievances/${id}`,changes,()=>Store.updateGrievance(id,{...changes,officer_id:current().id},staff())),
  // GET /grievances/:id/logs
  logs:id=>call('GET',`/grievances/${id}/logs`,null,()=>{if(!Store.grievances(scope()).some(g=>g.id===Number(id)))throw Error('Grievance unavailable.');return Store.grievanceLogs(id);})
};
API.users={
  // GET /users
  list:f=>call('GET','/users'+qs(f),null,()=>{const u=staff();return Store.queryUsers({...f,...(u.role==='OFFICER'?{role:'OFFICER',department_id:u.department_id}:{})});}),
  // GET /users/:id
  get:id=>call('GET',`/users/${id}`,null,()=>{ownUser(id);return clean(Store.user(id));}),
  // POST /users; PUT /users/:id
  save:data=>call(data.id?'PUT':'POST','/users'+(data.id?'/'+data.id:''),data,()=>{const u=staff(true);if(Number(data.id)===u.id&&(data.role!=='ADMIN'||data.status==='INACTIVE'))throw Error('You cannot remove your own administrator access.');if(!['OFFICER','ADMIN'].includes(data.role)||(!data.id&&(data.password||'').length<8))throw Error('Choose a staff role and a password of at least 8 characters.');return clean(Store.saveUser({...data,department_id:data.role==='ADMIN'?null:Number(data.department_id)}));}),
  // PATCH /users/:id/status
  setStatus:(id,status)=>call('PATCH',`/users/${id}/status`,{status},()=>{const u=staff(true);if(u.id===Number(id))throw Error('You cannot deactivate your own account.');if(!['ACTIVE','INACTIVE'].includes(status))throw Error('Invalid account status.');return clean(Store.setUserStatus(id,status));})
};
API.analytics={
  // GET /analytics/overview
  kpis:s=>call('GET','/analytics/overview'+qs(s),null,()=>Store.analytics.kpis(s)),
  // GET /analytics/monthly
  monthly:(n=12,s={})=>call('GET','/analytics/monthly'+qs({...s,months:n}),null,()=>Store.analytics.monthly(n,s)),
  // GET /analytics/daily
  daily:(n=30,s={})=>call('GET','/analytics/daily'+qs({...s,days:n}),null,()=>Store.analytics.daily(n,s)),
  // GET /analytics/status
  byStatus:s=>call('GET','/analytics/status'+qs(s),null,()=>Store.analytics.byStatus(s)),
  // GET /analytics/departments
  byDepartment:s=>call('GET','/analytics/departments'+qs(s),null,()=>Store.analytics.byDepartment(s)),
  // GET /analytics/services
  topServices:(n=6,s={})=>call('GET','/analytics/services'+qs({...s,limit:n}),null,()=>Store.analytics.topServices(n,s)),
  // GET /analytics/officers
  officers:(department_id,s={})=>call('GET','/analytics/officers'+qs({...s,department_id}),null,()=>{staff();return Store.scopedOfficers({...s,department_id});}),
  // GET /analytics/decisions
  decisions:(n=7,officer_id,s={})=>call('GET','/analytics/decisions'+qs({...s,days:n,officer_id}),null,()=>{staff();return Store.scopedDecisions(n,{...s,officer_id});}),
  // GET /analytics/processing
  processing:s=>call('GET','/analytics/processing'+qs(s),null,()=>Store.analytics.processingBuckets(s)),
  // GET /analytics/activity
  activity:(n=12,department_id,s={})=>call('GET','/analytics/activity'+qs({...s,limit:n,department_id}),null,()=>Store.scopedActivity(n,{...scope(s),...(department_id?{department_id}:{})})),
  // GET /analytics/grievances
  grievances:s=>call('GET','/analytics/grievances'+qs(s),null,()=>Store.scopedGrievanceSummary(scope(s))),
  // GET /analytics/sla
  sla:s=>call('GET','/analytics/sla'+qs(s),null,()=>Store.slaSummary(s)),
  // GET /analytics/users
  users:()=>call('GET','/analytics/users',null,()=>{staff(true);return Store.userSummary();})
};
API.notifications={
  // GET /users/:id/notifications
  list:id=>call('GET',`/users/${id}/notifications`,null,()=>{ownUser(id);return Store.notifications(id);}),
  // GET /users/:id/notifications/unread
  unread:id=>call('GET',`/users/${id}/notifications/unread`,null,()=>{ownUser(id);return Store.unreadCount(id);}),
  // POST /users/:id/notifications/read
  markRead:id=>call('POST',`/users/${id}/notifications/read`,null,()=>{ownUser(id);Store.markNotificationsRead(id);return {ok:true};})
};
API.preferences={
  // GET /preferences/:key
  get:key=>call('GET',`/preferences/${key}`,null,()=>Store.preference(key)),
  // PUT /preferences/:key
  set:(key,value)=>call('PUT',`/preferences/${key}`,{value},()=>Store.preference(key,value))
};
API.demo={
  // POST /demo/reset (development only)
  reset:()=>call('POST','/demo/reset',null,()=>{current();Store.reset();return {ok:true};}),
  // GET /demo/storage
  storage:()=>call('GET','/demo/storage',null,()=>({persistent:Store.persistent}))
};
export default API;
