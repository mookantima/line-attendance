const { reply, text, leaveTypeMessage, halfDayMessage, leaveApprovalFlex, downloadPhoto } = require('../services/lineMessaging');
const { getUserByLineId } = require('../services/attendanceService');
const { requestLeave, approveLeave, rejectLeave, getPendingLeaves, getLeaveBalance } = require('../services/leaveService');
const { notifyLeaveRequest, notifyLeaveResult, getAdminsAndManagers } = require('../services/notificationService');
const { setSession, clearSession } = require('../sessions');
const { syncLeave } = require('../services/googleSheets');

const LEAVE_TYPE_LABELS = { sick: 'ลาป่วย', personal: 'ลากิจ', annual: 'ลาพักร้อน' };

async function startLeave(event) {
  const { replyToken, source } = event;
  const user = await getUserByLineId(source.userId);
  if (!user) { await reply(replyToken, text('กรุณาลงทะเบียนก่อน')); return; }

  setSession(source.userId, 'leave_waiting_type');
  await reply(replyToken, leaveTypeMessage());
}

async function handleLeaveTypeSelected(event, leaveType) {
  const { replyToken, source } = event;
  const noticeMap = { sick: null, personal: 3, annual: 7 };
  const notice = noticeMap[leaveType];
  const noticeText = notice ? `\n\n⚠️ ต้องแจ้งล่วงหน้า ${notice} วัน` : '';

  setSession(source.userId, 'leave_waiting_start', { leaveType });
  await reply(replyToken, text(
    `📅 ประเภท: ${LEAVE_TYPE_LABELS[leaveType]}\n\nกรุณาพิมพ์วันที่เริ่มลา\nรูปแบบ: DD-MM-YYYY\nเช่น: 15-06-2026${noticeText}`
  ));
}

// Parse DD-MM-YYYY → YYYY-MM-DD
function parseDMY(str) {
  const m = str.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  if (isNaN(Date.parse(iso))) return null;
  return iso;
}

// Format date (ISO string or Date object) → DD-MM-YYYY
function fmtDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// Add N calendar days to YYYY-MM-DD
function addDays(isoDate, n) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + Math.ceil(n) - 1);
  return d.toISOString().slice(0, 10);
}

async function handleLeaveStartDate(event, sessionData, input) {
  const { replyToken, source } = event;
  const startDate = parseDMY(input);
  if (!startDate) {
    await reply(replyToken, text('รูปแบบวันที่ไม่ถูกต้อง\nกรุณาพิมพ์ใหม่ เช่น 15-06-2026'));
    return;
  }
  // Reject past dates (compare in Thai time)
  const todayThai = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  if (startDate < todayThai) {
    await reply(replyToken, text(`❌ วันที่ที่แจ้งมาไม่ถูกต้อง\n(${fmtDate(startDate)} เป็นวันที่ผ่านมาแล้ว)\n\nกรุณาพิมพ์วันที่ใหม่ เช่น ${fmtDate(todayThai)}`));
    return;
  }
  setSession(source.userId, 'leave_waiting_days', { ...sessionData, startDate });
  await reply(replyToken, text(
    `✅ วันที่เริ่มลา: ${fmtDate(startDate)}\n\nกรุณาพิมพ์จำนวนวันที่ลา\nเช่น: 1, 2, 3`
  ));
}

async function handleLeaveDays(event, sessionData, input) {
  const { replyToken, source } = event;
  const days = parseInt(input.trim());
  if (isNaN(days) || days <= 0 || days > 60) {
    await reply(replyToken, text('จำนวนวันไม่ถูกต้อง กรุณาพิมพ์ตัวเลขจำนวนเต็ม เช่น 1, 2, 3'));
    return;
  }
  const endDate = addDays(sessionData.startDate, days);
  setSession(source.userId, 'leave_waiting_reason', { ...sessionData, days, endDate, halfDayPeriod: null });
  await reply(replyToken, text(
    `✅ จำนวนวัน: ${days} วัน (ถึง ${fmtDate(endDate)})\n\nกรุณาระบุเหตุผลการลา\n(หรือพิมพ์ - ถ้าไม่มี)`
  ));
}

