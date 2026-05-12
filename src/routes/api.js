const express = require('express');
const { query } = require('../config/database');
const { getTodayAttendance, getMonthlyAttendance } = require('../services/attendanceService');
const { getAllLeaves, getAllBalances, getPendingLeaves } = require('../services/leaveService');
const { calcMonthlyPayroll } = require('../services/payrollService');
const { thaiNow } = require('../config/constants');

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

// GET /api/employees
router.get('/employees', async (req, res) => {
  try {
    const res2 = await query('SELECT id, name, role, start_date, is_active FROM users ORDER BY name');
    res.json(res2.rows);
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

module.exports = router;
