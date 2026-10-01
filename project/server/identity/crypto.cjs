'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {config}=require('../config.cjs');
let key;
function getKey(){if(key)return key;let value=process.env.ENCRYPTION_KEY;if(!value){if(config.production)throw Error('ENCRYPTION_KEY is required in production.');const file=path.join(config.root,'.runtime','identity-encryption.key');fs.mkdirSync(path.dirname(file),{recursive:true});if(!fs.existsSync(file))fs.writeFileSync(file,crypto.randomBytes(32).toString('hex'),{mode:0o600,flag:'wx'});value=fs.readFileSync(file,'utf8').trim();}if(!/^[a-f0-9]{64}$/i.test(value))throw Error('ENCRYPTION_KEY must be 32 bytes encoded in hex.');key=Buffer.from(value,'hex');return key;}
function seal(value){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',getKey(),iv);const bytes=Buffer.concat([c.update(JSON.stringify(value),'utf8'),c.final()]);return [iv.toString('base64'),c.getAuthTag().toString('base64'),bytes.toString('base64')].join('.');}
function open(value){const [iv,tag,data]=value.split('.').map(v=>Buffer.from(v,'base64'));const c=crypto.createDecipheriv('aes-256-gcm',getKey(),iv);c.setAuthTag(tag);return JSON.parse(Buffer.concat([c.update(data),c.final()]).toString('utf8'));}
const hash=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
const token=()=>crypto.randomBytes(32).toString('hex');
module.exports={seal,open,hash,token};
