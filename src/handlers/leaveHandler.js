const { reply, text, leaveTypeMessage } = require('../services/lineMessaging');
const { getUserByLineId } = require('../services/attendanceService');
const { requestLeave, approveLeave, rejectLeave, getPendingLeaves, getLeaveBalance } = require('../services/leaveService');
const { notifyLeaveRequest, notifyLeaveResult, getAdminsAndManagers } = require('../services/notificationService');
const { setSession, clearSession } = require('../sessions');
const { syncLeave } = require('../services/googleSheets');

async function startLeave(event) {
  const { replyToken, source } = event;
  const user = await getUserByLineId(source.userId);
  if (!user) { await reply(replyToken, text('กรุณาลงทะเบียนก่อน')); return; }

  setSession(source.userId, 'leave_waiting_type');
  await reply(replyToken, leaveTypeMessage());
}

async function handleLeaveTypeSelected(event, leaveType) {
  const { replyToken, source } = event;
  setSession(source.userId, 'leave_waiting_start', { leaveType });

  const notice = leaveType === 'personal' ? 3 : 7;
  await reply(replyToken, text(
    `📅 กรุณาพิมพ์วันที่เริ่มลา\nรูปแบบ: YYYY-MM-DD\nเช่น: 2026-05-20\n\n⚠️ ต้องแจ้งล่วงหน้า ${notice} วัน`
  ));
}

async function handleLeaveStartDate(event, sessionData, dateStr) {
  const { replyToken, source } = event;
  if (!isValidDate(dateStr)) {
    await reply(replyToken, text('รูปแบบวันที่ไม่ถูกต้อง กรุณาพิมพ์ใหม่ เช่น 2026-05-20'));
    return;
  }
  setSession(source.userId, 'leave_waiting_end', { ...sessionData, startDate: dateStr });
  await reply(replyToken, text('📅 กรุณาพิมพ์วันที่สิ้นสุดการลา\nรูปแบบ: YYYY-MM-DD'));
}

async function handleLeaveEndDate(event, sessionData, dateStr) {
  const { replyToken, source } = event;
  if (!isValidDate(dateStr) || dateStr < sessionData.startDate) {
    await reply(replyToken, text('วันที่สิ้นสุดต้องไม่ก่อนวันเริ่มลา กรุณาพิมพ์ใหม่'));
    return;
  }
  setSession(source.userId, 'leave_waiting_reason', { ...sessionData, endDate: dateStr });
  await reply(replyToken, text('📝 กรุณาระบุเหตุผลการลา (หรือพิมพ์ "-" ถ้าไม่มี)'));
}

async function handleLeaveReason(event, sessionData, reason) {
  const { replyToken, source } = event;
  const user = await getUserByLineId(source.userId);

  const result = await requestLeave(
    user.id,
    sessionData.leaveType,
    sessionData.startDate,
    sessionData.endDate,
    reason === '-' ? null : reason
  );

  clearSession(source.userId);

  if (result.error === 'insufficient_notice') {
    await reply(replyToken, text(
      `❌ ต้องแจ้งล่วงหน้า ${result.required} วัน\nคุณแจ้งล่วงหน้าเพียง ${result.given} วัน`
    ));
    return;
  }
  if (result.error === 'not_eligible_annual') {
    await reply(replyToken, text('❌ ลาพักร้อนได้เมื่ออายุงานครบ 1 ปี'));
    return;
  }
  if (result.error === 'insufficient_balance') {
    await reply(replyToken, text(`❌ วันลาไม่เพียงพอ (คงเหลือ: ${result.available} วัน)`));
    return;
  }

  let confirmMsg = `✅ ส่งใบลาสำเร็จ!\nรอการอนุมัติจากผู้จัดการ\n\n` +
    `ประเภท: ${sessionData.leaveType === 'personal' ? 'ลากิจ' : 'ลาพักร้อน'}\n` +
    `วันที่: ${sessionData.startDate} - ${sessionData.endDate}\n` +
    `จำนวน: ${result.request.days} วัน`;

  if (result.overlap?.length > 0) {
    confirmMsg += `\n\n⚠️ หมายเหตุ: ${result.overlap.map(o => o.name).join(', ')} ลาช่วงเดียวกัน`;
  }
  if (result.dayOffWarning?.length > 0) {
    confirmMsg += `\n\n📅 แจ้งเตือน: วันที่ขอลาต่อไปนี้ตรงกับวันหยุดประจำสัปดาห์ของคุณ:\n${result.dayOffWarning.join('\n')}\n(ระบบบันทึกไว้แล้ว แต่ไม่นับใช้วันลา)`;
  }

  await reply(replyToken, text(confirmMsg));

  syncLeave(result.request, user.name).catch(() => {});

  // Notify admins/managers
  const adminIds = await getAdminsAndManagers();
  await notifyLeaveRequest(adminIds, result.request, user.name).catch(() => {});
}

async function handleApproveLeave(event, requestId) {
  const { replyToken, source } = event;
  const admin = await getUserByLineId(source.userId);

  const result = await approveLeave(requestId, admin.id);
  if (result.error) { await reply(replyToken, text('❌ ไม่พบใบลา หรืออนุมัติไปแล้ว')); return; }

  await reply(replyToken, text(`✅ อนุมัติใบลาแล้ว`));

  // Find employee and notify
  const { query } = require('../config/database');
  const emp = await query('SELECT name, line_user_id FROM users WHERE id = $1', [result.request.user_id]);
  if (emp.rows[0]) {
    syncLeave(result.request, emp.rows[0].name).catch(() => {});
    await notifyLeaveResult(
      emp.rows[0].line_user_id, true,
      result.request.leave_type, result.request.start_date, result.request.end_date
    ).catch(() => {});
  }
}

async function handleRejectLeave(event, requestId) {
  const { replyToken, source } = event;
  const admin = await getUserByLineId(source.userId);

  const result = await rejectLeave(requestId, admin.id);
  if (result.error) { await reply(replyToken, text('❌ ไม่พบใบลา หรืออนุมัติไปแล้ว')); return; }

  await reply(replyToken, text(`❌ ปฏิเสธใบลาแล้ว`));

  const { query } = require('../config/database');
  const emp = await query('SELECT name, line_user_id FROM users WHERE id = $1', [result.request.user_id]);
  if (emp.rows[0]) {
    syncLeave(result.request, emp.rows[0].name).catch(() => {});
    await notifyLeaveResult(
      emp.rows[0].line_user_id, false,
      result.request.leave_type, result.request.start_date, result.request.end_date
    ).catch(() => {});
  }
}

async function showPendingLeaves(event) {
  const { replyToken } = event;
  const pending = await getPendingLeaves();
  if (pending.length === 0) {
    await reply(replyToken, text('✅ ไม่มีใบลาที่รอการอนุมัติ'));
    return;
  }

  const { leaveApprovalFlex } = require('../services/lineMessaging');
  const messages = pending.slice(0, 5).map(r => leaveApprovalFlex(r, r.employee_name));
  await reply(replyToken, messages);
}

function isValidDate(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(Date.parse(str));
}

module.exports = {
  startLeave, handleLeaveTypeSelected, handleLeaveStartDate,
  handleLeaveEndDate, handleLeaveReason, handleApproveLeave,
  handleRejectLeave, showPendingLeaves,
};
