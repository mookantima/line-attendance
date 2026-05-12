const express = require('express');
const line = require('@line/bot-sdk');
const { getSession, clearSession } = require('../sessions');
const { getUserByLineId } = require('../services/attendanceService');
const { reply, text, mainMenuFlex } = require('../services/lineMessaging');

const { handleFollow, handleRegister, handleRegisterStartDate, handleRegisterIdCard, handleRegisterBankBook, handleMenu, handleMyStats } = require('../handlers/menuHandler');
const { startCheckIn } = require('../handlers/checkInHandler');
const { startCheckOut } = require('../handlers/checkOutHandler');
const {
  startLeave, handleLeaveTypeSelected,
  handleLeaveStartDate, handleLeaveDays,
  handleLeaveReason, handleLeaveDoc, handleLeaveReply,
  handleApproveLeave, handleRejectLeave,
  handleAskMoreInfo, showPendingLeaves,
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
  if (data === 'leave_type_sick')     return handleLeaveTypeSelected(event, 'sick');
  if (data === 'leave_type_personal') return handleLeaveTypeSelected(event, 'personal');
  if (data === 'leave_type_annual')   return handleLeaveTypeSelected(event, 'annual');

  // Leave approval actions
  if (data.startsWith('leave_approve_cond_')) {
    const id = parseInt(data.replace('leave_approve_cond_', ''));
    return handleApproveLeave(event, id, true);
  }
  if (data.startsWith('leave_approve_')) {
    const id = parseInt(data.replace('leave_approve_', ''));
    return handleApproveLeave(event, id, false);
  }
  if (data.startsWith('leave_reject_')) {
    const id = parseInt(data.replace('leave_reject_', ''));
    return handleRejectLeave(event, id);
  }
  if (data.startsWith('leave_askmore_')) {
    const id = parseInt(data.replace('leave_askmore_', ''));
    return handleAskMoreInfo(event, id);
  }
}

async function handleMessage(event, session) {
  const { type: msgType, text: msgText } = event.message || {};

  // Image — handle doc upload or leave reply
  if (msgType === 'image') {
    if (session.state === 'register_waiting_id_card') {
      return handleRegisterIdCard(event, session.data, event.message.id);
    }
    if (session.state === 'register_waiting_bank_book') {
      return handleRegisterBankBook(event, session.data, event.message.id, null);
    }
    if (session.state === 'leave_waiting_doc') {
      return handleLeaveDoc(event, session.data, event.message.id);
    }
    if (session.state === 'leave_reply_waiting') {
      return handleLeaveReply(event, session.data, null, event.message.id);
    }
    return reply(event.replyToken, text('กรุณากดปุ่มลงเวลาผ่านเมนูครับ'));
  }

  if (msgType === 'location') {
    return reply(event.replyToken, text('กรุณากดปุ่มลงเวลาผ่านเมนูครับ'));
  }

  // Text message
  if (msgType === 'text') {
    const trimmed = msgText.trim();

    // Registration flow
    if (session.state === 'register_waiting_name') return handleRegister(event, trimmed);
    if (session.state === 'register_waiting_start_date') return handleRegisterStartDate(event, session.data, trimmed);
    if (session.state === 'register_waiting_bank_book') return handleRegisterBankBook(event, session.data, null, trimmed);

    // Leave flow (text input steps)
    if (session.state === 'leave_waiting_start')  return handleLeaveStartDate(event, session.data, trimmed);
    if (session.state === 'leave_waiting_days')   return handleLeaveDays(event, session.data, trimmed);
    if (session.state === 'leave_waiting_reason') return handleLeaveReason(event, session.data, trimmed);
    if (session.state === 'leave_waiting_doc')    return handleLeaveDoc(event, session.data, null);
    if (session.state === 'leave_reply_waiting')  return handleLeaveReply(event, session.data, trimmed, null);

    // Admin add staff
    if (session.state === 'admin_add_staff') return handleAddStaff(event, trimmed);

    // Keywords
    if (['เมนู', 'menu', 'หน้าหลัก', 'help', 'ช่วยเหลือ'].includes(trimmed.toLowerCase())) {
      return handleMenu(event);
    }

    // Default: if user not registered, treat text as name input directly
    const { getUserByLineId } = require('../services/attendanceService');
    const user = await getUserByLineId(event.source.userId);
    if (!user) {
      setSession(event.source.userId, 'register_waiting_name');
      return handleRegister(event, trimmed);
    }

    return handleMenu(event);
  }
}

module.exports = router;
