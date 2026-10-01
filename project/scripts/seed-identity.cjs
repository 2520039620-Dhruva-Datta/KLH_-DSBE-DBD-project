'use strict';
// Add one clearly synthetic staff account without replacing existing records.
const {pool,transaction,rows}=require('../server/db.cjs');
const {config}=require('../server/config.cjs'),P=require('../server/passwords.cjs');
async function seed(){
 if(config.production)throw Error('Demo staff seeding is disabled in production.');
 const email='agent@demo.gov';
 const [existing]=await rows(pool,'SELECT id,role FROM users WHERE email=?',[email]);
 if(existing){console.log('Demo agent already exists; credentials and approval were preserved.');return;}
 const encoded=await P.hash('AgentDemo123!');
 await transaction(async c=>{
  const [r]=await c.execute("INSERT INTO users(name,email,password_hash,role,phone,address) VALUES(?,?,?,'verification_agent',?,?)",['Sandbox Verification Agent',email,encoded,'9000000000','Academic prototype test center']);
  await c.execute("INSERT INTO verification_agents(user_id,agent_code,status,certification,authorized_until) VALUES(?,?,'APPROVED',?,DATE_ADD(UTC_DATE(),INTERVAL 1 YEAR))",[r.insertId,'AMAP-VA-'+r.insertId,'Synthetic academic fixture; no government accreditation']);
 });
 console.log('Added agent@demo.gov / AgentDemo123! (synthetic demo only).');
 console.log('The agent must enroll MFA and obtain administrator approval for its camera device before visits.');
}
if(require.main===module)seed().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());
module.exports={seed};
