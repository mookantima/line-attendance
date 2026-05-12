// Business rules

const WORK_START_HOUR = 10; // 10:00
const WORK_END_HOUR = 20;   // 20:00

// Late threshold for admin notification (minutes)
const LATE_NOTIFY_THRESHOLD = 15;

// Pay rates (baht/minute)
const LATE_DEDUCTION_PER_MIN = 1;
const OT_PAY_PER_MIN = 1;

// Perfect attendance bonus
const PERFECT_ATTENDANCE_BONUS = 1000;

// Leave entitlements
const PERSONAL_LEAVE_DAYS = 5;       // per year
const PERSONAL_LEAVE_NOTICE = 3;     // days advance notice
const ANNUAL_LEAVE_DAYS = 7;         // per year (after 1 year)
const ANNUAL_LEAVE_NOTICE = 7;       // days advance notice
const ANNUAL_LEAVE_MIN_TENURE = 365; // days employment required

// GPS
const STORE_RADIUS_M = parseInt(process.env.STORE_RADIUS_M || '10000');

// Holidays 2026 (2569) — employees get double pay
const HOLIDAYS_2026 = [
  { date: '2026-01-01', name: 'วันขึ้นปีใหม่', shopClosed: true },
  { date: '2026-01-02', name: 'วันหยุดเพิ่มเติม', shopClosed: true },
  { date: '2026-04-13', name: 'วันสงกรานต์', shopClosed: false },
  { date: '2026-04-14', name: 'วันสงกรานต์', shopClosed: false },
  { date: '2026-04-15', name: 'วันสงกรานต์', shopClosed: false },
  { date: '2026-05-01', name: 'วันแรงงานแห่งชาติ', shopClosed: false },
  { date: '2026-05-04', name: 'วันฉัตรมงคล', shopClosed: false },
  { date: '2026-06-03', name: 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ', shopClosed: false },
  { date: '2026-07-28', name: 'วันเฉลิมพระชนมพรรษา ร.10', shopClosed: false },
  { date: '2026-08-12', name: 'วันแม่แห่งชาติ', shopClosed: false },
  { date: '2026-10-13', name: 'วันหยุดชดเชยวันนวมินทรมหาราช', shopClosed: false },
  { date: '2026-10-23', name: 'วันปิยะมหาราช', shopClosed: false },
  { date: '2026-12-31', name: 'วันสิ้นปี', shopClosed: false },
];

function isHoliday(dateStr) {
  return HOLIDAYS_2026.find(h => h.date === dateStr) || null;
}

// Thailand time helpers (UTC+7, no DST)
// thaiNow() returns actual UTC — store as-is in DB (TIMESTAMPTZ handles it correctly)
function thaiNow() {
  return new Date();
}

// Convert any UTC Date to Thai local date string (YYYY-MM-DD)
function thaiDateStr(utcDate = new Date()) {
  const thaiMs = utcDate.getTime() + 7 * 60 * 60 * 1000;
  return new Date(thaiMs).toISOString().split('T')[0];
}

// Convert any UTC Date to Thai local time string (HH:MM)
function thaiTimeStr(utcDate = new Date()) {
  const thaiMs = utcDate.getTime() + 7 * 60 * 60 * 1000;
  return new Date(thaiMs).toISOString().substr(11, 5);
}

module.exports = {
  WORK_START_HOUR,
  WORK_END_HOUR,
  LATE_NOTIFY_THRESHOLD,
  LATE_DEDUCTION_PER_MIN,
  OT_PAY_PER_MIN,
  PERFECT_ATTENDANCE_BONUS,
  PERSONAL_LEAVE_DAYS,
  PERSONAL_LEAVE_NOTICE,
  ANNUAL_LEAVE_DAYS,
  ANNUAL_LEAVE_NOTICE,
  ANNUAL_LEAVE_MIN_TENURE,
  STORE_RADIUS_M,
  HOLIDAYS_2026,
  isHoliday,
  thaiNow,
  thaiDateStr,
  thaiTimeStr,
};
