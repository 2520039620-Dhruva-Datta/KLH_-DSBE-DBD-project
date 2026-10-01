import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router';
import API from '../../data/api.js';
import useApi from '../../hooks/useApi.js';
import Icon from '../../components/Icon.jsx';
import {Alert,ApiState,Badge,Button,Card,EmptyState,Field,PageHead,Table} from '../../components/ui/index.jsx';
import {useLanguage} from '../../context/LanguageContext.jsx';
import {fmtDate} from '../../lib/format.js';
export default function AgentDevice(){
  const {t}=useLanguage(),[label,setLabel]=useState(''),[locked,setLocked]=useState(false),[busy,setBusy]=useState(false),[live,setLive]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),video=useRef(null),stream=useRef(null),alive=useRef(true);
  const state=useApi(()=>API.verification('GET','/devices'),[]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;stream.current?.getTracks().forEach(track=>track.stop());};},[]);
  async function qualify(e){e.preventDefault();setBusy(true);setError('');setMessage('');try{
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error(t('Use a secure browser with a camera.'));
    const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1280},height:{ideal:720}},audio:false});
    if(!alive.current){media.getTracks().forEach(track=>track.stop());return;}
    stream.current=media;video.current.srcObject=media;await video.current.play();setLive(true);
    setMessage(t('Camera connected. Hold still while capturing device quality evidence.'));
    await new Promise(resolve=>setTimeout(resolve,2000));if(!alive.current)return;
    // Match the delivered aspect ratio; a stretched frame would misrepresent camera quality.
    const w=video.current.videoWidth||640,h=video.current.videoHeight||480,scale=Math.min(1,960/Math.max(w,h)),canvas=document.createElement('canvas');canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);
    canvas.getContext('2d').drawImage(video.current,0,0,canvas.width,canvas.height);
    await API.verification('POST','/devices',{label,capabilities:{secure_context:window.isSecureContext,screen_lock_confirmed:locked},frames:[canvas.toDataURL('image/jpeg',.88)]});
    setMessage(t('Quality evidence accepted. An administrator must now review and approve this device.'));setLabel('');setLocked(false);
  }catch(e){if(alive.current)setError(e.name==='NotAllowedError'?t('Camera permission denied. Allow camera access and try again.'):e.message);}
  finally{stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;if(video.current)video.current.srcObject=null;if(alive.current){setBusy(false);setLive(false);}}}
  return <>
    <PageHead eyebrow={t('Field verification')} title={t('Agent device qualification')} lead={t('Approval depends on usable camera evidence and a device review, not on a phone brand.')}><Link className="btn btn-outline" to="/agent"><Icon name="inbox" size={17}/>{t('Assigned jobs')}</Link><Link className="btn btn-outline" to="/security"><Icon name="key" size={17}/>{t('MFA and security')}</Link></PageHead>
    {error&&<div className="mb-5"><Alert type="danger">{error}</Alert></div>}
    {message&&<div className="mb-5"><Alert type={message.includes('accepted')?'success':'info'}>{message}</Alert></div>}
    <div className="dash-grid">
      <div className="col-7"><Card title={t('Submit this device for review')} subtitle={t('Takes a single well-lit frame from the rear camera.')}><form onSubmit={qualify}>
        <Field label={t('Device label')} required minLength={3} value={label} onChange={e=>setLabel(e.target.value)} placeholder={t('For example Field phone 2')}/>
        <div className={'camera-stage'+(live?' is-live':'')} data-phase={busy?'capturing':'idle'}><video ref={video} muted playsInline aria-label={t('Device camera preview')}/>{!live&&<div className="camera-placeholder"><Icon name="smartphone" size={34}/><p>{t('Camera starts when you submit')}</p><small>{t('Point it at a consenting test subject in good light.')}</small></div>}</div>
        <label className="check my-4"><input type="checkbox" checked={locked} onChange={e=>setLocked(e.target.checked)}/><span>{t('This device has a screen lock and device encryption. I understand an administrator must review this attestation.')}</span></label>
        <p className="hint mb-5">{t('Use a test subject with consent. Captured images are processed temporarily and discarded. Every appointment must pass image quality again.')}</p>
        <Button busy={busy} disabled={!locked} type="submit" icon="camera" className="btn-lg">{t('Capture and submit device evidence')}</Button>
      </form></Card></div>
      <div className="col-5"><Card title={t('My devices')} flush><ApiState state={state}><Table rows={state.data||[]} caption={t('My devices')} empty={<EmptyState icon="smartphone" title={t('No devices submitted')} message={t('Submit this device to start the approval review.')}/>} columns={[{key:'label',label:t('Device')},{key:'created_at',label:t('Submitted'),render:r=>fmtDate(r.created_at)},{key:'status',label:t('Status'),render:r=><Badge status={r.status}/>}]}/></ApiState></Card></div>
    </div>
  </>;
}
