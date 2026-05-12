const express = require('express');
const fs = require('fs');
const path = require('path');
const { validateToken } = require('../tokens');
const { getUserByLineId, checkIn, checkOut } = require('../services/attendanceService');
const { isInStore } = require('../services/gpsService');
const { notifyLate } = require('../services/notificationService');
const { push, text } = require('../services/lineMessaging');
const { query } = require('../config/database');
const { LATE_NOTIFY_THRESHOLD } = require('../config/constants');
const { compareFaces, THRESHOLD } = require('../services/faceService');
const { syncAttendance } = require('../services/googleSheets');

const router = express.Router();

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/attend.html'));
});

function saveBase64Photo(base64str) {
  const data = base64str.replace(/^data:image\/\w+;base64,/, '');
  const buf = Buffer.from(data, 'base64');
  const dir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `att_${Date.now()}.jpg`;
  fs.writeFileSync(path.join(dir, filename), buf);
  return `/uploads/${filename}`;
}

function readPhotoAsBase64(photoUrl) {
  const filepath = path.join(__dirname, '../../', photoUrl);
  if (!fs.existsSync(filepath)) return null;
  return fs.readFileSync(filepath).toString('base64');
}

async function notifyFaceAlert(user, photoUrl, confidence, action) {
  const { getAdminsAndManagers } = require('../services/notificationService');
  const admins = await getAdminsAndManagers();
  const actionStr = action === 'checkin' ? 'เข้างาน' : 'ออกงาน';
  const msg = text(
    `🚨 แจ้งเตือน: ใบหน้าไม่ตรงกัน!\n\n` +
    `พนักงาน: ${user.name}\n` +
    `การกระทำ: ลงเวลา${actionStr}\n` +
    `ความคล้าย: ${confidence?.toFixed(1) ?? '?'}% (ต้องการ ${THRESHOLD}%)\n\n` +
    `กรุณาตรวจสอบ Dashboard`
  );
  await Promise.all(admins.map(id => push(id, msg).catch(() => {})));

  // Log to face_alerts table
  await query(
    'INSERT INTO face_alerts (user_id, photo_url, confidence, action) VALUES ($1, $2, $3, $4)',
    [user.id, photoUrl, confidence, action]
  ).catch(() => {});
}

router.post('/submit', async (req, res) => {
  try {
    const { token, lat, lng, photo, action } = req.body;

    const tokenData = validateToken(token);
    if (!tokenData) return res.json({ error: 'TOKEN_EXPIRED' });

    const { userId } = tokenData;
    const user = await getUserByLineId(userId);
    if (!user) return res.json({ error: 'ไม่พบข้อมูลพนักงาน' });

    // GPS check
    const { valid, distanceM } = isInStore(parseFloat(lat), parseFloat(lng));
    if (!valid) {
      return res.json({ error: `ตำแหน่งอยู่นอกร้าน ${distanceM} เมตร (รัศมีที่อนุญาต 100 เมตร)` });
    }

    // ── Face Verification ─────────────────────────────────────────────────
    if (!user.reference_photo) {
      // First check-in ever → save as reference photo
      const photoUrl = saveBase64Photo(photo);
      await query('UPDATE users SET reference_photo = $1 WHERE id = $2', [photoUrl, user.id]);
      user.reference_photo = photoUrl;
      // Mark this as first-time so we skip comparison below
      user._isFirstPhoto = true;
    }

    if (!user._isFirstPhoto) {
      const refBase64 = readPhotoAsBase64(user.reference_photo);
      if (refBase64) {
        const faceResult = await compareFaces(refBase64, photo);

        if (!faceResult.match) {
          const photoUrl = saveBase64Photo(photo);
          await notifyFaceAlert(user, photoUrl, faceResult.confidence, action);

          const confStr = faceResult.confidence !== null
            ? `(ความคล้าย ${faceResult.confidence.toFixed(1)}%)`
            : '';
          return res.json({
            error: `❌ ใบหน้าไม่ตรงกับข้อมูลในระบบ ${confStr}\nAdmin ได้รับแจ้งเตือนแล้ว`,
          });
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    const photoUrl = user._isFirstPhoto ? user.reference_photo : saveBase64Photo(photo);

    // Check-in flow
    if (action === 'checkin') {
      const result = await checkIn(user.id, lat, lng, photoUrl);
      if (result.error === 'already_checkedin') return res.json({ error: 'คุณลงเวลาเข้างานวันนี้ไปแล้ว' });

      let msg = `✅ ลงเวลาเข้างานสำเร็จ!\n🕐 เวลา ${result.timeStr} น.`;
      if (user._isFirstPhoto) msg += '\n📸 บันทึกรูปอ้างอิงใบหน้าแล้ว';
      if (result.lateMinutes > 0) {
        msg += `\n⏰ สาย ${result.lateMinutes} นาที (-฿${result.lateMinutes})`;
        if (result.lateMinutes > LATE_NOTIFY_THRESHOLD) notifyLate(user.name, result.lateMinutes).catch(() => {});
      } else {
        msg += '\n🌟 มาตรงเวลา!';
      }
      await push(userId, text(msg)).catch(() => {});
      syncAttendance(result.record, user.name).catch(() => {});
      return res.json({ message: msg });
    }

    // Check-out flow
    if (action === 'checkout') {
      const result = await checkOut(user.id, lat, lng, photoUrl);
      if (result.error === 'no_checkin') return res.json({ error: 'คุณยังไม่ได้ลงเวลาเข้างานวันนี้' });
      if (result.error === 'already_checkedout') return res.json({ error: 'คุณลงเวลาออกงานวันนี้ไปแล้ว' });

      let msg = `✅ ลงเวลาออกงานสำเร็จ!\n🕐 เวลา ${result.timeStr} น.`;
      if (result.otMinutes > 0) msg += `\n⌛ OT ${result.otMinutes} นาที (+฿${result.otMinutes})`;
      msg += '\n\nขอบคุณสำหรับวันนี้! 👋';
      await push(userId, text(msg)).catch(() => {});
      syncAttendance(result.record, user.name).catch(() => {});
      return res.json({ message: msg });
    }

    res.json({ error: 'action ไม่ถูกต้อง' });

  } catch (e) {
    console.error('attend submit error:', e.message);
    res.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
  }
});

module.exports = router;
