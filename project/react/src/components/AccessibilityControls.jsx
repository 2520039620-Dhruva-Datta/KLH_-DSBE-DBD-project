import {useEffect,useRef,useState} from 'react';
import API from '../data/api.js';
export default function AccessibilityControls(){
  const [large,setLarge]=useState(()=>document.documentElement.dataset.text==='large'),[contrast,setContrast]=useState(()=>document.documentElement.dataset.contrast==='high'),changed=useRef(false);
  useEffect(()=>{let active=true;Promise.all([API.preferences.get('text'),API.preferences.get('contrast')]).then(([text,contrast])=>{if(active&&!changed.current){setLarge(text==='large');setContrast(contrast==='high');}}).catch(()=>{});return()=>{active=false;};},[]);
  function textToggle(){changed.current=true;const next=!large;setLarge(next);document.documentElement.dataset.text=next?'large':'normal';API.preferences.set('text',next?'large':'normal').catch(()=>{});}
  function contrastToggle(){changed.current=true;const next=!contrast;setContrast(next);document.documentElement.dataset.contrast=next?'high':'normal';API.preferences.set('contrast',next?'high':'normal').catch(()=>{});}
  return <div className="accessibility-controls" role="group" aria-label="Reading preferences"><button type="button" aria-label={large?'Use standard text size':'Use larger text'} aria-pressed={large} onClick={textToggle} title="Text size">A<span aria-hidden="true">{large?'−':'+'}</span></button><button type="button" aria-label={contrast?'Use standard contrast':'Use high contrast'} aria-pressed={contrast} onClick={contrastToggle} title="Contrast"><svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M10 3a7 7 0 0 1 0 14Z" fill="currentColor"/></svg></button></div>;
}
