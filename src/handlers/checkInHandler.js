const { reply, text } = require('../services/lineMessaging');
const { getUserByLineId } = require('../services/attendanceService');
const { createToken } = require('../tokens');

function attendUrl(token, action) {
  const base = process.env.SERVER_URL || 'https://vacation-debtor-coping.ngrok-free.dev';
  return `${base}/attend?token=${token}&action=${action}`;
}

function checkInFlex(url) {
  return {
    type: 'flex',
    altText: 'กดเพื่อลงเวลาเข้างาน',
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          { type: 'text', text: '🟢 ลงเวลาเข้างาน', weight: 'bold', size: 'lg' },
          { type: 'text', text: 'ระบบจะตรวจสอบ GPS จากมือถือ\n+ ถ่ายรูปกล้องหน้า', color: '#64748b', size: 'sm', wrap: true },
          { type: 'text', text: '⏱️ ลิงก์หมดอายุใน 10 นาที', color: '#f59e0b', size: 'xs' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [{
          type: 'button', style: 'primary', color: '#16A34A',
          action: { type: 'uri', label: '📍 กดที่นี่เพื่อลงเวลา', uri: url },
        }],
      },
    },
  };
}

async function startCheckIn(event) {
  const { replyToken, source } = event;
  const user = await getUserByLineId(source.userId);
  if (!user) { await reply(replyToken, text('กรุณาลงทะเบียนก่อนใช้งาน')); return; }

  const token = createToken(source.userId, 'checkin');
  const url = attendUrl(token, 'checkin');

  await reply(replyToken, [
    text(`สวัสดี ${user.name}! 🟢`),
    checkInFlex(url),
  ]);
}

module.exports = { startCheckIn };
