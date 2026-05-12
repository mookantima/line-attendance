const { reply, text } = require('../services/lineMessaging');
const { getUserByLineId } = require('../services/attendanceService');
const { createToken } = require('../tokens');

function attendUrl(token, action) {
  const base = process.env.SERVER_URL || 'https://vacation-debtor-coping.ngrok-free.dev';
  return `${base}/attend?token=${token}&action=${action}`;
}

function checkOutFlex(url) {
  return {
    type: 'flex',
    altText: 'กดเพื่อลงเวลาออกงาน',
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          { type: 'text', text: '🔴 ลงเวลาออกงาน', weight: 'bold', size: 'lg' },
          { type: 'text', text: 'ระบบจะตรวจสอบ GPS จากมือถือ\n+ ถ่ายรูปกล้องหน้า', color: '#64748b', size: 'sm', wrap: true },
          { type: 'text', text: '⏱️ ลิงก์หมดอายุใน 10 นาที', color: '#f59e0b', size: 'xs' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [{
          type: 'button', style: 'primary', color: '#DC2626',
          action: { type: 'uri', label: '📍 กดที่นี่เพื่อลงเวลา', uri: url },
        }],
      },
    },
  };
}

async function startCheckOut(event) {
  const { replyToken, source } = event;
  const user = await getUserByLineId(source.userId);
  if (!user) { await reply(replyToken, text('กรุณาลงทะเบียนก่อนใช้งาน')); return; }

  const token = createToken(source.userId, 'checkout');
  const url = attendUrl(token, 'checkout');

  await reply(replyToken, [
    text(`${user.name} 🔴 ลงเวลาออกงาน`),
    checkOutFlex(url),
  ]);
}

module.exports = { startCheckOut };
