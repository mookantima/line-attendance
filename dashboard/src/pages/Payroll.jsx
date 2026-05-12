import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api';

const fmt = n => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function Payroll() {
  const now = new Date(Date.now() + 7 * 3600000);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [records, setRecords] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [manualEdit, setManualEdit] = useState(null);
  const fileRef = useRef();
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  function load() {
    setLoading(true);
    Promise.all([
      api.payroll(year, month),
      api.commission(year, month),
      api.salaryEmployees(),
    ]).then(([p, c, e]) => { setRecords(p); setCommissions(c); setEmployees(e); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(load, [year, month]);

  async function handleUpload(e) {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('year', year);
    fd.append('month', month);
    setUploadResult(null);
    try {
      const res = await api.uploadCommission(fd);
      setUploadResult(res);
      load();
    } catch (err) {
      setUploadResult({ error: err.message });
    }
    e.target.value = '';
  }

  async function saveManual() {
    if (!manualEdit) return;
    await api.saveCommission({
      user_id: manualEdit.userId,
      year, month,
      sales_amount: manualEdit.sales,
      commission_amount: manualEdit.comm,
    });
    setManualEdit(null);
    load();
  }

  const totals = records.reduce((acc, r) => ({
    base: acc.base + r.baseSalary,
    ot: acc.ot + r.otEarnings,
    late: acc.late + r.lateDeduction,
    comm: acc.comm + r.commission,
    holiday: acc.holiday + r.holidayBonus,
    bonus: acc.bonus + r.perfectBonus,
    net: acc.net + r.netSalary,
  }), { base: 0, ot: 0, late: 0, comm: 0, holiday: 0, bonus: 0, net: 0 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-slate-800">สรุปเงินเดือน</h2>
        <div className="flex gap-3 flex-wrap">
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'ฐานเงินเดือนรวม', value: totals.base, color: 'slate' },
          { label: 'Commission รวม', value: totals.comm, color: 'blue' },
          { label: 'OT รวม', value: totals.ot, color: 'indigo' },
          { label: 'หักสายรวม', value: -totals.late, color: 'red' },
        ].map(c => (
          <div key={c.label} className={`rounded-xl border p-4 bg-${c.color}-50 border-${c.color}-200`}>
            <p className={`text-xs font-semibold text-${c.color}-600 mb-1`}>{c.label}</p>
            <p className={`text-xl font-bold text-${c.color}-700`}>
              {c.value >= 0 ? '' : '-'}฿{fmt(Math.abs(c.value))}
            </p>
          </div>
        ))}
      </div>
      <div className="bg-green-600 text-white rounded-xl p-4 flex justify-between items-center">
        <span className="font-semibold text-lg">💰 เงินเดือนสุทธิรวมทุกคน</span>
        <span className="text-2xl font-bold">฿{fmt(totals.net)}</span>
      </div>

      {/* Commission section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-semibold text-slate-700">Commission เดือน {months[month-1]} {year}</h3>
          <div className="flex gap-2 flex-wrap">
            <a href={api.commissionTemplate()} download
              className="text-xs border border-slate-300 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-50 font-medium">
              📥 โหลด Template
            </a>
            <button onClick={() => fileRef.current.click()}
              className="text-xs bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 font-medium">
              📤 Upload Excel (EasePOS)
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
          </div>
        </div>

        {uploadResult && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${uploadResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {uploadResult.error ? `❌ ${uploadResult.error}` : `✅ บันทึกแล้ว ${uploadResult.saved} คน`}
            {uploadResult.unmatched?.length > 0 && (
              <div className="mt-1 text-amber-700">⚠️ จับคู่ชื่อไม่ได้: {uploadResult.unmatched.map(u => u.rawName).join(', ')}</div>
            )}
          </div>
        )}

        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {['ชื่อ', 'ยอดขาย (฿)', 'Commission (฿)', 'จัดการ'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.filter(e => e.is_active).map(emp => {
              const comm = commissions.find(c => c.user_id === emp.id);
              const isEditing = manualEdit?.userId === emp.id;
              return (
                <tr key={emp.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{emp.name}</td>
                  <td className="px-3 py-2">
                    {isEditing
                      ? <input type="number" value={manualEdit.sales} onChange={e => setManualEdit(v => ({...v, sales: e.target.value}))}
                          className="border border-slate-300 rounded px-2 py-1 w-28 text-sm" />
                      : comm ? `฿${fmt(comm.sales_amount)}` : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing
                      ? <input type="number" value={manualEdit.comm} onChange={e => setManualEdit(v => ({...v, comm: e.target.value}))}
                          className="border border-slate-300 rounded px-2 py-1 w-28 text-sm" />
                      : comm ? <span className="text-blue-700 font-semibold">฿{fmt(comm.commission_amount)}</span>
                             : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button onClick={saveManual} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">บันทึก</button>
                        <button onClick={() => setManualEdit(null)} className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded">ยกเลิก</button>
                      </div>
                    ) : (
                      <button onClick={() => setManualEdit({ userId: emp.id, sales: comm?.sales_amount || 0, comm: comm?.commission_amount || 0 })}
                        className="text-xs text-blue-600 underline hover:text-blue-800">แก้ไข</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Full payroll table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700">รายละเอียดเงินเดือนแต่ละคน</h3>
        </div>
        {loading ? <p className="text-center text-slate-400 py-10">กำลังโหลด...</p> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {['ชื่อ','ประเภท','มา','ฐานเงินเดือน','OT','Commission','วันหยุด×2','เบี้ยขยัน','หักสาย','สุทธิ'].map(h => (
                  <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map(r => (
                <tr key={r.userId} className="hover:bg-slate-50">
                  <td className="px-3 py-3 font-medium">{r.name}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.salaryType === 'daily' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      {r.salaryType === 'daily' ? 'รายวัน' : 'รายเดือน'}
                    </span>
                  </td>
                  <td className="px-3 py-3">{r.presentDays} วัน</td>
                  <td className="px-3 py-3 font-medium">฿{fmt(r.baseSalary)}</td>
                  <td className="px-3 py-3 text-indigo-600">+฿{fmt(r.otEarnings)}</td>
                  <td className="px-3 py-3 text-blue-700 font-semibold">+฿{fmt(r.commission)}</td>
                  <td className="px-3 py-3 text-purple-600">
                    {r.holidayDaysWorked > 0 ? `+฿${fmt(r.holidayBonus)}` : '—'}
                  </td>
                  <td className="px-3 py-3 text-green-600">
                    {r.perfectBonus > 0 ? `+฿${fmt(r.perfectBonus)} 🌟` : '—'}
                  </td>
                  <td className="px-3 py-3 text-red-600">
                    {r.lateDeduction > 0 ? `-฿${fmt(r.lateDeduction)}` : '—'}
                  </td>
                  <td className="px-3 py-3 font-bold text-lg text-slate-800">฿{fmt(r.netSalary)}</td>
                </tr>
              ))}
              {/* Total row */}
              <tr className="bg-slate-800 text-white">
                <td className="px-3 py-3 font-bold" colSpan={3}>รวมทั้งหมด</td>
                <td className="px-3 py-3 font-bold">฿{fmt(totals.base)}</td>
                <td className="px-3 py-3 font-bold">+฿{fmt(totals.ot)}</td>
                <td className="px-3 py-3 font-bold">+฿{fmt(totals.comm)}</td>
                <td className="px-3 py-3 font-bold">+฿{fmt(totals.holiday)}</td>
                <td className="px-3 py-3 font-bold">+฿{fmt(totals.bonus)}</td>
                <td className="px-3 py-3 font-bold">-฿{fmt(totals.late)}</td>
                <td className="px-3 py-3 font-bold text-lg">฿{fmt(totals.net)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
