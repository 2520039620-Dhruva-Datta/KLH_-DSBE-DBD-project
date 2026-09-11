'use strict';
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const {config} = require('../server/config.cjs');

// Only trusted repository DDL is interpreted here, never request data. MySQL's
// DELIMITER is a CLI directive, so split triggers with their declared delimiter.
function statements(source) {
  let delimiter = ';', buffer = '';
  const output = [];
  for (const line of source.split(/\r?\n/)) {
    if (/^\s*--/.test(line) || !line.trim()) continue;
    const directive = line.match(/^DELIMITER\s+(\S+)/i);
    if (directive) { delimiter = directive[1]; continue; }
    buffer += line + '\n';
    if (buffer.trimEnd().endsWith(delimiter)) {
      output.push(buffer.trim().slice(0, -delimiter.length)); buffer = '';
    }
  }
  if (buffer.trim()) throw Error('Incomplete migration statement.');
  return output;
}
async function migrate(connection, database, {fresh = false} = {}) {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(database)) throw Error('Invalid database identifier.');
  await connection.query("SET time_zone='+00:00'");
  if (fresh) {
    // Deliberately no IF NOT EXISTS: setup cannot overwrite an existing database.
    await connection.query('CREATE DATABASE `' + database + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  }
  await connection.query('USE `' + database + '`');
  const [existing] = await connection.execute("SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=? AND table_name='departments'", [database]);
  if (!existing[0].n) {
    const schema = fs.readFileSync(path.join(config.root, 'database/schema.sql'), 'utf8')
      .split('INSERT INTO departments(id,name,code,icon,description) VALUES')[0]
      .replace(/^CREATE DATABASE.*;\r?\nUSE civicdesk;\r?\n/m, '');
    for (const sql of statements(schema)) await connection.query(sql);
  }
  await connection.query('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(100) PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))');
  const [applied] = await connection.execute('SELECT name FROM schema_migrations');
  for (const name of fs.readdirSync(path.join(config.root, 'database/migrations')).filter(n => n.endsWith('.sql')).sort()) {
    if (applied.some(m => m.name === name)) continue;
    for (const sql of statements(fs.readFileSync(path.join(config.root, 'database/migrations', name), 'utf8'))) await connection.query(sql);
    await connection.execute('INSERT INTO schema_migrations(name) VALUES(?)', [name]);
    console.log('Applied migration ' + name);
  }
}
async function grantApp(connection, database, username, password) {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(username)) throw Error('Invalid application DB username.');
  // Account-management DDL cannot use execute placeholders. Driver escaping is
  // applied here only; HTTP data queries all use prepared execute statements.
  await connection.query('CREATE USER ?@? IDENTIFIED BY ?', [username, '127.0.0.1', password]);
  await connection.query('GRANT SELECT ON `' + database + '`.* TO ?@?', [username, '127.0.0.1']);
  for (const table of ['departments','services','users','applications','documents','grievances','notifications','preferences','sessions','reference_sequences']) {
    await connection.query('GRANT INSERT, UPDATE ON `' + database + '`.`' + table + '` TO ?@?', [username, '127.0.0.1']);
  }
  for (const table of ['departments','services','sessions']) await connection.query('GRANT DELETE ON `' + database + '`.`' + table + '` TO ?@?', [username, '127.0.0.1']);
  // status_logs are read-only to the server. Triggers run with migration-owner rights.
}
if (require.main === module) (async () => {
  if (!process.env.DB_ADMIN_USER) throw Error('Set DB_ADMIN_USER and DB_ADMIN_PASSWORD in .env for migration only.');
  const connection = await mysql.createConnection({...config.db, database: undefined, user: process.env.DB_ADMIN_USER, password: process.env.DB_ADMIN_PASSWORD || ''});
  try {
    await migrate(connection,config.db.database,{fresh:process.argv.includes('--fresh')});
    if(process.argv.includes('--seed-demo')){
      if(config.production)throw Error('Synthetic demo accounts cannot be seeded in production mode.');
      await require('./seed-db.cjs').seed(connection);
    }
    if(process.argv.includes('--create-app-user'))await grantApp(connection,config.db.database,config.db.user,config.db.password);
  } finally { await connection.end(); }
})().catch(error => {console.error(error.message); process.exitCode = 1;});
module.exports = {migrate, grantApp, statements};
