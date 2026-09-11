'use strict';
const crypto = require('node:crypto');
const {config} = require('./config.cjs');
const {pool, rows, normalize} = require('./db.cjs');
const V = require('./validation.cjs');
const SESSION = config.secure ? '__Host-amap-session' : 'amap-session';
const CSRF = config.secure ? '__Host-amap-csrf' : 'amap-csrf';
const cookieOptions = {httpOnly:true,secure:config.secure,sameSite:'lax',path:'/'};
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const safeUser = user => {if(!user)return null;const {password_hash,...safe}=normalize(user);return safe;};
function cookies(req) {
  const result = Object.create(null);
  for (const item of (req.headers.cookie || '').split(';')) {
    const at = item.indexOf('='); if(at<1)continue;
    try {result[item.slice(0,at).trim()]=decodeURIComponent(item.slice(at+1).trim());}catch {}
  }
  return result;
}
function equals(a,b) {return typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));}
function csrfSignature(nonce,session) {return crypto.createHmac('sha256',config.csrfSecret).update(nonce+'!'+(session||'anonymous')).digest('hex');}
function validCsrf(token,session) {if(typeof token!=='string'||!/^[0-9a-f]{48}\.[0-9a-f]{64}$/.test(token))return false;const [nonce,signature]=token.split('.');return equals(signature,csrfSignature(nonce,session));}
function issueCsrf(req,res,session=req.sessionToken) {
  let token=req.cookies[CSRF];
  if(!validCsrf(token,session)){const nonce=crypto.randomBytes(24).toString('hex');token=nonce+'.'+csrfSignature(nonce,session);res.cookie(CSRF,token,cookieOptions);}
  res.set('X-CSRF-Token',token);
}
async function session(req,res,next) {
  req.cookies=cookies(req);req.user=null;req.sessionToken=null;
  const token=req.cookies[SESSION];
  if(token&&/^[0-9a-f]{64}$/.test(token)) {
    const found=await rows(pool,'SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP(3) AND u.active=TRUE',[digest(token)]);
    if(found[0]){req.user=safeUser(found[0]);req.sessionToken=token;}
    else res.clearCookie(SESSION,cookieOptions);
  }
  issueCsrf(req,res);
  next();
}
function allow(...roles) {return (req,res,next)=>{if(!req.user)V.fail('Please sign in to continue.',401);if(!roles.includes(req.user.role))V.fail('You do not have permission for this action.',403);next();};}
function origins() {
  const list=[config.origin];
  if(!config.production)for(const host of ['localhost','127.0.0.1'])list.push('http://'+host+':'+config.port);
  return list;
}
function headers(req,res,next) {
  if(!origins().some(origin=>new URL(origin).host===req.headers.host))V.fail('Unrecognized portal host.',403);
  res.set({'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"});
  if(config.secure)res.set('Strict-Transport-Security','max-age=31536000');
  next();
}
function csrf(req,res,next) {
  if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
  if(req.get('Sec-Fetch-Site')==='cross-site'||(req.get('Origin')&&!origins().includes(req.get('Origin'))))V.fail('This request must come from the portal.',403);
  const token=req.get('X-CSRF-Token');
  if(!equals(token,req.cookies[CSRF])||!validCsrf(token,req.sessionToken))V.fail('Your security token expired. Reload this page and try again.',403);
  if(!req.is('application/json')&&req.method!=='DELETE')V.fail('Send a JSON request.',415);
  next();
}
async function issueSession(req,res,user,connection=pool) {
  if(req.sessionToken)await connection.execute('DELETE FROM sessions WHERE token_hash=?',[digest(req.sessionToken)]);
  const token=crypto.randomBytes(32).toString('hex');
  await connection.execute('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',[digest(token),user.id,new Date(Date.now()+config.sessionHours*3600000)]);
  res.cookie(SESSION,token,{...cookieOptions,maxAge:config.sessionHours*3600000});
  req.sessionToken=token;issueCsrf(req,res,token);
}
async function logout(req,res) {
  if(req.sessionToken)await pool.execute('DELETE FROM sessions WHERE token_hash=?',[digest(req.sessionToken)]);
  res.clearCookie(SESSION,cookieOptions);req.sessionToken=null;issueCsrf(req,res,null);
  return {ok:true};
}
// Bounded, process-local request budgets. Production multi-instance hosting must
// replace this with a shared limiter at the gateway or in Redis.
function rateLimit(max,windowMs,key=req=>req.ip) {
  const buckets=new Map();let lastCleanup=0;
  return (req,res,next)=>{
    const now=Date.now();
    if(now-lastCleanup>60000){for(const [id,b]of buckets)if(b.until<=now)buckets.delete(id);lastCleanup=now;}
    const id=key(req);let b=buckets.get(id);
    if(!b||b.until<=now){if(buckets.size>=10000)V.fail('Please try again shortly.',429);b={count:0,until:now+windowMs};buckets.set(id,b);}
    if(++b.count>max){res.set('Retry-After',String(Math.ceil((b.until-now)/1000)));V.fail('Too many requests. Please try again later.',429);}
    next();
  };
}
module.exports={SESSION,CSRF,cookieOptions,cookies,safeUser,digest,session,allow,headers,csrf,issueSession,logout,rateLimit};
