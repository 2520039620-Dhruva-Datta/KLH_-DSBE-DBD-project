import {useState} from 'react';
import {Link} from 'react-router';
import API from '../../data/api.js';
import useApi from '../../hooks/useApi.js';
import {useAuth} from '../../context/AuthContext.jsx';
import {useLanguage} from '../../context/LanguageContext.jsx';
import Icon from '../../components/Icon.jsx';
import {Alert,ApiState,Button,Card,EmptyState,PageHead,Table} from '../../components/ui/index.jsx';
import {fmtDate,legacyLink,timeAgo} from '../../lib/format.js';
export default function PersonalRecords({notifications=false}){
  const {user}=useAuth(),{t}=useLanguage(),[error,setError]=useState(''),[offset,setOffset]=useState(0);
  const state=useApi(()=>notifications?API.notifications.list(user.id):API.applications.list({limit:20,offset}),[notifications,offset]);
  const unread=notifications?(state.data||[]).filter(n=>!n.is_read).length:0;
  return <>
    <PageHead eyebrow={t('Account')} title={t(notifications?'Notifications':'My documents')} lead={t(notifications?'Decisions, appointments and security updates.':'Open an application to view or download its protected documents.')}>{notifications&&<Button icon="checkCircle" disabled={!unread} onClick={()=>API.notifications.markRead(user.id).catch(e=>setError(e.message))}>{t('Mark all read')}</Button>}</PageHead>
    {error&&<div className="mb-5"><Alert type="danger">{error}</Alert></div>}
    {notifications?<Card title={unread?unread+' '+t('unread'):t('All caught up')} subtitle={t('Newest first')} flush><ApiState state={state}>{state.data?.length?<ol className="feed">{state.data.map((n,i)=><li key={n.id} className={'feed-item notif-item'+(!n.is_read?' unread':'')} style={{animationDelay:Math.min(i,10)*25+'ms'}}><span className="n-ico"><Icon name={n.is_read?'bell':'info'}/></span><div className="flex-1"><b>{n.title}</b><p className="text-sm muted">{n.message}</p><time className="text-xs muted" dateTime={n.created_at} title={fmtDate(n.created_at,true)}>{timeAgo(n.created_at)}</time></div>{n.link&&<Link className="btn btn-outline btn-sm" to={legacyLink(n.link)}>{t('View')}</Link>}</li>)}</ol>:<EmptyState icon="bell" title={t('No notifications yet')} message={t('Decisions, requests for information and security alerts will appear here.')}/>}</ApiState></Card>
    :<Card flush><ApiState state={state}><Table offset={offset} onPage={setOffset} limit={20} total={state.data?.total} rows={state.data?.rows||[]} caption={t('Documents by application')} empty={<EmptyState icon="fileText" title={t('No documents yet')} message={t('Documents you attach to applications will be listed here.')}/>} columns={[{key:'ref',label:t('Application'),render:r=><span className="mono">{r.ref}</span>},{key:'service',label:t('Service'),render:r=>r.service.name},{key:'document_count',label:t('Documents')},{key:'action',label:t('Open'),action:true,render:r=><Link className="btn btn-outline btn-sm" to={'/citizen/applications/'+r.id}>{t('View documents')}</Link>}]}/></ApiState></Card>}
  </>;
}
