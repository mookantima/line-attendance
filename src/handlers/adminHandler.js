const { reply, text } = require('../services/lineMessaging');
const { getUserByLineId, getTodayAttendance } = require('../services/attendanceService');
const { query } = require('../config/database');
const { thaiNow } = require('../config/constants');
const { setSession, clearSession } = require('../sessions');

async function handleAdminToday(event) {
  const { replyToken, source } = event;
  const admin = await getUserByLineId(source.userId);
  if (!admin || (admin.role !== 'admin' && admin.role !== 'manager')) {
    await reply(replyToken, text('❌ ไม่มีสิทธิ์ใช้งาน'));
    return;
  }

  const records = await getTodayAttendance();
  if (records.length === 0) {
    await reply(replyToken, text('📋 ยังไม่มีข้อมูลการลงเวลาวันนี้'));
    return;
  }

  const lines = records.map(r => {
    const inTime = r.check_in_time
      ? new Date(r.check_in_time.getTime() + 7 * 3600000).toISOString().substr(11, 5)
      : '-';
    const outTime = r.check_out_time
      ? new Date(r.check_out_time.getTime() + 7 * 3600000).toISOString().substr(11, 5)
      : '-';
    const late = r.late_minutes > 0 ? ` ⏰สาย${r.late_minutes}น.` : '';
    return `${r.name}: ${inTime}→${outTime}${late}`;
  });

  await reply(replyToken, text(`📋 รายงานวันนี้\n\n${lines.join('\n')}`));
}

async function startAddStaff(event) {
  const { replyToken, source } = event;
  const admin = await getUserByLineId(source.userId);
  if (!admin || admin.role !== 'admin') {
    await reply(replyToken, text('❌ เฉพาะ Admin เท่านั้น'));
    return;
  }

  setSession(source.userId, 'admin_add_staff');
  await reply(replyToken, text(
    '👤 เพิ่มพนักงานใหม่\n\nพิมพ์ข้อมูลในรูปแบบ:\n[ชื่อ] [Line User ID] [role]\n\nเช่น:\nสมชาย ใจดี Uxxxxxxxxxx employee\n\n(role: employee / manager / admin)'
  ));
}

async function handleAddStaff(event, input) {
  const { replyToken, source } = event;
  clearSession(source.userId);

  const parts = input.trim().split(/\s+/);
  if (parts.length < 3) {
    await reply(replyToken, text('❌ รูปแบบไม่ถูกต้อง กรุณาลองใหม่'));
    return;
  }

  const role = parts[parts.length - 1];
  const lineUserId = parts[parts.length - 2];
  const name = parts.slice(0, parts.length - 2).join(' ');

  if (!['employee', 'manager', 'admin'].includes(role)) {
    await reply(replyToken, text('❌ role ต้องเป็น employee / manager / admin'));
    return;
  }

  try {
    await query(
      'INSERT INTO users (line_user_id, name, role) VALUES ($1, $2, $3)',
      [lineUserId, name, role]
    );
    await reply(replyToken, text(`✅ เพิ่มพนักงาน "${name}" สำเร็จ\nLine ID: ${lineUserId}\nRole: ${role}`));
  } catch (e) {
    if (e.code === '23505') {
      await reply(replyToken, text('❌ Line User ID นี้มีอยู่ในระบบแล้ว'));
    } else {
      await reply(replyToken, text('❌ เกิดข้อผิดพลาด: ' + e.message));
    }
  }
}

module.exports = { handleAdminToday, startAddStaff, handleAddStaff };
