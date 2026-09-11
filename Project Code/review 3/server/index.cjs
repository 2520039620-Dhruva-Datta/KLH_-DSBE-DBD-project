'use strict';
const fs=require('node:fs'),path=require('node:path');
const express=require('express');
const {config,validate}=require('./config.cjs');
const {pool}=require('./db.cjs');
const Security=require('./security.cjs');
const {routes}=require('./routes.cjs');
async function createApp() {
  validate();await pool.execute('SELECT name FROM schema_migrations LIMIT 1');
  const app=express();app.disable('x-powered-by');app.set('query parser','simple');
  app.use(Security.headers);
  app.use('/api',await routes());
  // Serve only the public frontend, never .env, SQL, tests, source server files,
  // node_modules, local database files, or uploaded documents.
  for(const folder of ['css','js'])app.use('/'+folder,express.static(path.join(config.root,folder),{dotfiles:'deny',fallthrough:false,index:false,maxAge:0}));
  const pages=fs.readdirSync(config.root).filter(name=>/^[a-z-]+\.html$/.test(name));
  app.get('/',(req,res)=>res.sendFile(path.join(config.root,'index.html')));
  for(const name of pages)app.get('/'+name,(req,res)=>res.sendFile(path.join(config.root,name)));
  app.use((req,res)=>res.status(404).type('text').send('Not found.'));
  app.use((error,req,res,next)=>{
    if(res.headersSent)return next(error);
    let status=error.status||500,message=error.message;
    if(error.code==='ER_DUP_ENTRY'){status=409;message='That name, code, or email is already in use.';}
    else if(['ER_ROW_IS_REFERENCED_2','ER_NO_REFERENCED_ROW_2'].includes(error.code)){status=409;message='Linked records must be retained. Reassign open work or remove unused linked records first.';}
    else if(error.code==='ER_SIGNAL_EXCEPTION'){status=409;message=error.sqlMessage;}
    else if(['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error.code)){status=409;message='Another action changed this record. Refresh and try again.';}
    else if(error.type==='entity.too.large'){status=413;message='The request is too large. Keep attachments under 2 MB total.';}
    else if(error.type==='entity.parse.failed'){status=400;message='The request contains invalid JSON.';}
    if(status>=500){console.error('API error:',error.code||error.name);message='The server could not complete this request. Please try again.';}
    res.status(status).json({message});
  });return app;
}
async function start() {
  const app=await createApp();
  const server=await new Promise((resolve,reject)=>{const server=app.listen(config.port,config.host,()=>resolve(server));server.once('error',reject);});
  server.requestTimeout=30000;server.headersTimeout=15000;
  console.log('AMAP — Government Services Portal · Academic Prototype');
  console.log('Live MySQL portal: '+config.origin+' (Ctrl+C stops the web server)');
  const cleanup=setInterval(()=>pool.execute('DELETE FROM sessions WHERE expires_at<UTC_TIMESTAMP(3)').catch(error=>console.error('Session cleanup:',error.code)),600000);cleanup.unref();
  const shutdown=()=>{clearInterval(cleanup);server.close(async()=>{await pool.end();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();};
  process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
  return server;
}
if(require.main===module)start().catch(error=>{console.error('Startup failed:',error.code||'',error.message);pool.end();process.exitCode=1;});
module.exports={createApp,start};
