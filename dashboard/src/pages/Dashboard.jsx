import React, { useEffect, useState } from 'react';
import { api } from '../api';
import StatCard from '../components/StatCard';

function thaiTime(utcStr) {
  if (!utcStr) return '—';
  const d = new Date(new Date(utcStr).getTime() + 7 * 3600000);
  return d.toISOString().substr(11, 5);
}

const card = { background: 'white', border: '1px solid var(--brand-beige)', borderRadius: 16 };
const thHead = { background: '#f7f3ed', color: 'var(--brand-sage)', fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase' };

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [today, setToday] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notifying, setNotifying] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState(null);

  async function triggerEndOfDay() {
    setNotifying(true);
    setNotifyMsg(null);
    try {
      const r = await api.notifyEndOfDay();
      setNotifyMsg({ ok: true, text: r.message });
    } catch (e) {
      setNotifyMsg({ ok: false, text: e.message });
    } finally {
      setNotifying(false);
      setTimeout(() => setNotifyMsg(null), 4000);
    }
  }

  useEffect(() => {
    Promise.all([api.summary(), api.today()])
      .then(([s, t]) => { setSummary(s); setToday(t); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center mt-20">
      <div className="text-sm" style={{ color: 'var(--brand-light)' }}>กำลังโหลด...</div>
    </div>
  );
  if (error) return <div className="text-red-500 mt-10 text-center">❌ {error === 'UNAUTHORIZED' ? 'รหัสผ่านไม่ถูกต้อง' : error}</div>;

  const now = new Date(Date.now() + 7 * 3600000);
  const todayStr = now.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold" style={{ color: 'var(--brand-dark)' }}>ภาพรวมวันนี้</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--brand-light)' }}>{todayStr}</p>
        </div>
        <div className="flex items-center gap-3">
          {notifyMsg && (
            <span className={`text-xs px-3 py-1 rounded-full ${notifyMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {notifyMsg.ok ? '✅' : '❌'} {notifyMsg.text}
            </span>
          )}
          <button onClick={triggerEndOfDay} disabled={notifying}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white flex items-center gap-2 disabled:opacity-60"
            style={{ background: '#D97706' }}>
            {notifying ? 'กำลังส่ง...' : '⚠️ ส่งแจ้งเตือนเลิกงาน'}
          </button>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--brand-beige)' }} />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="พนักงานทั้งหมด" value={summary?.totalEmployees} icon="◉" color="sage" />
        <StatCard label="เข้างานวันนี้"   value={summary?.todayCheckedIn}  icon="✓" color="green" />
        <StatCard label="มาสายวันนี้"     value={summary?.todayLate}        icon="◷" color="amber" />
        <StatCard label="ใบลารออนุมัติ"   value={summary?.pendingLeaves}    icon="◻" color="red" />
      </div>

      {/* Today's table */}
      <div style={card} className="overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--brand-beige)' }}>
          <h3 className="font-semibold text-sm tracking-wide" style={{ color: 'var(--brand-dark)' }}>
            บันทึกเวลาวันนี้
          </h3>
          <span className="text-xs px-3 py-1 rounded-full"
            style={{ background: 'rgba(107,124,82,0.1)', color: 'var(--brand-sage)' }}>
            {today.filter(r => r.check_in_time).length} / {today.length} คน
          </span>
        </div>
        {today.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: 'var(--brand-light)' }}>ยังไม่มีข้อมูลการลงเวลา</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={thHead}>
                  {['ชื่อ', 'เวลาเข้า', 'เวลาออก', 'สาย', 'OT', 'สถานะ', 'รูป'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {today.map((r, i) => (
                  <tr key={r.id}
                    style={{ borderTop: i > 0 ? '1px solid var(--brand-beige)' : 'none' }}
                    className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--brand-dark)' }}>{r.name}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--brand-text)' }}>{thaiTime(r.check_in_time)}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--brand-text)' }}>{thaiTime(r.check_out_time)}</td>
                    <td className="px-4 py-3">
                      {r.late_minutes > 0
                        ? <span className="font-semibold text-red-600">{r.late_minutes} น.</span>
                        : <span style={{ color: 'var(--brand-light)' }}>—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.ot_minutes > 0
                        ? <span className="font-semibold" style={{ color: 'var(--brand-sage)' }}>{r.ot_minutes} น.</span>
                        : <span style={{ color: 'var(--brand-light)' }}>—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.check_out_time
                        ? <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--brand-beige)', color: 'var(--brand-mid)' }}>เสร็จแล้ว</span>
                        : r.check_in_time
                        ? <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(107,124,82,0.15)', color: 'var(--brand-sage)' }}>● กำลังทำงาน</span>
                        : <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-500">ยังไม่มา</span>}
                    </td>
                    <td className="px-4 py-3 space-x-2">
                      {r.check_in_photo && (
                        <a href={r.check_in_photo} target="_blank" rel="noreferrer"
                          className="text-xs underline" style={{ color: 'var(--brand-sage)' }}>เข้า</a>
                      )}
                      {r.check_out_photo && (
                        <a href={r.check_out_photo} target="_blank" rel="noreferrer"
                          className="text-xs underline" style={{ color: 'var(--brand-sage)' }}>ออก</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
