import {createContext,useCallback,useContext,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import Icon from '../components/Icon.jsx';
const Context=createContext(null);
export function ToastProvider({children}) {const [items,setItems]=useState([]),seq=useRef(0);const toast=useCallback((message,type='success')=>{const id=++seq.current;setItems(a=>[...a,{id,message,type}]);setTimeout(()=>setItems(a=>a.filter(t=>t.id!==id)),5000);},[]);return <Context.Provider value={toast}>{children}{createPortal(<div className="toast-host" aria-live="polite" aria-atomic="false">{items.map(t=><div key={t.id} className={'toast '+t.type}><Icon name={t.type==='error'?'alert':'checkCircle'}/><p>{t.message}</p><button aria-label="Dismiss notification" onClick={()=>setItems(a=>a.filter(x=>x.id!==t.id))}><Icon name="x" size={14}/></button></div>)}</div>,document.body)}</Context.Provider>;}
export const useToast=()=>useContext(Context);
