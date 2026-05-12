const { reply, text, mainMenuFlex, adminMenuFlex } = require('../services/lineMessaging');
const { getUserByLineId, createUser } = require('../services/attendanceService');
const { getLeaveBalance } = require('../services/leaveService');
const { getMyStats } = require('../services/attendanceService');
const { clearSession, setSession } = require('../sessions');
const { thaiNow } = require('../config/constants');

async function handleFollow(event) {
  const { replyToken, source } = event;
  await reply(replyToken, text('👋 ยินดีต้อนรับสู่ระบบลงเวลางาน!\n\nกรุณาพิมพ์ชื่อ-นามสกุลของคุณเพื่อลงทะเบียน'));
  setSession(source.userId, 'register_waiting_name');
}

async function handleRegister(event, name) {
  const { replyToken, source } = event;
  const existing = await getUserByLineId(source.userId);
  if (existing) {
    clearSession(source.userId);
    await reply(replyToken, [text(`✅ คุณลงทะเบียนแล้วในชื่อ "${existing.name}"`), mainMenuFlex()]);
    return;
  }
  const user = await createUser(source.userId, name.trim());
  clearSession(source.userId);
  await reply(replyToken, [
    text(`✅ ลงทะเบียนสำเร็จ!\nชื่อ: ${user.name}\nรหัส: ${user.id}`),
    mainMenuFlex(),
  ]);
}

async function handleMenu(event) {
  const { replyToken, source } = event;
  const user = await getUserByLineId(source.userId);
  clearSession(source.userId);

  if (!user) {
    await reply(replyToken, text('กรุณาลงทะเบียนก่อนใช้งาน พิมพ์ชื่อ-นามสกุลของคุณ'));
    setSession(source.userId, 'register_waiting_name');
    return;
  }

  const messages = [mainMenuFlex()];
  if (user.role === 'admin' || user.role === 'manager') {
    messages.push(adminMenuFlex());
  }
  await reply(replyToken, messages);
}

async function handleMyStats(event) {
  const { replyToken, source } = event;
  const user = await getUserByLineId(source.userId);
  if (!user) { await reply(replyToken, text('กรุณาลงทะเบียนก่อน')); return; }

  const now = thaiNow();
  const stats = await getMyStats(user.id);
  const balance = await getLeaveBalance(user.id, now.getUTCFullYear());

  const msg = `📊 สถิติของคุณ (${now.getUTCMonth() + 1}/${now.getUTCFullYear()})

✅ มาทำงาน: ${stats.present_days} วัน
❌ ขาดงาน: ${stats.absent_days} วัน
⏰ สาย: ${stats.total_late_min} นาที (-${stats.total_late_min} บาท)
⌛ OT: ${stats.total_ot_min} นาที (+${stats.total_ot_min} บาท)

📅 วันลาคงเหลือ
  - ลากิจ: ${balance.personal_total - balance.personal_used}/${balance.personal_total} วัน
  - ลาพักร้อน: ${balance.annual_total - balance.annual_used}/${balance.annual_total} วัน`;

  await reply(replyToken, text(msg));
}

module.exports = { handleFollow, handleRegister, handleMenu, handleMyStats };
