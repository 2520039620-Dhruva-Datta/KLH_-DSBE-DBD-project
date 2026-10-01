'use strict';
const {spawn}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..'),children=[];
function launch(file,args=[],cwd=root){const p=spawn(process.execPath,[file,...args],{cwd,stdio:'inherit',windowsHide:true});children.push(p);p.on('exit',code=>{if(code)shutdown(code);});return p;}
function shutdown(code=0){for(const p of children)if(!p.killed)p.kill();process.exitCode=code;}
(async()=>{const frontend=path.join(root,'react');const vite=path.join(path.dirname(require.resolve('vite/package.json',{paths:[frontend]})),'bin/vite.js');await require('./local-db.cjs').start(require('./local-db.cjs').load());launch(path.join(root,'server/index.cjs'));launch(vite,['--host','127.0.0.1','--port','5173','--strictPort'],frontend);process.on('SIGINT',()=>shutdown());process.on('SIGTERM',()=>shutdown());})().catch(e=>{console.error(e.message);shutdown(1);});
