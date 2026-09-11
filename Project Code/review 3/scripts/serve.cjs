/* Optional static server; built-in Node modules only. No installation required. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),port=Number(process.argv[2]||8080);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.sql':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};
const server=http.createServer((req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end('Bad request');return;}
  const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  const relative=path.relative(root,target);
  if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).some(p=>p.startsWith('.'))){res.writeHead(403);res.end('Forbidden');return;}
  if(!(/^[a-z-]+\.html$/.test(relative)||/^(css|js)[\\/][a-z0-9/\\.-]+$/.test(relative))){res.writeHead(404);res.end('Not found');return;}
  fs.readFile(target,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return;}if(relative.replace(/\\/g,'/')==='js/api.js')data=Buffer.concat([Buffer.from('window.AMAP_DEMO=true;\n'),data]);res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
});
server.listen(port,'127.0.0.1',()=>console.log('Civic Desk offline demo is available at http://127.0.0.1:'+port+' (use npm run dev for MySQL mode)'));
module.exports=server;
