# ระบบลงเวลางานผ่าน Line OA

## สิ่งที่ต้องเตรียม

1. **Line Official Account** + เปิด Messaging API
2. **PostgreSQL** database (ใช้ Railway / Neon / Supabase ได้)
3. **Server** สำหรับ deploy backend (Railway / Render / VPS)
4. **ngrok** สำหรับทดสอบในเครื่อง local

---

## ขั้นตอนติดตั้ง

### 1. ตั้งค่า Backend

```bash
cd line-attendance
npm install

# Copy ไฟล์ตั้งค่า
cp .env.example .env
```

แก้ไขไฟล์ `.env`:
```
LINE_CHANNEL_SECRET=   ← จาก Line Developers Console
LINE_CHANNEL_ACCESS_TOKEN=   ← จาก Line Developers Console
DATABASE_URL=postgresql://...
STORE_LAT=13.7563      ← latitude ของร้าน
STORE_LNG=100.5018     ← longitude ของร้าน
STORE_RADIUS_M=100
DASHBOARD_PASSWORD=รหัสผ่านที่ต้องการ
ADMIN_LINE_IDS=Uxxxxxxxx  ← Line User ID ของเจ้าของร้าน
```

### 2. สร้าง Database

```bash
psql $DATABASE_URL -f migrations/001_initial.sql
```

### 3. รัน Backend

```bash
npm run dev   # development
npm start     # production
```

### 4. ตั้งค่า Webhook URL ใน Line Developers

เปิด ngrok: `ngrok http 3000`

ใส่ URL: `https://xxxx.ngrok.io/webhook`

### 5. ติดตั้ง Dashboard

```bash
cd dashboard
npm install
npm run dev   # development (port 5173)
```

สำหรับ production:
```bash
npm run build
# นำ dist/ ไปใส่ใน static hosting หรือ Express serve
```

---

## วิธีหา Line User ID ของตัวเอง

1. เพิ่ม bot เป็นเพื่อน
2. พิมพ์อะไรก็ได้
3. ดู log ใน server — จะเห็น `lineUserId: Uxxxxxxxxxx`

---

## ขั้นตอนเพิ่มพนักงาน

**วิธีที่ 1 (ผ่าน Line Bot):**
- Admin แตะ "เพิ่มพนักงาน" จาก Admin Menu
- พิมพ์: `สมชาย ใจดี Uxxxxxxxxxx employee`

**วิธีที่ 2 (ตรง Database):**
```sql
INSERT INTO users (line_user_id, name, role, start_date)
VALUES ('Uxxxxxxxxxx', 'ชื่อพนักงาน', 'employee', '2026-01-01');
```

---

## Flow การใช้งาน

### พนักงาน:
1. แตะ **"ลงเวลาเข้างาน"**
2. ส่งตำแหน่ง GPS (ต้องอยู่ในรัศมี 100 เมตร)
3. ถ่ายรูปด้วย **กล้องหน้า**
4. ระบบบันทึกเวลา + แจ้งผล (มาตรงเวลา / สาย X นาที)

### Admin/Manager:
- รับแจ้งเตือนอัตโนมัติเมื่อพนักงานสาย > 15 นาที
- อนุมัติ/ปฏิเสธใบลาได้จาก Line โดยตรง
- ดู Dashboard ผ่านเว็บ

---

## Business Rules สรุป

| รายการ | ค่า |
|--------|-----|
| เวลางาน | 10:00 – 20:00 น. |
| ถือว่าสาย | ≥ 1 นาที |
| แจ้งเตือน Admin | สาย > 15 นาที |
| หักสาย | 1 บาท/นาที |
| OT | 1 บาท/นาที (หลัง 20:00) |
| เบี้ยขยัน | 1,000 บาท/เดือน (ไม่สาย ไม่ขาด ไม่ลา) |
| ลากิจ | 5 วัน/ปี, แจ้งล่วงหน้า 3 วัน |
| ลาพักร้อน | 7 วัน/ปี (อายุงาน ≥ 1 ปี), แจ้งล่วงหน้า 7 วัน |
| หยุดตรงกัน | ห้าม — ต้องสลับวัน |
| วันหยุดประเพณี | จ่าย 2 เท่า (13 วัน ปี 2569) |
