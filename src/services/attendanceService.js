const { query } = require('../config/database');
const { WORK_START_HOUR, WORK_END_HOUR, thaiNow, thaiDateStr, thaiTimeStr } = require('../config/constants');

async function getUserByLineId(lineUserId) {
  const res = await query('SELECT * FROM users WHERE line_user_id = $1 AND is_active = true', [lineUserId]);
  return res.rows[0] || null;
}

async function createUser(lineUserId, name, role = 'employee') {
  const res = await query(
    'INSERT INTO users (line_user_id, name, role) VALUES ($1, $2, $3) RETURNING *',
    [lineUserId, name, role]
  );
  return res.rows[0];
}

async function checkIn(userId, lat, lng, photoUrl) {
  const now = thaiNow();
  const today = thaiDateStr();

  // Check for existing record
  const existing = await query('SELECT * FROM attendance WHERE user_id = $1 AND work_date = $2', [userId, today]);
  if (existing.rows[0]?.check_in_time) {
    return { error: 'already_checkedin', record: existing.rows[0] };
  }

  // Calculate late minutes
  const lateMinutes = calcLateMinutes(now);

  // Upsert attendance record
  const res = await query(
    `INSERT INTO attendance (user_id, work_date, check_in_time, check_in_lat, check_in_lng, check_in_photo, late_minutes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, work_date) DO UPDATE SET
       check_in_time = EXCLUDED.check_in_time,
       check_in_lat = EXCLUDED.check_in_lat,
       check_in_lng = EXCLUDED.check_in_lng,
       check_in_photo = EXCLUDED.check_in_photo,
       late_minutes = EXCLUDED.late_minutes
     RETURNING *`,
    [userId, today, now.toISOString(), lat, lng, photoUrl, lateMinutes]
  );

  return { record: res.rows[0], lateMinutes, timeStr: thaiTimeStr(now) };
}

async function checkOut(userId, lat, lng, photoUrl) {
  const now = thaiNow();
  const today = thaiDateStr();

  const existing = await query('SELECT * FROM attendance WHERE user_id = $1 AND work_date = $2', [userId, today]);
  if (!existing.rows[0]?.check_in_time) {
    return { error: 'no_checkin' };
  }
  if (existing.rows[0]?.check_out_time) {
    return { error: 'already_checkedout' };
  }

  const otMinutes = calcOtMinutes(now);

  const res = await query(
    `UPDATE attendance SET
       check_out_time = $1, check_out_lat = $2, check_out_lng = $3,
       check_out_photo = $4, ot_minutes = $5
     WHERE user_id = $6 AND work_date = $7 RETURNING *`,
    [now.toISOString(), lat, lng, photoUrl, otMinutes, userId, today]
  );

  return { record: res.rows[0], otMinutes, timeStr: thaiTimeStr(now) };
}

function calcLateMinutes(utcDate) {
  // Convert UTC → Thai time (UTC+7) then check against work start
  const thaiMs = utcDate.getTime() + 7 * 60 * 60 * 1000;
  const thai = new Date(thaiMs);
  const totalMin = thai.getUTCHours() * 60 + thai.getUTCMinutes();
  const startMin = WORK_START_HOUR * 60;
  return totalMin > startMin ? totalMin - startMin : 0;
}

function calcOtMinutes(utcDate) {
  const thaiMs = utcDate.getTime() + 7 * 60 * 60 * 1000;
  const thai = new Date(thaiMs);
  const totalMin = thai.getUTCHours() * 60 + thai.getUTCMinutes();
  const endMin = WORK_END_HOUR * 60;
  return totalMin > endMin ? totalMin - endMin : 0;
}

async function getTodayAttendance() {
  const today = thaiDateStr();
  const res = await query(
    `SELECT a.*, u.name, u.role
     FROM attendance a
     JOIN users u ON u.id = a.user_id
     WHERE a.work_date = $1
     ORDER BY a.check_in_time ASC NULLS LAST`,
    [today]
  );
  return res.rows;
}

async function getMonthlyAttendance(year, month) {
  const res = await query(
    `SELECT a.*, u.name
     FROM attendance a
     JOIN users u ON u.id = a.user_id
     WHERE EXTRACT(YEAR FROM a.work_date) = $1
       AND EXTRACT(MONTH FROM a.work_date) = $2
     ORDER BY u.name, a.work_date`,
    [year, month]
  );
  return res.rows;
}

async function getMyStats(userId) {
  const now = thaiNow();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const res = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'present') AS present_days,
       COUNT(*) FILTER (WHERE status = 'absent') AS absent_days,
       COALESCE(SUM(late_minutes), 0) AS total_late_min,
       COALESCE(SUM(ot_minutes), 0) AS total_ot_min
     FROM attendance
     WHERE user_id = $1
       AND EXTRACT(YEAR FROM work_date) = $2
       AND EXTRACT(MONTH FROM work_date) = $3`,
    [userId, year, month]
  );
  return res.rows[0];
}

module.exports = { getUserByLineId, createUser, checkIn, checkOut, getTodayAttendance, getMonthlyAttendance, getMyStats };
