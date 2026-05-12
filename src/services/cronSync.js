const cron = require('node-cron');
const { query } = require('../config/database');
const { syncAttendance, syncLeave } = require('./googleSheets');

// Run daily at 23:30 Thai time (16:30 UTC)
function startCronSync() {
  cron.schedule('30 16 * * *', async () => {
    console.log('[CronSync] Starting daily Google Sheets sync...');
    try {
      const now = new Date(Date.now() + 7 * 3600000);
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth() + 1;

      // Sync today's attendance
      const attRes = await query(
        `SELECT a.*, u.name FROM attendance a
         JOIN users u ON u.id = a.user_id
         WHERE EXTRACT(YEAR FROM a.work_date) = $1 AND EXTRACT(MONTH FROM a.work_date) = $2`,
        [year, month]
      );
      for (const rec of attRes.rows) {
        await syncAttendance(rec, rec.name).catch(() => {});
      }

      // Sync all leave requests this month
      const leaveRes = await query(
        `SELECT lr.*, u.name FROM leave_requests lr
         JOIN users u ON u.id = lr.user_id
         WHERE EXTRACT(YEAR FROM lr.created_at) = $1 AND EXTRACT(MONTH FROM lr.created_at) = $2`,
        [year, month]
      );
      for (const req of leaveRes.rows) {
        await syncLeave(req, req.name).catch(() => {});
      }

      console.log(`[CronSync] Done: ${attRes.rows.length} attendance, ${leaveRes.rows.length} leave records`);
    } catch (e) {
      console.error('[CronSync] Error:', e.message);
    }
  }, { timezone: 'UTC' });

  console.log('✅ Daily Google Sheets sync scheduled (23:30 Thai time)');
}

module.exports = { startCronSync };
