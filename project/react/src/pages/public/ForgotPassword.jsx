import {useState} from 'react';
import {Link,useSearchParams} from 'react-router';
import API from '../../data/api.js';
import Icon from '../../components/Icon.jsx';
import {Alert,Button,Card,Field,PasswordInput} from '../../components/ui/index.jsx';
import {useLanguage,LanguageSelect} from '../../context/LanguageContext.jsx';
export default function ForgotPassword({reset=false}){
  const {t}=useLanguage(),[params]=useSearchParams(),[value,setValue]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  async function submit(e){e.preventDefault();setBusy(true);setError('');try{const result=reset?await API.auth.reset(params.get('token')||'',value):await API.auth.forgot(value);setMessage(reset?t('Your password was updated. Sign in with your new password.'):result.message);}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <div className="public-page recovery-entry"><Card>
    <div className="auth-top"><LanguageSelect/></div>
    <div className="recovery-intro"><Icon name={reset?'key':'lock'}/><div><h1>{t(reset?'Choose a new password':'Recover your account')}</h1><p>{t('Recovery instructions are prepared only for eligible accounts. For this development installation, messages are saved in the local outbox; no external email is sent.')}</p></div></div>
    {error&&<div className="mb-5"><Alert type="danger">{error}</Alert></div>}
    {message?<Alert type="success">{message}</Alert>:<form onSubmit={submit}>{reset?<PasswordInput label={t('New password')} value={value} onChange={e=>setValue(e.target.value)} required minLength={8} showMeter autoComplete="new-password"/>:<Field label={t('Email address')} type="email" required value={value} onChange={e=>setValue(e.target.value)} autoComplete="username"/>}<Button busy={busy} type="submit" icon="arrowRight">{t(reset?'Update password':'Prepare recovery instructions')}</Button></form>}
    <p className="mt-6"><Link to="/login">{t('Back to sign in')}</Link></p>
  </Card></div>;
}
