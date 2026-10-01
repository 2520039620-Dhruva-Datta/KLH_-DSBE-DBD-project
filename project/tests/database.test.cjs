/* Runs only an isolated MySQL instance with a fresh temporary data directory.
 * Existing MySQL services, configuration, users, and databases are never used.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),crypto=require('node:crypto');
const {spawn,spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results');
const bin=process.env.MYSQL_BIN||'C:/Program Files/MySQL/MySQL Server 8.0/bin';
const executable=name=>path.join(bin,name+(process.platform==='win32'?'.exe':''));
if(!fs.existsSync(executable('mysqld'))||!fs.existsSync(executable('mysql')))throw Error('Set MYSQL_BIN to a MySQL 8 installation containing mysqld and mysql.');
fs.mkdirSync(out,{recursive:true});
const temporaryRoot=fs.realpathSync(os.tmpdir()),sandbox=fs.mkdtempSync(path.join(temporaryRoot,'civicdesk-mysql-'));
const data=path.join(sandbox,'data');fs.mkdirSync(data);
let server,port,log='',checks=0;
function run(name,args,input=''){const result=spawnSync(executable(name),args.filter(arg=>arg!=='--no-login-paths'),{input,encoding:'utf8',windowsHide:true,env:{...process.env,MYSQL_TEST_LOGIN_FILE:path.join(sandbox,'unused-login-file')},maxBuffer:4*1024*1024,timeout:60000});if(result.error)throw result.error;return result;}
function query(sql,expectError=false){const result=run('mysql',['--no-defaults','--no-login-paths','--protocol=TCP','--host=127.0.0.1','--port='+port,'--user=root','--skip-password','--default-character-set=utf8mb4','--batch','--raw','--skip-column-names'],'USE civicdesk;\n'+sql);if(expectError){assert.notEqual(result.status,0,'Expected SQL to be rejected: '+sql);checks++;return result.stderr;}assert.equal(result.status,0,result.stderr);return result.stdout.trim();}
function scalar(sql){return Number(query(sql));}
function check(sql,expected){assert.equal(scalar(sql),expected,sql);checks++;}
function update(id,status,actor,extra=''){return query("UPDATE applications SET status='"+status+"',last_actor_id="+actor+",last_remarks='The supplied records were checked and the next step was explained clearly.'"+(extra?','+extra:'')+' WHERE id='+id+';');}
function create(id){query("INSERT INTO applications(id,reference,citizen_id,service_id,department_id,status,form_data,fee,sla_days,created_at,last_actor_id,last_remarks) VALUES("+id+",'SQL-VERIFY-"+id+"',1,3,1,'SUBMITTED',JSON_OBJECT('full_name','Aarav Sharma'),100,14,UTC_TIMESTAMP(3)-INTERVAL 2 DAY,1,'Application submitted with supporting documentation.');");}
async function delay(ms){await new Promise(resolve=>setTimeout(resolve,ms));}
(async()=>{
  try{
    const version=run('mysqld',['--no-defaults','--version']).stdout.trim();
    console.log('Initializing isolated '+version);
    const initialized=run('mysqld',['--no-defaults','--initialize-insecure','--basedir='+path.dirname(bin),'--datadir='+data,'--console','--innodb-buffer-pool-size=32M']);
    assert.equal(initialized.status,0,initialized.stderr);
    const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
    server=spawn(executable('mysqld'),['--no-defaults','--basedir='+path.dirname(bin),'--datadir='+data,'--port='+port,'--bind-address=127.0.0.1','--mysqlx=OFF','--skip-log-bin','--innodb-buffer-pool-size=32M','--console'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    server.stdout.on('data',chunk=>{log+=chunk;});server.stderr.on('data',chunk=>{log+=chunk;});server.on('error',err=>{log+=err.message;});
    let connected=false;for(let attempt=0;attempt<100;attempt++){if(server.exitCode!==null)throw Error(log);const ping=run('mysqladmin',['--no-defaults','--protocol=TCP','--host=127.0.0.1','--port='+port,'--user=root','--skip-password','--connect-timeout=1','ping']);if(ping.status===0){connected=true;break;}await delay(200);}
    assert.ok(connected,'Temporary MySQL did not start: '+log);
    const imported=run('mysql',['--no-defaults','--no-login-paths','--protocol=TCP','--host=127.0.0.1','--port='+port,'--user=root','--skip-password','--default-character-set=utf8mb4'],fs.readFileSync(path.join(root,'database/schema.sql'),'utf8'));
    assert.equal(imported.status,0,'Schema import failed:\n'+imported.stderr);checks++;
    check("SELECT COUNT(*) FROM information_schema.views WHERE table_schema='civicdesk';",8);
    check("SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema='civicdesk';",3);
    check('SELECT COUNT(*) FROM users;',3);check('SELECT COUNT(*) FROM departments;',8);
    for(const role of ['citizen','officer','admin']){const encoded=query("SELECT password_hash FROM users WHERE email='"+role+"@demo.gov';"),[algorithm,salt,hash]=encoded.split(':');assert.equal(algorithm,'scrypt');assert.equal(crypto.scryptSync(role+'123',salt,64).toString('hex'),hash);checks++;}
    create(1);check('SELECT COUNT(*) FROM status_logs WHERE application_id=1;',1);check('SELECT COUNT(*) FROM notifications WHERE application_id=1;',1);
    assert.match(query("UPDATE applications SET status='APPROVED',last_actor_id=2,last_remarks='This must not bypass the required initial review stage.' WHERE id=1;",true),/Invalid application status transition/);
    assert.match(query("UPDATE applications SET status='UNDER_REVIEW',last_actor_id=2,last_remarks='ok' WHERE id=1;",true),/at least 20/);
    update(1,'UNDER_REVIEW',2,'officer_id=2');update(1,'NEEDS_INFO',2);
    assert.match(query("UPDATE applications SET status='UNDER_REVIEW',last_actor_id=2,last_remarks='An officer cannot respond on behalf of this citizen.' WHERE id=1;",true),/Only the applicant/);
    update(1,'UNDER_REVIEW',1);
    query("INSERT INTO users(id,name,email,password_hash,role,department_id) VALUES(4,'Receiving Officer','receiving@demo.gov','test-only','officer',2);");
    update(1,'FORWARDED',2,'department_id=2,officer_id=4');
    assert.match(query("UPDATE applications SET status='UNDER_REVIEW',last_actor_id=2,last_remarks='The originating officer cannot review the forwarded request.' WHERE id=1;",true),/outside application department/);
    update(1,'UNDER_REVIEW',4,'officer_id=4');update(1,'APPROVED',4);
    check('SELECT decided_at IS NOT NULL FROM applications WHERE id=1;',1);check('SELECT COUNT(*) FROM status_logs WHERE application_id=1;',7);check('SELECT COUNT(*) FROM notifications WHERE application_id=1;',7);
    check('SELECT isOverdue FROM v_applications_full WHERE id=1;',0);check('SELECT revision FROM applications WHERE id=1;',7);
    assert.match(query("UPDATE applications SET officer_id=NULL,last_actor_id=3,last_remarks='Closed applications cannot be returned to a work queue.' WHERE id=1;",true),/Closed applications are immutable/);
    create(2);update(2,'WITHDRAWN',1);check('SELECT decided_at IS NOT NULL FROM applications WHERE id=2;',1);
    query('UPDATE services SET fee=999,sla_days=30 WHERE id=3;');check('SELECT fee FROM applications WHERE id=2;',100);check('SELECT sla_days FROM applications WHERE id=2;',14);
    create(3);const logCount=scalar('SELECT COUNT(*) FROM status_logs;');
    query("START TRANSACTION; UPDATE applications SET officer_id=2,last_actor_id=3,last_remarks='Assigning this open application to a department officer.' WHERE id=3; UPDATE applications SET officer_id=NULL,last_actor_id=3,last_remarks='This closed application must make the entire batch fail.' WHERE id=1; COMMIT;",true);
    check('SELECT officer_id IS NULL FROM applications WHERE id=3;',1);check('SELECT COUNT(*) FROM status_logs;',logCount);
    for(const view of ['v_applications_full','v_department_performance','v_monthly_volume','v_daily_decisions','v_status_split','v_officer_performance','v_top_services','v_sla_distribution']){query('SELECT * FROM '+view+';');checks++;}
    check('SELECT SUM(total) FROM v_department_performance;',3);check('SELECT SUM(value) FROM v_status_split;',3);check('SELECT SUM(total) FROM v_top_services;',3);check('SELECT SUM(value) FROM v_sla_distribution;',1);
    query("INSERT INTO grievances(reference,application_id,service_id,citizen_id,department_id,subject,description) VALUES('GRV-SQL-1',3,3,1,1,'Clarify service timeline','Please clarify the expected completion date for this application.');");
    query("UPDATE grievances SET status='IN_PROGRESS',officer_id=2 WHERE id=1;");query("UPDATE grievances SET status='RESOLVED',resolution='short',resolved_at=UTC_TIMESTAMP(3) WHERE id=1;",true);
    query("UPDATE grievances SET status='RESOLVED',resolution='The completion timeline was checked and explained to the citizen.',resolved_at=UTC_TIMESTAMP(3) WHERE id=1;");check("SELECT COUNT(*) FROM grievances WHERE status='RESOLVED';",1);
    query('DELETE FROM departments WHERE id=1;',true);
    fs.writeFileSync(path.join(out,'database.json'),JSON.stringify({timestamp:new Date().toISOString(),version,isolated:true,schemaImported:true,views:8,checks,passed:true},null,2));
    console.log('PASS: '+checks+' MySQL checks; schema import, eight views, scrypt accounts, transition validation, audit/notifications, forwarding, SLA, snapshot integrity, rollback, grievances, and foreign keys.');
  }finally{
    if(server&&server.exitCode===null){run('mysqladmin',['--no-defaults','--protocol=TCP','--host=127.0.0.1','--port='+port,'--user=root','--skip-password','shutdown']);for(let i=0;i<50&&server.exitCode===null;i++)await delay(100);if(server.exitCode===null){server.kill();await new Promise(resolve=>server.once('exit',resolve));}}
    fs.writeFileSync(path.join(out,'mysql-test.log'),log);
    // Delete only the unique directory created by this test, after the server exits.
    const resolved=fs.realpathSync(sandbox),relative=path.relative(temporaryRoot,resolved);
    if(path.dirname(resolved)!==temporaryRoot||!relative.startsWith('civicdesk-mysql-')||relative.includes(path.sep))throw Error('Refusing cleanup outside the verified test directory.');
    fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
})().catch(err=>{console.error(err);process.exitCode=1;});
