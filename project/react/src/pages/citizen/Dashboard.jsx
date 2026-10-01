import {Link} from 'react-router';
import API from '../../data/api.js';
import useApi from '../../hooks/useApi.js';
import {useAuth} from '../../context/AuthContext.jsx';
import Icon from '../../components/Icon.jsx';
import {ApiState,Badge,ButtonLink,Card,EmptyState,Progress,Stats,Table,Timeline} from '../../components/ui/index.jsx';
import {Donut} from '../../components/charts/index.jsx';
import {statusColor} from '../../lib/status.js';
import {fmtDate} from '../../lib/format.js';
const quick=[['/citizen/apply','filePlus','New application','Choose a service'],['/citizen/applications','files','My applications','Review your history'],['/identity','fingerprint','Digital Identity','Face enrollment & privacy'],['/citizen/grievances','megaphone','File a grievance','Ask for help']];
const greeting=()=>{const h=new Date().getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening';};
export default function Dashboard(){
  const {user}=useAuth();
  const state=useApi(async()=>{const scope={user_id:user.id};const [kpis,applications,status,grievances]=await Promise.all([API.analytics.kpis(scope),API.applications.list({limit:6}),API.analytics.byStatus(scope),API.grievances.list({limit:4})]);const latest=applications.rows[0],logs=latest?await API.applications.logs(latest.id):[];return {kpis,applications,status,grievances,latest,logs};},[user.id]);
  const d=state.data,attention=d?.status.find(s=>s.key==='NEEDS_INFO')?.value||0;
  return <>
    <section className="welcome" aria-label="Welcome">
      <div><p className="eyebrow">{greeting()}</p><h1>Welcome, {user.full_name.split(' ')[0]}</h1><p>{attention?`${attention} application${attention>1?'s need':' needs'} your response. Open it to see what the officer asked for.`:'A clear view of your requests and their next steps.'}</p></div>
      <div className="w-actions">{attention>0&&<ButtonLink to="/citizen/applications?status=NEEDS_INFO" variant="outline" icon="alert">Respond now</ButtonLink>}<ButtonLink to="/citizen/apply" icon="filePlus">Apply for a service</ButtonLink></div>
    </section>
    <ApiState state={state}>{d&&<>
      <Stats items={[{label:'Applications',value:d.kpis.total,icon:'files'},{label:'Open now',value:d.kpis.pending,icon:'clock',tone:'info'},{label:'Approved',value:d.kpis.approved,icon:'checkCircle',tone:'ok'},{label:'Needs your attention',value:attention,icon:'alert',tone:'warn'}]}/>
      <div className="dash-grid">
        <div className="col-8"><Card title="Your most recent application" subtitle={d.latest?d.latest.ref+' · submitted '+fmtDate(d.latest.submitted_at):undefined} actions={d.latest&&<Link to={'/citizen/applications/'+d.latest.id}>Open</Link>}>{d.latest?<><h3 className="mb-4">{d.latest.service.name}</h3><Progress application={d.latest}/><Timeline logs={d.logs.slice(-3)}/><div className="mt-6"><ButtonLink to={'/citizen/applications/'+d.latest.id} variant="outline" icon="arrowRight">View full application</ButtonLink></div></>:<EmptyState icon="filePlus" title="Your first application starts here" message="Choose a service to begin. You’ll get a reference number when you submit."><ButtonLink to="/citizen/apply">Apply for a service</ButtonLink></EmptyState>}</Card></div>
        <div className="col-4 stack">
          <Card title="Quick actions"><div className="quick-grid">{quick.map(([to,icon,label,sub])=><Link className="quick" key={to} to={to}><Icon name={icon}/><b>{label}</b><span>{sub}</span></Link>)}</div></Card>
        </div>
        <div className="col-8"><Card title="Recent applications" actions={<Link to="/citizen/applications">View all</Link>} flush><Table caption="Recent applications" rows={d.applications.rows} empty={<EmptyState icon="files" title="No applications yet" message="Applications you submit will be listed here."/>} columns={[{key:'ref',label:'Reference',render:a=><Link className="mono" to={'/citizen/applications/'+a.id}>{a.ref}</Link>},{key:'service',label:'Service',render:a=>a.service.name},{key:'department',label:'Department',render:a=>a.department.code},{key:'submitted_at',label:'Submitted',render:a=>fmtDate(a.submitted_at)},{key:'status',label:'Status',render:a=><Badge status={a.status}/>}]}/></Card></div>
        <div className="col-4"><Card title="Where your applications stand"><Donut slices={d.status.map(s=>({...s,color:statusColor(s.key)}))}/></Card></div>
        <div className="col-12"><Card title="Recent grievances" actions={<Link to="/citizen/grievances">Manage</Link>}>{d.grievances.rows.length?<div className="grievance-grid">{d.grievances.rows.map(g=><Link to="/citizen/grievances" className="grievance-summary" key={g.id}><Badge status={g.status}/><p>{g.subject}</p><small className="muted mono">{g.ref}</small></Link>)}</div>:<p className="muted">No grievances filed. If a service needs attention, you can raise it here.</p>}</Card></div>
      </div>
    </>}</ApiState>
  </>;
}
