import {useState} from 'react';
import {Link,useNavigate} from 'react-router';
import API from '../../data/api.js';
import useApi from '../../hooks/useApi.js';
import Icon from '../../components/Icon.jsx';
import {ApiState,Button,ButtonLink,EmptyState,Field,Modal} from '../../components/ui/index.jsx';
import {money,num} from '../../lib/format.js';
import {matchesService,popularServices,serviceIcon} from '../../lib/services.js';

const steps=[['Create your account','Register once with your basic details.'],['Send your application','Choose a service and attach your documents.'],['Follow the review','See updates and respond if more details are needed.'],['Get your decision','Read the outcome and save your acknowledgment.']];
const promises=[['shield','Protected by the server','Every decision is checked by role, department and ownership, and recorded in an audit trail.'],['eye','Transparent at every step','Each status change carries the officer’s remarks, visible to you as soon as it happens.'],['users','Built for everyone','Larger text, high contrast, dark mode and keyboard access on every page.']];
const nextSteps=['Sign in or create a free citizen account.','Fill in the short form and attach the documents listed.','Track the review; respond if the officer asks for more.'];

export default function Home(){
  const navigate=useNavigate(),[service,setService]=useState(null),[reference,setReference]=useState(''),[query,setQuery]=useState('');
  const state=useApi(async()=>{const [departments,services]=await Promise.all([API.departments.list(),API.services.list()]);return {departments,services};},[]);
  const stats=useApi(()=>API.analytics.publicCounts(),[],{subscribe:false}),samples=useApi(()=>API.applications.samples(),[],{subscribe:false});
  const s=stats.data,data=state.data,departmentOf=x=>data?.departments.find(d=>d.id===x.department_id);
  const active=data?data.services.filter(x=>x.is_active):[],matching=active.filter(x=>matchesService(x,departmentOf(x),query)),popular=data?popularServices(data.services):[];
  const groups=data?data.departments.map((dep,i)=>({dep,i,services:matching.filter(x=>x.department_id===dep.id)})).filter(g=>!query||g.services.length):[];
  const current=service&&departmentOf(service);
  return <>
    <section className="entry-hero"><div className="entry-container hero-grid">
      <div className="hero-copy">
        <span className="hero-badge"><span className="pulse" aria-hidden="true"/>Academic prototype · live service records</span>
        <h1>Apply once. <em>Follow every step.</em></h1>
        <p className="entry-purpose">From Aadhaar and PAN to certificates, licences and pensions: apply for public services and follow each request from submission to decision.</p>
        <div className="entry-actions"><ButtonLink to="/citizen/apply" icon="arrowRight">Apply for a service</ButtonLink><ButtonLink to="/#services" variant="outline" icon="grid">Browse all services</ButtonLink></div>
        {s&&<dl className="hero-stats" aria-label="Portal at a glance">{[[num(s.applications),'Applications handled'],[num(s.services),'Online services'],[num(s.departments),'Departments'],[Math.round(Number(s.approvalRate)||0)+'%','Approval rate']].map(([value,label])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
      </div>
      <aside className="hero-track" aria-labelledby="hero-track-title">
        <span className="hero-track-ico"><Icon name="search"/></span>
        <h2 id="hero-track-title">Where is my application?</h2>
        <p>Enter the reference on your acknowledgment. No sign-in needed.</p>
        <form className="track-form" onSubmit={e=>{e.preventDefault();if(reference.trim())navigate('/track?ref='+encodeURIComponent(reference.trim().toUpperCase()));}}><Field label="Reference number" value={reference} onChange={e=>setReference(e.target.value)} placeholder="For example GOV-2026-000421" required autoComplete="off"/><Button type="submit" icon="arrowRight">Track application</Button></form>
        {samples.data?.length>0&&<div className="hero-track-foot"><span>Try a demo reference:</span>{samples.data.map(x=><Link className="sample-ref" key={x.ref} to={'/track?ref='+encodeURIComponent(x.ref)}>{x.ref}</Link>)}</div>}
      </aside>
    </div></section>

    {popular.length>0&&<section className="entry-container entry-popular" aria-labelledby="popular-title">
      <div className="entry-section-head"><div><p className="eyebrow">Most requested</p><h2 id="popular-title">Identity documents, made simpler.</h2></div><p>Aadhaar, PAN, passports and more, alongside every department service.</p></div>
      <div className="popular-grid">{popular.map((x,i)=><button key={x.id} className="popular-card" style={{animationDelay:i*50+'ms'}} onClick={()=>setService(x)}><span className="popular-ico"><Icon name={serviceIcon(x,departmentOf(x))} size={22}/></span><b>{x.name}</b><span className="popular-meta">{money(x.fee)} · {x.sla_days} days</span><Icon name="arrowRight" size={16} className="popular-go"/></button>)}</div>
    </section>}

    <section className="entry-catalogue entry-container" id="services">
      <div className="entry-section-head"><div><p className="eyebrow">Find the right department</p><h2>What do you need help with?</h2></div><div className="catalogue-search"><Icon name="search" size={18}/><label className="sr-only" htmlFor="catalogue-search">Search services</label><input id="catalogue-search" className="input" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={'Search '+(active.length||'all')+' services — try “PAN” or “pension”'} autoComplete="off"/></div></div>
      {query&&data&&<p className="scope-note" aria-live="polite"><Icon name="filter" size={15}/>{matching.length} {matching.length===1?'service matches':'services match'} “{query}”{matching.length>0&&<> · <button className="btn-link" onClick={()=>setQuery('')}>Show all</button></>}</p>}
      <ApiState state={state}>{data&&(groups.length?<div className="entry-service-grid">{groups.map(({dep,i,services})=><article className="entry-department" key={dep.id}>
        <div className="entry-department-title"><span className="dept-ico"><Icon name={dep.icon} size={21}/></span><h3>{dep.name}</h3><span className="department-number" aria-hidden="true">{String(i+1).padStart(2,'0')}</span></div>
        <ul>{services.map(x=><li key={x.id}><button onClick={()=>setService(x)}><span>{x.name}</span><Icon name="arrowUpRight" size={15}/></button></li>)}</ul>
        {!services.length&&<p className="muted text-sm mt-3">No services accepting applications yet.</p>}
      </article>)}</div>:<EmptyState icon="search" title="No matching services" message="Try a shorter word, such as “licence”, “certificate” or “card”."><Button variant="outline" onClick={()=>setQuery('')}>Show all services</Button></EmptyState>)}</ApiState>
    </section>

    <section className="entry-how entry-container" aria-labelledby="how-title">
      <p className="eyebrow">How it works</p><h2 id="how-title">A clear path from here.</h2>
      <ol>{steps.map(([title,text],i)=><li key={title}><span className="step-index">{i+1}</span><h3>{title}</h3><p>{text}</p></li>)}</ol>
    </section>
    <section className="entry-container" aria-label="Our commitments"><div className="entry-trust">{promises.map(([icon,title,text])=><div key={title}><Icon name={icon}/><p><b>{title}</b><span>{text}</span></p></div>)}</div></section>

    {service&&<Modal title={service.name} onClose={()=>setService(null)} actions={<><Button variant="outline" onClick={()=>setService(null)}>Close</Button><ButtonLink to={'/citizen/apply?service='+service.id} icon="arrowRight">Apply for this service</ButtonLink></>}>
      <div className="service-sheet">
        <div className="service-sheet-head"><span className="popular-ico"><Icon name={serviceIcon(service,current)} size={22}/></span><div><p className="eyebrow">{current?.name}</p><p className="mt-1">{service.description}</p></div></div>
        <div className="service-facts"><div><span>Demo fee</span><b>{money(service.fee)}</b></div><div><span>Published timeline</span><b>{service.sla_days} days</b></div><div><span>Documents</span><b>{service.docs.length}</b></div></div>
        <h3 className="mt-6 mb-3">Documents to keep ready</h3>
        <ul className="document-checklist">{service.docs.map(doc=><li key={doc}>{doc}</li>)}</ul>
        <h3 className="mt-6 mb-3">What happens next</h3>
        <ol className="service-steps">{nextSteps.map(text=><li key={text}>{text}</li>)}</ol>
        <p className="hint mt-5">This is an academic demonstration. No payment is collected and no official document, card or number is issued.</p>
      </div>
    </Modal>}
  </>;
}
