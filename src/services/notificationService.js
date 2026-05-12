const { push, text, leaveApprovalFlex } = require('./lineMessaging');
const { query } = require('../config/database');

async function getAdminsAndManagers() {
  const res = await query(
    "SELECT line_user_id FROM users WHERE role IN ('admin', 'manager') AND is_active = true"
  );
  return res.rows.map(r => r.line_user_id);
}

async function notifyLate(employeeName, lateMinutes) {
  const recipients = await getAdminsAndManagers();
  const msg = text(`⚠️ แจ้งเตือน: ${employeeName} มาสาย ${lateMinutes} นาที`);
  await Promise.all(recipients.map(id => push(id, msg).catch(() => {})));
}

async function notifyLeaveRequest(adminLineIds, request, employeeName, userRole, stats, overlap) {
  const msg = leaveApprovalFlex(request, employeeName, userRole, stats, overlap);
  await Promise.all(adminLineIds.map(id => push(id, msg).catch(() => {})));
}

async function notifyLeaveResult(employeeLineId, approved, leaveType, startDate, endDate, conditional = false) {
  const typeMap = { sick: 'ลาป่วย', personal: 'ลากิจ', annual: 'ลาพักร้อน' };
  const typeStr = typeMap[leaveType] || leaveType;
  const emoji = approved ? '✅' : '❌';
  let status = approved ? 'อนุมัติแล้ว' : 'ถูกปฏิเสธ';
  if (conditional) status = 'อนุมัติ (มีเงื่อนไข)';

  function fmt(d) {
    if (!d) return '-';
    const date = new Date(d);
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${date.getUTCFullYear()}`;
  }

  await push(employeeLineId, text(
    `${emoji} ใบ${typeStr} ${fmt(startDate)}${startDate !== endDate ? ` ถึง ${fmt(endDate)}` : ''} ของคุณ${status}`
  ));
}

module.exports = { notifyLate, notifyLeaveRequest, notifyLeaveResult, getAdminsAndManagers };
