import {useState} from 'react';
import {Link} from 'react-router';
import API from '../../data/api.js';
import Icon from '../../components/Icon.jsx';
import {Alert,Button,Card,Details,Field} from '../../components/ui/index.jsx';
import CameraVerification from '../../components/CameraVerification.jsx';
import {useLanguage,LanguageSelect} from '../../context/LanguageContext.jsx';
export default function RecoverIdentity(){
  const {t}=useLanguage(),[email,setEmail]=useState(''),[session,setSession]=useState(null),[result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function start(e){e.preventDefault();setBusy(true);setError('');try{setSession(await API.identity('POST','/sessions',{kind:'RECOVERY',email}));}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <div className="public-page recovery-entry"><Card>
    <div className="auth-top"><LanguageSelect/></div>
    <div className="recovery-intro"><Icon name="fingerprint"/><div><h1>{t('Forgot Aadhaar / Recover Identity')}</h1><p>{t('Recover the synthetic identity linked to your AMAP account. No real Aadhaar lookup or UIDAI access is available.')}</p></div></div>
    {error&&<div className="mb-5"><Alert type="danger">{error}</Alert></div>}
    {result?<div className="cv-result is-ok"><span className="cv-result-icon"><Icon name="checkCircle" size={34}/></span><div className="flex-1"><h2 className="mb-4">{t('Identity verified')}</h2><Details items={[[t('Name'),result.name],[t('Synthetic Aadhaar'),<span className="masked-id">{result.aadhaar}</span>],[t('Provider'),result.provider]]}/><p className="hint mt-4">{t('This result is masked and has no official identity validity.')}</p></div></div>
    :session?<CameraVerification initial={session} onCancel={()=>setSession(null)} onComplete={r=>{setResult(r);setSession(null);}}/>
    :<form onSubmit={start}><p className="mb-5">{t('Start with your registered email. You do not need to know your Aadhaar number. Verification checks only the claimed account; it never searches the population.')}</p><Field label={t('Registered email address')} type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/><Button type="submit" busy={busy} icon="arrowRight">{t('Continue')}</Button></form>}
    <p className="mt-6 flex flex-wrap gap-2"><Link to="/login">{t('Back to sign in')}</Link><span aria-hidden="true">·</span><Link to="/forgot-password">{t('Recover account access')}</Link></p>
  </Card></div>;
}
