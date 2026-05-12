const express = require('express');
const line = require('@line/bot-sdk');
const { getSession, clearSession } = require('../sessions');
const { getUserByLineId } = require('../services/attendanceService');
const { reply, text, mainMenuFlex } = require('../services/lineMessaging');

const { handleFollow, handleRegister, handleMenu, handleMyStats } = require('../handlers/menuHandler');
const { startCheckIn } = require('../handlers/checkInHandler');
const { startCheckOut } = require('../handlers/checkOutHandler');
const {
  startLeave, handleLeaveTypeSelected, handleLeaveStartDate,
  handleLeaveEndDate, handleLeaveReason, handleApproveLeave,
  handleRejectLeave, showPendingLeaves,
} = require('../handlers/leaveHandler');
const { handleAdminToday, startAddStaff, handleAddStaff } = require('../handlers/adminHandler');

const router = express.Router();

const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// Verify Line signature
router.post('/', line.middleware(lineConfig), async (req, res) => {
  res.sendStatus(200);
  const events = req.body.events || [];
  await Promise.all(events.map(event => handleEvent(event).catch(console.error)));
});

async function handleEvent(event) {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;

  const session = getSession(lineUserId);

  if (event.type === 'follow') {
    return handleFollow(event);
  }

  if (event.type === 'postback') {
    return handlePostback(event, session);
  }

  if (event.type === 'message') {
    return handleMessage(event, session);
  }
}

async function handlePostback(event, session) {
  const { data } = event.postback;

  if (data === 'action_checkin') return startCheckIn(event);
  if (data === 'action_checkout') return startCheckOut(event);
  if (data === 'action_leave') return startLeave(event);
  if (data === 'action_mystats') return handleMyStats(event);
  if (data === 'action_cancel') {
    clearSession(event.source.userId);
    return reply(event.replyToken, [text('ยกเลิกแล้ว'), mainMenuFlex()]);
  }

  // Admin actions
  if (data === 'admin_today') return handleAdminToday(event);
  if (data === 'admin_leaves') return showPendingLeaves(event);
  if (data === 'admin_addstaff') return startAddStaff(event);

  // Leave type selection
  if (data === 'leave_type_personal') return handleLeaveTypeSelected(event, 'personal');
  if (data === 'leave_type_annual') return handleLeaveTypeSelected(event, 'annual');

  // Leave approval
  if (data.startsWith('leave_approve_')) {
    const id = parseInt(data.replace('leave_approve_', ''));
    return handleApproveLeave(event, id);
  }
  if (data.startsWith('leave_reject_')) {
    const id = parseInt(data.replace('leave_reject_', ''));
    return handleRejectLeave(event, id);
  }
}

async function handleMessage(event, session) {
  const { type: msgType, text: msgText } = event.message || {};

  // Location / Image — no longer used for check-in/out (handled by LIFF)
  if (msgType === 'location' || msgType === 'image') {
    return reply(event.replyToken, text('กรุณากดปุ่มลงเวลาผ่านเมนูครับ'));
  }

  // Text message
  if (msgType === 'text') {
    const trimmed = msgText.trim();

    // Registration flow
    if (session.state === 'register_waiting_name') return handleRegister(event, trimmed);

    // Leave flow (text input steps)
    if (session.state === 'leave_waiting_start') return handleLeaveStartDate(event, session.data, trimmed);
    if (session.state === 'leave_waiting_end') return handleLeaveEndDate(event, session.data, trimmed);
    if (session.state === 'leave_waiting_reason') return handleLeaveReason(event, session.data, trimmed);

    // Admin add staff
    if (session.state === 'admin_add_staff') return handleAddStaff(event, trimmed);

    // Keywords
    if (['เมนู', 'menu', 'หน้าหลัก', 'help', 'ช่วยเหลือ'].includes(trimmed.toLowerCase())) {
      return handleMenu(event);
    }

    // Default: show menu
    return handleMenu(event);
  }
}

module.exports = router;
