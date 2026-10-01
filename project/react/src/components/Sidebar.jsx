import {Link,NavLink} from 'react-router';
import Icon from './Icon.jsx';
import {Avatar} from './ui/index.jsx';
import {useAuth} from '../context/AuthContext.jsx';

// [path, label, icon, badge?, onMobileBar?]
export const navGroups={
  CITIZEN:[['My portal',[['/citizen','Dashboard','dashboard',null,true],['/citizen/apply','Apply for a service','filePlus',null,true],['/citizen/applications','Applications','files','open',true],['/documents','Documents','fileText'],['/citizen/grievances','My grievances','megaphone']]],['Identity & security',[['/identity','Digital Identity','fingerprint',null,true],['/security','Security','lock']]],['Account',[['/notifications','Notifications','bell'],['/profile','My profile','user']]]],
  OFFICER:[['Officer desk',[['/officer','Dashboard','dashboard',null,true],['/officer/queue','Application queue','inbox','open',true],['/officer/grievances','Grievances','megaphone',null,true],['/officer/verification','Verification history','shield',null,true]]],['Account',[['/security','Security','lock'],['/profile','My profile','user']]]],
  ADMIN:[['Insights',[['/admin','Analytics dashboard','barChart',null,true],['/admin/reports','Reports & export','report']]],['Operations',[['/admin/applications','All applications','files','open',true],['/admin/verification','Verification center','shield',null,true],['/officer/grievances','Grievances','megaphone']]],['Administration',[['/admin/departments','Departments & services','building'],['/admin/users','User management','users',null,true]]],['Account',[['/security','Security','lock'],['/profile','My profile','user']]]],
  VERIFICATION_AGENT:[['Field work',[['/agent','Assigned jobs','inbox',null,true],['/agent/device','My device','smartphone',null,true]]],['Account',[['/notifications','Notifications','bell',null,true],['/security','Security','shield',null,true]]]]
};
export const navigation=Object.fromEntries(Object.entries(navGroups).map(([role,groups])=>[role,groups.flatMap(([,items])=>items)]));
export const roleLabel={CITIZEN:'Citizen',OFFICER:'Department officer',ADMIN:'Administrator',VERIFICATION_AGENT:'Verification agent'};
export const areaLabel={CITIZEN:'My portal',OFFICER:'Officer desk',ADMIN:'Administration',VERIFICATION_AGENT:'Field verification'};
export const exactRoots=['/citizen','/officer','/admin','/agent'];
export const shortLabel={'/citizen':'Home','/officer':'Home','/admin':'Analytics','/agent':'Jobs','/citizen/apply':'Apply','/citizen/applications':'Applications','/admin/applications':'Applications','/identity':'Identity','/officer/queue':'Queue','/officer/grievances':'Grievances','/officer/verification':'Verification','/admin/verification':'Verification','/admin/users':'Users','/agent/device':'Device','/notifications':'Alerts','/security':'Security'};

export function Wordmark(){return <Link to="/" className="wordmark" aria-label="AMAP home"><Icon name="layers" size={34}/><span>AMAP<small>Public services · Academic prototype</small></span></Link>;}
export default function Sidebar({open,onClose,counts}){
  const {user}=useAuth();
  return <aside className={'sidebar '+(open?'is-open':'')} aria-label="Sidebar">
    <div className="sb-brand"><Wordmark/><button className="icon-btn drawer-close" aria-label="Close navigation" onClick={onClose}><Icon name="x"/></button></div>
    <nav className="sb-nav" aria-label="Main navigation">{navGroups[user.role].map(([group,items])=><div key={group} role="group" aria-label={group}><p className="sb-group" aria-hidden="true">{group}</p>{items.map(([to,label,icon,badge])=><NavLink end={exactRoots.includes(to)} key={to} to={to} onClick={onClose} className={({isActive})=>'sb-link '+(isActive?'is-active':'')}><Icon name={icon} size={19}/><span>{label}</span>{badge&&counts?.pending>0&&<span className="count">{counts.pending}</span>}</NavLink>)}</div>)}</nav>
    <div className="sb-foot"><Link to={user.role==='VERIFICATION_AGENT'?'/security':'/profile'} onClick={onClose} className="sb-user"><Avatar name={user.full_name} size="sm"/><span className="flex-1"><b className="nm truncate">{user.full_name}</b><span className="em block">{roleLabel[user.role]}</span></span><Icon name="chevronRight" size={16}/></Link><div className="sb-help">Academic prototype. Use sample details and documents for this demonstration.</div></div>
  </aside>;
}
