const cron = require('node-cron');
const { query } = require('../config/database');
const { push } = require('./lineMessaging');
const { createToken } = require('../tokens');

function endOfDayFlex(userName, timeStr, checkoutUrl) {
  return {
    type: 'flex',
    altText: '⚠️ แจ้งเตือนเลิกงาน — ถึงเวลาเลิกงานแล้ว',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#F59E0B',
        paddingAll: '20px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'md',
            contents: [
              {
                type: 'text',
                text: '!',
                color: '#FFFFFF',
                weight: 'bold',
                size: 'xxl',
                flex: 0,
              },
              {
                type: 'text',
                text: 'แจ้งเตือนเลิกงาน',
                color: '#FFFFFF',
                weight: 'bold',
                size: 'xl',
                gravity: 'center',
              },
            ],
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: timeStr,
            color: '#9CA3AF',
            size: 'sm',
            align: 'center',
          },
          {
            type: 'separator',
            margin: 'sm',
          },
          {
            type: 'text',
            text: `ถึง คุณ ${userName}`,
            color: '#6B7280',
            size: 'sm',
            margin: 'md',
          },
          {
            type: 'text',
            text: 'ถึงเวลาเลิกงานแล้ว',
            color: '#F59E0B',
            weight: 'bold',
            size: 'lg',
            margin: 'sm',
          },
          {
            type: 'text',
            text: 'ให้ออกจากออฟฟิศทันที',
            color: '#1F2937',
            weight: 'bold',
            size: 'lg',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            backgroundColor: '#FFFBEB',
            borderColor: '#FCD34D',
            borderWidth: '1px',
            cornerRadius: '8px',
            paddingAll: '14px',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                spacing: 'sm',
                contents: [
                  {
                    type: 'text',
                    text: '⚠️',
                    flex: 0,
                    size: 'sm',
                  },
                  {
                    type: 'text',
                    text: 'คำเตือนสำคัญ',
                    color: '#B45309',
                    weight: 'bold',
                    size: 'sm',
                  },
                ],
              },
              {
                type: 'text',
                text: 'หากไม่ได้รับลูกค้าอยู่ ให้ทำการลงเวลาออกทันที บริษัทฯ จะไม่รับผิดชอบค่าล่วงเวลาทุกกรณี',
                wrap: true,
                color: '#92400E',
                size: 'sm',
                margin: 'sm',
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '16px',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'ลงเวลาออกงาน',
              uri: checkoutUrl,
            },
            style: 'primary',
            color: '#DC2626',
            height: 'sm',
          },
        ],
      },
    },
  };
}

async function sendEndOfDayNotifications() {
  const now = new Date(Date.now() + 7 * 3600000);
  const todayStr = now.toISOString().slice(0, 10);
  const timeStr = `${now.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })} เวลา ${now.toISOString().substr(11, 5)} น.`;

  // Find employees who checked in today but haven't checked out
  const res = await query(
    `SELECT a.user_id, u.name, u.line_user_id
     FROM attendance a
     JOIN users u ON u.id = a.user_id
     WHERE a.work_date = $1
       AND a.check_in_time IS NOT NULL
       AND a.check_out_time IS NULL
       AND u.is_active = true`,
    [todayStr]
  );

  console.log(`[EndOfDay] Sending to ${res.rows.length} employees who haven't checked out`);

  const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';

  for (const emp of res.rows) {
    if (!emp.line_user_id) continue;
    // Create 60-minute checkout token
    const token = createToken(emp.line_user_id, 'checkout', 60 * 60 * 1000);
    const checkoutUrl = `${serverUrl}/attend?token=${token}&action=checkout`;
    const msg = endOfDayFlex(emp.name, timeStr, checkoutUrl);
    await push(emp.line_user_id, msg).catch(e =>
      console.error(`[EndOfDay] Failed to notify ${emp.name}:`, e.message)
    );
  }
}

// Schedule: 20:00 Thai time = 13:00 UTC
function startEndOfDayCron() {
  cron.schedule('0 13 * * *', async () => {
    console.log('[EndOfDay] Running end-of-day notification...');
    try {
      await sendEndOfDayNotifications();
    } catch (e) {
      console.error('[EndOfDay] Error:', e.message);
    }
  }, { timezone: 'UTC' });

  console.log('✅ End-of-day notification scheduled (20:00 Thai time)');
}

module.exports = { startEndOfDayCron, sendEndOfDayNotifications };
