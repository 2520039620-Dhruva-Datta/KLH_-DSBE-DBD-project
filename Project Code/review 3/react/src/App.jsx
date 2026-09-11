import {BrowserRouter,Routes,Route,Link} from 'react-router';
import {AuthProvider} from './context/AuthContext.jsx';
import {ThemeProvider} from './context/ThemeContext.jsx';
import {ToastProvider} from './context/ToastContext.jsx';
import {ConfirmProvider} from './components/ui/index.jsx';
import PublicLayout from './components/PublicLayout.jsx';
import AppShell from './components/AppShell.jsx';
import RequireRole from './components/RequireRole.jsx';
import Home from './pages/public/Home.jsx';
import Login from './pages/public/Login.jsx';
import Register from './pages/public/Register.jsx';
import Track from './pages/public/Track.jsx';
import CitizenDashboard from './pages/citizen/Dashboard.jsx';
import Apply from './pages/citizen/Apply.jsx';
import CitizenApplications from './pages/citizen/Applications.jsx';
import Application from './pages/citizen/Application.jsx';
import CitizenGrievances from './pages/citizen/Grievances.jsx';
import Profile from './pages/citizen/Profile.jsx';
import OfficerDashboard from './pages/officer/Dashboard.jsx';
import OfficerQueue from './pages/officer/Queue.jsx';
import OfficerReview from './pages/officer/Review.jsx';
import OfficerGrievances from './pages/officer/Grievances.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';
import AdminApplications from './pages/admin/Applications.jsx';
import Departments from './pages/admin/Departments.jsx';
import Users from './pages/admin/Users.jsx';
import Reports from './pages/admin/Reports.jsx';
export default function App(){return <BrowserRouter><ThemeProvider><ToastProvider><ConfirmProvider><AuthProvider><Routes>
<Route element={<PublicLayout/>}><Route path="/" element={<Home/>}/><Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/><Route path="/track" element={<Track/>}/></Route>
<Route element={<RequireRole roles={['CITIZEN']}/>}><Route element={<AppShell/>}><Route path="/citizen" element={<CitizenDashboard/>}/><Route path="/citizen/apply" element={<Apply/>}/><Route path="/citizen/applications" element={<CitizenApplications/>}/><Route path="/citizen/applications/:id" element={<Application/>}/><Route path="/citizen/grievances" element={<CitizenGrievances/>}/></Route></Route>
<Route element={<RequireRole roles={['OFFICER']}/>}><Route element={<AppShell/>}><Route path="/officer" element={<OfficerDashboard/>}/><Route path="/officer/queue" element={<OfficerQueue/>}/></Route></Route>
<Route element={<RequireRole roles={['OFFICER','ADMIN']}/>}><Route element={<AppShell/>}><Route path="/officer/review/:id" element={<OfficerReview/>}/><Route path="/officer/grievances" element={<OfficerGrievances/>}/></Route></Route>
<Route element={<RequireRole roles={['ADMIN']}/>}><Route element={<AppShell/>}><Route path="/admin" element={<AdminDashboard/>}/><Route path="/admin/applications" element={<AdminApplications/>}/><Route path="/admin/departments" element={<Departments/>}/><Route path="/admin/users" element={<Users/>}/><Route path="/admin/reports" element={<Reports/>}/></Route></Route>
<Route element={<RequireRole roles={['CITIZEN','OFFICER','ADMIN']}/>}><Route element={<AppShell/>}><Route path="/profile" element={<Profile/>}/></Route></Route>
<Route element={<PublicLayout/>}><Route path="*" element={<div className="sec-in public-page"><h1>Page not found</h1><p>Check the address or <Link to="/">return to the homepage</Link>.</p></div>}/></Route>
</Routes></AuthProvider></ConfirmProvider></ToastProvider></ThemeProvider></BrowserRouter>;}
