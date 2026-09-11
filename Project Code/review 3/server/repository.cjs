'use strict';
const {pool,rows,normalize,transaction}=require('./db.cjs');
const V=require('./validation.cjs');
const Uploads=require('./uploads.cjs');
const Security=require('./security.cjs');
const Passwords=require('./passwords.cjs');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const iconContext={window:{}};vm.createContext(iconContext);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/icons.js'),'utf8').replace('Icons.names =','window.Icons.names ='),iconContext);
const iconNames=iconContext.window.Icons.names;
const usersSelect='id,name,email,role,department_id,phone,address,active,created_at';
async function one(c,table,id,lock=false) {
  // Table is always a repository constant, never a client-supplied identifier.
  const found=await rows(c,'SELECT * FROM '+table+' WHERE id=?'+(lock?' FOR UPDATE':''),[V.id(id)]);
  if(!found[0])V.fail('This record could not be found.',404);return normalize(found[0]);
}
function access(record,user) {if(user.role==='citizen'&&record.citizen_id!==user.id||user.role==='officer'&&record.department_id!==user.department_id)V.fail('This record is outside your access.',403);}
async function write(user,fn) {return transaction(async c=>{
  const current=await rows(c,'SELECT '+usersSelect+' FROM users WHERE id=? AND active=TRUE FOR SHARE',[user.id]);
  if(!current[0])V.fail('Please sign in with an active account.',401);
  return fn(c,normalize(current[0]));
});}
function scope(filters,user,alias='a') {
  const f=V.filters(filters),clauses=[],params=[];
  const add=(sql,value)=>{clauses.push(sql);if(value!==undefined)params.push(value);};
  if(user?.role==='citizen')add(alias+'.citizen_id=?',user.id);
  if(user?.role==='officer')add(alias+'.department_id=?',user.department_id);
  for(const key of ['department_id','citizen_id','service_id','status','priority'])if(f[key])add(alias+'.'+key+'=?',f[key]);
  if(f.officer_id)add(alias+'.officer_id'+(f.officer_id==='unassigned'?' IS NULL':'=?'),f.officer_id==='unassigned'?undefined:f.officer_id);
  if(f.from)add(alias+'.created_at>=?',new Date(f.from+'T00:00:00Z'));
  if(f.to)add(alias+'.created_at<?',new Date(Date.parse(f.to+'T00:00:00Z')+86400000));
  if(f.search){clauses.push('('+['reference','service_name','citizen_name','department_name'].map(k=>'LOCATE(LOWER(?),LOWER('+alias+'.'+k+'))>0').join(' OR ')+')');params.push(...Array(4).fill(f.search));}
  return {sql:clauses.length?' WHERE '+clauses.join(' AND '):'',params,filters:f};
}
async function applications(c,filters,user) {const s=scope(filters,user);return (await rows(c,'SELECT a.* FROM v_applications_full a'+s.sql+' ORDER BY a.created_at DESC,a.id DESC',s.params)).map(normalize);}
async function application(c,id,user,details=false) {
  const a=await one(c,'v_applications_full',id);if(user)access(a,user);
  if(details){a.documents=(await rows(c,'SELECT id,application_id,label,name,mime,size,created_at FROM documents WHERE application_id=? ORDER BY id',[a.id])).map(normalize);a.logs=await logs(c,'application_id',a.id);}
  return a;
}
async function logs(c,key,id) {return (await rows(c,'SELECT l.*,u.name AS actor_name FROM status_logs l JOIN users u ON u.id=l.actor_id WHERE l.'+key+'=? ORDER BY l.created_at,l.id',[id])).map(normalize);}
async function next(c,name) {const [row]=await rows(c,'SELECT value FROM reference_sequences WHERE name=? FOR UPDATE',[name]);if(!row)V.fail('Reference allocation is unavailable.',503);const value=Number(row.value)+1;if(value>999999)V.fail('Reference allocation capacity reached.',503);await c.execute('UPDATE reference_sequences SET value=? WHERE name=?',[value,name]);return value;}
async function attach(c,id,docs) {for(const d of docs)await c.execute('INSERT INTO documents(application_id,label,name,mime,size,content) VALUES(?,?,?,?,?,?)',[id,d.label,d.name,d.mime,d.size,d.content]);}
async function notify(c,userId,appId,title,message) {await c.execute('INSERT INTO notifications(user_id,application_id,title,message) VALUES(?,?,?,?)',[userId,appId||null,title,message]);}
async function activeDepartment(c,id) {const d=await one(c,'departments',id);if(!d.active)V.fail('This department is unavailable.');return d;}
async function officer(c,id,department) {if(!id)return null;const u=await one(c,'users',id,true);if(!u.active||u.role!=='officer'||u.department_id!==department)V.fail('Choose an active officer in the application department.');return u;}
async function departmentData(c,data) {
  V.fields(data,['name','code','description','icon']);
  const code=V.text(data.code,'Department code',2,8).toUpperCase();if(!/^[A-Z0-9]+$/.test(code))V.fail('Department codes contain only letters and numbers.');
  return {name:V.text(data.name,'Department name',3,100),code,description:V.text(data.description,'Description',8,500),icon:iconNames.includes(data.icon)?data.icon:'building'};
}
async function serviceData(c,data) {
  // The old form helper also includes its last checked "documents" field.
  V.fields(data,['department_id','name','description','fee','sla_days','required_documents','documents']);
  const d=await activeDepartment(c,data.department_id),fee=Number(data.fee),sla=Number(data.sla_days);
  if(!Number.isFinite(fee)||fee<0||fee>100000)V.fail('Fee must be between 0 and 100,000.');
  if(!Number.isInteger(sla)||sla<1||sla>365)V.fail('SLA must be 1–365 whole days.');
  if(!Array.isArray(data.required_documents)||!data.required_documents.length||data.required_documents.some(x=>!V.DOCUMENT_TYPES.includes(x)))V.fail('Choose at least one valid required document type.');
  return {department_id:d.id,name:V.text(data.name,'Service name',3,100),description:V.text(data.description,'Description',10,1000),fee,sla_days:sla,required_documents:JSON.stringify([...new Set(data.required_documents)])};
}
async function insert(c,table,data) {const keys=Object.keys(data);const [result]=await c.execute('INSERT INTO '+table+' ('+keys.map(k=>'`'+k+'`').join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')',Object.values(data));return one(c,table,result.insertId);}
async function update(c,table,id,data) {const keys=Object.keys(data);if(keys.length)await c.execute('UPDATE '+table+' SET '+keys.map(k=>'`'+k+'`=?').join(',')+' WHERE id=?',[...Object.values(data),id]);return one(c,table,id);}
const Repository={
  applications,application,logs,scope,access,write,one,usersSelect,
  departments:{
    list:()=>rows(pool,'SELECT * FROM departments ORDER BY id').then(list=>list.map(normalize)),
    create:(data,user)=>write(user,async c=>insert(c,'departments',await departmentData(c,data))),
    update:(id,data,user)=>write(user,async c=>{await one(c,'departments',id,true);return update(c,'departments',V.id(id),await departmentData(c,data));}),
    remove:(id,user)=>write(user,async c=>{await one(c,'departments',id,true);await c.execute('DELETE FROM departments WHERE id=?',[V.id(id)]);return {ok:true};})
  },
  services:{
    async list(filters={}) {V.fields(filters,['department_id']);return (await rows(pool,'SELECT * FROM services'+(filters.department_id?' WHERE department_id=?':'')+' ORDER BY id',filters.department_id?[V.id(filters.department_id)]:[])).map(normalize);},
    create:(data,user)=>write(user,async c=>insert(c,'services',await serviceData(c,data))),
    update:(id,data,user)=>write(user,async c=>{const old=await one(c,'services',id,true),valid=await serviceData(c,data);if(old.department_id!==valid.department_id){const linked=await rows(c,'SELECT id FROM applications WHERE service_id=? LIMIT 1',[old.id]);if(linked.length)V.fail('A service with applications cannot move departments.');}return update(c,'services',old.id,valid);}),
    remove:(id,user)=>write(user,async c=>{await one(c,'services',id,true);await c.execute('DELETE FROM services WHERE id=?',[V.id(id)]);return {ok:true};})
  },
  users:{
    async list(filters,user) {
      V.fields(filters,['role','department_id','active']);const clauses=[],params=[];
      if(user.role==='officer')clauses.push("role='officer'");
      if(filters.role){if(!['citizen','officer','admin'].includes(filters.role))V.fail('Invalid role.');clauses.push('role=?');params.push(filters.role);}
      if(filters.department_id){clauses.push('department_id=?');params.push(V.id(filters.department_id));}
      if(filters.active!==undefined){if(!['true','false',true,false].includes(filters.active))V.fail('Invalid account status.');clauses.push('active=?');params.push(String(filters.active)==='true');}
      return (await rows(pool,'SELECT '+(user.role==='admin'?usersSelect:'id,name,role,department_id,active')+' FROM users'+(clauses.length?' WHERE '+clauses.join(' AND '):'')+' ORDER BY id',params)).map(normalize);
    },
    async create(data,user) {
      V.fields(data,['name','email','role','department_id','password','phone']);if(!['officer','admin'].includes(data.role))V.fail('Create officers or administrators here.');
      const encoded=await Passwords.hash(V.password(data.password));
      return write(user,async c=>{const department=data.role==='officer'?(await activeDepartment(c,data.department_id)).id:null;return Security.safeUser(await insert(c,'users',{name:V.text(data.name,'Name',3,100),email:V.email(data.email),password_hash:encoded,role:data.role,department_id:department,phone:data.phone?V.phone(data.phone):''}));});
    },
    update:(id,data,user)=>write(user,async(c,u)=>{
      V.fields(data,['name','phone','address','active','department_id']);id=V.id(id);if(id!==u.id&&u.role!=='admin')V.fail('You can only edit your own profile.',403);
      if(('active'in data||'department_id'in data)&&u.role!=='admin')V.fail('Administrator access required.',403);
      const old=await one(c,'users',id,true),patch={};
      if('name'in data)patch.name=V.text(data.name,'Name',3,100);if('phone'in data)patch.phone=V.phone(data.phone);if('address'in data)patch.address=V.text(data.address,'Address',8,300);
      if('active'in data){if(typeof data.active!=='boolean')V.fail('Account status must be a boolean.');if(id===u.id&&!data.active)V.fail('You cannot deactivate your own account.');patch.active=data.active;}
      if('department_id'in data){if(old.role!=='officer')V.fail('Only officers have a department.');patch.department_id=(await activeDepartment(c,data.department_id)).id;if(patch.department_id!==old.department_id){const open=await rows(c,"SELECT id FROM applications WHERE officer_id=? AND status IN ('SUBMITTED','UNDER_REVIEW','NEEDS_INFO','FORWARDED') LIMIT 1",[id]);if(open.length)V.fail('Reassign open applications before moving this officer to another department.');}}
      const saved=await update(c,'users',id,patch);
      if(patch.active===false||patch.department_id&&patch.department_id!==old.department_id)await c.execute('DELETE FROM sessions WHERE user_id=?',[id]);
      return Security.safeUser(saved);
    })
  },
  createApplication:(data,user)=>write(user,async(c,u)=>{
    V.fields(data,['service_id','form_data','documents','priority']);const s=await one(c,'services',data.service_id,true);if(!s.active)V.fail('This service is unavailable.');await activeDepartment(c,s.department_id);
    const f=V.fields(data.form_data,['full_name','email','phone','address','purpose']);
    const form={full_name:V.text(f.full_name,'Applicant name',3,100),email:V.email(f.email),phone:V.phone(f.phone),address:V.text(f.address,'Address',8,300),purpose:V.text(f.purpose,'Purpose',15,2000)};
    const docs=Uploads.documents(data.documents),missing=s.required_documents.filter(label=>!docs.some(d=>d.label===label));if(missing.length)V.fail('Attach required documents: '+missing.join(', '));
    if(data.priority&&!['normal','high','urgent'].includes(data.priority))V.fail('Invalid priority.');
    const id=await next(c,'applications');
    await insert(c,'applications',{id,reference:'GOV-'+new Date().getUTCFullYear()+'-'+String(id).padStart(6,'0'),citizen_id:u.id,service_id:s.id,department_id:s.department_id,form_data:JSON.stringify(form),fee:s.fee,sla_days:s.sla_days,priority:data.priority||'normal',last_actor_id:u.id,last_remarks:'Application submitted with supporting documents.'});
    await attach(c,id,docs);return application(c,id,u);
  }),
  transition:(id,data,user)=>write(user,async(c,u)=>{
    V.fields(data,['status','remarks','department_id','officer_id','documents']);const a=await one(c,'applications',id,true);access(a,u);
    const to=data.status,from=a.status,remarks=V.text(data.remarks,'Remarks',20,2000),rules={SUBMITTED:['UNDER_REVIEW','WITHDRAWN'],UNDER_REVIEW:['APPROVED','REJECTED','NEEDS_INFO','FORWARDED','WITHDRAWN'],NEEDS_INFO:['UNDER_REVIEW'],FORWARDED:['UNDER_REVIEW'],APPROVED:[],REJECTED:[],WITHDRAWN:[]};
    if(!rules[from].includes(to))V.fail('Cannot change '+from+' to '+to+'.',409);
    let department=a.department_id,assigned=a.officer_id,docs=[];
    if(to==='WITHDRAWN'||from==='NEEDS_INFO'){
      if(u.role!=='citizen'||u.id!==a.citizen_id)V.fail('Only the applicant can withdraw or respond.',403);
      if(from==='NEEDS_INFO'){const [size]=await rows(c,'SELECT COALESCE(SUM(size),0) total FROM documents WHERE application_id=?',[a.id]);docs=Uploads.documents(data.documents,Number(size.total));}
      else if(data.documents?.length)V.fail('Documents can only be added with an information response.');
      if(data.department_id||data.officer_id)V.fail('The applicant cannot change assignments.',403);
    }else{
      if(!['officer','admin'].includes(u.role))V.fail('Only staff can make a decision.',403);
      if(u.role==='officer'&&assigned&&assigned!==u.id)V.fail('Assign this application to yourself before reviewing it.',409);
      if(data.documents?.length)V.fail('Only an applicant response may add documents.');
      if(u.role==='officer')assigned=u.id;
      if(to==='FORWARDED'){department=(await activeDepartment(c,data.department_id)).id;assigned=(await officer(c,data.officer_id||null,department))?.id||null;}
      else if(data.department_id||data.officer_id)V.fail('Use forwarding or the assignment action to change routing.');
    }
    await c.execute('UPDATE applications SET status=?,department_id=?,officer_id=?,last_actor_id=?,last_remarks=? WHERE id=?',[to,department,assigned,u.id,remarks,a.id]);
    await attach(c,a.id,docs);
    // A forwarding response can show the completed action to its originating
    // officer; subsequent reads enforce the receiving department's access.
    return application(c,a.id,null);
  }),
  assign:(data,user)=>write(user,async(c,u)=>{
    V.fields(data,['ids','officer_id']);if(!Array.isArray(data.ids)||!data.ids.length||data.ids.length>200)V.fail('Select between 1 and 200 applications.');
    const ids=[...new Set(data.ids.map(x=>V.id(x)))].sort((a,b)=>a-b);const target=data.officer_id?await one(c,'users',data.officer_id,true):null;
    if(target&&(!target.active||target.role!=='officer'))V.fail('Choose an active officer.');if(u.role==='officer'&&target?.id!==u.id)V.fail('Officers may only assign applications to themselves.',403);
    const selected=[];for(const id of ids){const a=await one(c,'applications',id,true);access(a,u);if(!V.OPEN.includes(a.status))V.fail('Only open applications may be reassigned.',409);if(target&&target.department_id!==a.department_id)V.fail('The officer must belong to the application department.');selected.push(a);}
    for(const a of selected)await c.execute('UPDATE applications SET officer_id=?,last_actor_id=?,last_remarks=? WHERE id=?',[target?.id||null,u.id,target?'Assigned to '+target.name+' for follow-up.':'Returned to the department’s unassigned queue.',a.id]);
    const result=[];for(const a of selected)result.push(await application(c,a.id,u));return result;
  }),
  async document(id,user){return transaction(async c=>{const d=await one(c,'documents',id);access(await one(c,'applications',d.application_id),user);return {...d,content:'data:'+d.mime+';base64,'+d.content.toString('base64')};},true);},
  async track(reference){
    const ref=V.text(reference,'Reference',1,30).toUpperCase();if(!/^GOV-\d{4}-\d{6}$/.test(ref))V.fail('Enter a valid application reference.');
    return transaction(async c=>{const [a]=await rows(c,'SELECT * FROM v_applications_full WHERE reference=?',[ref]);if(!a)V.fail('No application was found with that reference number.',404);const full=normalize(a),name=a.citizen_name.split(/\s+/).map(p=>p[0]+'•••').join(' '),[local,domain]=a.citizen_email.split('@');
      // Public logs never expose free-text remarks: names, email, phone numbers,
      // addresses, and document details can appear anywhere in officer remarks.
      const publicLogs=(await logs(c,'application_id',a.id)).map(l=>({id:l.id,from_status:l.from_status,to_status:l.to_status,created_at:l.created_at,actor_name:l.actor_id===a.citizen_id?'Applicant':'Department officer',remarks:l.from_status===l.to_status?'The application assignment was updated.':'Status updated. Sign in to read the full remarks.'}));
      return {reference:a.reference,status:a.status,service_name:a.service_name,department_name:a.department_name,created_at:full.created_at,decided_at:full.decided_at,sla_days:a.sla_days,isOverdue:full.isOverdue,applicant_name:name,applicant_email:local[0]+'***@'+domain[0]+'***.'+domain.split('.').pop(),logs:publicLogs};
    },true);
  },
  grievances:{
    async list(filters,user,c=pool){V.fields(filters,['status','department_id']);const clauses=[],params=[];if(user.role==='citizen'){clauses.push('g.citizen_id=?');params.push(user.id);}if(user.role==='officer'){clauses.push('g.department_id=?');params.push(user.department_id);}if(filters.status){if(!['OPEN','IN_PROGRESS','RESOLVED'].includes(filters.status))V.fail('Invalid grievance status.');clauses.push('g.status=?');params.push(filters.status);}if(filters.department_id){clauses.push('g.department_id=?');params.push(V.id(filters.department_id));}
      const result=(await rows(c,"SELECT g.*,u.name AS citizen_name,d.name AS department_name,s.name AS service_name,COALESCE(a.reference,'Service grievance') AS application_reference FROM grievances g JOIN users u ON u.id=g.citizen_id JOIN departments d ON d.id=g.department_id JOIN services s ON s.id=g.service_id LEFT JOIN applications a ON a.id=g.application_id"+(clauses.length?' WHERE '+clauses.join(' AND '):'')+' ORDER BY g.created_at DESC,g.id DESC',params)).map(normalize);
      if(result.length){const ids=result.map(g=>g.id),history=await rows(c,'SELECT l.*,u.name actor_name FROM status_logs l JOIN users u ON u.id=l.actor_id WHERE l.grievance_id IN ('+ids.map(()=>'?').join(',')+') ORDER BY l.created_at,l.id',ids);for(const g of result)g.logs=history.filter(l=>l.grievance_id===g.id).map(normalize);}return result;
    },
    create:(data,user)=>write(user,async(c,u)=>{V.fields(data,['application_id','service_id','subject','description']);const a=data.application_id?await one(c,'applications',data.application_id,true):null;if(a)access(a,u);const s=await one(c,'services',a?.service_id||data.service_id);if(!a&& !s.active)V.fail('This service is unavailable.');const id=await next(c,'grievances');return insert(c,'grievances',{id,reference:'GRV-'+String(id).padStart(5,'0'),application_id:a?.id||null,service_id:s.id,citizen_id:u.id,department_id:a?.department_id||s.department_id,subject:V.text(data.subject,'Subject',8,150),description:V.text(data.description,'Description',20,2000),last_actor_id:u.id});}),
    update:(id,data,user)=>write(user,async(c,u)=>{V.fields(data,['status','resolution']);const g=await one(c,'grievances',id,true);access(g,u);if(!((g.status==='OPEN'&&data.status==='IN_PROGRESS')||(g.status==='IN_PROGRESS'&&data.status==='RESOLVED')))V.fail('Take up the grievance before resolving it; resolved grievances are closed.',409);const resolution=data.status==='RESOLVED'?V.text(data.resolution,'Resolution',20,2000):'';return update(c,'grievances',g.id,{status:data.status,resolution,last_actor_id:u.id});})
  },
  notifications:{
    list:user=>rows(pool,'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC,id DESC',[user.id]).then(list=>list.map(normalize)),
    read:(id,user)=>write(user,async(c,u)=>{if(id!=='all'){const n=await one(c,'notifications',id);if(n.user_id!==u.id)V.fail('You cannot update another user’s notifications.',403);}await c.execute('UPDATE notifications SET `read`=TRUE WHERE user_id=?'+(id==='all'?'':' AND id=?'),id==='all'?[u.id]:[u.id,V.id(id)]);return {ok:true};})
  },notify
};
module.exports=Repository;
