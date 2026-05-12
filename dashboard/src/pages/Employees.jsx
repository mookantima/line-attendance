import React, { useEffect, useState } from 'react';
import { api } from '../api';

const SALARY_TYPE_LABEL = { daily: 'รายวัน', monthly: 'รายเดือน' };

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [editing, setEditing] = useState(null); // { id, salary_type, salary_amount }
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { api.salaryEmployees().then(setEmployees).catch(console.error); }, []);

  function startEdit(emp) {
    setEditing({ id: emp.id, salary_type: emp.salary_type || 'monthly', salary_amount: emp.salary_amount || 0 });
    setMsg('');
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const updated = await api.updateSalary(editing.id, {
        salary_type: editing.salary_type,
        salary_amount: parseFloat(editing.salary_amount),
      });
      setEmployees(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e));
      setEditing(null);
      setMsg('✅ บันทึกแล้ว');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg('❌ ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">ข้อมูลพนักงาน</h2>
        {msg && <span className="text-sm font-medium text-green-600">{msg}</span>}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {['ชื่อ', 'ตำแหน่ง', 'วันที่เริ่มงาน', 'ประเภทเงินเดือน', 'ฐานเงินเดือน', 'จัดการ'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map(emp => (
              <tr key={emp.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{emp.name}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    emp.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                    emp.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>{emp.role}</span>
                </td>
                <td className="px-4 py-3 text-slate-500">{String(emp.start_date).slice(0, 10)}</td>
                <td className="px-4 py-3">
                  {editing?.id === emp.id ? (
                    <select
                      value={editing.salary_type}
                      onChange={e => setEditing(v => ({ ...v, salary_type: e.target.value }))}
                      className="border border-slate-300 rounded-lg px-2 py-1 text-sm"
                    >
                      <option value="monthly">รายเดือน</option>
                      <option value="daily">รายวัน</option>
                    </select>
                  ) : (
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      emp.salary_type === 'daily' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                    }`}>{SALARY_TYPE_LABEL[emp.salary_type] || 'รายเดือน'}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editing?.id === emp.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editing.salary_amount}
                        onChange={e => setEditing(v => ({ ...v, salary_amount: e.target.value }))}
                        className="border border-slate-300 rounded-lg px-2 py-1 text-sm w-28"
                        min="0"
                      />
                      <span className="text-slate-400 text-xs">
                        {editing.salary_type === 'daily' ? 'บาท/วัน' : 'บาท/เดือน'}
                      </span>
                    </div>
                  ) : (
                    <span className="font-medium text-slate-800">
                      {emp.salary_amount > 0
                        ? `฿${Number(emp.salary_amount).toLocaleString()} / ${emp.salary_type === 'daily' ? 'วัน' : 'เดือน'}`
                        : <span className="text-red-400 text-xs">ยังไม่ได้ตั้งค่า</span>}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editing?.id === emp.id ? (
                    <div className="flex gap-2">
                      <button onClick={saveEdit} disabled={saving}
                        className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50">
                        {saving ? '...' : 'บันทึก'}
                      </button>
                      <button onClick={() => setEditing(null)}
                        className="bg-slate-200 text-slate-600 px-3 py-1 rounded-lg text-xs font-semibold hover:bg-slate-300">
                        ยกเลิก
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(emp)}
                      className="text-blue-600 hover:text-blue-800 text-xs font-semibold underline">
                      แก้ไขเงินเดือน
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
