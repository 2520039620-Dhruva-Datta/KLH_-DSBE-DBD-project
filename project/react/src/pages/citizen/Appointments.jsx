import {useState} from 'react';
import {Link} from 'react-router';
import API from '../../data/api.js';
import useApi from '../../hooks/useApi.js';
import {useAuth} from '../../context/AuthContext.jsx';
import {useLanguage} from '../../context/LanguageContext.jsx';
import Icon from '../../components/Icon.jsx';
import {Alert,ApiState,Badge,Button,Card,Details,EmptyState,Field,Modal,PageHead} from '../../components/ui/index.jsx';
import CameraVerification from '../../components/CameraVerification.jsx';
import {fmtDate} from '../../lib/format.js';

// Visit lifecycle, in order. Rescheduled visits sit with newly requested ones.
const FLOW=['REQUESTED','ASSIGNED','AGENT_ACCEPTED','EN_ROUTE','ARRIVED','CITIZEN_CONFIRMED_AGENT','VERIFICATION_STARTED','COMPLETED'];
const stageLabel={REQUESTED:'Waiting for an agent to be assigned',RESCHEDULED:'Rescheduled; waiting for assignment',ASSIGNED:'Agent assigned; waiting for acceptance',AGENT_ACCEPTED:'Agent accepted the visit',EN_ROUTE:'Agent is on the way',ARRIVED:'Agent has arrived; confirm their code',CITIZEN_CONFIRMED_AGENT:'Citizen confirmed the agent',VERIFICATION_STARTED:'Face verification in progress',COMPLETED:'Verification completed',CANCELLED:'This visit was cancelled.',NO_SHOW:'Recorded as a no-show.',FAILED:'The visit could not complete.'};
const locationLabel={CENTER:'Verification center',HOME:'Home',WORKPLACE:'Workplace'};

function Track({status}){const position=FLOW.indexOf(status==='RESCHEDULED'?'REQUESTED':status),ended=position<0;return <><div className="appt-track" style={{'--steps':FLOW.length}} aria-hidden="true">{FLOW.map((s,i)=><span key={s} className={ended?'':i<position||status==='COMPLETED'?'is-done':i===position?'is-current':''}/>)}</div><p className="appt-track-label">{stageLabel[status]||status.replaceAll('_',' ').toLowerCase()}</p></>;}

