require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const sql = fs.readFileSync('./migrations/001_initial.sql', 'utf8');
  try {
    await pool.query(sql);
    console.log('✅ Migration สำเร็จ! ตารางถูกสร้างแล้ว');
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
  await pool.end();
}

migrate();
