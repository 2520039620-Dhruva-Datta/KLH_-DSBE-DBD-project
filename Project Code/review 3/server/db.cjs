'use strict';
const mysql = require('mysql2/promise');
const {config} = require('./config.cjs');
const pool = mysql.createPool({...config.db, connectionLimit: 10, queueLimit: 100, waitForConnections: true});
// Set the SQL session timezone as well as the driver's date encoding timezone.
pool.pool.on('connection', connection => connection.query("SET time_zone = '+00:00'"));
async function transaction(fn, readOnly = false) {
  const connection = await pool.getConnection();
  try {
    await connection.query(readOnly ? 'START TRANSACTION READ ONLY' : 'START TRANSACTION');
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}
async function rows(connection, sql, params = []) { return (await connection.execute(sql, params))[0]; }
function normalize(row) {
  const result = {...row};
  for (const key of ['active', 'read', 'isOverdue']) if (key in result) result[key] = Boolean(result[key]);
  for (const [key, value] of Object.entries(result)) if (value instanceof Date) result[key] = value.toISOString();
  return result;
}
module.exports = {pool, transaction, rows, normalize};
