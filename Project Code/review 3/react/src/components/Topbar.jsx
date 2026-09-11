import AccessibilityControls from './AccessibilityControls.jsx';
import {useState} from 'react';
import {Link,useNavigate} from 'react-router';
import {useAuth,homeFor} from '../context/AuthContext.jsx';
import {useTheme} from '../context/ThemeContext.jsx';
import {useToast} from '../context/ToastContext.jsx';
import useApi from '../hooks/useApi.js';
import API from '../data/api.js';
import Icon from './Icon.jsx';
import {Avatar,Button,Dropdown,Field,useConfirm} from './ui/index.jsx';
import {legacyLink,timeAgo} from '../lib/format.js';
export function ThemeButton(){const {theme,toggle}=useTheme();return <button className="icon-btn" onClick={toggle} aria-label={theme==='dark'?'Switch to light mode':'Switch to dark mode'}><Icon name={theme==='dark'?'sun':'moon'} size={18}/></button>;}
export default function Topbar({onMenu,title}) {
  const {user,logout}=useAuth(),navigate=useNavigate(),toast=useToast(),confirm=useConfirm(),[q,setQ]=useState('');
  const notifications=useApi(()=>API.notifications.list(user.id),[user.id]);
  const list=notifications.data||[],unread=list.filter(n=>!n.is_read).length;
  const search=e=>{e.preventDefault();if(q.trim())navigate((user.role==='CITIZEN'?'/citizen/applications':user.role==='OFFICER'?'/officer/queue':'/admin/applications')+'?q='+encodeURIComponent(q.trim()));};
  async function signOut(){try{await logout();navigate('/login');}catch(e){toast(e.message,'error');}}
  async function reset(){if(await confirm({title:'Reset demo data?',message:'This removes changes made in this React demo and restores the original sample records. You will be signed out.',confirmLabel:'Reset demo',danger:true})){try{await API.demo.reset();await signOut();toast('Demo data restored.');}catch(e){toast(e.message,'error');}}}
  return <header className="topbar"><button className="icon-btn hamburger" aria-label="Open navigation" onClick={onMenu}><Icon name="menu"/></button><nav className="tb-crumb" aria-label="Breadcrumb"><Link to={homeFor(user.role)}>{user.role==='CITIZEN'?'My portal':user.role==='OFFICER'?'Officer desk':'Administration'}</Link><span>/</span><b>{title}</b></nav><div className="tb-actions"><form className="global-search" onSubmit={search}><label className="sr-only" htmlFor="global-search">Search applications</label><input id="global-search" className="input" type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Reference, name or service"/><button className="icon-btn" aria-label="Search applications"><Icon name="search" size={16}/></button></form><AccessibilityControls/><ThemeButton/><Dropdown label={'Notifications'+(unread?' ('+unread+' unread)':'')} className="notification-dropdown" trigger={<><Icon name="bell" size={18}/>{unread>0&&<span className="dot"/>}</>}>{close=><><div className="notif-head"><b>Notifications {unread?`(${unread})`:''}</b>{unread>0&&<button className="btn-link text-xs" onClick={()=>API.notifications.markRead(user.id).catch(e=>toast(e.message,'error'))}>Mark all read</button>}</div><div className="notif-list">{notifications.error?<p className="card-body">{notifications.error.message}</p>:list.length?list.slice(0,12).map(n=><Link onClick={close} className={'notif-item '+(!n.is_read?'unread':'')} to={legacyLink(n.link)} key={n.id}><span><b>{n.title}</b><span className="block text-xs muted">{n.message}</span><time className="text-xs muted">{timeAgo(n.created_at)}</time></span></Link>):<p className="card-body">You’re up to date. New decisions will appear here.</p>}</div></>}</Dropdown><Dropdown label="Account menu" trigger={<Avatar name={user.full_name} size="sm"/>}>{close=><><div className="dd-head">{user.full_name}</div><Link to="/profile" onClick={close}>My profile</Link><Link to="/" onClick={close}>Public site</Link>{API.MODE==='demo'&&<button onClick={()=>{close();reset();}}>Reset demo data</button>}<button onClick={()=>{close();signOut();}}>Sign out</button></>}</Dropdown></div></header>;
}
