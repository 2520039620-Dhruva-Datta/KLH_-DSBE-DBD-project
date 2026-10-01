'use strict';
const {rows}=require('../db.cjs'),C=require('./crypto.cjs'),V=require('../validation.cjs');
class SandboxIdentityProvider{
 async ensure(c,userId,dob){let [p]=await rows(c,'SELECT * FROM identity_profiles WHERE user_id=?',[userId]);if(!p){const suffix=String(userId%10000).padStart(4,'0');await c.execute('INSERT INTO identity_profiles(user_id,sandbox_reference,identity_cipher,masked_identity,dob) VALUES(?,?,?,?,?)',[userId,'AMAP-SYNTHETIC-'+userId,C.seal('SYNTHETIC-0000-0000-'+suffix),'XXXX XXXX '+suffix,V.date(dob)]);[p]=await rows(c,'SELECT * FROM identity_profiles WHERE user_id=?',[userId]);}return p;}
 async result(c,userId){const [p]=await rows(c,'SELECT p.masked_identity,p.last_verified_at,u.name FROM identity_profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=?',[userId]);if(!p)V.fail('Use assisted verification to establish a sandbox identity.',409);return {provider:'sandbox',notice:'Synthetic identity only. Not connected to UIDAI.',name:p.name.split(/\s+/).map(s=>s[0]+'*'.repeat(Math.max(2,s.length-1))).join(' '),aadhaar:p.masked_identity,last_verified_at:p.last_verified_at};}
}
class UidaiIdentityProvider{constructor(){V.fail('UIDAI integration is not configured or authorized. Use the sandbox provider.',503);}}
function provider(){return process.env.IDENTITY_PROVIDER&&process.env.IDENTITY_PROVIDER!=='sandbox'?new UidaiIdentityProvider():new SandboxIdentityProvider();}
module.exports={provider,SandboxIdentityProvider,UidaiIdentityProvider};
