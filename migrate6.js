require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  const sql = fs.readFileSync('./migrations/006_weekly_off.sql', 'utf8');
  try { await pool.query(sql); console.log('✅ Migration 006 done'); }
  catch (e) { console.error('❌', e.message); }
  finally { await pool.end(); }
}
run();
