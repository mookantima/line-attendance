const { reply, text, mainMenuFlex, adminMenuFlex, downloadPhoto } = require('../services/lineMessaging');
const { getUserByLineId, createUser, findUnlinkedByName, linkLineId, completeRegistration } = require('../services/attendanceService');
const { getLeaveBalance } = require('../services/leaveService');
const { getMyStats } = require('../services/attendanceService');
const { clearSession, setSession } = require('../sessions');
const { thaiNow } = require('../config/constants');

// Parse DD-MM-YYYY → YYYY-MM-DD
function parseDMY(str) {
  const m = str.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  if (isNaN(Date.parse(iso))) return null;
  return iso;
}

async function handleFollow(event) {
  const { replyToken, source } = event;
  const existing = await getUserByLineId(source.userId);
  if (existing) {
    clearSession(source.userId);
    await reply(replyToken, [text(`✅ คุณลงทะเบียนแล้วในชื่อ "${existing.name}"`), mainMenuFlex()]);
    return;
  }
  setSession(source.userId, 'register_waiting_name');
  await reply(replyToken, text(
    '👋 ยินดีต้อนรับสู่ระบบลงเวลางาน Olivia Nails Spa!\n\nกรุณาพิมพ์ชื่อ-นามสกุลของคุณเพื่อเริ่มลงทะเบียน\nเช่น: สมหญิง ใจดี'
  ));
}

async function handleRegister(event, name) {
  const { replyToken, source } = event;
  const existing = await getUserByLineId(source.userId);
  if (existing) {
    clearSession(source.userId);
    await reply(replyToken, [text(`✅ คุณลงทะเบียนแล้วในชื่อ "${existing.name}"`), mainMenuFlex()]);
    return;
  }

  // Check if admin pre-added this employee by name
  const preAdded = await findUnlinkedByName(name.trim());
  let user;
  if (preAdded) {
    user = await linkLineId(preAdded.id, source.userId);
  } else {
    user = await createUser(source.userId, name.trim());
  }

  setSession(source.userId, 'register_waiting_start_date', { userId: user.id });
  await reply(replyToken, text(
    `✅ รับชื่อแล้ว: ${[user.name, user.surname].filter(Boolean).join(' ')}\n\n` +
    `📅 กรุณาพิมพ์วันที่เริ่มงาน\nรูปแบบ: DD-MM-YYYY\nเช่น: 01-06-2026`
  ));
}

async function handleRegisterStartDate(event, sessionData, input) {
  const { replyToken, source } = event;
  const startDate = parseDMY(input);
  if (!startDate) {
    await reply(replyToken, text('รูปแบบวันที่ไม่ถูกต้อง กรุณาพิมพ์ใหม่ เช่น 01-06-2026'));
    return;
  }
  setSession(source.userId, 'register_waiting_id_card', { ...sessionData, startDate });
  await reply(replyToken, text(
    `✅ วันที่เริ่มงาน: ${input.trim()}\n\n` +
    `🪪 กรุณาถ่ายรูปและส่งสำเนาบัตรประชาชนของคุณ`
  ));
}

async function handleRegisterIdCard(event, sessionData, messageId) {
  const { replyToken, source } = event;
  let idCardUrl = null;
  if (messageId) {
    try {
      idCardUrl = await downloadPhoto(messageId);
    } catch {
      await reply(replyToken, text('❌ อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่'));
      return;
    }
  }
  setSession(source.userId, 'register_waiting_bank_book', { ...sessionData, idCardUrl });
  await reply(replyToken, text(
    `✅ รับรูปบัตรประชาชนแล้ว\n\n` +
    `🏦 กรุณาถ่ายรูปและส่งหน้าบัญชีธนาคาร\n(หรือพิมพ์ "-" ถ้ายังไม่มี)`
  ));
}

async function handleRegisterBankBook(event, sessionData, messageId, textInput) {
  const { replyToken, source } = event;

  let bankBookUrl = null;
  if (messageId) {
    try {
      bankBookUrl = await downloadPhoto(messageId);
    } catch {
      await reply(replyToken, text('❌ อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่'));
      return;
    }
  }

  await completeRegistration(sessionData.userId, {
    startDate: sessionData.startDate,
    idCardUrl: sessionData.idCardUrl,
    bankBookUrl,
  });

  clearSession(source.userId);

  const user = await getUserByLineId(source.userId);
  const fullName = [user?.name, user?.surname].filter(Boolean).join(' ');

  const dd = sessionData.startDate ? sessionData.startDate.slice(8, 10) : null;
  const mm = sessionData.startDate ? sessionData.startDate.slice(5, 7) : null;
  const yyyy = sessionData.startDate ? sessionData.startDate.slice(0, 4) : null;
  const startFmt = dd ? `${dd}-${mm}-${yyyy}` : '-';

  await reply(replyToken, [
    text(
      `🎉 ลงทะเบียนสำเร็จ!\n\n` +
      `ชื่อ: ${fullName}\n` +
      `วันที่เริ่มงาน: ${startFmt}\n` +
      `📋 บัตรประชาชน: ${sessionData.idCardUrl ? '✅' : '⏳ ยังไม่ได้ส่ง'}\n` +
      `🏦 หน้าบัญชี: ${bankBookUrl ? '✅' : '⏳ ยังไม่ได้ส่ง'}`
    ),
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

module.exports = {
  handleFollow, handleRegister, handleRegisterStartDate,
  handleRegisterIdCard, handleRegisterBankBook,
  handleMenu, handleMyStats,
};
