import React, { useEffect, useState } from 'react';
import { api } from '../api';

const TYPE_LABEL = { personal: 'ลากิจ', annual: 'ลาพักร้อน' };
const STATUS_STYLE = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
};
const STATUS_LABEL = { pending: 'รอการอนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ถูกปฏิเสธ' };

export default function Leave() {
  const now = new Date(Date.now() + 7 * 3600000);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [data, setData] = useState({ leaves: [], pending: [] });
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.leaves(year, month), api.leaveBalance(year)])
      .then(([d, b]) => { setData(d); setBalances(b); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year, month]);

  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">การลางาน</h2>
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

      {/* Leave balance table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700">วันลาคงเหลือ ปี {year}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {['ชื่อ', 'ลากิจ (ใช้/สิทธิ์)', 'ลากิจคงเหลือ', 'ลาพักร้อน (ใช้/สิทธิ์)', 'พักร้อนคงเหลือ'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {balances.map(b => (
                <tr key={b.id || b.name} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{b.name}</td>
                  <td className="px-4 py-3">{b.personal_used ?? 0}/{b.personal_total ?? 5}</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${(b.personal_total - b.personal_used) <= 1 ? 'text-red-600' : 'text-green-600'}`}>
                      {(b.personal_total ?? 5) - (b.personal_used ?? 0)} วัน
                    </span>
                  </td>
                  <td className="px-4 py-3">{b.annual_used ?? 0}/{b.annual_total ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-blue-600">
                      {(b.annual_total ?? 0) - (b.annual_used ?? 0)} วัน
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leave requests */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700">
            ใบลางาน {months[month - 1]} {year}
            {data.pending.length > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                รอ {data.pending.length} ใบ
              </span>
            )}
          </h3>
        </div>
        {loading ? (
          <p className="text-center text-slate-400 py-12">กำลังโหลด...</p>
        ) : data.leaves.length === 0 ? (
          <p className="text-center text-slate-400 py-12">ไม่มีใบลาในช่วงนี้</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {['พนักงาน', 'ประเภท', 'วันเริ่ม', 'วันสิ้นสุด', 'จำนวน', 'เหตุผล', 'สถานะ'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.leaves.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{r.employee_name}</td>
                    <td className="px-4 py-3">{TYPE_LABEL[r.leave_type]}</td>
                    <td className="px-4 py-3">{String(r.start_date).slice(0, 10)}</td>
                    <td className="px-4 py-3">{String(r.end_date).slice(0, 10)}</td>
                    <td className="px-4 py-3">{r.days} วัน</td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{r.reason || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLE[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
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
