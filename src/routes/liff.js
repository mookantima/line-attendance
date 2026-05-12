const express = require('express');
const fs = require('fs');
const path = require('path');
const { getUserByLineId, checkIn, checkOut } = require('../services/attendanceService');
const { isInStore } = require('../services/gpsService');
const { notifyLate } = require('../services/notificationService');
const { push, text } = require('../services/lineMessaging');
const { LATE_NOTIFY_THRESHOLD } = require('../config/constants');
const { getSetting } = require('../services/settingsService');

const router = express.Router();

function saveBase64Photo(base64str) {
  const data = base64str.replace(/^data:image\/\w+;base64,/, '');
  const buf = Buffer.from(data, 'base64');
  const filename = `liff_${Date.now()}.jpg`;
  const filepath = path.join(__dirname, '../../uploads', filename);
  fs.writeFileSync(filepath, buf);
  return `/uploads/${filename}`;
}

// POST /liff/checkin
router.post('/checkin', async (req, res) => {
  try {
    const { userId, lat, lng, photo } = req.body;
    if (!userId || !lat || !lng || !photo) {
      return res.json({ error: 'ข้อมูลไม่ครบ' });
    }

    const user = await getUserByLineId(userId);
    if (!user) return res.json({ error: 'กรุณาลงทะเบียนผ่าน Line bot ก่อน' });

    const radiusM = parseInt(await getSetting('store_radius_m') || '10000');
    const { valid, distanceM } = isInStore(parseFloat(lat), parseFloat(lng), radiusM);
    if (!valid) return res.json({ error: `ตำแหน่งอยู่นอกรัศมี ${distanceM} เมตร (รัศมีที่อนุญาต ${radiusM.toLocaleString()} เมตร)` });

    const photoUrl = saveBase64Photo(photo);
    const result = await checkIn(user.id, lat, lng, photoUrl);

    if (result.error === 'already_checkedin') {
      return res.json({ error: 'คุณลงเวลาเข้างานวันนี้ไปแล้ว' });
    }

    let msg = `✅ ลงเวลาเข้างานสำเร็จ!\n🕐 เวลา: ${result.timeStr} น.`;
    if (result.lateMinutes > 0) {
      msg += `\n⏰ สาย ${result.lateMinutes} นาที (-฿${result.lateMinutes})`;
      if (result.lateMinutes > LATE_NOTIFY_THRESHOLD) {
        notifyLate(user.name, result.lateMinutes).catch(() => {});
      }
    } else {
      msg += '\n🌟 มาตรงเวลา!';
    }

    await push(userId, text(msg)).catch(() => {});
    res.json({ message: msg });

  } catch (e) {
    console.error('LIFF checkin error:', e.message);
    res.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
  }
});

// POST /liff/checkout
router.post('/checkout', async (req, res) => {
  try {
    const { userId, lat, lng, photo } = req.body;
    if (!userId || !lat || !lng || !photo) {
      return res.json({ error: 'ข้อมูลไม่ครบ' });
    }

    const user = await getUserByLineId(userId);
    if (!user) return res.json({ error: 'กรุณาลงทะเบียนผ่าน Line bot ก่อน' });

    const radiusM = parseInt(await getSetting('store_radius_m') || '10000');
    const { valid, distanceM } = isInStore(parseFloat(lat), parseFloat(lng), radiusM);
    if (!valid) return res.json({ error: `ตำแหน่งอยู่นอกรัศมี ${distanceM} เมตร (รัศมีที่อนุญาต ${radiusM.toLocaleString()} เมตร)` });

    const photoUrl = saveBase64Photo(photo);
    const result = await checkOut(user.id, lat, lng, photoUrl);

    if (result.error === 'no_checkin') return res.json({ error: 'คุณยังไม่ได้ลงเวลาเข้างานวันนี้' });
    if (result.error === 'already_checkedout') return res.json({ error: 'คุณลงเวลาออกงานวันนี้ไปแล้ว' });

    let msg = `✅ ลงเวลาออกงานสำเร็จ!\n🕐 เวลา: ${result.timeStr} น.`;
    if (result.otMinutes > 0) {
      msg += `\n⌛ OT ${result.otMinutes} นาที (+฿${result.otMinutes})`;
    }
    msg += '\n\nขอบคุณสำหรับวันนี้! 👋';

    await push(userId, text(msg)).catch(() => {});
    res.json({ message: msg });

  } catch (e) {
    console.error('LIFF checkout error:', e.message);
    res.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
  }
});

module.exports = router;
