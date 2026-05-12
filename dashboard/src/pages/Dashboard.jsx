import React, { useEffect, useState } from 'react';
import { api } from '../api';
import StatCard from '../components/StatCard';

function thaiTime(utcStr) {
  if (!utcStr) return '—';
  const d = new Date(new Date(utcStr).getTime() + 7 * 3600000);
  return d.toISOString().substr(11, 5);
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [today, setToday] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.summary(), api.today()])
      .then(([s, t]) => { setSummary(s); setToday(t); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500 mt-10 text-center">กำลังโหลด...</div>;
  if (error) return <div className="text-red-500 mt-10 text-center">❌ {error === 'UNAUTHORIZED' ? 'รหัสผ่านไม่ถูกต้อง' : error}</div>;

  const now = new Date(Date.now() + 7 * 3600000);
  const todayStr = now.toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">ภาพรวมวันนี้</h2>
        <p className="text-slate-500 text-sm">{todayStr}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="พนักงานทั้งหมด" value={summary?.totalEmployees} icon="👥" color="blue" />
        <StatCard label="เข้างานวันนี้" value={summary?.todayCheckedIn} icon="✅" color="green" />
        <StatCard label="มาสายวันนี้" value={summary?.todayLate} icon="⏰" color="amber" />
        <StatCard label="ใบลารอการอนุมัติ" value={summary?.pendingLeaves} icon="📋" color="purple" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700">บันทึกเวลาวันนี้</h3>
        </div>
        {today.length === 0 ? (
          <p className="text-center text-slate-400 py-12">ยังไม่มีข้อมูลการลงเวลา</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {['ชื่อ', 'เวลาเข้า', 'เวลาออก', 'สาย (นาที)', 'OT (นาที)', 'สถานะ', 'รูปถ่าย'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {today.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.name}</td>
                    <td className="px-4 py-3">{thaiTime(r.check_in_time)}</td>
                    <td className="px-4 py-3">{thaiTime(r.check_out_time)}</td>
                    <td className="px-4 py-3">
                      {r.late_minutes > 0
                        ? <span className="text-red-600 font-medium">{r.late_minutes}</span>
                        : <span className="text-green-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.ot_minutes > 0
                        ? <span className="text-blue-600 font-medium">{r.ot_minutes}</span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {r.check_out_time
                        ? <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">เสร็จ</span>
                        : r.check_in_time
                        ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">กำลังทำงาน</span>
                        : <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-xs">ยังไม่มา</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.check_in_photo && (
                        <a href={r.check_in_photo} target="_blank" rel="noreferrer"
                          className="text-blue-500 underline text-xs">เข้า</a>
                      )}
                      {r.check_out_photo && (
                        <a href={r.check_out_photo} target="_blank" rel="noreferrer"
                          className="text-blue-500 underline text-xs ml-2">ออก</a>
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
