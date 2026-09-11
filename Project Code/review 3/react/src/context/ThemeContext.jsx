import {createContext,useContext,useLayoutEffect,useState} from 'react';
import API from '../data/api.js';
const Context=createContext(null);
export function ThemeProvider({children}) {
  const [preference,setPreference]=useState(()=>document.documentElement.dataset.theme||'system');
  const [systemDark,setSystemDark]=useState(()=>matchMedia('(prefers-color-scheme: dark)').matches);
  const theme=preference==='system'?(systemDark?'dark':'light'):preference;
  useLayoutEffect(()=>{if(preference==='system')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=preference;},[preference]);
  useLayoutEffect(()=>{const m=matchMedia('(prefers-color-scheme: dark)'),fn=e=>setSystemDark(e.matches);m.addEventListener('change',fn);return()=>m.removeEventListener('change',fn);},[]);
  const setTheme=t=>{if(!['system','light','dark'].includes(t))return; if(t==='system')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=t;setPreference(t);API.preferences.set('theme',t).catch(()=>{});};
  return <Context.Provider value={{theme,preference,setTheme,toggle:()=>setTheme(theme==='dark'?'light':'dark')}}>{children}</Context.Provider>;
}
export const useTheme=()=>useContext(Context);
