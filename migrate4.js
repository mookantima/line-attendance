require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const sql = fs.readFileSync('./migrations/004_employee_profile.sql', 'utf8');
  try {
    await pool.query(sql);
    console.log('✅ Migration 004 done');
  } catch (e) {
    console.error('❌', e.message);
  } finally {
    await pool.end();
  }
}

migrate();
