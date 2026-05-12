const { google } = require('googleapis');
const path = require('path');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CREDS_PATH = process.env.GOOGLE_CREDENTIALS_PATH || './credentials/google.json';
const CREDS_BASE64 = process.env.GOOGLE_CREDENTIALS_BASE64;

const ATTENDANCE_SHEET = 'การลงเวลา';
const LEAVE_SHEET = 'การลางาน';

const ATTENDANCE_HEADERS = ['วันที่', 'ชื่อ', 'เวลาเข้า', 'เวลาออก', 'สาย (นาที)', 'OT (นาที)', 'หักสาย (฿)', 'OT (฿)', 'หมายเหตุ'];
const LEAVE_HEADERS = ['วันที่ขอ', 'ชื่อ', 'ประเภท', 'วันเริ่ม', 'วันสิ้นสุด', 'จำนวนวัน', 'เหตุผล', 'สถานะ'];

let _sheets = null;

function getSheets() {
  if (_sheets) return _sheets;
  if (!SHEET_ID) return null;
  try {
    let credentials;
    if (CREDS_BASE64) {
      credentials = JSON.parse(Buffer.from(CREDS_BASE64, 'base64').toString('utf8'));
    }
    const auth = new google.auth.GoogleAuth({
      ...(credentials ? { credentials } : { keyFile: path.resolve(CREDS_PATH) }),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    _sheets = google.sheets({ version: 'v4', auth });
    return _sheets;
  } catch (e) {
    console.error('Google Sheets init error:', e.message);
    return null;
  }
}

async function ensureSheetExists(sheets, sheetName, headers) {
  // Get existing sheets
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const exists = meta.data.sheets.some(s => s.properties.title === sheetName);

  if (!exists) {
    // Create the sheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });
    // Add headers
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }
}

// Find row by matching value in column A (date) and B (name)
async function findRow(sheets, sheetName, dateStr, name) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A:B`,
  });
  const rows = res.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === dateStr && rows[i][1] === name) return i + 1; // 1-indexed
  }
  return null;
}

function thaiTimeStr(utcStr) {
  if (!utcStr) return '';
  const d = new Date(new Date(utcStr).getTime() + 7 * 3600000);
  return d.toISOString().substr(11, 5);
}

// Sync attendance record to Google Sheets
async function syncAttendance(record, userName) {
  const sheets = getSheets();
  if (!sheets) return;

  try {
    await ensureSheetExists(sheets, ATTENDANCE_SHEET, ATTENDANCE_HEADERS);

    const dateStr = new Date(record.work_date).toISOString().split('T')[0];
    const lateDeduct = (record.late_minutes || 0);
    const otEarn = (record.ot_minutes || 0);

    const rowData = [
      dateStr,
      userName,
      thaiTimeStr(record.check_in_time),
      thaiTimeStr(record.check_out_time),
      record.late_minutes || 0,
      record.ot_minutes || 0,
      lateDeduct > 0 ? `-${lateDeduct}` : 0,
      otEarn > 0 ? `+${otEarn}` : 0,
      record.note || '',
    ];

    const existingRow = await findRow(sheets, ATTENDANCE_SHEET, dateStr, userName);
    if (existingRow) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${ATTENDANCE_SHEET}!A${existingRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [rowData] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${ATTENDANCE_SHEET}!A1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [rowData] },
      });
    }
  } catch (e) {
    console.error('Sheets syncAttendance error:', e.message);
  }
}

// Sync leave request to Google Sheets
async function syncLeave(request, userName) {
  const sheets = getSheets();
  if (!sheets) return;

  try {
    await ensureSheetExists(sheets, LEAVE_SHEET, LEAVE_HEADERS);

    const typeLabel = request.leave_type === 'personal' ? 'ลากิจ' : 'ลาพักร้อน';
    const statusLabel = { pending: 'รอการอนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ถูกปฏิเสธ' }[request.status] || request.status;
    const createdDate = new Date(request.created_at).toISOString().split('T')[0];

    const rowData = [
      createdDate,
      userName,
      typeLabel,
      String(request.start_date).slice(0, 10),
      String(request.end_date).slice(0, 10),
      request.days,
      request.reason || '',
      statusLabel,
    ];

    // Find by created date + name
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${LEAVE_SHEET}!A:B`,
    });
    const rows = res.data.values || [];
    let existingRow = null;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === createdDate && rows[i][1] === userName) { existingRow = i + 1; break; }
    }

    if (existingRow) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${LEAVE_SHEET}!A${existingRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [rowData] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${LEAVE_SHEET}!A1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [rowData] },
      });
    }
  } catch (e) {
    console.error('Sheets syncLeave error:', e.message);
  }
}

module.exports = { syncAttendance, syncLeave };
