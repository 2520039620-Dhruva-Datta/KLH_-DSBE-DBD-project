'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {config} = require('../server/config.cjs');
const passwords = require('../server/passwords.cjs');
function fixture(anchor = new Date().toISOString()) {
  const context = {window: {}, btoa: value => Buffer.from(value, 'binary').toString('base64')};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(config.root, 'js/seed.js'), 'utf8'), context);
  return context.window.Seed.generate(anchor);
}
const timestamp = value => value ? new Date(value) : null;
async function seed(connection, anchor) {
  const [count] = await connection.execute('SELECT COUNT(*) n FROM users');
  if (count[0].n) throw Error('Seeding requires an empty database; existing accounts are never overwritten.');
  const data = fixture(anchor);
  // Each user receives an independent salt, including users sharing a demo password.
  console.log('Hashing 50 synthetic demo accounts…');
  const hashes = new Map();
  for (const user of data.users) {
    hashes.set(user.id, await passwords.hash(user.password));
    if(hashes.size%10===0)console.log('Hashed '+hashes.size+' / '+data.users.length+' demo accounts.');
  }
  const insert = async (table, row) => {
    const columns = Object.keys(row);
    await connection.execute('INSERT INTO `' + table + '` (' + columns.map(c => '`' + c + '`').join(',') + ') VALUES (' + columns.map(() => '?').join(',') + ')', Object.values(row));
  };
  await connection.beginTransaction();
  try {
    for (const d of data.departments) await insert('departments', {...d, created_at: timestamp(d.created_at)});
    for (const s of data.services) await insert('services', {...s, required_documents: JSON.stringify(s.required_documents)});
    for (const {password, ...u} of data.users) await insert('users', {...u, password_hash: hashes.get(u.id), created_at: timestamp(u.created_at)});
    for (const a of data.applications) {
      const logs = data.status_logs.filter(l => l.application_id === a.id);
      const last = logs.at(-1);
      await insert('applications', {...a, form_data: JSON.stringify(a.form_data), created_at: timestamp(a.created_at), updated_at: timestamp(a.updated_at), decided_at: timestamp(a.decided_at), last_actor_id: last.actor_id, last_remarks: last.remarks, revision: logs.length});
    }
    // Setup owns a brand-new empty database. Replace insert-trigger fixture logs
    // with the complete deterministic application history, within this transaction.
    await connection.execute('DELETE FROM notifications');
    await connection.execute('DELETE FROM status_logs');
    for (const l of data.status_logs) await insert('status_logs', {...l, created_at: timestamp(l.created_at)});
    for (const d of data.documents) await insert('documents', {...d, content: Buffer.from(d.content.split(',')[1], 'base64'), created_at: timestamp(d.created_at)});
    for (const n of data.notifications) await insert('notifications', {...n, created_at: timestamp(n.created_at)});
    // Seed grievances through the real state machine, preserving each transition.
    for (const g of data.grievances) {
      const {status, resolution, resolved_at, officer_id, updated_at, ...base} = g;
      await insert('grievances', {...base, created_at: timestamp(g.created_at), last_actor_id: g.citizen_id});
      if (status !== 'OPEN') await connection.execute("UPDATE grievances SET status='IN_PROGRESS',last_actor_id=?,updated_at=? WHERE id=?", [officer_id, timestamp(updated_at), g.id]);
      if (status === 'RESOLVED') await connection.execute("UPDATE grievances SET status='RESOLVED',resolution=?,last_actor_id=?,updated_at=? WHERE id=?", [resolution, officer_id, timestamp(updated_at), g.id]);
    }
    await connection.execute("UPDATE reference_sequences SET value=? WHERE name='applications'", [data.applications.length]);
    await connection.execute("UPDATE reference_sequences SET value=? WHERE name='grievances'", [data.grievances.length]);
    await connection.execute('INSERT INTO portal_metadata(name,value) VALUES(?,?),(?,?)', ['seed_anchor', data.anchor, 'instance_id', crypto.randomUUID()]);
    await connection.commit();
    console.log('Seeded 8 departments, 25 services, 50 users, 420 applications, 684 documents and 42 grievances.');
  } catch (error) { await connection.rollback(); throw error; }
}
module.exports = {seed, fixture};
