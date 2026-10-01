import {useEffect,useState} from 'react';
import {NavLink,Outlet,useLocation} from 'react-router';
import API from '../data/api.js';
import useApi from '../hooks/useApi.js';
import {useAuth} from '../context/AuthContext.jsx';
import Icon from './Icon.jsx';
import Sidebar,{navigation,exactRoots,shortLabel} from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

// Routes that are not sidebar destinations still need a meaningful title.
const subTitles={'/identity/face':'Face verification','/identity/history':'Verification history','/identity/privacy':'Consent & privacy','/identity/appointments':'Assisted verification','/admin/verification/appointments':'Verification appointments','/notifications':'Notifications','/documents':'Documents','/profile':'My profile','/security':'Security'};
function titleFor(role,pathname){return navigation[role].find(([path])=>pathname===path)?.[1]||subTitles[pathname]||(pathname.includes('/review/')?'Review application':pathname.startsWith('/citizen/applications/')?'Application details':'AMAP');}

export default function AppShell(){
  const {user}=useAuth(),{pathname}=useLocation(),[open,setOpen]=useState(false);
  const scope=user.role==='CITIZEN'?{user_id:user.id}:user.role==='OFFICER'?{department_id:user.department_id}:{};
  const stats=useApi(()=>user.role==='VERIFICATION_AGENT'?Promise.resolve(null):API.analytics.kpis(scope),[user.id]);
  const title=titleFor(user.role,pathname),mobile=navigation[user.role].filter(item=>item[4]).slice(0,4);
  useEffect(()=>{document.title=title+' — AMAP';setOpen(false);},[pathname,title]);
  useEffect(()=>{const key=e=>{if(e.key==='Escape')setOpen(false);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  return <div className="app">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <Sidebar open={open} onClose={()=>setOpen(false)} counts={stats.data}/>
    {open&&<button className="scrim" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
    <div className="app-main">
      <Topbar title={title} onMenu={()=>setOpen(!open)}/>
      <main className="content" id="main-content"><div className="page-enter" key={pathname}><Outlet/></div></main>
    </div>
    <nav className="mobile-nav" aria-label="Quick navigation" style={{'--items':mobile.length+1}}>
      {mobile.map(([to,label,icon])=><NavLink key={to} to={to} end={exactRoots.includes(to)} className={({isActive})=>isActive?'is-active':''} aria-label={label}><Icon name={icon}/><span aria-hidden="true">{shortLabel[to]||label}</span></NavLink>)}
      <button type="button" onClick={()=>setOpen(true)} aria-label="All sections" aria-expanded={open}><Icon name="menu"/><span aria-hidden="true">More</span></button>
    </nav>
  </div>;
}
