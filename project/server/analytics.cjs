'use strict';
const {transaction,rows,normalize}=require('./db.cjs');
const R=require('./repository.cjs');
const V=require('./validation.cjs');
function summary(list) {
  const decided=list.filter(a=>['APPROVED','REJECTED'].includes(a.status)),approved=decided.filter(a=>a.status==='APPROVED'),onTime=decided.filter(a=>a.processingDays<=a.sla_days);
  return {total:list.length,open:list.filter(a=>V.OPEN.includes(a.status)).length,approved:approved.length,rejected:decided.length-approved.length,decided:decided.length,overdue:list.filter(a=>a.isOverdue).length,approvalRate:decided.length?100*approved.length/decided.length:0,slaCompliance:decided.length?100*onTime.length/decided.length:0,avgProcessing:decided.length?decided.reduce((s,a)=>s+a.processingDays,0)/decided.length:0,fees:list.reduce((s,a)=>s+a.fee,0),onTime:onTime.length};
}
function trend(list,daily,filters) {
  const end=filters.to?new Date(filters.to+'T00:00:00Z'):new Date();
  const start=daily?new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth(),end.getUTCDate()-13)):filters.from?new Date(filters.from+'T00:00:00Z'):new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()-11,1));
  const count=daily?14:(end.getUTCFullYear()-start.getUTCFullYear())*12+end.getUTCMonth()-start.getUTCMonth()+1;
  const buckets=[];for(let i=0;i<count;i++){
    const d=daily?new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth(),start.getUTCDate()+i)):new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+i,1)),key=d.toISOString().slice(0,daily?10:7);
    buckets.push({key,label:d.toLocaleDateString('en-IN',{timeZone:'UTC',...(daily?{day:'numeric',month:'short'}:{month:'short',year:'2-digit'})}),submitted:list.filter(a=>a.created_at.startsWith(key)).length,approved:list.filter(a=>a.status==='APPROVED'&&a.decided_at?.startsWith(key)).length,rejected:list.filter(a=>a.status==='REJECTED'&&a.decided_at?.startsWith(key)).length});
  }return buckets;
}
async function dashboard(filters,user,part) {
  const f=V.filters(filters);
  // Consistent InnoDB read snapshot: all aggregates use the same scoped joined
  // SQL view. No localStorage or browser Store is involved in live analytics.
  return transaction(async c=>{
    const list=await R.applications(c,f,user),kpis=summary(list);
    const deps=(await rows(c,'SELECT id,name FROM departments ORDER BY id')).filter(d=>(!f.department_id||d.id===f.department_id)&&(user.role!=='officer'||d.id===user.department_id));
    const departments=deps.map(d=>({...d,...summary(list.filter(a=>a.department_id===d.id))}));
    if(part==='kpis')return kpis;
    if(part==='departments')return departments;
    if(part==='monthly'||part==='daily')return trend(list,part==='daily',f);
    const status=V.STATUSES.map(status=>({status,label:status,value:list.filter(a=>a.status===status).length}));if(part==='status')return status;
    const services=(await rows(c,'SELECT id,name FROM services ORDER BY id')).map(s=>({...s,...summary(list.filter(a=>a.service_id===s.id))})).filter(s=>s.total).sort((a,b)=>b.total-a.total||a.id-b.id);if(part==='services')return services;
    const officers=(await rows(c,"SELECT u.id,u.name,u.department_id,d.name department_name FROM users u JOIN departments d ON d.id=u.department_id WHERE u.role='officer' ORDER BY u.id")).filter(o=>(!f.department_id||o.department_id===f.department_id)&&(user.role!=='officer'||o.department_id===user.department_id)&&(user.role!=='citizen'||list.some(a=>a.officer_id===o.id))).map(({department_id,...o})=>({...o,...summary(list.filter(a=>a.officer_id===o.id))})).sort((a,b)=>b.decided-a.decided||a.id-b.id);if(part==='officers')return officers;
    const distribution=[{label:'0–3 days',min:0,max:3},{label:'4–7 days',min:3,max:7},{label:'8–14 days',min:7,max:14},{label:'15–30 days',min:14,max:30},{label:'31+ days',min:30,max:Infinity}].map((b,i)=>({label:b.label,value:list.filter(a=>['APPROVED','REJECTED'].includes(a.status)&&(i===0?a.processingDays>=0:a.processingDays>b.min)&&a.processingDays<=b.max).length}));
    const sla={summary:kpis,departments,distribution};if(part==='sla')return sla;
    const s=R.scope(f,user),activity=(await rows(c,"SELECT l.*,u.name actor_name,CONCAT(a.reference,' · ',REPLACE(LOWER(l.to_status),'_',' ')) title FROM status_logs l JOIN v_applications_full a ON a.id=l.application_id JOIN users u ON u.id=l.actor_id"+s.sql+' ORDER BY l.created_at DESC,l.id DESC LIMIT 30',s.params)).map(normalize);if(part==='activity')return activity;
    return {kpis,monthly:trend(list,false,f),daily:trend(list,true,f),status,departments,services,officers,sla,activity};
  },true);
}
async function publicCounts() {
  return transaction(async c=>{
    const [counts]=await rows(c,"SELECT (SELECT COUNT(*) FROM applications) applications,(SELECT COUNT(*) FROM users WHERE role='citizen') citizens,(SELECT COUNT(*) FROM departments) departments,(SELECT COUNT(*) FROM services) services,COALESCE(100*SUM(status='APPROVED')/NULLIF(SUM(status IN ('APPROVED','REJECTED')),0),0) approvalRate FROM applications");return counts;
  },true);
}
module.exports={dashboard,publicCounts,summary};
