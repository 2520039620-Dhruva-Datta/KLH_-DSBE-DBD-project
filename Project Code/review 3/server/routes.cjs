'use strict';
const express=require('express');
const {pool,rows,transaction}=require('./db.cjs');
const S=require('./security.cjs');
const V=require('./validation.cjs');
const R=require('./repository.cjs');
const P=require('./passwords.cjs');
const Analytics=require('./analytics.cjs');
const {config}=require('./config.cjs');
const all=S.allow('citizen','officer','admin'),staff=S.allow('officer','admin'),admin=S.allow('admin'),citizen=S.allow('citizen');
async function routes() {
  const api=express.Router();
  api.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
  api.use(S.rateLimit(6000,15*60*1000));
  api.use(S.session,S.csrf);
  api.use(express.json({limit:'3mb',strict:true}));
  const authRate=S.rateLimit(60,15*60*1000),accountRate=S.rateLimit(20,15*60*1000,req=>req.ip+':'+String(req.body?.email||'').toLowerCase().slice(0,150));
  const dummyHash=await P.hash(require('node:crypto').randomBytes(32).toString('hex'));
  // Nullable current-user lookup also bootstraps anonymous CSRF and new-tab UX.
  api.get('/auth/me',(req,res)=>res.json(req.user));
  api.post('/auth/login',authRate,accountRate,async(req,res)=>{
    const d=V.fields(req.body,['email','password','role']),email=V.email(d.email),password=V.text(d.password,'Password',1,100);
    const [user]=await rows(pool,'SELECT * FROM users WHERE email=?',[email]);
    const correct=await P.verify(password,user?.password_hash||dummyHash);
    if(!correct||!user?.active||user.role!==d.role)V.fail('Email, password, or selected role is incorrect.',401);
    const upgraded=user.password_hash.startsWith('scrypt:')?await P.hash(password):null;
    const safe=await R.write(S.safeUser(user),async c=>{
      const locked=await R.one(c,'users',user.id,true);if(locked.password_hash!==user.password_hash)V.fail('Your password changed. Please sign in again.',401);
      if(upgraded)await c.execute('UPDATE users SET password_hash=? WHERE id=?',[upgraded,user.id]);
      await S.issueSession(req,res,user,c);return S.safeUser(locked);
    });res.json(safe);
  });
  api.post('/auth/register',authRate,async(req,res)=>{
    const d=V.fields(req.body,['name','email','phone','address','password','confirm-password']);
    const record={name:V.text(d.name,'Full name',3,100),email:V.email(d.email),phone:V.phone(d.phone),address:V.text(d.address,'Address',8,300),password_hash:await P.hash(V.password(d.password))};
    const user=await transaction(async c=>{const [result]=await c.execute("INSERT INTO users(name,email,phone,address,password_hash,role) VALUES(?,?,?,?,?,'citizen')",Object.values(record));const u=S.safeUser(await R.one(c,'users',result.insertId));await R.notify(c,u.id,null,'Welcome to Civic Desk','Your account is ready. Explore services and submit your first application.');await S.issueSession(req,res,u,c);return u;});res.status(201).json(user);
  });
  api.post('/auth/logout',async(req,res)=>res.json(await S.logout(req,res)));
  api.post('/auth/password',all,authRate,async(req,res)=>{
    const d=V.fields(req.body,['current_password','new_password','confirm_password']);
    const current=await R.one(pool,'users',req.user.id);
    if(!await P.verify(V.text(d.current_password,'Current password',1,100),current.password_hash))V.fail('Current password is incorrect.',400);
    const hash=await P.hash(V.password(d.new_password));
    await R.write(req.user,async(c,u)=>{const locked=await R.one(c,'users',u.id,true);if(locked.password_hash!==current.password_hash)V.fail('Your password changed. Please sign in again.',409);await c.execute('UPDATE users SET password_hash=? WHERE id=?',[hash,u.id]);await c.execute('DELETE FROM sessions WHERE user_id=?',[u.id]);await S.issueSession(req,res,u,c);});res.json({ok:true});
  });
  api.get('/preferences',async(req,res)=>{const found=req.user?await rows(pool,'SELECT theme FROM preferences WHERE user_id=?',[req.user.id]):[];const anonymous=['system','light','dark'].includes(req.cookies['amap-theme'])?req.cookies['amap-theme']:'system';res.json({theme:found[0]?.theme||anonymous});});
  api.patch('/preferences',async(req,res)=>{const d=V.fields(req.body,['theme']);if(!['system','light','dark'].includes(d.theme))V.fail('Invalid theme.');if(req.user)await R.write(req.user,(c,u)=>c.execute('INSERT INTO preferences(user_id,theme) VALUES(?,?) ON DUPLICATE KEY UPDATE theme=?',[u.id,d.theme,d.theme]));res.cookie('amap-theme',d.theme,{...S.cookieOptions,maxAge:31536000000});res.json({theme:d.theme});});
  api.get('/departments',async(req,res)=>res.json(await R.departments.list()));
  api.post('/departments',admin,async(req,res)=>res.status(201).json(await R.departments.create(req.body,req.user)));
  api.patch('/departments/:id',admin,async(req,res)=>res.json(await R.departments.update(req.params.id,req.body,req.user)));
  api.delete('/departments/:id',admin,async(req,res)=>res.json(await R.departments.remove(req.params.id,req.user)));
  api.get('/services',async(req,res)=>res.json(await R.services.list(req.query)));
  api.post('/services',admin,async(req,res)=>res.status(201).json(await R.services.create(req.body,req.user)));
  api.patch('/services/:id',admin,async(req,res)=>res.json(await R.services.update(req.params.id,req.body,req.user)));
  api.delete('/services/:id',admin,async(req,res)=>res.json(await R.services.remove(req.params.id,req.user)));
  api.get('/users',staff,async(req,res)=>res.json(await R.users.list(req.query,req.user)));
  api.post('/users',admin,async(req,res)=>res.status(201).json(await R.users.create(req.body,req.user)));
  api.patch('/users/:id',all,async(req,res)=>res.json(await R.users.update(req.params.id,req.body,req.user)));
  api.get('/applications',all,async(req,res)=>res.json(await R.applications(pool,req.query,req.user)));
  api.get('/applications/:id',all,async(req,res)=>res.json(await transaction(c=>R.application(c,req.params.id,req.user,true),true)));
  api.post('/applications',citizen,async(req,res)=>res.status(201).json(await R.createApplication(req.body,req.user)));
  api.post('/applications/assign',staff,async(req,res)=>res.json(await R.assign(req.body,req.user)));
  api.post('/applications/:id/transitions',all,async(req,res)=>res.json(await R.transition(req.params.id,req.body,req.user)));
  api.get('/track/:reference',S.rateLimit(60,15*60*1000),async(req,res)=>res.json(await R.track(req.params.reference)));
  api.get('/documents/:id',all,async(req,res)=>res.json(await R.document(req.params.id,req.user)));
  api.get('/grievances',all,async(req,res)=>res.json(await R.grievances.list(req.query,req.user)));
  api.post('/grievances',citizen,async(req,res)=>res.status(201).json(await R.grievances.create(req.body,req.user)));
  api.patch('/grievances/:id',staff,async(req,res)=>res.json(await R.grievances.update(req.params.id,req.body,req.user)));
  api.get('/notifications',all,async(req,res)=>res.json(await R.notifications.list(req.user)));
  api.patch('/notifications/:id',all,async(req,res)=>{V.fields(req.body,['read']);if(req.body.read!==true)V.fail('Use read=true to mark notifications read.');res.json(await R.notifications.read(req.params.id,req.user));});
  api.get('/analytics/public',async(req,res)=>res.json(await Analytics.publicCounts()));
  for(const part of ['dashboard','kpis','monthly','daily','status','departments','services','officers','sla','activity'])api.get('/analytics/'+part,all,async(req,res)=>res.json(await Analytics.dashboard(req.query,req.user,part)));
  api.post('/demo/reset',admin,(req,res)=>{V.fail(config.production?'Demo reset is not available.':'Live database reset is disabled to preserve shared records and audit history. The offline demo retains its reset action.',config.production?404:409);});
  api.use((req,res)=>res.status(404).json({message:'This API endpoint does not exist.'}));
  return api;
}
module.exports={routes};
