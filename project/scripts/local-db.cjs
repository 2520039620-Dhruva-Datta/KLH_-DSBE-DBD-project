'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const crypto = require('node:crypto');
const {spawn, spawnSync} = require('node:child_process');
const mysql = require('mysql2/promise');
const root = path.resolve(__dirname, '..');
const runtime = path.join(root, '.runtime');
const metaFile = path.join(runtime, 'local-db.json');
const envFile = path.join(root, '.env');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const rootOptions = meta => ({host:'127.0.0.1',port:meta.port,user:'root',password:meta.rootPassword,timezone:'Z',connectTimeout:1000,multipleStatements:false});
function load() {
  if (!fs.existsSync(metaFile)) throw Error('Run npm run setup:local first, or use npm start with your own .env database configuration.');
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  if (meta.owner !== root) throw Error('Local database metadata belongs to another folder.');
  if(meta.database!=='amap_local'||!Number.isInteger(meta.port)||meta.port<1||meta.port>65535)throw Error('Invalid local database metadata.');
  return meta;
}
function shortRuntime() {
  fs.mkdirSync(runtime, {recursive:true});
  if (process.platform !== 'win32') return runtime;
  // MySQL's Windows paths are shorter through a junction. The actual persistent
  // files remain in this project's .runtime folder, never in the temp directory.
  const short = path.join(fs.realpathSync(os.tmpdir()), 'amap-' + crypto.createHash('sha256').update(root).digest('hex').slice(0,12));
  if (!fs.existsSync(short)) fs.symlinkSync(runtime, short, 'junction');
  if (fs.realpathSync(short).toLowerCase() !== fs.realpathSync(runtime).toLowerCase()) throw Error('The temporary MySQL path points outside this project.');
  return short;
}
async function freePort(preferred = 3307) {
  async function probe(port) { const server = net.createServer(); await new Promise((resolve,reject) => {server.once('error',reject);server.listen(port,'127.0.0.1',resolve);}); const chosen = server.address().port; await new Promise(resolve=>server.close(resolve)); return chosen; }
  try { return await probe(preferred); } catch { return probe(0); }
}
async function start(meta, bootstrap = false) {
  try {
    const connection = await mysql.createConnection(rootOptions(meta));
    try {
      const [rows] = await connection.execute('SELECT value FROM `' + meta.database + '`.portal_metadata WHERE name=?', ['instance_id']);
      if (!rows.length || rows[0].value !== meta.instanceId) throw Error('The listening database is not this project’s instance.');
    } finally { await connection.end(); }
    console.log('Project MySQL is already running on 127.0.0.1:' + meta.port); return;
  } catch (error) {
    if (!['ECONNREFUSED','ETIMEDOUT'].includes(error.code)) throw error;
  }
  const short = shortRuntime();
  const bootstrapPath = path.join(short, 'bootstrap.sql');
  if (bootstrap) fs.writeFileSync(bootstrapPath, "ALTER USER 'root'@'localhost' IDENTIFIED BY '" + meta.rootPassword + "';\nCREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED BY '" + meta.rootPassword + "';\nGRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION;\n", {mode:0o600});
  const log = fs.openSync(path.join(runtime, 'mysql.log'), 'a');
  const child = spawn(meta.executable, ['--no-defaults','--basedir='+path.dirname(path.dirname(meta.executable)), '--datadir='+path.join(short,'mysql'), '--port='+meta.port, '--bind-address=127.0.0.1', '--mysqlx=OFF','--skip-log-bin','--skip-name-resolve','--local-infile=OFF','--secure-file-priv=NULL','--innodb-buffer-pool-size=64M','--console', ...(bootstrap?['--init-file='+bootstrapPath]:[])], {windowsHide:true,stdio:['ignore',log,log]});
  let spawnError;
  child.on('error',error=>{spawnError=error;});
  child.unref(); fs.closeSync(log);
  meta.pid = child.pid; fs.writeFileSync(metaFile, JSON.stringify(meta,null,2), {mode:0o600});
  let ready = false;
  for (let attempt=0; attempt<120; attempt++) {
    await pause(250);
    if(spawnError)throw spawnError;
    if(child.exitCode!==null)throw Error('Project MySQL exited ('+child.exitCode+'). Read .runtime/mysql.log.');
    try {const connection=await mysql.createConnection(rootOptions(meta));await connection.end();ready=true;break;} catch {}
  }
  if (bootstrap && fs.existsSync(bootstrapPath)) fs.unlinkSync(bootstrapPath);
  if (!ready) throw Error('Project MySQL did not start. Read .runtime/mysql.log.');
  console.log('Project MySQL started on 127.0.0.1:' + meta.port);
}
async function setup() {
  if (fs.existsSync(metaFile)) {
    const meta = load();
    if (!meta.ready) throw Error('Local setup was interrupted. Inspect .runtime/mysql.log and resume with node scripts/local-db.cjs resume.');
    await start(meta); console.log('Setup is already complete. Run npm run dev.'); return;
  }
  if (fs.existsSync(envFile)) throw Error('.env already exists. Use npm start for that database, or move the file yourself before choosing isolated local setup.');
  const executable = process.env.MYSQL_BIN ? path.join(process.env.MYSQL_BIN, process.platform==='win32'?'mysqld.exe':'mysqld') : process.platform==='win32' ? 'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqld.exe' : '/usr/sbin/mysqld';
  if (!fs.existsSync(executable)) throw Error('Install MySQL 8 and set MYSQL_BIN to its bin directory.');
  const short=shortRuntime(), data=path.join(short,'mysql');
  if (fs.existsSync(data) && fs.readdirSync(data).length) throw Error('Existing MySQL files found; setup refuses to overwrite them.');
  fs.mkdirSync(data, {recursive:true});
  console.log('Initializing a separate project MySQL instance…');
  const result=spawnSync(executable,['--no-defaults','--initialize-insecure','--basedir='+path.dirname(path.dirname(executable)),'--datadir='+data,'--innodb-buffer-pool-size=64M','--console'],{windowsHide:true,encoding:'utf8',timeout:60000});
  fs.writeFileSync(path.join(runtime,'mysql-initialize.log'),result.stdout+'\n'+result.stderr);
  if (result.error || result.status!==0) throw Error('MySQL initialization failed; read .runtime/mysql-initialize.log.');
  const meta={owner:root,executable,port:await freePort(),database:'amap_local',rootPassword:crypto.randomBytes(32).toString('hex'),appPassword:crypto.randomBytes(32).toString('hex'),csrfSecret:crypto.randomBytes(32).toString('hex'),ready:false};
  fs.writeFileSync(metaFile,JSON.stringify(meta,null,2),{mode:0o600});
  await start(meta,true); await finish(meta);
}
async function finish(meta) {
  if (!fs.existsSync(envFile)) fs.writeFileSync(envFile, ['NODE_ENV=development','HOST=127.0.0.1','PORT=3000','APP_ORIGIN=http://localhost:3000','DB_HOST=127.0.0.1','DB_PORT='+meta.port,'DB_NAME='+meta.database,'DB_USER=amap_app','DB_PASSWORD='+meta.appPassword,'CSRF_SECRET='+meta.csrfSecret,'SESSION_HOURS=8','COOKIE_SECURE=false',''].join('\n'),{mode:0o600});
  const connection=await mysql.createConnection(rootOptions(meta));
  try {
    const {migrate,grantApp}=require('./migrate.cjs');
    const [databases]=await connection.execute('SELECT SCHEMA_NAME FROM information_schema.schemata WHERE SCHEMA_NAME=?',[meta.database]);
    await migrate(connection,meta.database,{fresh:!databases.length});
    const [users]=await connection.execute('SELECT COUNT(*) n FROM users');
    if (!users[0].n) await require('./seed-db.cjs').seed(connection);
    const [accounts]=await connection.execute("SELECT user FROM mysql.user WHERE user='amap_app' AND host='127.0.0.1'");
    if (!accounts.length) await grantApp(connection,meta.database,'amap_app',meta.appPassword);
    const [instance]=await connection.execute("SELECT value FROM portal_metadata WHERE name='instance_id'");
    meta.instanceId=instance[0].value;meta.ready=true;
    fs.writeFileSync(metaFile,JSON.stringify(meta,null,2),{mode:0o600});
    console.log('Local setup complete. Run npm run dev, then open http://localhost:3000.');
  } finally {await connection.end();}
}
async function stop(meta) {
  let connection;
  try {
    connection=await mysql.createConnection(rootOptions(meta));
    const [instance]=await connection.execute('SELECT value FROM `'+meta.database+'`.portal_metadata WHERE name=?',['instance_id']);
    if (instance[0]?.value!==meta.instanceId) throw Error('Refusing to stop an instance not owned by this project.');
    await connection.query('SHUTDOWN');
    let stopped=false;
    for(let attempt=0;attempt<100;attempt++){
      const listening=await new Promise(resolve=>{const socket=net.connect(meta.port,'127.0.0.1');socket.setTimeout(500);socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',()=>resolve(false));socket.once('timeout',()=>{socket.destroy();resolve(true);});});
      if(!listening){stopped=true;break;}await pause(100);
    }
    if(!stopped)throw Error('MySQL shutdown is still in progress. Wait before restarting it.');
    console.log('Project MySQL stopped. Persistent data remains in .runtime/mysql.');
  } catch (error) {if(error.code==='ECONNREFUSED')console.log('Project MySQL is already stopped.');else throw error;}
  finally {if(connection)await connection.end().catch(()=>{});}
}
if(require.main===module)(async()=>{const command=process.argv[2];if(command==='setup')await setup();else if(command==='start')await start(load());else if(command==='stop')await stop(load());else if(command==='resume'){const meta=load();await start(meta,!meta.ready);await finish(meta);}else throw Error('Use setup, start, stop, or resume.');})().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={load,start,stop,rootOptions};