export default function Appointments(){
  const {user}=useAuth(),{t}=useLanguage(),citizen=user.role==='CITIZEN',admin=user.role==='ADMIN',agent=user.role==='VERIFICATION_AGENT';
  const [form,setForm]=useState({location_type:'CENTER',location:'',scheduled_date:new Date().toISOString().slice(0,10),time_window:'10:00–12:00',consent:false}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[dialog,setDialog]=useState(null),[code,setCode]=useState(''),[agentId,setAgentId]=useState(''),[proof,setProof]=useState(null),[verification,setVerification]=useState(null);
  const data=useApi(()=>API.verification('GET','/appointments'),[]),agents=useApi(()=>admin?API.verification('GET','/agents'):Promise.resolve([]),[]);
  const bind=k=>({value:form[k],onChange:e=>setForm({...form,[k]:e.target.value})});
  async function action(path,body,done){setBusy(true);setError('');try{const r=await API.verification('POST',path,body);done?.(r);setDialog(null);setCode('');}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function create(e){e.preventDefault();await action('/appointments',form,()=>setForm(f=>({...f,location:'',consent:false})));}
  const list=data.data||[];
  return <>
    <PageHead eyebrow={t(agent?'Field verification':admin?'Verification center':'Digital Identity')} title={t(agent?'Assigned verification jobs':admin?'Verification appointments':'Assisted verification')} lead={t('A controlled fallback when self-service camera verification is not suitable.')}><Link className="btn btn-outline" to={agent?'/agent/device':admin?'/admin/verification':'/identity'}><Icon name={agent?'smartphone':admin?'shield':'fingerprint'} size={17}/>{t(agent?'Device qualification':admin?'Control center':'Digital Identity')}</Link></PageHead>
    {error&&<div className="mb-5"><Alert type="danger">{error}</Alert></div>}
    {agent&&<div className="mb-6"><Alert title={t('Before every visit')}>{t('Only assigned jobs are visible. MFA sign-in and an approved camera device are required for visit actions. Never request a bank OTP or external password.')}</Alert></div>}
    {citizen&&<Card title={t('Request an appointment')} subtitle={t('An authorised agent confirms your identity in person, using the same protected face check.')}><form onSubmit={create}>
      <div className="grid-2"><Field label={t('Location type')} as="select" {...bind('location_type')}>{['CENTER','HOME','WORKPLACE'].map(x=><option key={x} value={x}>{t(locationLabel[x])}</option>)}</Field><Field label={t('Preferred date')} type="date" min={new Date().toISOString().slice(0,10)} required {...bind('scheduled_date')}/><Field label={t('Preferred time window')} as="select" {...bind('time_window')}>{['10:00–12:00','12:00–14:00','14:00–16:00','16:00–18:00'].map(s=><option key={s}>{s}</option>)}</Field><Field label={t('Address or agreed center location')} required minLength={8} maxLength={300} {...bind('location')}/></div>
      <p className="hint mb-4">{t('This academic installation has no real mobile verification workforce or public centers. Arrange a synthetic test visit with your project administrator.')}</p>
      <label className="check mb-5"><input type="checkbox" checked={form.consent} onChange={e=>setForm({...form,consent:e.target.checked})}/><span>{t('I consent to sharing this visit location with the assigned agent and to temporary face and age-consistency processing during the appointment.')}</span></label>
      <Button busy={busy} type="submit" icon="calendar" disabled={!form.consent}>{t('Request appointment')}</Button>
    </form></Card>}
    {proof&&<Card className="mt-6" title={t('One-time visit code')} subtitle={t('Share this code only with the other participant in this appointment. It expires within ten minutes and cannot be reused.')}><p className="visit-token">{proof.token}</p>{proof.qr&&<img className="setup-qr" src={proof.qr} alt={t('One-time appointment QR code')}/>}<Button variant="outline" icon="eyeOff" onClick={()=>setProof(null)}>{t('Hide code')}</Button></Card>}
    {verification&&<Card className="mt-6" title={t('Controlled face verification')}><CameraVerification initial={verification} agent onCancel={()=>setVerification(null)} onComplete={()=>action('/appointments/'+verification.appointment_id+'/finish',{},()=>setVerification(null))}/></Card>}
    <h2 className="mt-8 mb-5">{t(agent?'Your jobs':admin?'All appointments':'Your appointments')} <span className="muted text-md">({list.length})</span></h2>
    <ApiState state={data}>{!list.length?<Card><EmptyState icon="calendar" title={t('No verification appointments yet')} message={t(citizen?'Request an appointment above if you cannot use self-service verification.':'New appointments will appear here as soon as they are assigned.')}/></Card>:<div className="appointment-grid">{list.map(a=><Card key={a.id} className="appt-card" title={t('Verification appointment')} subtitle={t('Job ID')+' '+a.id} actions={<Badge status={a.status}/>}>
      <Track status={a.status}/>
      <div className="appt-meta"><span><Icon name="calendar"/>{fmtDate(a.scheduled_date)}</span><span><Icon name="clock"/>{a.time_window}</span><span><Icon name="mapPin"/>{a.location}</span></div>
      <Details items={[[t('Citizen'),a.citizen_name],[t('Agent'),a.agent_name||t('Not assigned')],[t('Agent ID'),a.agent_code||'—'],[t('Authorization'),a.agent_status?String(a.agent_status).toLowerCase():'—']]}/>
      <div className="appt-actions">
        {agent&&['ASSIGNED','AGENT_ACCEPTED','EN_ROUTE'].includes(a.status)&&<Button busy={busy} icon="arrowRight" onClick={()=>action('/appointments/'+a.id+'/advance',{},r=>{if(r.token)setProof(r);})}>{t(({ASSIGNED:'Accept job',AGENT_ACCEPTED:'Start travel',EN_ROUTE:'Record arrival'})[a.status])}</Button>}
        {agent&&a.status==='CITIZEN_CONFIRMED_AGENT'&&<Button icon="key" onClick={()=>setDialog({kind:'verify-appointment',a})}>{t('Verify appointment')}</Button>}
        {citizen&&a.status==='ARRIVED'&&<Button icon="userCheck" onClick={()=>setDialog({kind:'verify-agent',a})}>{t('Verify agent')}</Button>}
        {admin&&['REQUESTED','RESCHEDULED','ASSIGNED'].includes(a.status)&&<Button icon="userCheck" onClick={()=>setDialog({kind:'assign',a})}>{t('Assign agent')}</Button>}
        {citizen&&['REQUESTED','RESCHEDULED','ASSIGNED','AGENT_ACCEPTED'].includes(a.status)&&<Button variant="outline" icon="calendar" onClick={()=>{setDialog({kind:'reschedule',a});setForm(f=>({...f,scheduled_date:String(a.scheduled_date).slice(0,10),time_window:a.time_window}));}}>{t('Reschedule')}</Button>}
        {agent&&['EN_ROUTE','ARRIVED','CITIZEN_CONFIRMED_AGENT','VERIFICATION_STARTED'].includes(a.status)&&<><Button variant="outline" busy={busy} onClick={()=>action('/appointments/'+a.id+'/outcome',{status:'NO_SHOW'})}>{t('Record no-show')}</Button><Button variant="outline" busy={busy} onClick={()=>action('/appointments/'+a.id+'/outcome',{status:'FAILED'})}>{t('Visit could not complete')}</Button></>}
        {(citizen||admin)&&['REQUESTED','RESCHEDULED','ASSIGNED','AGENT_ACCEPTED','EN_ROUTE','ARRIVED','CITIZEN_CONFIRMED_AGENT'].includes(a.status)&&<Button variant="ghost" busy={busy} onClick={()=>action('/appointments/'+a.id+'/cancel',{})}>{t('Cancel')}</Button>}
      </div>
    </Card>)}</div>}</ApiState>
    {dialog&&<Modal size="sm" title={t(({assign:'Assign approved agent',reschedule:'Reschedule appointment','verify-agent':'Confirm your agent','verify-appointment':'Confirm the appointment'})[dialog.kind])} onClose={()=>setDialog(null)}><form onSubmit={e=>{e.preventDefault();const kind=dialog.kind;action('/appointments/'+dialog.a.id+'/'+kind,kind==='assign'?{agent_id:Number(agentId)}:kind==='reschedule'?{scheduled_date:form.scheduled_date,time_window:form.time_window}:{token:code},r=>{if(kind==='verify-agent')setProof(r);if(kind==='verify-appointment')setVerification(r);});}}>
      {dialog.kind==='assign'?<Field label={t('Approved agent')} as="select" value={agentId} onChange={e=>setAgentId(e.target.value)} required><option value="">{t('Choose an agent')}</option>{agents.data?.filter(a=>a.status==='APPROVED').map(a=><option key={a.user_id} value={a.user_id}>{a.name} · {a.agent_code}</option>)}</Field>
      :dialog.kind==='reschedule'?<><Field label={t('Preferred date')} type="date" required {...bind('scheduled_date')}/><Field label={t('Time window')} required {...bind('time_window')}/></>
      :<><p className="mb-4">{t('Read the one-time code from the other participant. It must belong to this appointment.')}</p><Field label={t('One-time visit code')} className="code-field" value={code} onChange={e=>{let value=e.target.value;try{value=JSON.parse(value).token||value;}catch{}setCode(value);}} required autoComplete="off"/></>}
      <Button busy={busy} type="submit" className="btn-block mt-2">{t('Confirm')}</Button>
    </form></Modal>}
  </>;
}
