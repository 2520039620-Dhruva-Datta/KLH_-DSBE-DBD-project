import {Navigate,Outlet,useLocation} from 'react-router';
import {useAuth,homeFor} from '../context/AuthContext.jsx';
export default function RequireRole({roles}) {const {user,loading}=useAuth(),loc=useLocation();if(loading)return <main className="content"><p role="status">Restoring your session…</p></main>;if(!user)return <Navigate to={'/login?next='+encodeURIComponent(loc.pathname+loc.search)} replace/>;if(roles&&!roles.includes(user.role))return <Navigate to={homeFor(user.role)} replace/>;return <Outlet/>;}
