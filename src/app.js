require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const webhookRouter = require('./routes/webhook');
const apiRouter = require('./routes/api');
const attendRouter = require('./routes/attend');
const salaryRouter = require('./routes/salary');

const app = express();

app.use(cors());

// Serve uploaded photos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve static public files (attend.html etc.)
app.use(express.static(path.join(__dirname, '../public')));

// Line webhook — must come before express.json()
app.use('/webhook', webhookRouter);

// JSON body parser for API routes
app.use(express.json({ limit: '10mb' }));

// Dashboard API
app.use('/api', apiRouter);

// Attendance web page + submit API
app.use('/attend', attendRouter);

// Salary & commission management
app.use('/api/salary', salaryRouter);

// Serve built dashboard
const dashboardDist = path.join(__dirname, '../dashboard/dist');
if (fs.existsSync(dashboardDist)) {
  app.use('/dashboard', express.static(dashboardDist));
  app.get(['/dashboard', '/dashboard/*'], (req, res) =>
    res.sendFile(path.join(dashboardDist, 'index.html'))
  );
}

// Admin tool: unlink LINE for testing
app.post('/admin/unlink', express.urlencoded({ extended: true }), async (req, res) => {
  const { query } = require('./config/database');
  if (req.body.pw !== process.env.DASHBOARD_PASSWORD) return res.status(401).send('Unauthorized');
  const result = await query('UPDATE users SET line_user_id = NULL WHERE id = $1', [parseInt(req.body.id)]);
  res.redirect(`/admin/unlink?pw=${encodeURIComponent(req.body.pw)}&msg=unlinked+${result.rowCount}+rows`);
});

app.get('/admin/unlink', async (req, res) => {
  const { query } = require('./config/database');
  if (req.query.pw !== process.env.DASHBOARD_PASSWORD) return res.status(401).send('Unauthorized');
  const result = await query('SELECT id, name, surname, line_user_id FROM users WHERE is_active = true ORDER BY name');
  const pw = req.query.pw;
  const msg = req.query.msg ? `<p style="color:green;font-weight:bold">✅ ${req.query.msg}</p>` : '';
  const rows = result.rows.map(u =>
    `<tr><td>${u.id}</td><td>${u.name} ${u.surname || ''}</td>` +
    `<td style="color:${u.line_user_id ? 'green' : 'gray'}">${u.line_user_id ? '✅ เชื่อมแล้ว' : '❌ ไม่ได้เชื่อม'}</td>` +
    `<td>${u.line_user_id
      ? `<form method="POST" action="/admin/unlink" style="display:inline">
           <input type="hidden" name="pw" value="${pw}">
           <input type="hidden" name="id" value="${u.id}">
           <button type="submit" style="color:red;cursor:pointer;border:none;background:none;font-size:14px">ยกเลิก LINE</button>
         </form>`
      : '<span style="color:gray">—</span>'
    }</td></tr>`
  ).join('');
  res.send(`<html><body style="font-family:sans-serif;padding:20px">
    <h2>จัดการ LINE Account</h2>${msg}
    <table border=1 cellpadding=8 cellspacing=0>${rows}</table>
  </body></html>`);
});

// Root → redirect to dashboard
app.get('/', (req, res) => res.redirect('/dashboard/'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Start daily cron sync
const { startCronSync } = require('./services/cronSync');
startCronSync();

// Start end-of-day notification (20:00 Thai time)
const { startEndOfDayCron } = require('./services/endOfDayNotify');
startEndOfDayCron();

const PORT = process.env.PORT || 3000;

async function runMigrations() {
  const { query } = require('./config/database');
  const migrations = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS id_card_url TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_book_url TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS start_date DATE`,
  ];
  for (const sql of migrations) {
    try { await query(sql); } catch (e) { console.error('Migration error:', e.message); }
  }
  console.log('✅ Migrations checked');
}

runMigrations().then(() => app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Webhook: https://YOUR_DOMAIN/webhook`);
  console.log(`📱 LIFF page: https://YOUR_DOMAIN/liff`);
}));
