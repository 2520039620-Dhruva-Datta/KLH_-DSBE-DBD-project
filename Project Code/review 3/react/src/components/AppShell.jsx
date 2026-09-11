import {useEffect,useState} from 'react';
import {Outlet,useLocation} from 'react-router';
import API from '../data/api.js';
import useApi from '../hooks/useApi.js';
import {useAuth} from '../context/AuthContext.jsx';
import Sidebar,{navigation} from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
export default function AppShell(){const {user}=useAuth(),{pathname}=useLocation(),[open,setOpen]=useState(false);const scope=user.role==='CITIZEN'?{user_id:user.id}:user.role==='OFFICER'?{department_id:user.department_id}:{};const stats=useApi(()=>API.analytics.kpis(scope),[user.id]);const title=navigation[user.role].find(([path])=>pathname===path)?.[1]||(pathname.includes('/review/')?'Review application':'Application details');useEffect(()=>{document.title=title+' — AMAP';setOpen(false);},[pathname,title]);useEffect(()=>{const key=e=>{if(e.key==='Escape')setOpen(false);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);return <div className="app"><a className="skip-link" href="#main-content">Skip to main content</a><Sidebar open={open} onClose={()=>setOpen(false)} counts={stats.data}/>{open&&<button className="scrim" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}<div className="app-main"><Topbar title={title} onMenu={()=>setOpen(!open)}/><main className="content" id="main-content"><Outlet/></main></div></div>;}
