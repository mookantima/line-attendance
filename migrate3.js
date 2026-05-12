require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function migrate() {
  const sql = fs.readFileSync('./migrations/003_face.sql', 'utf8');
  try {
    await pool.query(sql);
    console.log('✅ Migration 003 สำเร็จ! (เพิ่ม reference_photo + face_alerts)');
  } catch (e) { console.error('❌', e.message); }
  await pool.end();
}
migrate();
