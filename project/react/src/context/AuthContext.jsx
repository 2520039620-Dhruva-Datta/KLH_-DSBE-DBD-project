import {createContext,useContext,useEffect,useState} from 'react';
import API from '../data/api.js';
export const homeFor=role=>({CITIZEN:'/citizen',OFFICER:'/officer',ADMIN:'/admin',VERIFICATION_AGENT:'/agent'}[role]||'/');
const AuthContext=createContext(null),KEY='amap.session';
function read(){try{const s=JSON.parse(sessionStorage.getItem(KEY));API.token=s?.token||null;return s;}catch{return null;}}
export function AuthProvider({children}) {
  const [session,setSession]=useState(API.MODE==='live'?null:read),[loading,setLoading]=useState(API.MODE==='live'||!!session?.user),[signedOut,setSignedOut]=useState(false);
  function save(s){API.token=s?.token||null;if(s?.user)setSignedOut(false);setSession(s);try{if(s)sessionStorage.setItem(KEY,JSON.stringify(s));else sessionStorage.removeItem(KEY);}catch{/* memory fallback */}}
  async function refresh(){try{const u=await API.auth.me();if(u)save({user:u,...(API.MODE==='demo'?{token:API.token}:{})});else save(null);return u;}catch{save(null);return null;}finally{setLoading(false);}}
  useEffect(()=>{if(API.MODE==='live'||session?.user)refresh();const expired=()=>{save(null);window.location.assign('/login?expired=1');};window.addEventListener('amap:session-expired',expired);return()=>window.removeEventListener('amap:session-expired',expired);},[]);
  const user=session?.user||null;
  const value={user,loading,signedOut,homeFor,is:role=>user?.role===role,isAdmin:()=>user?.role==='ADMIN',isOfficer:()=>user?.role==='OFFICER',isCitizen:()=>user?.role==='CITIZEN',department:()=>user?.department_id?API.departments.get(user.department_id):Promise.resolve(null),refresh,
    login:async(email,password,role)=>{const s=await API.auth.login(email,password,role);if(s.mfa_required)return s;save({...s,at:Date.now()});return s.user;},
    challenge:async(challenge,code)=>{const s=await API.auth.challenge(challenge,code);save(s);return s.user;},
    register:async data=>{const s=await API.auth.register(data);const signed=API.MODE==='live'||s.token?s:await API.auth.login(data.email,data.password,'CITIZEN');save({...signed,at:Date.now()});return signed.user;},
    // signedOut lets route guards send a deliberate sign-out to plain /login rather
    // than racing it with a ?next= redirect back to the page just left.
    logout:async()=>{await API.auth.logout();setSignedOut(true);save(null);}
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
