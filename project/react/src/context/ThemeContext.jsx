import {createContext,useContext,useLayoutEffect,useRef,useState} from 'react';
import API from '../data/api.js';
const Context=createContext(null);
export function ThemeProvider({children}) {
  const revision=useRef(0);
  const [preference,setPreference]=useState(()=>document.documentElement.dataset.theme||'system');
  const [systemDark,setSystemDark]=useState(()=>matchMedia('(prefers-color-scheme: dark)').matches);
  const theme=preference==='system'?(systemDark?'dark':'light'):preference;
  useLayoutEffect(()=>{if(preference==='system')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=preference;},[preference]);
  useLayoutEffect(()=>{const m=matchMedia('(prefers-color-scheme: dark)'),fn=e=>setSystemDark(e.matches);m.addEventListener('change',fn);return()=>m.removeEventListener('change',fn);},[]);
  useLayoutEffect(()=>{let active=true;const restore=()=>{const version=revision.current;API.preferences.get('theme').then(value=>{if(active&&version===revision.current&&['system','light','dark'].includes(value)){if(value==='system')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=value;setPreference(value);}}).catch(()=>{});};restore();const unsubscribe=API.subscribe(restore);return()=>{active=false;unsubscribe();};},[]);
  const setTheme=t=>{if(!['system','light','dark'].includes(t))return;revision.current++; if(t==='system')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=t;setPreference(t);API.preferences.set('theme',t).catch(()=>{});};
  return <Context.Provider value={{theme,preference,setTheme,toggle:()=>setTheme(theme==='dark'?'light':'dark')}}>{children}</Context.Provider>;
}
export const useTheme=()=>useContext(Context);
