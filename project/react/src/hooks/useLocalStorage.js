import {useEffect,useState} from 'react';
import API from '../data/api.js';
// Device preferences still use the API seam; storage access belongs to Store.
export default function useLocalStorage(key,initial) {const [value,setValue]=useState(initial);useEffect(()=>{let active=true;API.preferences.get(key).then(v=>{if(active&&v!=null)setValue(v);}).catch(()=>{});return()=>{active=false;};},[key]);return [value,v=>{setValue(v);return API.preferences.set(key,v);}];}
