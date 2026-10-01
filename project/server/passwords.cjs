'use strict';
const crypto = require('node:crypto');
const {promisify} = require('node:util');
const scrypt = promisify(crypto.scrypt);
// New hashes use OWASP's scrypt N=2^17, r=8, p=1; schema's older demo hashes
// are accepted for migration and upgraded after a successful login.
const options = {N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024};
let tail = Promise.resolve(),pending=0;
function serialized(fn) {
  if(pending>=16){const error=Error('Sign-in is busy. Please try again shortly.');error.status=503;return Promise.reject(error);}
  pending++;const job=tail.then(fn).finally(()=>pending--);tail=job.catch(()=>{});return job;
}
async function hash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await serialized(() => scrypt(password, salt, 64, options));
  return 'scrypt17:' + salt + ':' + key.toString('hex');
}
async function verify(password, encoded) {
  const [algorithm, salt, expected] = String(encoded || '').split(':');
  if (!['scrypt','scrypt17'].includes(algorithm) || !salt || !/^[0-9a-f]{128}$/.test(expected || '')) return false;
  const actual = await serialized(() => scrypt(String(password), salt, 64, algorithm === 'scrypt17' ? options : {}));
  return crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
module.exports = {hash, verify};
