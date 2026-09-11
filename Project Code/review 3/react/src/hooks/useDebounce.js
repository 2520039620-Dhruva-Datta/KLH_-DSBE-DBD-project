import {useEffect,useState} from 'react';
export default function useDebounce(value,delay=180) {const [result,setResult]=useState(value);useEffect(()=>{const timer=setTimeout(()=>setResult(value),delay);return()=>clearTimeout(timer);},[value,delay]);return result;}
