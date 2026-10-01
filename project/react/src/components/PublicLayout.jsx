import AccessibilityControls from './AccessibilityControls.jsx';
import {useEffect} from 'react';
import {Link,NavLink,Outlet,useLocation} from 'react-router';
import {Wordmark} from './Sidebar.jsx';
import {ThemeButton} from './Topbar.jsx';
import {useAuth,homeFor} from '../context/AuthContext.jsx';

export default function PublicLayout(){
  const {pathname,hash}=useLocation(),{user}=useAuth();
  useEffect(()=>{document.title=({'/':'AMAP — Apply for public services','/login':'Sign in — AMAP','/register':'Create an account — AMAP','/track':'Track an application — AMAP','/forgot-password':'Recover your account — AMAP','/recover-identity':'Recover your identity — AMAP'}[pathname]||'AMAP');},[pathname]);
  // Section links such as /#services scroll to their target; other routes start at the top.
  useEffect(()=>{if(hash)requestAnimationFrame(()=>document.getElementById(hash.slice(1))?.scrollIntoView({behavior:'smooth',block:'start'}));else window.scrollTo(0,0);},[pathname,hash]);
  const link=({isActive})=>isActive?'is-active':'';
  return <>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="site-header"><nav className="site-nav" aria-label="Public navigation">
      <Wordmark/>
      <div className="public-links"><Link to="/#services">Services</Link><NavLink to="/track" className={link}>Track application</NavLink>{user?<Link className="btn btn-primary" to={homeFor(user.role)}>Open my dashboard</Link>:<><NavLink to="/register" className={link}>Register</NavLink><Link className="btn btn-primary" to="/login">Sign in</Link></>}</div>
      <div className="public-tools"><AccessibilityControls/><ThemeButton/></div>
    </nav></header>
    <main id="main-content"><Outlet/></main>
    <footer className="site-footer"><div className="footer-in">
      <div><p><b>AMAP — Government Services Portal · Academic Prototype</b></p><p className="mt-2">Dhruva Datta Vishnubhotla · Somana Divya Sai · Ayusha Das</p><p className="text-sm">Under the guidance of Dr. R. Sateesh Kumar</p><p className="footer-note mt-3">Demonstration services, fees and documents. This project is not an official government service.</p></div>
      <nav className="footer-links" aria-label="Footer"><Link to="/#services">Services</Link><Link to="/track">Track application</Link><Link to="/recover-identity">Recover identity</Link><Link to="/forgot-password">Account recovery</Link></nav>
    </div></footer>
  </>;
}
