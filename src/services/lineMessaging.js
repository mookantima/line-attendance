const line = require('@line/bot-sdk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

let client;

function getClient() {
  if (!client) {
    client = new line.messagingApi.MessagingApiClient({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    });
  }
  return client;
}

async function reply(replyToken, messages) {
  const msgs = Array.isArray(messages) ? messages : [messages];
  await getClient().replyMessage({ replyToken, messages: msgs });
}

async function push(lineUserId, messages) {
  const msgs = Array.isArray(messages) ? messages : [messages];
  await getClient().pushMessage({ to: lineUserId, messages: msgs });
}

async function downloadPhoto(messageId) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const resp = await axios.get(
    `https://api-data.line.me/v2/bot/message/${messageId}/content`,
    { headers: { Authorization: `Bearer ${token}` }, responseType: 'arraybuffer' }
  );
  const dir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `${messageId}.jpg`;
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, resp.data);
  return `/uploads/${filename}`;
}

// ─── Message builders ───────────────────────────────────────────────────────

function text(msg) {
  return { type: 'text', text: msg };
}

function mainMenuFlex() {
  return {
    type: 'flex',
    altText: 'เมนูหลัก',
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical',
        backgroundColor: '#2563EB',
        paddingAll: '16px',
        contents: [{ type: 'text', text: '📋 ระบบลงเวลางาน', color: '#FFFFFF', weight: 'bold', size: 'lg' }],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          menuButton('🟢 ลงเวลาเข้างาน', 'action_checkin', '#16A34A'),
          menuButton('🔴 ลงเวลาออกงาน', 'action_checkout', '#DC2626'),
          menuButton('📅 ขอลางาน', 'action_leave', '#D97706'),
          menuButton('📊 ดูสถิติของฉัน', 'action_mystats', '#7C3AED'),
        ],
      },
    },
  };
}

function adminMenuFlex() {
  return {
    type: 'flex',
    altText: 'เมนู Admin',
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical',
        backgroundColor: '#1E293B',
        paddingAll: '16px',
        contents: [{ type: 'text', text: '⚙️ เมนู Admin', color: '#FFFFFF', weight: 'bold', size: 'lg' }],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          menuButton('📋 รายงานวันนี้', 'admin_today', '#2563EB'),
          menuButton('✅ อนุมัติใบลา', 'admin_leaves', '#16A34A'),
          menuButton('👤 เพิ่มพนักงาน', 'admin_addstaff', '#7C3AED'),
        ],
      },
    },
  };
}

function menuButton(label, data, color) {
  return {
    type: 'button',
    style: 'primary',
    color,
    action: { type: 'postback', label, data },
  };
}

function liffButton(action) {
  const baseUrl = process.env.LIFF_ID
    ? `https://liff.line.me/${process.env.LIFF_ID}`
    : `${process.env.SERVER_URL || 'http://localhost:3000'}/liff`;
  const label = action === 'checkin' ? '🟢 เปิดหน้าลงเวลาเข้างาน' : '🔴 เปิดหน้าลงเวลาออกงาน';
  const title = action === 'checkin' ? 'ลงเวลาเข้างาน' : 'ลงเวลาออกงาน';
  const desc = 'ระบบจะตรวจสอบ GPS + รูปถ่ายกล้องหน้า';

  return {
    type: 'flex',
    altText: title,
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical', spacing: 'md',
        contents: [
          { type: 'text', text: title, weight: 'bold', size: 'lg' },
          { type: 'text', text: desc, color: '#64748b', size: 'sm', wrap: true },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [{
          type: 'button', style: 'primary',
          color: action === 'checkin' ? '#16A34A' : '#DC2626',
          action: { type: 'uri', label, uri: `${baseUrl}?action=${action}` },
        }],
      },
    },
  };
}

function leaveTypeMessage() {
  return {
    type: 'flex',
    altText: 'เลือกประเภทการลา',
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          { type: 'text', text: 'เลือกประเภทการลา', weight: 'bold', size: 'md' },
          menuButton('📝 ลากิจ (5 วัน/ปี)', 'leave_type_personal', '#D97706'),
          menuButton('🏖️ ลาพักร้อน (7 วัน/ปี)', 'leave_type_annual', '#2563EB'),
          menuButton('❌ ยกเลิก', 'action_cancel', '#6B7280'),
        ],
      },
    },
  };
}

function leaveApprovalFlex(req, userName) {
  return {
    type: 'flex',
    altText: `ใบลา: ${userName}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#D97706', paddingAll: '12px',
        contents: [{ type: 'text', text: '📋 ใบขอลางาน', color: '#FFFFFF', weight: 'bold' }],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          infoRow('พนักงาน', userName),
          infoRow('ประเภท', req.leave_type === 'personal' ? 'ลากิจ' : 'ลาพักร้อน'),
          infoRow('วันที่', `${req.start_date} ถึง ${req.end_date}`),
          infoRow('จำนวน', `${req.days} วัน`),
          infoRow('เหตุผล', req.reason || '-'),
        ],
      },
      footer: {
        type: 'box', layout: 'horizontal', spacing: 'sm',
        contents: [
          {
            type: 'button', style: 'primary', color: '#16A34A',
            action: { type: 'postback', label: '✅ อนุมัติ', data: `leave_approve_${req.id}` },
          },
          {
            type: 'button', style: 'primary', color: '#DC2626',
            action: { type: 'postback', label: '❌ ปฏิเสธ', data: `leave_reject_${req.id}` },
          },
        ],
      },
    },
  };
}

function infoRow(label, value) {
  return {
    type: 'box', layout: 'horizontal',
    contents: [
      { type: 'text', text: label, color: '#6B7280', size: 'sm', flex: 2 },
      { type: 'text', text: String(value), size: 'sm', flex: 3, wrap: true },
    ],
  };
}

module.exports = {
  reply, push, downloadPhoto, text,
  mainMenuFlex, adminMenuFlex, liffButton,
  leaveTypeMessage, leaveApprovalFlex,
};
