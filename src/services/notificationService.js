const { push, text } = require('./lineMessaging');
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

async function notifyLeaveRequest(adminLineIds, request, employeeName) {
  const { leaveApprovalFlex } = require('./lineMessaging');
  const msg = leaveApprovalFlex(request, employeeName);
  await Promise.all(adminLineIds.map(id => push(id, msg).catch(() => {})));
}

async function notifyLeaveResult(employeeLineId, approved, leaveType, startDate, endDate) {
  const typeStr = leaveType === 'personal' ? 'ลากิจ' : 'ลาพักร้อน';
  const emoji = approved ? '✅' : '❌';
  const status = approved ? 'อนุมัติแล้ว' : 'ถูกปฏิเสธ';
  await push(employeeLineId, text(`${emoji} ใบ${typeStr} ${startDate} - ${endDate} ของคุณ${status}`));
}

module.exports = { notifyLate, notifyLeaveRequest, notifyLeaveResult, getAdminsAndManagers };
