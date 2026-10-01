'use strict';
const net=require('node:net');
const unknown=()=>({available:false,country:null,region:null,latitude:null,longitude:null,vpn:false,tor:false,datacenter:false});
// Optional operator-configured HTTPS adapter; no browser GPS or forwarded headers.
// The endpoint accepts ?ip= and returns {country,region,latitude,longitude,vpn,tor,datacenter}.
// With no provider, location stays unknown and cannot create a risk signal.
async function lookup(ip){
 const base=process.env.NETWORK_RISK_URL;
 if(!base||!net.isIP(ip)||ip==='::1'||ip.startsWith('127.')||ip.startsWith('::ffff:127.')||ip.startsWith('10.')||ip.startsWith('192.168.')||/^172\.(1[6-9]|2\d|3[01])\./.test(ip))return unknown();
 try{
  const url=new URL(base);if(url.protocol!=='https:')return unknown();url.searchParams.set('ip',ip);
  const response=await fetch(url,{headers:process.env.NETWORK_RISK_TOKEN?{Authorization:'Bearer '+process.env.NETWORK_RISK_TOKEN}:{},signal:AbortSignal.timeout(2000),redirect:'error'});
  if(!response.ok)return unknown();const d=await response.json();
  return {available:true,country:/^[A-Z]{2}$/.test(d.country)?d.country:null,region:typeof d.region==='string'?d.region.slice(0,80):null,latitude:Number.isFinite(d.latitude)&&Math.abs(d.latitude)<=90?d.latitude:null,longitude:Number.isFinite(d.longitude)&&Math.abs(d.longitude)<=180?d.longitude:null,vpn:d.vpn===true,tor:d.tor===true,datacenter:d.datacenter===true};
 }catch{return unknown();}
}
function travel(current,previous){
 if(!current.available||!previous)return {};
 const signals={newCountry:!!current.country&&!!previous.country&&current.country!==previous.country,newRegion:!!current.region&&!!previous.region&&current.region!==previous.region};
 const before=previous.metadata?.network;
 if(!before||![current.latitude,current.longitude,before.latitude,before.longitude].every(Number.isFinite))return signals;
 const radians=n=>n*Math.PI/180,dx=radians(current.latitude-before.latitude),dy=radians(current.longitude-before.longitude);
 const a=Math.sin(dx/2)**2+Math.cos(radians(before.latitude))*Math.cos(radians(current.latitude))*Math.sin(dy/2)**2;
 const km=6371*2*Math.atan2(Math.sqrt(Math.max(0,a)),Math.sqrt(Math.max(0,1-a))),hours=(Date.now()-new Date(previous.created_at))/3600000;
 signals.impossibleTravel=hours>0&&hours<24&&km>500&&km/hours>1000;return signals;
}
module.exports={lookup,travel,unknown};
