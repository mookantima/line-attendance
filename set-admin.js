require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function setAdmin() {
  const res = await pool.query(
    "UPDATE users SET role = 'admin' WHERE name = 'กัณทิมา อุปัติสิงห์' RETURNING id, name, role"
  );
  if (res.rows[0]) {
    console.log(`✅ อัพเดทสำเร็จ: ${res.rows[0].name} (ID: ${res.rows[0].id}) → role: ${res.rows[0].role}`);
  } else {
    console.log('❌ ไม่พบชื่อในระบบ');
  }
  await pool.end();
}

setAdmin();
