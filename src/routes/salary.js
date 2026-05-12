const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const { query } = require('../config/database');
const { thaiNow } = require('../config/constants');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function auth(req, res, next) {
  if (req.headers['x-dashboard-password'] !== process.env.DASHBOARD_PASSWORD)
    return res.status(401).json({ error: 'Unauthorized' });
  next();
}
router.use(auth);

// GET /api/salary/employees — get all employees with salary info
router.get('/employees', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, role, salary_type, salary_amount, start_date, is_active FROM users ORDER BY name'
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/salary/employees/:id — update salary
router.put('/employees/:id', async (req, res) => {
  const { salary_type, salary_amount } = req.body;
  if (!['daily', 'monthly'].includes(salary_type)) return res.status(400).json({ error: 'salary_type ต้องเป็น daily หรือ monthly' });
  if (isNaN(salary_amount) || salary_amount < 0) return res.status(400).json({ error: 'salary_amount ไม่ถูกต้อง' });
  try {
    const result = await query(
      'UPDATE users SET salary_type = $1, salary_amount = $2 WHERE id = $3 RETURNING id, name, salary_type, salary_amount',
      [salary_type, salary_amount, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'ไม่พบพนักงาน' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/salary/commission?year=&month= — get commission records
router.get('/commission', async (req, res) => {
  const now = thaiNow();
  const year = parseInt(req.query.year || now.getFullYear());
  const month = parseInt(req.query.month || now.getMonth() + 1);
  try {
    const result = await query(
      `SELECT c.*, u.name FROM commissions c
       JOIN users u ON u.id = c.user_id
       WHERE c.year = $1 AND c.month = $2
       ORDER BY u.name`,
      [year, month]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/salary/commission/manual — manual entry per employee
router.post('/commission/manual', async (req, res) => {
  const { user_id, year, month, sales_amount, commission_amount, note } = req.body;
  try {
    const result = await query(
      `INSERT INTO commissions (user_id, year, month, sales_amount, commission_amount, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, year, month) DO UPDATE SET
         sales_amount = EXCLUDED.sales_amount,
         commission_amount = EXCLUDED.commission_amount,
         note = EXCLUDED.note,
         uploaded_at = NOW()
       RETURNING *`,
      [user_id, year, month, sales_amount || 0, commission_amount || 0, note || null]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/salary/commission/upload — upload Excel from EasePOS
router.post('/commission/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ไม่มีไฟล์' });
  const { year, month } = req.body;
  if (!year || !month) return res.status(400).json({ error: 'กรุณาระบุปีและเดือน' });

  try {
    const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) return res.status(400).json({ error: 'ไฟล์ไม่มีข้อมูล' });

    // Detect column names (flexible matching)
    const firstRow = rows[0];
    const keys = Object.keys(firstRow);

    const nameCol = keys.find(k => /ชื่อ|name|พนักงาน|staff/i.test(k));
    const salesCol = keys.find(k => /ยอด|sale|amount|รายได้/i.test(k));
    const commCol = keys.find(k => /commission|คอม|ค่าคอม/i.test(k));

    if (!nameCol) {
      return res.status(400).json({
        error: 'ไม่พบคอลัมน์ชื่อพนักงาน',
        hint: 'ตรวจสอบว่าไฟล์มีคอลัมน์ที่มีคำว่า "ชื่อ" หรือ "Name"',
        columns: keys,
      });
    }

    // Get all employees for matching
    const empRes = await query('SELECT id, name FROM users WHERE is_active = true');
    const employees = empRes.rows;

    const matched = [], unmatched = [];

    for (const row of rows) {
      const rawName = String(row[nameCol] || '').trim();
      if (!rawName) continue;

      const emp = employees.find(e =>
        e.name === rawName ||
        e.name.includes(rawName) ||
        rawName.includes(e.name)
      );

      const sales = parseFloat(String(row[salesCol] || '0').replace(/,/g, '')) || 0;
      const comm = parseFloat(String(row[commCol] || '0').replace(/,/g, '')) || 0;

      if (emp) {
        matched.push({ userId: emp.id, name: emp.name, rawName, sales_amount: sales, commission_amount: comm });
      } else {
        unmatched.push({ rawName, sales_amount: sales, commission_amount: comm });
      }
    }

    // Save matched rows
    for (const m of matched) {
      await query(
        `INSERT INTO commissions (user_id, year, month, sales_amount, commission_amount, note)
         VALUES ($1, $2, $3, $4, $5, 'นำเข้าจาก EasePOS')
         ON CONFLICT (user_id, year, month) DO UPDATE SET
           sales_amount = EXCLUDED.sales_amount,
           commission_amount = EXCLUDED.commission_amount,
           note = EXCLUDED.note, uploaded_at = NOW()`,
        [m.userId, year, month, m.sales_amount, m.commission_amount]
      );
    }

    res.json({
      saved: matched.length,
      unmatched: unmatched.length > 0 ? unmatched : undefined,
      matched,
    });

  } catch (e) {
    console.error('Excel upload error:', e.message);
    res.status(500).json({ error: 'อ่านไฟล์ไม่ได้: ' + e.message });
  }
});

// GET /api/salary/commission/template — download template Excel
router.get('/commission/template', async (req, res) => {
  const empRes = await query('SELECT name FROM users WHERE is_active = true ORDER BY name');
  const wb = xlsx.utils.book_new();
  const data = [
    ['ชื่อพนักงาน', 'ยอดขาย (บาท)', 'commission (บาท)'],
    ...empRes.rows.map(e => [e.name, 0, 0]),
  ];
  const ws = xlsx.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 18 }];
  xlsx.utils.book_append_sheet(wb, ws, 'Commission');
  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=commission_template.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

module.exports = router;