async function handleLeaveReason(event, sessionData, reason) {
  const { replyToken, source } = event;
  const finalReason = reason === '-' ? null : reason;

  // Sick leave → ask for medical document before submitting
  if (sessionData.leaveType === 'sick') {
    setSession(source.userId, 'leave_waiting_doc', { ...sessionData, reason: finalReason });
    await reply(replyToken, text(
      '📎 กรุณาส่งรูปใบรับรองแพทย์ หรือใบเสร็จ\n\n(ถ่ายรูปและส่งได้เลย หรือพิมพ์ "-" ถ้าไม่มี)'
    ));
    return;
  }

  await submitLeave(event, { ...sessionData, reason: finalReason, docUrl: null });
}

async function handleLeaveDoc(event, sessionData, messageId) {
  // messageId = LINE image message ID, or null = user typed '-'
  let docUrl = null;
  if (messageId) {
    try {
      docUrl = await downloadPhoto(messageId);
    } catch {
      await reply(event.replyToken, text('❌ ดาวน์โหลดรูปไม่สำเร็จ กรุณาลองใหม่'));
      return;
    }
  }
  await submitLeave(event, { ...sessionData, docUrl });
}

async function submitLeave(event, sessionData) {
  const { replyToken, source } = event;
  const user = await getUserByLineId(source.userId);

  const result = await requestLeave(
    user.id,
    sessionData.leaveType,
    sessionData.startDate,
    sessionData.endDate,
    sessionData.days,
    sessionData.reason,
    sessionData.halfDayPeriod,
    sessionData.docUrl
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

  const dLabel = sessionData.halfDayPeriod === 'morning' ? 'ครึ่งวันเช้า'
    : sessionData.halfDayPeriod === 'afternoon' ? 'ครึ่งวันบ่าย'
    : `${sessionData.days} วัน`;

  let confirmMsg = `✅ ส่งใบลาสำเร็จ รอการอนุมัติ\n\n` +
    `ประเภท: ${LEAVE_TYPE_LABELS[sessionData.leaveType]}\n` +
    `วันที่: ${fmtDate(sessionData.startDate)}` +
    (sessionData.startDate !== sessionData.endDate ? ` ถึง ${fmtDate(sessionData.endDate)}` : '') +
    `\nจำนวน: ${dLabel}`;

  if (result.overlap?.length > 0) {
    confirmMsg += `\n\n⚠️ ${result.overlap.map(o => o.name).join(', ')} ลาช่วงเดียวกัน`;
  }
  if (result.dayOffWarning?.length > 0) {
    confirmMsg += `\n\n📅 วันที่ขอลาตรงกับวันหยุดของคุณ:\n${result.dayOffWarning.join('\n')}\n(ไม่นับใช้วันลา)`;
  }

  await reply(replyToken, text(confirmMsg));

  syncLeave(result.request, user.name).catch(() => {});

  // Notify admins — pass stats + overlap for rich Flex
  const adminIds = await getAdminsAndManagers();
  await notifyLeaveRequest(adminIds, result.request, user.name, user.role, result.stats, result.overlap).catch(() => {});
}

async function handleApproveLeave(event, requestId, conditional = false) {
  const { replyToken, source } = event;
  const admin = await getUserByLineId(source.userId);

  const result = await approveLeave(requestId, admin.id);
  if (result.error) { await reply(replyToken, text('❌ ไม่พบใบลา หรืออนุมัติไปแล้ว')); return; }

  const label = conditional ? 'อนุมัติ (มีเงื่อนไข)' : 'อนุมัติ';
  await reply(replyToken, text(`✅ ${label}ใบลาแล้ว`));

  const { query } = require('../config/database');
  const emp = await query('SELECT name, line_user_id FROM users WHERE id = $1', [result.request.user_id]);
  if (emp.rows[0]) {
    syncLeave(result.request, emp.rows[0].name).catch(() => {});
    await notifyLeaveResult(
      emp.rows[0].line_user_id, true,
      result.request.leave_type, result.request.start_date, result.request.end_date,
      conditional
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

async function handleAskMoreInfo(event, requestId) {
  const { replyToken, source } = event;
  const { query } = require('../config/database');
  const { push } = require('../services/lineMessaging');

  const req = await query(
    'SELECT lr.*, u.name, u.line_user_id FROM leave_requests lr JOIN users u ON u.id = lr.user_id WHERE lr.id = $1',
    [requestId]
  );
  if (!req.rows[0]) { await reply(replyToken, text('❌ ไม่พบใบลา')); return; }

  const emp = req.rows[0];
  await reply(replyToken, text(`📩 ส่งคำขอข้อมูลเพิ่มถึง ${emp.name} แล้ว`));

  if (emp.line_user_id) {
    // Set session on employee side (TTL 24h) to capture their reply
    const adminIds = await getAdminsAndManagers();
    setSession(emp.line_user_id, 'leave_reply_waiting', {
      requestId,
      leaveId: `L${requestId}`,
      startDate: emp.start_date,
      adminIds,
    }, 24 * 60 * 60 * 1000);

    await push(emp.line_user_id, text(
      `📩 ผู้จัดการขอข้อมูลเพิ่มเติมเกี่ยวกับใบลาของคุณ\n(${fmtDate(emp.start_date)})\n\nกรุณาตอบกลับข้อความนี้หรือส่งรูปเอกสารเพิ่มเติม`
    )).catch(() => {});
  }
}

async function handleLeaveReply(event, sessionData, msgText, imageMessageId) {
  const { replyToken, source } = require('../services/lineMessaging') ? event : event;
  const { push } = require('../services/lineMessaging');
  const { query } = require('../config/database');

  // Get employee name
  const userRes = await query('SELECT name FROM users WHERE line_user_id = $1', [event.source.userId]);
  const empName = userRes.rows[0]?.name || 'พนักงาน';

  let docUrl = null;
  if (imageMessageId) {
    try { docUrl = await downloadPhoto(imageMessageId); } catch {}
  }

  const label = `📩 ส่งหลักฐานเพิ่ม (${sessionData.leaveId}) จาก ${empName}`;

  for (const adminId of (sessionData.adminIds || [])) {
    if (docUrl) {
      // Send text header + image URL
      await push(adminId, text(`${label}\n\n${msgText || '(ส่งรูป)'}\n\nรูป: ${process.env.SERVER_URL || ''}${docUrl}`)).catch(() => {});
    } else {
      await push(adminId, text(`${label}\n\n${msgText}`)).catch(() => {});
    }
  }

  clearSession(event.source.userId);
  await reply(event.replyToken, text('✅ ส่งข้อมูลเพิ่มเติมให้ผู้จัดการแล้ว'));
}

async function showPendingLeaves(event) {
  const { replyToken } = event;
  const pending = await getPendingLeaves();
  if (pending.length === 0) {
    await reply(replyToken, text('✅ ไม่มีใบลาที่รอการอนุมัติ'));
    return;
  }
  const messages = pending.slice(0, 5).map(r => leaveApprovalFlex(r, r.employee_name, r.role || 'พนักงาน'));
  await reply(replyToken, messages);
}

module.exports = {
  startLeave, handleLeaveTypeSelected,
  handleLeaveStartDate, handleLeaveDays,
  handleLeaveReason, handleLeaveDoc, handleLeaveReply,
  handleApproveLeave, handleRejectLeave,
  handleAskMoreInfo, showPendingLeaves,
};
