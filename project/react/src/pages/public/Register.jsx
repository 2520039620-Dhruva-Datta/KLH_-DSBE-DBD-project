import {useState} from 'react';
import {Link,Navigate,useSearchParams} from 'react-router';
import {useAuth,homeFor} from '../../context/AuthContext.jsx';
import Icon from '../../components/Icon.jsx';
import {Alert,Button,Field,PasswordInput} from '../../components/ui/index.jsx';
import {safeNext} from '../../lib/format.js';
const cities=['Visakhapatnam','Vijayawada','Guntur','Tirupati','Kakinada','Rajahmundry','Nellore','Kurnool','Anantapur','Hyderabad','Warangal','Khammam'];
const points=[['filePlus','Your details prefill application forms.','Enter them once; every department reuses them.'],['activity','Follow every request from submission to decision.','Status changes arrive with the officer’s remarks.'],['fileText','Keep an accessible record.','Download acknowledgments and review your history any time.']];
export default function Register(){
  const auth=useAuth(),[params]=useSearchParams(),[form,setForm]=useState({full_name:'',email:'',phone:'',city:'',address:'',id_last4:'',password:'',confirm:''}),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const bind=key=>({value:form[key],onChange:e=>setForm({...form,[key]:e.target.value})});
  if(auth.user)return <Navigate replace to={safeNext(params.get('next'),homeFor(auth.user.role))}/>;
  async function submit(e){e.preventDefault();setError('');if(form.password!==form.confirm){setError('The two passwords do not match.');return;}setBusy(true);try{const {confirm,...data}=form;await auth.register(data);}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <div className="auth">
    <aside className="auth-aside"><div><p className="eyebrow">Citizen account</p><h2>Register once. Apply to every department.</h2><p>Your profile, applications and documents come together in one place.</p><ul className="auth-points">{points.map(([icon,title,text])=><li key={title}><Icon name={icon}/><span><b>{title}</b><span>{text}</span></span></li>)}</ul></div><p className="auth-note">Government Services Portal — Academic Prototype</p></aside>
    <section className="auth-main"><div className="auth-card register-card">
      <h1>Create a citizen account</h1><p className="lead">Use sample details for this academic demonstration. It takes about two minutes.</p>
      {error&&<div className="mb-5"><Alert type="danger">{error}</Alert></div>}
      <form onSubmit={submit}>
        <Field label="Full name" required minLength={3} autoComplete="name" {...bind('full_name')}/>
        <div className="grid-2"><Field label="Email address" type="email" required autoComplete="email" {...bind('email')}/><Field label="Mobile number" type="tel" required pattern="[6-9][0-9]{9}" maxLength={10} inputMode="numeric" hint="A 10-digit mobile number" {...bind('phone')}/><Field label="City / District" as="select" required {...bind('city')}><option value="">Select a city</option>{cities.map(c=><option key={c}>{c}</option>)}</Field><Field label="ID last 4 digits" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} hint="Optional. Only four digits are stored." {...bind('id_last4')}/></div>
        <Field label="Residential address" as="textarea" required minLength={8} autoComplete="street-address" {...bind('address')}/>
        <div className="grid-2"><PasswordInput required minLength={8} autoComplete="new-password" showMeter {...bind('password')}/><Field label="Confirm password" type="password" required minLength={8} autoComplete="new-password" hint={form.confirm&&form.confirm!==form.password?'The passwords do not match yet.':undefined} {...bind('confirm')}/></div>
        <label className="check mb-5"><input type="checkbox" required/><span>I confirm these details are correct and consent to their use for processing my applications.</span></label>
        <Button type="submit" busy={busy} className="btn-block">Create account</Button>
      </form>
      <div className="auth-switch"><span>Already registered?</span><Link to="/login">Sign in</Link></div>
    </div></section>
  </div>;
}
