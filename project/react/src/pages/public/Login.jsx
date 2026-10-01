import {useEffect,useRef,useState} from 'react';
import {Link,Navigate,useSearchParams} from 'react-router';
import {useAuth,homeFor} from '../../context/AuthContext.jsx';
import {useLanguage,LanguageSelect} from '../../context/LanguageContext.jsx';
import {Alert,Button,Field} from '../../components/ui/index.jsx';
import {safeNext} from '../../lib/format.js';
import Icon from '../../components/Icon.jsx';

export const demos=[{role:'CITIZEN',label:'Citizen',email:'citizen@demo.gov',password:'citizen123'},{role:'OFFICER',label:'Officer',email:'officer@demo.gov',password:'officer123'},{role:'ADMIN',label:'Admin',email:'admin@demo.gov',password:'admin123'},{role:'VERIFICATION_AGENT',label:'Agent',email:'agent@demo.gov',password:'AgentDemo123!'}];
const points=[['shield','Account access enforced by the server','Every request is checked for your role and ownership.'],['key','MFA and revocable sessions','Add an authenticator and sign out devices you do not recognise.'],['fingerprint','Identity recovery with explicit consent','Face checks run only after you agree, and never search other people.']];

// The server determines the account's role from its credentials, so citizens,
// officers, administrators and agents all use the same sign-in form.
export default function Login(){
  const auth=useAuth(),{t}=useLanguage(),[params]=useSearchParams();
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[show,setShow]=useState(false),[caps,setCaps]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[cooldown,setCooldown]=useState(0),[challenge,setChallenge]=useState(null),[code,setCode]=useState(''),errorRef=useRef();
  useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
  useEffect(()=>{if(!cooldown)return;const timer=setInterval(()=>setCooldown(n=>Math.max(0,n-1)),1000);return()=>clearInterval(timer);},[!!cooldown]);
  if(auth.user)return <Navigate replace to={safeNext(params.get('next'),homeFor(auth.user.role))}/>;
  function fill(d){setEmail(d.email);setPassword(d.password);setError('');setChallenge(null);}
  async function submit(e){e.preventDefault();setBusy(true);setError('');try{const result=challenge?await auth.challenge(challenge,code):await auth.login(email,password);if(result?.mfa_required){setChallenge(result.challenge);setPassword('');}}catch(e){setError(e.message);if(e.status===429)setCooldown(e.retryAfter||60);}finally{setBusy(false);}}
  return <div className="auth secure-login">
    <aside className="auth-aside">
      <div className="secure-login-copy">
        <p className="eyebrow">AMAP · {t('Academic sandbox')}</p>
        <h2>{t('Your services. Your identity. Your control.')}</h2>
        <p>{t('Secure access to your applications, documents and account. Follow every decision in one place.')}</p>
        <ul className="auth-points">{points.map(([icon,title,text])=><li key={title}><Icon name={icon}/><span><b>{t(title)}</b><span>{t(text)}</span></span></li>)}</ul>
      </div>
      <p className="auth-note">{t('Government Services Portal — Academic Prototype. Sandbox identities only; no UIDAI connection or government endorsement.')}</p>
    </aside>
    <section className="auth-main"><div className="auth-card">
      <div className="auth-top"><LanguageSelect/></div>
      {challenge&&<span className="mfa-mark"><Icon name="shield" size={28}/></span>}
      <h1>{t(challenge?'Verify your sign-in':'Sign in')}</h1>
      <p className="lead">{t(challenge?'Enter your authenticator code or a single-use recovery code.':'Use the email and password registered with AMAP. We’ll take you to the right workspace.')}</p>
      {params.get('expired')&&<Alert type="warning">{t('Your session expired or was revoked. Sign in again to continue.')}</Alert>}
      {error&&<div ref={errorRef} tabIndex={-1} className="mb-5"><Alert type="danger">{error}</Alert></div>}
      <form className="mt-5" onSubmit={submit}>
        {challenge?<Field label={t('Authenticator or recovery code')} className="code-field" value={code} onChange={e=>setCode(e.target.value)} required autoComplete="one-time-code" autoFocus inputMode="text"/>:<>
          <Field label={t('Email address')} type="email" value={email} required autoComplete="username" placeholder="name@example.gov" onChange={e=>setEmail(e.target.value)}/>
          <div className="password-field"><Field label={t('Password')} type={show?'text':'password'} value={password} required autoComplete="current-password" onChange={e=>setPassword(e.target.value)} onKeyUp={e=>setCaps(e.getModifierState('CapsLock'))}/><button type="button" className="password-toggle icon-btn" aria-label={t(show?'Hide password':'Show password')} onClick={()=>setShow(!show)}><Icon name={show?'eyeOff':'eye'} size={17}/></button></div>
          {caps&&<p className="hint mb-4" role="status">{t('Caps Lock is on.')}</p>}
        </>}
        <Button busy={busy} disabled={cooldown>0||auth.loading} type="submit" className="btn-block">{cooldown?t('Try again in')+' '+cooldown+' s':t(challenge?'Verify and sign in':'Sign in')}</Button>
      </form>
      {challenge?<Button className="mt-4" variant="ghost" icon="arrowLeft" onClick={()=>{setChallenge(null);setCode('');}}>{t('Back to password sign-in')}</Button>:<>
        <div className="login-recovery-links"><Link to="/forgot-password">{t('Forgot password?')}</Link><Link to="/recover-identity">{t('Forgot Aadhaar / Recover Identity')}</Link></div>
        <div className="auth-switch"><span>{t('New to AMAP?')}</span><Link to="/register">{t('Create a citizen account')}</Link></div>
      </>}
      <details className="demo-creds"><summary><Icon name="key" size={16}/><span>{t('Development test accounts')}</span><span className="tag">{t('Demo only')}</span></summary>
        <div className="demo-grid">{demos.map(d=><div className="demo-row" key={d.role}><div className="flex-1"><b>{t(d.label)}</b><p className="cred">{d.email}<br/>{d.password}</p></div><Button variant="outline" className="btn-sm" onClick={()=>fill(d)} aria-label={'Fill '+d.label+' demo'}>{t('Fill')}</Button></div>)}</div>
        <p className="hint">{t('The restricted agent test account is added by the identity seed command. Use synthetic personal details only.')}</p>
      </details>
    </div></section>
  </div>;
}
