require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  const sql = fs.readFileSync('./migrations/008_registration.sql', 'utf8');
  try { await pool.query(sql); console.log('✅ Migration 008 done'); }
  catch (e) { console.error('❌', e.message); }
  finally { await pool.end(); }
}
run();
