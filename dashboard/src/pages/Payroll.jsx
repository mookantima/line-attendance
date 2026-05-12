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
  const [salaryEdit, setSalaryEdit] = useState(null);
  const [salaryMsg, setSalaryMsg] = useState(null);
  const [extrasModal, setExtrasModal] = useState(null); // { record }
  const [extrasSaving, setExtrasSaving] = useState(false);
  const [extrasMsg, setExtrasMsg] = useState(null);
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

  async function saveSalary() {
    if (!salaryEdit) return;
    setSalaryMsg(null);
    try {
      await api.updateSalary(salaryEdit.id, {
        salary_type: salaryEdit.salary_type,
        salary_amount: parseFloat(salaryEdit.salary_amount),
      });
      setSalaryMsg({ ok: true, text: `บันทึกเงินเดือน ${salaryEdit.name} สำเร็จ` });
      setSalaryEdit(null);
      load();
    } catch (e) {
      setSalaryMsg({ ok: false, text: e.message });
    }
  }

  function openExtras(rec) {
    setExtrasModal({
      userId: rec.userId,
      name: rec.name,
      product_commission: rec.productCommission || 0,
      holiday_pay: rec.manualHolidayPay || 0,
      social_security: rec.socialSecurity || 0,
      absent_deduction: rec.absentDeduction || 0,
      note: '',
    });
    setExtrasMsg(null);
  }

  async function saveExtras() {
    if (!extrasModal) return;
    setExtrasSaving(true);
    try {
      await api.saveExtras({
        user_id: extrasModal.userId,
        year, month,
        product_commission: extrasModal.product_commission,
        holiday_pay: extrasModal.holiday_pay,
        social_security: extrasModal.social_security,
        absent_deduction: extrasModal.absent_deduction,
        note: extrasModal.note,
      });
      setExtrasMsg({ ok: true, text: 'บันทึกสำเร็จ' });
      load();
      setTimeout(() => { setExtrasModal(null); setExtrasMsg(null); }, 800);
    } catch (e) {
      setExtrasMsg({ ok: false, text: e.message });
    } finally {
      setExtrasSaving(false);
    }
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
    productComm: acc.productComm + (r.productCommission || 0),
    holiday: acc.holiday + (r.holidayBonus || 0) + (r.manualHolidayPay || 0),
    bonus: acc.bonus + r.perfectBonus,
    social: acc.social + (r.socialSecurity || 0),
    absent: acc.absent + (r.absentDeduction || 0),
    net: acc.net + r.netSalary,
  }), { base: 0, ot: 0, late: 0, comm: 0, productComm: 0, holiday: 0, bonus: 0, social: 0, absent: 0, net: 0 });

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
          { label: 'ฐานเงินเดือนรวม', value: totals.base, plus: true },
          { label: 'Commission + คอมสินค้า', value: totals.comm + totals.productComm, plus: true },
          { label: 'OT + วันหยุด', value: totals.ot + totals.holiday, plus: true },
          { label: 'หัก (สาย+ประกัน+ขาด)', value: totals.late + totals.social + totals.absent, plus: false },
        ].map(c => (
          <div key={c.label} className="rounded-xl p-4"
            style={{ background: c.plus ? 'rgba(107,124,82,0.08)' : 'rgba(180,60,60,0.07)',
                     border: `1px solid ${c.plus ? 'rgba(107,124,82,0.2)' : 'rgba(180,60,60,0.2)'}` }}>
            <p className="text-xs font-medium mb-1" style={{ color: c.plus ? 'var(--brand-sage)' : '#8b2020' }}>{c.label}</p>
            <p className="text-xl font-bold" style={{ color: c.plus ? 'var(--brand-dark)' : '#8b2020' }}>
              {c.plus ? '+' : '-'}฿{fmt(Math.abs(c.value))}
            </p>
          </div>
        ))}
      </div>
      <div className="rounded-xl p-4 flex justify-between items-center text-white"
        style={{ background: 'var(--brand-mid)' }}>
        <span className="font-semibold text-lg">เงินเดือนสุทธิรวมทุกคน</span>
        <span className="text-2xl font-bold">฿{fmt(totals.net)}</span>
      </div>

      {/* Salary settings */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-700 mb-4">⚙️ ตั้งค่าเงินเดือนพนักงาน</h3>
        {salaryMsg && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${salaryMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {salaryMsg.ok ? '✅' : '❌'} {salaryMsg.text}
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {['ชื่อ', 'ประเภท', 'อัตราเงินเดือน (฿)', 'จัดการ'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.filter(e => e.is_active).map(emp => {
              const isEditing = salaryEdit?.id === emp.id;
              return (
                <tr key={emp.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{emp.name}</td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <select value={salaryEdit.salary_type}
                        onChange={e => setSalaryEdit(v => ({ ...v, salary_type: e.target.value }))}
                        className="border border-slate-300 rounded px-2 py-1 text-sm">
                        <option value="monthly">รายเดือน</option>
                        <option value="daily">รายวัน</option>
                      </select>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${emp.salary_type === 'daily' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {emp.salary_type === 'daily' ? 'รายวัน' : 'รายเดือน'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input type="number" value={salaryEdit.salary_amount}
                          onChange={e => setSalaryEdit(v => ({ ...v, salary_amount: e.target.value }))}
                          className="border border-slate-300 rounded px-2 py-1 w-32 text-sm" />
                        <span className="text-slate-400 text-xs">
                          {salaryEdit.salary_type === 'daily' ? '฿/วัน' : '฿/เดือน'}
                        </span>
                      </div>
                    ) : (
                      <span className="font-semibold text-slate-700">
                        ฿{fmt(emp.salary_amount)}
                        <span className="text-slate-400 text-xs font-normal ml-1">
                          {emp.salary_type === 'daily' ? '/วัน' : '/เดือน'}
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button onClick={saveSalary}
                          className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">บันทึก</button>
                        <button onClick={() => setSalaryEdit(null)}
                          className="text-xs bg-slate-200 text-slate-600 px-3 py-1 rounded">ยกเลิก</button>
                      </div>
                    ) : (
                      <button onClick={() => { setSalaryEdit({ id: emp.id, name: emp.name, salary_type: emp.salary_type || 'monthly', salary_amount: emp.salary_amount || 0 }); setSalaryMsg(null); }}
                        className="text-xs text-blue-600 underline hover:text-blue-800">แก้ไข</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
      <div className="rounded-xl overflow-x-auto" style={{ background: 'white', border: '1px solid var(--brand-beige)' }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--brand-beige)' }}>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--brand-dark)' }}>รายละเอียดเงินเดือนแต่ละคน</h3>
          <p className="text-xs" style={{ color: 'var(--brand-light)' }}>กดปุ่ม "รายได้/หัก" เพื่อกรอกรายการเพิ่มเติม</p>
        </div>
        {loading ? <p className="text-center py-10" style={{ color: 'var(--brand-light)' }}>กำลังโหลด...</p> : (
          <table className="w-full text-sm">
            <thead style={{ background: '#f7f3ed', color: 'var(--brand-sage)', fontSize: 11 }}>
              <tr>
                {['ชื่อ','ประเภท','มา','ฐานเงินเดือน','OT','Commission','คอมสินค้า','วันหยุด×2','เบี้ยขยัน','หักสาย','ประกันสังคม','ขาดงาน','สุทธิ',''].map(h => (
                  <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.userId} style={{ borderTop: i > 0 ? '1px solid var(--brand-beige)' : 'none' }}
                  className="hover:bg-stone-50 transition-colors">
                  <td className="px-3 py-3 font-semibold" style={{ color: 'var(--brand-dark)' }}>{r.name}</td>
                  <td className="px-3 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={r.salaryType === 'daily'
                        ? { background: 'rgba(180,130,40,0.1)', color: '#7a5a10' }
                        : { background: 'rgba(107,124,82,0.1)', color: 'var(--brand-sage)' }}>
                      {r.salaryType === 'daily' ? 'รายวัน' : 'รายเดือน'}
                    </span>
                  </td>
                  <td className="px-3 py-3">{r.presentDays} วัน</td>
                  <td className="px-3 py-3 font-medium">฿{fmt(r.baseSalary)}</td>
                  <td className="px-3 py-3" style={{ color: 'var(--brand-sage)' }}>
                    {r.otEarnings > 0 ? `+฿${fmt(r.otEarnings)}` : '—'}
                  </td>
                  <td className="px-3 py-3 font-semibold" style={{ color: 'var(--brand-mid)' }}>
                    {r.commission > 0 ? `+฿${fmt(r.commission)}` : '—'}
                  </td>
                  <td className="px-3 py-3" style={{ color: 'var(--brand-sage)' }}>
                    {r.productCommission > 0 ? `+฿${fmt(r.productCommission)}` : '—'}
                  </td>
                  <td className="px-3 py-3" style={{ color: '#6b4fa0' }}>
                    {(r.holidayBonus + (r.manualHolidayPay||0)) > 0 ? `+฿${fmt(r.holidayBonus + (r.manualHolidayPay||0))}` : '—'}
                  </td>
                  <td className="px-3 py-3" style={{ color: 'var(--brand-sage)' }}>
                    {r.perfectBonus > 0 ? `+฿${fmt(r.perfectBonus)} ★` : '—'}
                  </td>
                  <td className="px-3 py-3 text-red-600">
                    {r.lateDeduction > 0 ? `-฿${fmt(r.lateDeduction)}` : '—'}
                  </td>
                  <td className="px-3 py-3 text-red-600">
                    {r.socialSecurity > 0 ? `-฿${fmt(r.socialSecurity)}` : '—'}
                  </td>
                  <td className="px-3 py-3 text-red-600">
                    {r.absentDeduction > 0 ? `-฿${fmt(r.absentDeduction)}` : '—'}
                  </td>
                  <td className="px-3 py-3 font-bold text-base" style={{ color: 'var(--brand-dark)' }}>฿{fmt(r.netSalary)}</td>
                  <td className="px-3 py-3">
                    <button onClick={() => openExtras(r)}
                      className="text-xs px-2 py-1 rounded-lg whitespace-nowrap"
                      style={{ background: 'rgba(107,124,82,0.1)', color: 'var(--brand-sage)' }}>
                      รายได้/หัก
                    </button>
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'var(--brand-dark)', color: 'white' }}>
                <td className="px-3 py-3 font-bold" colSpan={3}>รวมทั้งหมด</td>
                <td className="px-3 py-3 font-bold">฿{fmt(totals.base)}</td>
                <td className="px-3 py-3 font-bold">+฿{fmt(totals.ot)}</td>
                <td className="px-3 py-3 font-bold">+฿{fmt(totals.comm)}</td>
                <td className="px-3 py-3 font-bold">+฿{fmt(totals.productComm)}</td>
                <td className="px-3 py-3 font-bold">+฿{fmt(totals.holiday)}</td>
                <td className="px-3 py-3 font-bold">+฿{fmt(totals.bonus)}</td>
                <td className="px-3 py-3 font-bold">-฿{fmt(totals.late)}</td>
                <td className="px-3 py-3 font-bold">-฿{fmt(totals.social)}</td>
                <td className="px-3 py-3 font-bold">-฿{fmt(totals.absent)}</td>
                <td className="px-3 py-3 font-bold text-lg">฿{fmt(totals.net)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Extras modal */}
      {extrasModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl shadow-xl w-full max-w-sm" style={{ background: 'var(--brand-cream)' }}>
            <div className="px-6 py-4 flex justify-between items-center" style={{ borderBottom: '1px solid var(--brand-beige)' }}>
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--brand-dark)' }}>รายได้ / รายหัก</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--brand-light)' }}>{extrasModal.name} — {months[month-1]} {year}</p>
              </div>
              <button onClick={() => setExtrasModal(null)} style={{ color: 'var(--brand-light)' }} className="text-xl">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {extrasMsg && (
                <div className={`p-3 rounded-xl text-sm ${extrasMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {extrasMsg.ok ? '✅' : '❌'} {extrasMsg.text}
                </div>
              )}

              <p className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--brand-sage)' }}>รายได้เพิ่มเติม (+)</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--brand-text)' }}>คอมสินค้า (฿)</label>
                  <input type="number" min="0" value={extrasModal.product_commission}
                    onChange={e => setExtrasModal(v => ({ ...v, product_commission: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ border: '1.5px solid var(--brand-beige)', background: 'white' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--brand-text)' }}>มาทำงานวันหยุด (฿)</label>
                  <input type="number" min="0" value={extrasModal.holiday_pay}
                    onChange={e => setExtrasModal(v => ({ ...v, holiday_pay: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ border: '1.5px solid var(--brand-beige)', background: 'white' }} />
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--brand-beige)' }} />

              <p className="text-xs font-semibold tracking-wider uppercase text-red-500">รายหัก (-)</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--brand-text)' }}>ประกันสังคม (฿)</label>
                  <input type="number" min="0" value={extrasModal.social_security}
                    onChange={e => setExtrasModal(v => ({ ...v, social_security: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ border: '1.5px solid var(--brand-beige)', background: 'white' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--brand-text)' }}>ขาดงาน (฿)</label>
                  <input type="number" min="0" value={extrasModal.absent_deduction}
                    onChange={e => setExtrasModal(v => ({ ...v, absent_deduction: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ border: '1.5px solid var(--brand-beige)', background: 'white' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--brand-text)' }}>หมายเหตุ</label>
                  <input type="text" value={extrasModal.note}
                    onChange={e => setExtrasModal(v => ({ ...v, note: e.target.value }))}
                    placeholder="ไม่บังคับ"
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ border: '1.5px solid var(--brand-beige)', background: 'white' }} />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid var(--brand-beige)' }}>
              <button onClick={() => setExtrasModal(null)}
                className="flex-1 py-2 rounded-xl text-sm"
                style={{ background: 'var(--brand-beige)', color: 'var(--brand-text)' }}>ยกเลิก</button>
              <button onClick={saveExtras} disabled={extrasSaving}
                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'var(--brand-sage)' }}>
                {extrasSaving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
