import {useCallback,useEffect,useRef,useState} from 'react';
import API from '../data/api.js';
export default function useApi(producer,deps=[],options={}) {
  const ref=useRef(producer); ref.current=producer;
  const [state,setState]=useState({data:null,loading:true,error:null});
  const [revision,bump]=useState(0),key=JSON.stringify(deps);
  const refetch=useCallback(()=>bump(n=>n+1),[]);
  useEffect(()=>options.subscribe===false?undefined:API.subscribe(refetch),[refetch,options.subscribe]);
  useEffect(()=>{let alive=true;setState(s=>({...s,loading:true,error:null}));Promise.resolve().then(()=>ref.current()).then(data=>{if(alive)setState({data,loading:false,error:null});}).catch(error=>{if(alive)setState(s=>({...s,loading:false,error}));});return()=>{alive=false;};},[key,revision]);
  return {...state,refetch};
}
