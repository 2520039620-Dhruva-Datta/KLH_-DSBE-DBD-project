/* REST contract: change MODE and BASE to connect a cookie-authenticated Express API. */
(function(){
  'use strict';
  const API={MODE:'live',BASE:'/api',LATENCY:70};
  // Direct files and the explicit offline demo server keep the original Store.
  if(location.protocol==='file:'||window.AMAP_DEMO)API.MODE='demo';
  const query=f=>{const p=new URLSearchParams();Object.entries(f||{}).forEach(([k,v])=>{if(v!==''&&v!==undefined&&v!==null)p.set(k,v);});return p.size?'?'+p.toString():'';};
  // Transport for all endpoint methods below; live sessions use HttpOnly cookies.
  let csrfToken='',bootstrap;
  const channel=location.protocol!=='file:'&&window.BroadcastChannel?new BroadcastChannel('amap-live-updates'):null;
  if(channel)channel.onmessage=()=>{if(API.MODE==='live')window.dispatchEvent(new CustomEvent('civicdesk:datachange'));};
  async function request(method,path,data,demo){
    if(API.MODE==='demo'){await new Promise(r=>setTimeout(r,API.LATENCY));Store.sync();return demo();}
    const mutation=!['GET','HEAD'].includes(method);
    if(mutation&&!csrfToken){bootstrap||=(async()=>{await request('GET','/preferences');})();try{await bootstrap;}finally{bootstrap=null;}}
    const response=await fetch(API.BASE.replace(/\/$/,'')+path,{method,credentials:'include',headers:{Accept:'application/json',...(mutation?{'X-CSRF-Token':csrfToken}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{})},...(data!==undefined?{body:JSON.stringify(data)}:{})});
    const token=response.headers.get('X-CSRF-Token');if(token)csrfToken=token;
    if(response.status===204)return {ok:true};
    const body=await response.json().catch(()=>({message:'The server returned an invalid response.'}));
    if(!response.ok){const error=Error(body.message||'Request failed ('+response.status+').');error.status=response.status;throw error;}
    if(mutation&&!path.startsWith('/auth/')&&path!=='/preferences')channel?.postMessage({changed:true});
    return body;
  }
  API.auth={
    // POST /api/auth/login
    login:data=>request('POST','/auth/login',data,()=>Store.auth.login(data)),
    // POST /api/auth/register
    register:data=>request('POST','/auth/register',data,()=>Store.auth.register(data)),
    // GET /api/auth/me
    me:()=>request('GET','/auth/me',undefined,()=>Store.auth.me(Auth.user)),
    // POST /api/auth/logout
    logout:()=>request('POST','/auth/logout',{},()=>Store.auth.logout())
  };
  API.preferences={
    // GET /api/preferences
    get:()=>request('GET','/preferences',undefined,()=>Store.preferences.get()),
    // PATCH /api/preferences
    set:data=>request('PATCH','/preferences',data,()=>Store.preferences.set(data))
  };
  API.departments={
    // GET /api/departments
    list:()=>request('GET','/departments',undefined,()=>Store.departments.list()),
    // POST /api/departments
    create:data=>request('POST','/departments',data,()=>Store.departments.create(data,Auth.user)),
    // PATCH /api/departments/:id
    update:(id,data)=>request('PATCH','/departments/'+id,data,()=>Store.departments.update(id,data,Auth.user)),
    // DELETE /api/departments/:id
    remove:id=>request('DELETE','/departments/'+id,undefined,()=>Store.departments.remove(id,Auth.user))
  };
  API.services={
    // GET /api/services
    list:filters=>request('GET','/services'+query(filters),undefined,()=>Store.services.list(filters)),
    // POST /api/services
    create:data=>request('POST','/services',data,()=>Store.services.create(data,Auth.user)),
    // PATCH /api/services/:id
    update:(id,data)=>request('PATCH','/services/'+id,data,()=>Store.services.update(id,data,Auth.user)),
    // DELETE /api/services/:id
    remove:id=>request('DELETE','/services/'+id,undefined,()=>Store.services.remove(id,Auth.user))
  };
  API.users={
    // GET /api/users
    list:filters=>request('GET','/users'+query(filters),undefined,()=>Store.users.list(filters,Auth.user)),
    // POST /api/users
    create:data=>request('POST','/users',data,()=>Store.users.create(data,Auth.user)),
    // PATCH /api/users/:id
    update:(id,data)=>request('PATCH','/users/'+id,data,()=>Store.users.update(id,data,Auth.user)),
    // POST /api/auth/password
    changePassword:data=>request('POST','/auth/password',data,()=>Store.users.changePassword(data,Auth.user))
  };
  API.applications={
    // GET /api/applications
    list:filters=>request('GET','/applications'+query(filters),undefined,()=>Store.applications.list(filters,Auth.user)),
    // GET /api/applications/:id
    get:id=>request('GET','/applications/'+id,undefined,()=>Store.applications.get(id,Auth.user)),
    // GET /api/track/:reference
    track:reference=>request('GET','/track/'+encodeURIComponent(reference),undefined,()=>Store.applications.track(reference)),
    // POST /api/applications
    create:data=>request('POST','/applications',data,()=>Store.applications.create(data,Auth.user)),
    // POST /api/applications/:id/transitions
    transition:(id,data)=>request('POST','/applications/'+id+'/transitions',data,()=>Store.applications.transition(id,data,Auth.user)),
    // POST /api/applications/assign
    assign:(ids,officer_id)=>request('POST','/applications/assign',{ids,officer_id},()=>Store.applications.assign(ids,officer_id,Auth.user))
  };
  API.documents={
    // GET /api/documents/:id (JSON metadata and a base64 data URL in content)
    get:id=>request('GET','/documents/'+id,undefined,()=>Store.documents.get(id,Auth.user))
  };
  API.grievances={
    // GET /api/grievances
    list:filters=>request('GET','/grievances'+query(filters),undefined,()=>Store.grievances.list(filters,Auth.user)),
    // POST /api/grievances
    create:data=>request('POST','/grievances',data,()=>Store.grievances.create(data,Auth.user)),
    // PATCH /api/grievances/:id
    update:(id,data)=>request('PATCH','/grievances/'+id,data,()=>Store.grievances.update(id,data,Auth.user))
  };
  API.notifications={
    // GET /api/notifications
    list:()=>request('GET','/notifications',undefined,()=>Store.notifications.list(Auth.user)),
    // PATCH /api/notifications/:id (use id=all to mark all as read)
    read:id=>request('PATCH','/notifications/'+id,{read:true},()=>Store.notifications.read(id,Auth.user))
  };
  API.analytics={
    // GET /api/analytics/public
    public:()=>request('GET','/analytics/public',undefined,()=>Store.analytics.public()),
    // GET /api/analytics/dashboard
    dashboard:filters=>request('GET','/analytics/dashboard'+query(filters),undefined,()=>Store.analytics.dashboard(filters,Auth.user)),
    // GET /api/analytics/kpis
    kpis:filters=>request('GET','/analytics/kpis'+query(filters),undefined,()=>Store.analytics.kpis(filters,Auth.user)),
    // GET /api/analytics/monthly
    monthly:filters=>request('GET','/analytics/monthly'+query(filters),undefined,()=>Store.analytics.monthly(filters,Auth.user)),
    // GET /api/analytics/daily
    daily:filters=>request('GET','/analytics/daily'+query(filters),undefined,()=>Store.analytics.daily(filters,Auth.user)),
    // GET /api/analytics/status
    status:filters=>request('GET','/analytics/status'+query(filters),undefined,()=>Store.analytics.status(filters,Auth.user)),
    // GET /api/analytics/departments
    departments:filters=>request('GET','/analytics/departments'+query(filters),undefined,()=>Store.analytics.departments(filters,Auth.user)),
    // GET /api/analytics/services
    services:filters=>request('GET','/analytics/services'+query(filters),undefined,()=>Store.analytics.services(filters,Auth.user)),
    // GET /api/analytics/officers
    officers:filters=>request('GET','/analytics/officers'+query(filters),undefined,()=>Store.analytics.officers(filters,Auth.user)),
    // GET /api/analytics/sla
    sla:filters=>request('GET','/analytics/sla'+query(filters),undefined,()=>Store.analytics.sla(filters,Auth.user)),
    // GET /api/analytics/activity
    activity:filters=>request('GET','/analytics/activity'+query(filters),undefined,()=>Store.analytics.activity(filters,Auth.user))
  };
  // POST /api/demo/reset (disable this endpoint in production)
  API.reset=()=>request('POST','/demo/reset',{},()=>Store.reset(Auth.user));
  window.API=API;
})();
