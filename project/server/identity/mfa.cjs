'use strict';
const crypto=require('node:crypto');
const {rows,pool}=require('../db.cjs'),C=require('./crypto.cjs'),V=require('../validation.cjs');
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(bytes){let bits=0,value=0,out='';for(const b of bytes){value=(value<<8)|b;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5;}}if(bits)out+=alphabet[(value<<(5-bits))&31];return out;}
function decode(s){let bits=0,value=0,out=[];for(const ch of s){const n=alphabet.indexOf(ch);if(n<0)throw Error('Invalid base32');value=(value<<5)|n;bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}}return Buffer.from(out);}
function totp(secret,counter=Math.floor(Date.now()/30000)){const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(counter));const h=crypto.createHmac('sha1',decode(secret)).update(b).digest(),off=h.at(-1)&15;return String((h.readUInt32BE(off)&0x7fffffff)%1000000).padStart(6,'0');}
function counterFor(secret,code,last=-1){if(!/^\d{6}$/.test(String(code)))return null;const n=Math.floor(Date.now()/30000);for(let i=-1;i<=1;i++)if(n+i>Number(last)&&crypto.timingSafeEqual(Buffer.from(totp(secret,n+i)),Buffer.from(code)))return n+i;return null;}
async function verify(c,userId,code,{pending=false,recovery=true}={}){
 const [m]=await rows(c,'SELECT * FROM mfa_methods WHERE user_id=? FOR UPDATE',[userId]);
 if(!m||(!pending&&!m.enabled))V.fail('Multi-factor authentication is not enabled.',409);
 if(recovery&&!pending&&/^[A-F0-9-]{19,40}$/i.test(String(code))){const [r]=await rows(c,'SELECT * FROM mfa_recovery_codes WHERE user_id=? AND code_hash=? AND used_at IS NULL FOR UPDATE',[userId,C.hash(String(code).toUpperCase())]);if(r){await c.execute('UPDATE mfa_recovery_codes SET used_at=UTC_TIMESTAMP(3) WHERE id=?',[r.id]);return 'RECOVERY_CODE';}}
 const cipher=pending?m.pending_cipher:m.secret_cipher;if(!cipher)V.fail('Start MFA setup again.',409);const counter=counterFor(C.open(cipher),String(code),pending?-1:m.last_counter);if(counter===null)V.fail('The code is invalid, expired or already used.',400);
 await c.execute('UPDATE mfa_methods SET last_counter=?,updated_at=UTC_TIMESTAMP(3) WHERE user_id=?',[counter,userId]);return 'TOTP';
}
async function codes(c,userId){const codes=Array.from({length:10},()=>crypto.randomBytes(10).toString('hex').toUpperCase().match(/.{1,5}/g).join('-'));await c.execute('DELETE FROM mfa_recovery_codes WHERE user_id=?',[userId]);for(const code of codes)await c.execute('INSERT INTO mfa_recovery_codes(user_id,code_hash) VALUES(?,?)',[userId,C.hash(code)]);return codes;}
module.exports={base32,totp,counterFor,verify,codes,newSecret:()=>base32(crypto.randomBytes(20))};
