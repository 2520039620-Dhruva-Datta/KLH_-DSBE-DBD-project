'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),net=require('node:net');
const mysql=require('mysql2/promise');
const {load,start,rootOptions}=require('../scripts/local-db.cjs');
async function setup() {
  const meta=load();await start(meta);
  const owner=await mysql.createConnection(rootOptions(meta));
  const suffix=crypto.randomBytes(6).toString('hex'),database='amap_test_'+suffix,user='amapt_'+suffix,password=crypto.randomBytes(32).toString('hex');
  let server,pool,created=false,account=false;
  const context={owner,database,user};
  context.close=async()=>{
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    if(pool)await pool.end();
    // The test deletes only the random database/account created in this call.
    if(!/^amap_test_[a-f0-9]{12}$/.test(database)||!/^amapt_[a-f0-9]{12}$/.test(user))throw Error('Unsafe test cleanup target.');
    if(created)await owner.query('DROP DATABASE `'+database+'`');
    if(account)await owner.query('DROP USER ?@?',[user,'127.0.0.1']);
    await owner.end();
  };
  try{
    const {migrate,grantApp}=require('../scripts/migrate.cjs');
    await owner.query("SET time_zone='+00:00'");
    await owner.query('CREATE DATABASE `'+database+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');created=true;
    await migrate(owner,database);
    await require('../scripts/seed-db.cjs').seed(owner);
    await grantApp(owner,database,user,password);account=true;
    const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
    const {config}=require('../server/config.cjs');config.db={...config.db,database,user,password};config.port=port;config.origin='http://127.0.0.1:'+port;
    const app=await require('../server/index.cjs').createApp();pool=require('../server/db.cjs').pool;
    server=await new Promise(resolve=>{const listener=app.listen(port,'127.0.0.1',()=>resolve(listener));});
    Object.assign(context,{base:config.origin,pool});return context;
  }catch(error){await context.close();throw error;}
}
class Client {
  constructor(base){this.base=base;this.cookies=new Map();this.token='';this.coverage=new Set();}
  async request(method,path,data,extra={}) {
    const headers={Accept:'application/json',Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),Origin:this.base,...(data===undefined?{}:{'Content-Type':'application/json'}),...(method==='GET'?{}:{'X-CSRF-Token':this.token}),...(extra.headers||{})};
    for(const key of Object.keys(headers))if(headers[key]===null)delete headers[key];
    const response=await fetch(this.base+path,{method,headers,...(data===undefined?{}:{body:JSON.stringify(data)})});
    for(const value of response.headers.getSetCookie()){const [pair]=value.split(';'),at=pair.indexOf('=');this.cookies.set(pair.slice(0,at),pair.slice(at+1));}
    if(response.headers.get('X-CSRF-Token'))this.token=response.headers.get('X-CSRF-Token');
    const body=await response.json();this.coverage.add(method+' '+path.split('?')[0]);return {status:response.status,body,headers:response.headers};
  }
  async login(role,email=role+'@demo.gov',password=role+'123') {await this.request('GET','/api/auth/me');const result=await this.request('POST','/api/auth/login',{email,password,role});if(result.status!==200)throw Error('Login failed: '+JSON.stringify(result.body));this.user=result.body;return result;}
}
function report(name,data) {const out=path.join(__dirname,'../test-results');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name),JSON.stringify({timestamp:new Date().toISOString(),...data},null,2));}
module.exports={setup,Client,report};
