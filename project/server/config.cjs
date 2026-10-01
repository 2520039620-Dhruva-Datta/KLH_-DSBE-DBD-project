'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const envFile = path.resolve(process.env.AMAP_ENV_FILE || path.join(root, '.env'));
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
function integer(name, fallback, min, max) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw Error('Invalid ' + name);
  return value;
}
const production = process.env.NODE_ENV === 'production';
const config = {
  root, production, envFile,
  host: process.env.HOST || '127.0.0.1',
  port: integer('PORT', 3000, 1, 65535),
  origin: process.env.APP_ORIGIN || 'http://localhost:3000',
  csrfSecret: process.env.CSRF_SECRET || '',
  secure: process.env.COOKIE_SECURE === 'true',
  sessionHours: integer('SESSION_HOURS', 8, 1, 24),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: integer('DB_PORT', 3306, 1, 65535),
    database: process.env.DB_NAME || 'amap',
    user: process.env.DB_USER || 'amap_app',
    password: process.env.DB_PASSWORD || '',
    timezone: 'Z', decimalNumbers: true, supportBigNumbers: true,
    multipleStatements: false, charset: 'utf8mb4',
    ...(process.env.DB_SSL_CA ? {ssl: {ca: fs.readFileSync(process.env.DB_SSL_CA), rejectUnauthorized: true}} : {})
  }
};
function validate() {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(config.db.database)) throw Error('DB_NAME must be a simple database identifier.');
  if (config.csrfSecret.length < 64 || !config.db.password) throw Error('Configure .env first: run npm run setup:local or follow .env.example.');
  const origin = new URL(config.origin);
  if (origin.origin !== config.origin) throw Error('APP_ORIGIN must contain only scheme, hostname, and port.');
  if (production && (!config.secure || origin.protocol !== 'https:')) throw Error('Production requires an HTTPS APP_ORIGIN and COOKIE_SECURE=true.');
  if (!production && !['localhost', '127.0.0.1', '::1'].includes(config.host)) throw Error('Development binds to loopback only. Configure HTTPS production mode for deployment.');
}
module.exports = {config, validate};
