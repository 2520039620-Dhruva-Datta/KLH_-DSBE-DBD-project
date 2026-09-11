import {createContext,useContext,useEffect,useState} from 'react';
import API from '../data/api.js';
export const homeFor=role=>({CITIZEN:'/citizen',OFFICER:'/officer',ADMIN:'/admin'}[role]||'/');
const AuthContext=createContext(null),KEY='amap.session';
function read(){try{const s=JSON.parse(sessionStorage.getItem(KEY));API.token=s?.token||null;return s;}catch{return null;}}
export function AuthProvider({children}) {
  const [session,setSession]=useState(read),[loading,setLoading]=useState(!!session?.user);
  function save(s){API.token=s?.token||null;setSession(s);try{if(s)sessionStorage.setItem(KEY,JSON.stringify(s));else sessionStorage.removeItem(KEY);}catch{/* memory fallback */}}
  async function refresh(){try{const u=await API.auth.me();setSession(s=>{if(!s)return null;const next={...s,user:u};try{sessionStorage.setItem(KEY,JSON.stringify(next));}catch{}return next;});return u;}catch{save(null);return null;}finally{setLoading(false);}}
  useEffect(()=>{if(session?.user)refresh();},[]);
  const user=session?.user||null;
  const value={user,loading,homeFor,is:role=>user?.role===role,isAdmin:()=>user?.role==='ADMIN',isOfficer:()=>user?.role==='OFFICER',isCitizen:()=>user?.role==='CITIZEN',department:()=>user?.department_id?API.departments.get(user.department_id):Promise.resolve(null),refresh,
    login:async(email,password,role)=>{const s=await API.auth.login(email,password,role);save({...s,at:Date.now()});return s.user;},
    register:async data=>{const s=await API.auth.register(data);const signed=s.token?s:await API.auth.login(data.email,data.password,'CITIZEN');save({...signed,at:Date.now()});return signed.user;},
    logout:async()=>{await API.auth.logout();save(null);}
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
