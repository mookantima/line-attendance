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
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#4E5E3A', paddingAll: '14px',
        contents: [{ type: 'text', text: '📅 เลือกประเภทการลา', color: '#FFFFFF', weight: 'bold', size: 'md' }],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          menuButton('🤒 ลาป่วย (30 วัน/ปี)', 'leave_type_sick', '#DC2626'),
          menuButton('📝 ลากิจ (5 วัน/ปี)', 'leave_type_personal', '#D97706'),
          menuButton('🏖️ ลาพักร้อน (7 วัน/ปี)', 'leave_type_annual', '#2563EB'),
          menuButton('❌ ยกเลิก', 'action_cancel', '#6B7280'),
        ],
      },
    },
  };
}

function halfDayMessage() {
  return {
    type: 'flex',
    altText: 'เลือกช่วงเวลา',
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          { type: 'text', text: '🕐 ลาครึ่งวัน — เลือกช่วงเวลา', weight: 'bold', size: 'sm' },
          menuButton('🌅 เช้า (ก่อนเที่ยง)', 'leave_halfday_morning', '#D97706'),
          menuButton('🌆 บ่าย (หลังเที่ยง)', 'leave_halfday_afternoon', '#7C3AED'),
        ],
      },
    },
  };
}

function leaveTypeLabel(t) {
  return t === 'sick' ? 'ลาป่วย' : t === 'personal' ? 'ลากิจ' : 'ลาพักร้อน';
}

function durationLabel(days, halfDayPeriod) {
  if (halfDayPeriod === 'morning') return 'ครึ่งวัน (เช้า)';
  if (halfDayPeriod === 'afternoon') return 'ครึ่งวัน (บ่าย)';
  return `${days} วัน`;
}

function leaveApprovalFlex(req, userName, userRole, stats, overlap) {
  const year = new Date(req.start_date).getFullYear();
  const s = stats || { sick: { times: 0, days: 0 }, personal: { times: 0, days: 0 }, annual: { times: 0, days: 0 } };
  const leaveId = `L${req.id}`;

  // Format date as DD-MM-YYYY — handles both ISO strings and Date objects
  function fmt(d) {
    if (!d) return '-';
    const date = new Date(d);
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = date.getUTCFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  const startIso = new Date(req.start_date).toISOString().slice(0, 10);
  const endIso   = new Date(req.end_date).toISOString().slice(0, 10);
  const dateStr  = startIso === endIso
    ? fmt(req.start_date)
    : `${fmt(req.start_date)} ถึง ${fmt(req.end_date)}`;

  const bodyContents = [
    // Employee name + role
    {
      type: 'box', layout: 'vertical', spacing: 'xs',
      contents: [
        { type: 'text', text: userName, weight: 'bold', size: 'md', color: '#1F2937' },
        { type: 'text', text: userRole || 'พนักงาน', size: 'xs', color: '#9CA3AF' },
      ],
    },
    { type: 'separator', margin: 'md' },
    // Leave details
    infoRow('วันที่', dateStr),
    infoRow('ประเภท', leaveTypeLabel(req.leave_type)),
    infoRow('ระยะเวลา', durationLabel(parseFloat(req.days), req.half_day_period)),
    infoRow('เหตุผล', req.reason || '-'),
  ];

  // Medical document link for sick leave
  if (req.leave_type === 'sick') {
    const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
    const docText = req.doc_url ? `${serverUrl}${req.doc_url}` : null;
    bodyContents.push({
      type: 'box', layout: 'horizontal', margin: 'sm',
      contents: [
        { type: 'text', text: 'เอกสาร', color: '#6B7280', size: 'sm', flex: 2 },
        docText
          ? {
              type: 'button', flex: 3, height: 'sm',
              style: 'primary', color: '#2563EB',
              action: { type: 'uri', label: '📎 ดูใบรับรองแพทย์', uri: docText },
            }
          : { type: 'text', text: 'ไม่มีเอกสาร', color: '#9CA3AF', size: 'sm', flex: 3 },
      ],
    });
  }

  // Overlap warning
  if (overlap && overlap.length > 0) {
    const names = overlap.map(o => o.name).join(', ');
    bodyContents.push({ type: 'separator', margin: 'md' });
    bodyContents.push({
      type: 'box', layout: 'vertical', margin: 'sm',
      backgroundColor: '#FEF3C7', cornerRadius: '8px', paddingAll: '10px',
      contents: [
        { type: 'text', text: '⚠️ ความเสี่ยงทับวันหยุด', size: 'xs', color: '#B45309', weight: 'bold' },
        { type: 'text', text: `${names} ลาช่วงเดียวกัน`, size: 'xs', color: '#92400E', wrap: true, margin: 'xs' },
      ],
    });
  }

  // Stats section
  bodyContents.push({ type: 'separator', margin: 'md' });
  bodyContents.push({
    type: 'text', text: `สถิติลาปีนี้ (${year})`,
    size: 'xs', color: '#6B7280', weight: 'bold', margin: 'md',
  });
  bodyContents.push(statRow('ลาป่วย', s.sick.times, s.sick.days));
  bodyContents.push(statRow('ลากิจ', s.personal.times, s.personal.days));
  bodyContents.push(statRow('พักร้อน', s.annual.times, s.annual.days));

  return {
    type: 'flex',
    altText: `📝 ใบลาใหม่รออนุมัติ — ${userName}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        backgroundColor: '#FFFFFF',
        borderColor: '#E5E7EB',
        contents: [
          { type: 'text', text: '📝 ใบลาใหม่รออนุมัติ', weight: 'bold', size: 'lg', color: '#1F2937' },
          { type: 'text', text: leaveId, size: 'xs', color: '#9CA3AF', margin: 'xs' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px',
        contents: bodyContents,
      },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px',
        contents: [
          // Row 1: อนุมัติ + อนุมัติแบบมีเงื่อนไข
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              {
                type: 'button', flex: 1,
                style: 'primary', color: '#166534', height: 'sm',
                action: { type: 'postback', label: '✅ อนุมัติ', data: `leave_approve_${req.id}` },
              },
              {
                type: 'button', flex: 1,
                style: 'primary', color: '#92400E', height: 'sm',
                action: { type: 'postback', label: '✅ ⏳ อนุมัติมีเงื่อนไข', data: `leave_approve_cond_${req.id}` },
              },
            ],
          },
          // Row 2: ปฏิเสธ + ขอข้อมูลเพิ่ม
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              {
                type: 'button', flex: 1,
                style: 'secondary', height: 'sm',
                action: { type: 'postback', label: '❌ ปฏิเสธ', data: `leave_reject_${req.id}` },
              },
              {
                type: 'button', flex: 1,
                style: 'secondary', height: 'sm',
                action: { type: 'postback', label: 'ℹ️ ขอข้อมูลเพิ่ม', data: `leave_askmore_${req.id}` },
              },
            ],
          },
        ],
      },
    },
  };
}

function statRow(label, times, days) {
  return {
    type: 'box', layout: 'horizontal', margin: 'xs',
    contents: [
      { type: 'text', text: label, size: 'xs', color: '#6B7280', flex: 3 },
      { type: 'text', text: `${times} ครั้ง / ${days} วัน`, size: 'xs', color: '#374151', flex: 4, align: 'end' },
    ],
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
  leaveTypeMessage, halfDayMessage, leaveApprovalFlex,
};
