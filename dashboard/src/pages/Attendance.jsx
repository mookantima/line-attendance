import React, { useEffect, useState } from 'react';
import { api } from '../api';

function thaiTime(utcStr) {
  if (!utcStr) return '—';
  return new Date(new Date(utcStr).getTime() + 7 * 3600000).toISOString().substr(11, 5);
}

export default function Attendance() {
  const now = new Date(Date.now() + 7 * 3600000);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.attendance(year, month)
      .then(setRecords)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year, month]);

  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">การลงเวลา</h2>
        <div className="flex gap-3">
          <select value={month} onChange={e => setMonth(+e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            {[2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        {loading ? (
          <p className="text-center text-slate-400 py-12">กำลังโหลด...</p>
        ) : records.length === 0 ? (
          <p className="text-center text-slate-400 py-12">ไม่มีข้อมูล</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {['วันที่', 'ชื่อ', 'เวลาเข้า', 'เวลาออก', 'สาย', 'OT', 'รูปเข้า', 'รูปออก'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{String(r.work_date).slice(0, 10)}</td>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">{thaiTime(r.check_in_time)}</td>
                  <td className="px-4 py-3">{thaiTime(r.check_out_time)}</td>
                  <td className="px-4 py-3">
                    {r.late_minutes > 0
                      ? <span className="text-red-600 font-medium">{r.late_minutes} น. (-฿{r.late_minutes})</span>
                      : <span className="text-green-600 text-xs">ตรงเวลา</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.ot_minutes > 0
                      ? <span className="text-blue-600 font-medium">{r.ot_minutes} น. (+฿{r.ot_minutes})</span>
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {r.check_in_photo && (
                      <a href={r.check_in_photo} target="_blank" rel="noreferrer"
                        className="text-blue-500 underline text-xs">ดู</a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.check_out_photo && (
                      <a href={r.check_out_photo} target="_blank" rel="noreferrer"
                        className="text-blue-500 underline text-xs">ดู</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
