const { query } = require('../config/database');

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  // Seed defaults
  await query(`
    INSERT INTO settings (key, value)
    VALUES ('store_radius_m', '10000')
    ON CONFLICT (key) DO NOTHING
  `);
}

let tableReady = null;
function init() {
  if (!tableReady) tableReady = ensureTable().catch(e => { tableReady = null; throw e; });
  return tableReady;
}

async function getSetting(key) {
  await init();
  const res = await query('SELECT value FROM settings WHERE key = $1', [key]);
  return res.rows[0]?.value ?? null;
}

async function setSetting(key, value) {
  await init();
  await query(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, String(value)]
  );
}

async function getAllSettings() {
  await init();
  const res = await query('SELECT key, value FROM settings ORDER BY key');
  return Object.fromEntries(res.rows.map(r => [r.key, r.value]));
}

module.exports = { getSetting, setSetting, getAllSettings };
