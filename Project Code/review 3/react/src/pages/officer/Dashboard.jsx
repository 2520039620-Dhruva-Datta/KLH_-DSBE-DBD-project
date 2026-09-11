import {Link} from 'react-router';
import API from '../../data/api.js';
import useApi from '../../hooks/useApi.js';
import {useAuth} from '../../context/AuthContext.jsx';
import {Activity,ApiState,Badge,ButtonLink,Card,PageHead,Priority,Stats,Table} from '../../components/ui/index.jsx';
import {BarChart,Donut,HBarChart,Legend} from '../../components/charts/index.jsx';
import {OPEN_STATUSES,statusColor} from '../../lib/status.js';
import {fmtDate} from '../../lib/format.js';
export default function Dashboard(){
  const {user}=useAuth();
  const state=useApi(async()=>{
    const scope={department_id:user.department_id};
    const [department,kpis,queue,decisions,status,services,activity]=await Promise.all([API.departments.get(user.department_id),API.analytics.kpis(scope),API.applications.list({view:'open',me:user.id,limit:8,sort:'submitted_at',direction:'asc'}),API.analytics.decisions(7,undefined,scope),API.analytics.byStatus({...scope,statusIn:OPEN_STATUSES}),API.analytics.topServices(6,{...scope,statusIn:OPEN_STATUSES}),API.analytics.activity(9,user.department_id)]);
    return {department,kpis,queue,decisions,status,services,activity};
  },[user.id]);
  const d=state.data;
  return <><PageHead title="Department overview" lead={d?.department.name||'Your department’s daily work.'}><ButtonLink to="/officer/queue">Open work queue</ButtonLink></PageHead><ApiState state={state}>{d&&<><Stats items={[{label:'Department open',value:d.kpis.pending},{label:'Assigned to you',value:d.queue.counts.mine,icon:'user'},{label:'Past timeline',value:d.kpis.overdue,icon:'alert',tone:'danger'},{label:'Decisions today',value:(d.decisions.at(-1)?.approved||0)+(d.decisions.at(-1)?.rejected||0),icon:'checkCircle'}]}/><div className="dash-grid"><div className="col-8"><Card title="Decisions this week" subtitle="Recorded decisions across your department"><BarChart labels={d.decisions.map(r=>r.label)} series={['approved','rejected'].map(key=>({name:key==='approved'?'Approved':'Rejected',color:statusColor(key.toUpperCase()),data:d.decisions.map(r=>r[key])}))}/><Legend items={['APPROVED','REJECTED'].map(key=>({label:key==='APPROVED'?'Approved':'Rejected',color:statusColor(key)}))}/></Card></div><div className="col-4"><Card title="Open applications"><Donut slices={d.status.map(s=>({...s,color:statusColor(s.key)}))}/></Card></div><div className="col-8"><Card title="Oldest pending applications" actions={<Link to="/officer/queue?view=open&sort=submitted_at&direction=asc">View queue</Link>} flush><Table caption="Oldest pending applications" rows={d.queue.rows} columns={[{key:'ref',label:'Reference',render:a=><Link to={'/officer/review/'+a.id}>{a.ref}</Link>},{key:'applicant',label:'Applicant',render:a=>a.citizen.full_name},{key:'service',label:'Service',render:a=>a.service.name},{key:'date',label:'Submitted',render:a=>fmtDate(a.submitted_at)},{key:'priority',label:'Priority',render:a=><Priority value={a.priority}/>},{key:'status',label:'Status',render:a=><Badge status={a.status}/>}]}/></Card></div><div className="col-4"><Card title="Pending work by service"><HBarChart rows={d.services.map(r=>({label:r.name,value:r.value}))}/></Card></div><div className="col-12"><Card title="Department activity"><Activity rows={d.activity}/></Card></div></div></>}</ApiState></>;
}
