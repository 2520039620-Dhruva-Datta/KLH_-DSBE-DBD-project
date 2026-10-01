import AccessibilityControls from './AccessibilityControls.jsx';
import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate} from 'react-router';
import {useAuth,homeFor} from '../context/AuthContext.jsx';
import {useTheme} from '../context/ThemeContext.jsx';
import {useToast} from '../context/ToastContext.jsx';
import useApi from '../hooks/useApi.js';
import API from '../data/api.js';
import Icon from './Icon.jsx';
import {Avatar,Dropdown,useConfirm} from './ui/index.jsx';
import {roleLabel,areaLabel} from './Sidebar.jsx';
import {legacyLink,timeAgo} from '../lib/format.js';

export function ThemeButton(){const {theme,toggle}=useTheme();return <button className="icon-btn" onClick={toggle} aria-label={theme==='dark'?'Switch to light mode':'Switch to dark mode'} title={theme==='dark'?'Light mode':'Dark mode'}><Icon name={theme==='dark'?'sun':'moon'} size={19}/></button>;}
const noticeIcon=n=>{const text=(n.title+' '+n.message).toLowerCase();return /approv|complete|resolved|verified/.test(text)?'checkCircle':/reject|revok|fail/.test(text)?'xCircle':/info|request|respond/.test(text)?'alert':/security|sign|device|mfa/.test(text)?'shield':/appointment|visit|agent/.test(text)?'calendar':'bell';};

export default function Topbar({onMenu,title}) {
  const {user,logout}=useAuth(),navigate=useNavigate(),toast=useToast(),confirm=useConfirm(),[q,setQ]=useState(''),searchRef=useRef(null);
  const notifications=useApi(()=>API.notifications.list(user.id),[user.id]);
  const list=notifications.data||[],unread=list.filter(n=>!n.is_read).length;
  const searchable=user.role!=='VERIFICATION_AGENT';
  // "/" or Ctrl/⌘+K jumps to search, as in most professional consoles.
  useEffect(()=>{if(!searchable)return;const key=e=>{const typing=/input|textarea|select/i.test(e.target.tagName)||e.target.isContentEditable;if((e.key==='k'&&(e.ctrlKey||e.metaKey))||(e.key==='/'&&!typing)){e.preventDefault();searchRef.current?.focus();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[searchable]);
  const search=e=>{e.preventDefault();if(q.trim())navigate((user.role==='CITIZEN'?'/citizen/applications':user.role==='OFFICER'?'/officer/queue':'/admin/applications')+'?q='+encodeURIComponent(q.trim()));};
  async function signOut(){try{await logout();navigate('/login');}catch(e){toast(e.message,'error');}}
  async function reset(){if(await confirm({title:'Reset demo data?',message:'This removes changes made in this React demo and restores the original sample records. You will be signed out.',confirmLabel:'Reset demo',danger:true})){try{await API.demo.reset();await signOut();toast('Demo data restored.');}catch(e){toast(e.message,'error');}}}
  return <header className="topbar">
    <button className="icon-btn hamburger" aria-label="Open navigation" onClick={onMenu}><Icon name="menu"/></button>
    <nav className="tb-crumb" aria-label="Breadcrumb"><Link to={homeFor(user.role)}>{areaLabel[user.role]}</Link><span aria-hidden="true">/</span><b aria-current="page">{title}</b></nav>
    <div className="tb-actions">
      {searchable&&<form className="global-search" role="search" onSubmit={search}><label className="sr-only" htmlFor="global-search">Search applications</label><Icon name="search" size={16}/><input ref={searchRef} id="global-search" className="input" type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search reference, name or service" autoComplete="off"/><kbd aria-hidden="true">Ctrl K</kbd></form>}
      <AccessibilityControls/>
      <ThemeButton/>
      <Dropdown label={'Notifications'+(unread?' ('+unread+' unread)':'')} className="notification-dropdown" trigger={<><Icon name="bell" size={19}/>{unread>0&&<span className="dot"/>}</>}>{close=><>
        <div className="notif-head"><b>Notifications {unread?<span className="muted text-sm">· {unread} new</span>:null}</b>{unread>0&&<button onClick={()=>API.notifications.markRead(user.id).catch(e=>toast(e.message,'error'))}>Mark all read</button>}</div>
        <div className="notif-list">{notifications.error?<p className="notif-empty">{notifications.error.message}</p>:list.length?list.slice(0,10).map(n=><Link onClick={close} className={'notif-item '+(!n.is_read?'unread':'')} to={legacyLink(n.link)} key={n.id}><span className="n-ico"><Icon name={noticeIcon(n)}/></span><span className="flex-1"><b>{n.title}</b><span className="block text-xs muted">{n.message}</span><time className="text-xs muted">{timeAgo(n.created_at)}</time></span></Link>):<div className="notif-empty"><Icon name="checkCircle" size={26} className="mb-2"/>You’re all caught up. New decisions will appear here.</div>}</div>
        <Link className="notif-foot" to="/notifications" onClick={close}>View all notifications</Link>
      </>}</Dropdown>
      <Dropdown label="Account menu" trigger={<Avatar name={user.full_name} size="sm"/>}>{close=><>
        <div className="dd-head"><Avatar name={user.full_name}/><span className="flex-1"><b>{user.full_name}</b><span>{user.email}</span><span>{roleLabel[user.role]}</span></span></div>
        {user.role!=='VERIFICATION_AGENT'&&<Link to="/profile" onClick={close}><Icon name="user"/>My profile</Link>}
        <Link to="/security" onClick={close}><Icon name="lock"/>Security settings</Link>
        <Link to="/" onClick={close}><Icon name="globe"/>Public site</Link>
        {API.MODE==='demo'&&<button onClick={()=>{close();reset();}}><Icon name="refresh"/>Reset demo data</button>}
        <div className="sep"/>
        <button className="danger" onClick={()=>{close();signOut();}}><Icon name="logout"/>Sign out</button>
      </>}</Dropdown>
    </div>
  </header>;
}
