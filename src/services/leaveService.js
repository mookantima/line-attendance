const { query } = require('../config/database');
const {
  PERSONAL_LEAVE_DAYS, PERSONAL_LEAVE_NOTICE,
  ANNUAL_LEAVE_DAYS, ANNUAL_LEAVE_NOTICE, ANNUAL_LEAVE_MIN_TENURE,
  thaiNow, thaiDateStr,
} = require('../config/constants');

async function getLeaveBalance(userId, year) {
  const now = thaiNow();
  const y = year || now.getUTCFullYear();

  // Ensure row exists
  await query(
    `INSERT INTO leave_balance (user_id, year, personal_total, annual_total)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT (user_id, year) DO NOTHING`,
    [userId, y, PERSONAL_LEAVE_DAYS]
  );

  const res = await query('SELECT * FROM leave_balance WHERE user_id = $1 AND year = $2', [userId, y]);
  return res.rows[0];
}

async function ensureAnnualLeave(userId, startDate) {
  const user = await query('SELECT start_date FROM users WHERE id = $1', [userId]);
  const startWork = new Date(user.rows[0].start_date);
  const tenureDays = (new Date(startDate) - startWork) / (1000 * 60 * 60 * 24);
  return tenureDays >= ANNUAL_LEAVE_MIN_TENURE;
}

// Count working days between two dates (simple — excludes Sundays, not holidays)
function countWorkDays(start, end) {
  let count = 0;
  const cur = new Date(start);
  const endDate = new Date(end);
  while (cur <= endDate) {
    if (cur.getDay() !== 0) count++; // exclude Sunday
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

async function checkOverlap(startDate, endDate) {
  const res = await query(
    `SELECT u.name, lr.start_date, lr.end_date
     FROM leave_requests lr
     JOIN users u ON u.id = lr.user_id
     WHERE lr.status = 'approved'
       AND lr.start_date <= $2 AND lr.end_date >= $1`,
    [startDate, endDate]
  );
  return res.rows; // returns employees already on leave during those dates
}

async function requestLeave(userId, leaveType, startDate, endDate, reason) {
  const now = thaiNow();
  const today = thaiDateStr();

  // Advance notice check
  const notice = leaveType === 'personal' ? PERSONAL_LEAVE_NOTICE : ANNUAL_LEAVE_NOTICE;
  const noticeDays = (new Date(startDate) - new Date(today)) / (1000 * 60 * 60 * 24);
  if (noticeDays < notice) {
    return { error: 'insufficient_notice', required: notice, given: Math.floor(noticeDays) };
  }

  // Annual leave tenure check
  if (leaveType === 'annual') {
    const eligible = await ensureAnnualLeave(userId, startDate);
    if (!eligible) return { error: 'not_eligible_annual' };
  }

  // Balance check
  const year = new Date(startDate).getFullYear();
  const balance = await getLeaveBalance(userId, year);
  const days = countWorkDays(startDate, endDate);

  if (leaveType === 'personal' && balance.personal_used + days > balance.personal_total) {
    return { error: 'insufficient_balance', available: balance.personal_total - balance.personal_used };
  }
  if (leaveType === 'annual' && balance.annual_used + days > balance.annual_total) {
    return {
      error: 'insufficient_balance',
      available: balance.annual_total === 0 ? ANNUAL_LEAVE_DAYS : balance.annual_total - balance.annual_used,
    };
  }

  // Overlap warning (not blocking — admin decides)
  const overlap = await checkOverlap(startDate, endDate);

  // Check if leave falls on employee's weekly day off
  const userRes = await query('SELECT weekly_off FROM users WHERE id = $1', [userId]);
  const weeklyOff = userRes.rows[0]?.weekly_off || [];
  const dayOffWarning = [];
  if (weeklyOff.length > 0) {
    const d = new Date(startDate);
    const end = new Date(endDate);
    while (d <= end) {
      if (weeklyOff.includes(d.getDay())) {
        const dayNames = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'];
        dayOffWarning.push(`${d.toISOString().slice(0,10)} (${dayNames[d.getDay()]})`);
      }
      d.setDate(d.getDate() + 1);
    }
  }

  const res = await query(
    `INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, days, reason)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [userId, leaveType, startDate, endDate, days, reason]
  );

  return { request: res.rows[0], overlap, dayOffWarning };
}

async function approveLeave(requestId, adminId) {
  const req = await query('SELECT * FROM leave_requests WHERE id = $1', [requestId]);
  if (!req.rows[0]) return { error: 'not_found' };
  if (req.rows[0].status !== 'pending') return { error: 'already_processed' };

  await query(
    `UPDATE leave_requests SET status = 'approved', approved_by = $1, approved_at = NOW() WHERE id = $2`,
    [adminId, requestId]
  );

  // Deduct from balance
  const { user_id, leave_type, days, start_date } = req.rows[0];
  const year = new Date(start_date).getFullYear();
  const col = leave_type === 'personal' ? 'personal_used' : 'annual_used';
  await query(`UPDATE leave_balance SET ${col} = ${col} + $1 WHERE user_id = $2 AND year = $3`, [days, user_id, year]);

  return { request: req.rows[0] };
}

async function rejectLeave(requestId, adminId) {
  const res = await query(
    `UPDATE leave_requests SET status = 'rejected', approved_by = $1, approved_at = NOW()
     WHERE id = $2 AND status = 'pending' RETURNING *`,
    [adminId, requestId]
  );
  return res.rows[0] ? { request: res.rows[0] } : { error: 'not_found_or_processed' };
}

async function getPendingLeaves() {
  const res = await query(
    `SELECT lr.*, u.name AS employee_name
     FROM leave_requests lr
     JOIN users u ON u.id = lr.user_id
     WHERE lr.status = 'pending'
     ORDER BY lr.created_at ASC`
  );
  return res.rows;
}

async function getAllLeaves(year, month) {
  const res = await query(
    `SELECT lr.*, u.name AS employee_name
     FROM leave_requests lr
     JOIN users u ON u.id = lr.user_id
     WHERE EXTRACT(YEAR FROM lr.start_date) = $1
       AND EXTRACT(MONTH FROM lr.start_date) = $2
     ORDER BY lr.start_date, u.name`,
    [year, month]
  );
  return res.rows;
}

async function getAllBalances(year) {
  const res = await query(
    `SELECT u.id, u.name, lb.*
     FROM users u
     LEFT JOIN leave_balance lb ON lb.user_id = u.id AND lb.year = $1
     WHERE u.is_active = true
     ORDER BY u.name`,
    [year]
  );
  return res.rows;
}

module.exports = {
  getLeaveBalance, requestLeave, approveLeave, rejectLeave,
  getPendingLeaves, getAllLeaves, getAllBalances, checkOverlap,
};
