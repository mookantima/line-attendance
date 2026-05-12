const express = require('express');
const { query } = require('../config/database');
const { getTodayAttendance, getMonthlyAttendance } = require('../services/attendanceService');
const { getAllLeaves, getAllBalances, getPendingLeaves } = require('../services/leaveService');
const { calcMonthlyPayroll } = require('../services/payrollService');
const { thaiNow } = require('../config/constants');
const { getAllSettings, setSetting } = require('../services/settingsService');

const router = express.Router();

// Simple password auth middleware
function auth(req, res, next) {
  const pass = req.headers['x-dashboard-password'];
  if (pass !== process.env.DASHBOARD_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.use(auth);

// GET /api/today — today's attendance
router.get('/today', async (req, res) => {
  try {
    const records = await getTodayAttendance();
    res.json(records);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/attendance?year=&month=
router.get('/attendance', async (req, res) => {
  const now = thaiNow();
  const year = parseInt(req.query.year || now.getUTCFullYear());
  const month = parseInt(req.query.month || now.getUTCMonth() + 1);
  try {
    const records = await getMonthlyAttendance(year, month);
    res.json(records);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/employees — pre-add employee (no LINE ID yet)
router.post('/employees', async (req, res) => {
  const { name, surname, nickname, salary_type, salary_amount, bank_account, bank_name } = req.body;
  if (!name) return res.status(400).json({ error: 'กรุณาระบุชื่อพนักงาน' });
  try {
    const result = await query(
      `INSERT INTO users (name, surname, nickname, salary_type, salary_amount, bank_account, bank_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'employee', true)
       RETURNING id, name, surname, nickname, role, salary_type, salary_amount, bank_account, bank_name, is_active`,
      [name, surname || null, nickname || null, salary_type || 'monthly',
       salary_amount ? parseFloat(salary_amount) : null, bank_account || null, bank_name || null]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/employees
router.get('/employees', async (req, res) => {
  try {
    const res2 = await query(
      'SELECT id, name, surname, nickname, role, start_date, is_active, salary_type, salary_amount, bank_account, bank_name, id_card_url, bank_book_url, CASE WHEN line_user_id IS NOT NULL THEN true ELSE false END AS line_user_id FROM users ORDER BY name'
    );
    res.json(res2.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/employees/:id — update employee profile (admin)
router.put('/employees/:id', async (req, res) => {
  const { name, surname, nickname, bank_account, bank_name, salary_type, salary_amount } = req.body;
  try {
    const result = await query(
      `UPDATE users SET
        name = COALESCE($1, name),
        surname = COALESCE($2, surname),
        nickname = COALESCE($3, nickname),
        bank_account = COALESCE($4, bank_account),
        bank_name = COALESCE($5, bank_name),
        salary_type = COALESCE($6, salary_type),
        salary_amount = COALESCE($7, salary_amount)
       WHERE id = $8
       RETURNING id, name, surname, nickname, role, salary_type, salary_amount, bank_account, bank_name`,
      [name || null, surname || null, nickname || null, bank_account || null, bank_name || null,
       salary_type || null, salary_amount != null ? parseFloat(salary_amount) : null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'ไม่พบพนักงาน' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/employees/:id — deactivate employee (soft delete)
router.delete('/employees/:id', async (req, res) => {
  try {
    const result = await query(
      'UPDATE users SET is_active = false WHERE id = $1 RETURNING id, name',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'ไม่พบพนักงาน' });
    res.json({ ok: true, id: result.rows[0].id, name: result.rows[0].name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/calendar?year=&month= — all employees attendance for calendar view
router.get('/calendar', async (req, res) => {
  const now = thaiNow();
  const year = parseInt(req.query.year || now.getUTCFullYear());
  const month = parseInt(req.query.month || now.getUTCMonth() + 1);
  try {
    const [empRes, attRes, leaveRes] = await Promise.all([
      query('SELECT id, name, nickname, weekly_off FROM users WHERE is_active = true ORDER BY name'),
      query(
        `SELECT a.*, u.name as user_name FROM attendance a
         JOIN users u ON u.id = a.user_id
         WHERE EXTRACT(YEAR FROM a.work_date) = $1 AND EXTRACT(MONTH FROM a.work_date) = $2`,
        [year, month]
      ),
      query(
        `SELECT lr.*, u.name as user_name FROM leave_requests lr
         JOIN users u ON u.id = lr.user_id
         WHERE lr.status != 'rejected'
           AND (EXTRACT(YEAR FROM lr.start_date) = $1 OR EXTRACT(YEAR FROM lr.end_date) = $1)
           AND (EXTRACT(MONTH FROM lr.start_date) = $2 OR EXTRACT(MONTH FROM lr.end_date) = $2)`,
        [year, month]
      ),
    ]);
    res.json({ employees: empRes.rows, attendance: attRes.rows, leaves: leaveRes.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/employees/:id/weekly-off — set weekly off days
router.put('/employees/:id/weekly-off', async (req, res) => {
  const { weekly_off } = req.body; // array of 0-6 (0=Sun)
  if (!Array.isArray(weekly_off)) return res.status(400).json({ error: 'weekly_off ต้องเป็น array' });
  try {
    const result = await query(
      'UPDATE users SET weekly_off = $1 WHERE id = $2 RETURNING id, name, weekly_off',
      [weekly_off, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/attendance/employee/:id?year=&month= — attendance records for one employee
router.get('/attendance/employee/:id', async (req, res) => {
  const now = thaiNow();
  const year = parseInt(req.query.year || now.getUTCFullYear());
  const month = parseInt(req.query.month || now.getUTCMonth() + 1);
  try {
    const result = await query(
      `SELECT * FROM attendance
       WHERE user_id = $1
         AND EXTRACT(YEAR FROM work_date) = $2
         AND EXTRACT(MONTH FROM work_date) = $3
       ORDER BY work_date`,
      [req.params.id, year, month]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/attendance/manual — create or update attendance record (admin)
router.post('/attendance/manual', async (req, res) => {
  const { user_id, work_date, check_in_time, check_out_time, late_minutes, ot_minutes, note } = req.body;
  if (!user_id || !work_date) return res.status(400).json({ error: 'กรุณาระบุพนักงานและวันที่' });

  // Convert Thai time strings (HH:MM) to UTC ISO for the given date
  function toUTC(dateStr, timeStr) {
    if (!timeStr) return null;
    // dateStr = YYYY-MM-DD, timeStr = HH:MM (Thai time = UTC+7)
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCHours(h - 7, m, 0, 0); // subtract 7 to get UTC
    return d.toISOString();
  }

  const checkIn = toUTC(work_date, check_in_time);
  const checkOut = toUTC(work_date, check_out_time);

  // Auto-calc late and OT if not provided
  let lateMin = parseInt(late_minutes) || 0;
  let otMin = parseInt(ot_minutes) || 0;

  if (check_in_time && late_minutes == null) {
    const [h, m] = check_in_time.split(':').map(Number);
    const startMinutes = h * 60 + m;
    lateMin = Math.max(0, startMinutes - 10 * 60);
  }
  if (check_out_time && ot_minutes == null) {
    const [h, m] = check_out_time.split(':').map(Number);
    const endMinutes = h * 60 + m;
    otMin = Math.max(0, endMinutes - 20 * 60);
  }

  try {
    const result = await query(
      `INSERT INTO attendance (user_id, work_date, check_in_time, check_out_time, late_minutes, ot_minutes, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, work_date) DO UPDATE SET
         check_in_time = EXCLUDED.check_in_time,
         check_out_time = EXCLUDED.check_out_time,
         late_minutes = EXCLUDED.late_minutes,
         ot_minutes = EXCLUDED.ot_minutes,
         note = EXCLUDED.note
       RETURNING *`,
      [user_id, work_date, checkIn, checkOut, lateMin, otMin, note || 'แก้ไขโดย admin']
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/leaves?year=&month=
router.get('/leaves', async (req, res) => {
  const now = thaiNow();
  const year = parseInt(req.query.year || now.getUTCFullYear());
  const month = parseInt(req.query.month || now.getUTCMonth() + 1);
  try {
    const [leaves, pending] = await Promise.all([getAllLeaves(year, month), getPendingLeaves()]);
    res.json({ leaves, pending });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/leave-balance?year=
router.get('/leave-balance', async (req, res) => {
  const now = thaiNow();
  const year = parseInt(req.query.year || now.getUTCFullYear());
  try {
    const balances = await getAllBalances(year);
    res.json(balances);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/payroll?year=&month=
router.get('/payroll', async (req, res) => {
  const now = thaiNow();
  const year = parseInt(req.query.year || now.getUTCFullYear());
  const month = parseInt(req.query.month || now.getUTCMonth() + 1);
  try {
    const payroll = await calcMonthlyPayroll(year, month);
    res.json(payroll);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/notify/end-of-day — manually trigger end-of-day notification
router.post('/notify/end-of-day', async (req, res) => {
  try {
    const { sendEndOfDayNotifications } = require('../services/endOfDayNotify');
    await sendEndOfDayNotifications();
    res.json({ ok: true, message: 'ส่งแจ้งเตือนแล้ว' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/summary — dashboard overview
router.get('/summary', async (req, res) => {
  try {
    const today = await getTodayAttendance();
    const pending = await getPendingLeaves();
    const empCount = await query('SELECT COUNT(*) FROM users WHERE is_active = true');

    res.json({
      totalEmployees: parseInt(empCount.rows[0].count),
      todayCheckedIn: today.filter(r => r.check_in_time).length,
      todayLate: today.filter(r => r.late_minutes > 0).length,
      pendingLeaves: pending.length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await getAllSettings();
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/settings
router.put('/settings', async (req, res) => {
  try {
    const allowed = ['store_radius_m'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        await setSetting(key, req.body[key]);
      }
    }
    const settings = await getAllSettings();
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
