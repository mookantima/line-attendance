import React, { useEffect, useState } from 'react';
import { api } from '../api';

const BANKS = ['กสิกรไทย', 'กรุงเทพ', 'กรุงไทย', 'กรุงศรี', 'ไทยพาณิชย์', 'ทหารไทยธนชาต', 'ออมสิน', 'ธ.ก.ส.', 'ซีไอเอ็มบี', 'UOB', 'อื่นๆ'];

const fmt = n => Number(n || 0).toLocaleString('th-TH');

function thaiDate(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).slice(0, 10);
}

function toThaiTime(utcStr) {
  if (!utcStr) return '';
  const d = new Date(new Date(utcStr).getTime() + 7 * 3600000);
  return d.toISOString().substr(11, 5);
}

// Days of current month
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export default function Employees() {
  const now = new Date(Date.now() + 7 * 3600000);
  const [year] = useState(now.getUTCFullYear());
  const [month] = useState(now.getUTCMonth() + 1);
  const [employees, setEmployees] = useState([]);
  const [editEmp, setEditEmp] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // Create employee modal
  const [createModal, setCreateModal] = useState(false);
  const [newEmp, setNewEmp] = useState({ name: '', surname: '', nickname: '', salary_type: 'monthly', salary_amount: '', bank_name: '', bank_account: '' });
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null); // emp
  const [deleting, setDeleting] = useState(false);

  // Attendance modal
  const [attModal, setAttModal] = useState(null); // { emp }
  const [attRecords, setAttRecords] = useState([]);
  const [attLoading, setAttLoading] = useState(false);
  const [editAtt, setEditAtt] = useState(null); // { work_date, check_in, check_out, late, ot, note }
  const [attMsg, setAttMsg] = useState(null);
  const [addingNew, setAddingNew] = useState(false);

  const monthNames = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  function loadEmployees() {
    api.employees().then(setEmployees).catch(console.error);
  }

  useEffect(loadEmployees, []);

  function openCreateModal() {
    setNewEmp({ name: '', surname: '', nickname: '', salary_type: 'monthly', salary_amount: '', bank_name: '', bank_account: '' });
    setCreateMsg(null);
    setCreateModal(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteEmployee(deleteTarget.id);
      setEmployees(prev => prev.filter(e => e.id !== deleteTarget.id));
      setDeleteTarget(null);
      setMsg({ ok: true, text: `ลบพนักงาน "${deleteTarget.name}" แล้ว` });
      setTimeout(() => setMsg(null), 4000);
    } catch (e) {
      setMsg({ ok: false, text: e.message });
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  async function createEmployee() {
    if (!newEmp.name.trim()) { setCreateMsg({ ok: false, text: 'กรุณาระบุชื่อ' }); return; }
    setCreating(true);
    try {
      const created = await api.createEmployee(newEmp);
      setEmployees(prev => [...prev, created]);
      setCreateModal(false);
      setMsg({ ok: true, text: `เพิ่มพนักงาน "${created.name}" แล้ว รอให้พนักงานลงทะเบียนผ่าน LINE` });
      setTimeout(() => setMsg(null), 5000);
    } catch (e) {
      setCreateMsg({ ok: false, text: e.message });
    } finally {
      setCreating(false);
    }
  }

  function startEditEmp(emp) {
    setEditEmp({
      id: emp.id,
      name: emp.name || '',
      surname: emp.surname || '',
      nickname: emp.nickname || '',
      salary_type: emp.salary_type || 'monthly',
      salary_amount: emp.salary_amount || 0,
      bank_name: emp.bank_name || '',
      bank_account: emp.bank_account || '',
    });
    setMsg(null);
  }

  async function saveEmployee() {
    setSaving(true);
    try {
      const updated = await api.updateEmployee(editEmp.id, editEmp);
      setEmployees(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e));
      setEditEmp(null);
      setMsg({ ok: true, text: 'บันทึกข้อมูลพนักงานแล้ว' });
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  }

  // Attendance modal
  async function openAttModal(emp) {
    setAttModal({ emp });
    setAttMsg(null);
    setEditAtt(null);
    setAddingNew(false);
    setAttLoading(true);
    try {
      const records = await api.employeeAttendance(emp.id, year, month);
      setAttRecords(records);
    } catch (e) {
      setAttMsg({ ok: false, text: e.message });
    } finally {
      setAttLoading(false);
    }
  }

  function startEditAtt(rec) {
    setEditAtt({
      work_date: thaiDate(rec.work_date),
      check_in: toThaiTime(rec.check_in_time),
      check_out: toThaiTime(rec.check_out_time),
      late_minutes: rec.late_minutes ?? '',
      ot_minutes: rec.ot_minutes ?? '',
      note: rec.note || '',
    });
    setAddingNew(false);
    setAttMsg(null);
  }

  function startNewAtt() {
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    setEditAtt({ work_date: today, check_in: '10:00', check_out: '20:00', late_minutes: '', ot_minutes: '', note: '' });
    setAddingNew(true);
    setAttMsg(null);
  }

  async function saveAtt() {
    if (!editAtt || !attModal) return;
    setSaving(true);
    try {
      await api.manualAttendance({
        user_id: attModal.emp.id,
        work_date: editAtt.work_date,
        check_in_time: editAtt.check_in || null,
        check_out_time: editAtt.check_out || null,
        late_minutes: editAtt.late_minutes !== '' ? editAtt.late_minutes : null,
        ot_minutes: editAtt.ot_minutes !== '' ? editAtt.ot_minutes : null,
        note: editAtt.note || 'แก้ไขโดย admin',
      });
      const records = await api.employeeAttendance(attModal.emp.id, year, month);
      setAttRecords(records);
      setEditAtt(null);
      setAddingNew(false);
      setAttMsg({ ok: true, text: 'บันทึกสำเร็จ' });
    } catch (e) {
      setAttMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--brand-dark)' }}>ข้อมูลพนักงาน</h2>
        <div className="flex items-center gap-3">
          {msg && (
            <span className={`text-sm font-medium ${msg.ok ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</span>
          )}
          <button onClick={openCreateModal}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: 'var(--brand-sage)' }}>
            + เพิ่มพนักงาน
          </button>
        </div>
      </div>

      {/* Employee table */}
      <div className="bg-white rounded-xl overflow-x-auto" style={{ border: '1px solid var(--brand-beige)' }}>
        <table className="w-full text-sm">
          <thead style={{ background: '#f7f3ed', color: 'var(--brand-sage)', fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            <tr>
              {['ชื่อ-นามสกุล', 'ชื่อเล่น', 'LINE', 'ตำแหน่ง', 'ประเภทเงินเดือน', 'อัตรา', 'บัญชีธนาคาร', 'เอกสาร', 'จัดการ'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map(emp => (
              <tr key={emp.id} className="hover:bg-stone-50 transition-colors">
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--brand-dark)' }}>
                  {emp.name}{emp.surname ? ` ${emp.surname}` : ''}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--brand-text)' }}>{emp.nickname || '—'}</td>
                <td className="px-4 py-3">
                  {emp.line_user_id
                    ? <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: 'rgba(107,124,82,0.12)', color: 'var(--brand-sage)' }}>● เชื่อมแล้ว</span>
                    : <span className="text-xs px-2 py-1 rounded-full font-medium bg-amber-50 text-amber-600">รอลงทะเบียน</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    emp.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                    emp.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>{emp.role}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    emp.salary_type === 'daily' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                  }`}>{emp.salary_type === 'daily' ? 'รายวัน' : 'รายเดือน'}</span>
                </td>
                <td className="px-4 py-3 font-medium text-slate-700">
                  {emp.salary_amount > 0
                    ? `฿${fmt(emp.salary_amount)}/${emp.salary_type === 'daily' ? 'วัน' : 'เดือน'}`
                    : <span className="text-red-400 text-xs">ยังไม่ได้ตั้งค่า</span>}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {emp.bank_name && emp.bank_account
                    ? <span>{emp.bank_name}<br />{emp.bank_account}</span>
                    : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {emp.id_card_url
                      ? <a href={emp.id_card_url} target="_blank" rel="noreferrer"
                          className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-100 font-medium whitespace-nowrap">🪪 บัตร</a>
                      : <span className="text-xs text-slate-300">บัตร —</span>}
                    {emp.bank_book_url
                      ? <a href={emp.bank_book_url} target="_blank" rel="noreferrer"
                          className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg hover:bg-green-100 font-medium whitespace-nowrap">🏦 บัญชี</a>
                      : <span className="text-xs text-slate-300">บัญชี —</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => startEditEmp(emp)}
                      className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-100 font-medium">
                      แก้ไขข้อมูล
                    </button>
                    <button onClick={() => openAttModal(emp)}
                      className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-lg hover:bg-amber-100 font-medium">
                      เวลาทำงาน
                    </button>
                    {emp.line_user_id && (
                      <button onClick={async () => {
                        if (!confirm(`ยกเลิกการเชื่อม LINE ของ ${emp.name}?`)) return;
                        await api.unlinkLine(emp.id);
                        setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, line_user_id: false } : e));
                      }} className="text-xs bg-slate-50 text-slate-500 px-3 py-1 rounded-lg hover:bg-slate-100 font-medium whitespace-nowrap">
                        ยกเลิก LINE
                      </button>
                    )}
                    <button onClick={() => setDeleteTarget(emp)}
                      className="text-xs bg-red-50 text-red-600 px-3 py-1 rounded-lg hover:bg-red-100 font-medium">
                      ลบ
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit employee modal */}
      {editEmp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-lg">แก้ไขข้อมูลพนักงาน</h3>
              <button onClick={() => setEditEmp(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">ชื่อ</label>
                  <input value={editEmp.name} onChange={e => setEditEmp(v => ({ ...v, name: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">นามสกุล</label>
                  <input value={editEmp.surname} onChange={e => setEditEmp(v => ({ ...v, surname: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ชื่อเล่น</label>
                <input value={editEmp.nickname} onChange={e => setEditEmp(v => ({ ...v, nickname: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">ประเภทเงินเดือน</label>
                  <select value={editEmp.salary_type} onChange={e => setEditEmp(v => ({ ...v, salary_type: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="monthly">รายเดือน</option>
                    <option value="daily">รายวัน</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    อัตรา ({editEmp.salary_type === 'daily' ? '฿/วัน' : '฿/เดือน'})
                  </label>
                  <input type="number" value={editEmp.salary_amount}
                    onChange={e => setEditEmp(v => ({ ...v, salary_amount: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" min="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">ธนาคาร</label>
                  <select value={editEmp.bank_name} onChange={e => setEditEmp(v => ({ ...v, bank_name: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">เลือกธนาคาร</option>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">เลขบัญชี</label>
                  <input value={editEmp.bank_account} onChange={e => setEditEmp(v => ({ ...v, bank_account: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="xxx-x-xxxxx-x" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setEditEmp(null)}
                className="px-4 py-2 text-sm rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">ยกเลิก</button>
              <button onClick={saveEmployee} disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold disabled:opacity-50">
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-5 text-center space-y-3">
              <div className="text-4xl">⚠️</div>
              <h3 className="font-bold text-lg" style={{ color: 'var(--brand-dark)' }}>ยืนยันการลบพนักงาน</h3>
              <p className="text-sm" style={{ color: 'var(--brand-text)' }}>
                ลบ <span className="font-semibold">{deleteTarget.name}{deleteTarget.surname ? ` ${deleteTarget.surname}` : ''}</span> ออกจากระบบ?
              </p>
              <p className="text-xs text-slate-400">ข้อมูลการลงเวลาและเงินเดือนจะยังคงอยู่ในฐานข้อมูล</p>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 text-sm rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium">
                ยกเลิก
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="flex-1 py-2 text-sm rounded-xl bg-red-600 text-white hover:bg-red-700 font-semibold disabled:opacity-50">
                {deleting ? 'กำลังลบ...' : 'ลบพนักงาน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create employee modal */}
      {createModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--brand-beige)' }}>
              <h3 className="font-bold text-lg" style={{ color: 'var(--brand-dark)' }}>เพิ่มพนักงานใหม่</h3>
              <button onClick={() => setCreateModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(107,124,82,0.08)', color: 'var(--brand-sage)' }}>
                พนักงานที่เพิ่มไว้จะสามารถลงทะเบียนผ่าน LINE ด้วยการพิมพ์ชื่อ-นามสกุล ระบบจะเชื่อมโดยอัตโนมัติ
              </p>
              {createMsg && (
                <div className={`text-sm px-3 py-2 rounded-lg ${createMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {createMsg.text}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">ชื่อ *</label>
                  <input value={newEmp.name} onChange={e => setNewEmp(v => ({ ...v, name: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="ชื่อ" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">นามสกุล</label>
                  <input value={newEmp.surname} onChange={e => setNewEmp(v => ({ ...v, surname: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="นามสกุล" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ชื่อเล่น</label>
                <input value={newEmp.nickname} onChange={e => setNewEmp(v => ({ ...v, nickname: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="ชื่อเล่น" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">ประเภทเงินเดือน</label>
                  <select value={newEmp.salary_type} onChange={e => setNewEmp(v => ({ ...v, salary_type: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="monthly">รายเดือน</option>
                    <option value="daily">รายวัน</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    อัตรา ({newEmp.salary_type === 'daily' ? '฿/วัน' : '฿/เดือน'})
                  </label>
                  <input type="number" value={newEmp.salary_amount} min="0"
                    onChange={e => setNewEmp(v => ({ ...v, salary_amount: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">ธนาคาร</label>
                  <select value={newEmp.bank_name} onChange={e => setNewEmp(v => ({ ...v, bank_name: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">เลือกธนาคาร</option>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">เลขบัญชี</label>
                  <input value={newEmp.bank_account} onChange={e => setNewEmp(v => ({ ...v, bank_account: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="xxx-x-xxxxx-x" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--brand-beige)' }}>
              <button onClick={() => setCreateModal(false)}
                className="px-4 py-2 text-sm rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">ยกเลิก</button>
              <button onClick={createEmployee} disabled={creating}
                className="px-4 py-2 text-sm rounded-lg font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--brand-sage)' }}>
                {creating ? 'กำลังเพิ่ม...' : 'เพิ่มพนักงาน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance modal */}
      {attModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">
                  เวลาทำงาน — {attModal.emp.name}
                </h3>
                <p className="text-xs text-slate-400">{monthNames[month]} {year}</p>
              </div>
              <button onClick={() => { setAttModal(null); setEditAtt(null); }} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {attMsg && (
                <div className={`p-3 rounded-lg text-sm ${attMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {attMsg.ok ? '✅' : '❌'} {attMsg.text}
                </div>
              )}

              {/* Add new row */}
              <button onClick={startNewAtt}
                className="w-full py-2 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50">
                + เพิ่มวันทำงานใหม่
              </button>

              {/* New/edit form */}
              {editAtt && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-blue-800">
                    {addingNew ? '➕ เพิ่มวันทำงาน' : '✏️ แก้ไขวันทำงาน'}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">วันที่</label>
                      <input type="date" value={editAtt.work_date}
                        onChange={e => setEditAtt(v => ({ ...v, work_date: e.target.value }))}
                        max={new Date(Date.now() + 7*3600000).toISOString().slice(0,10)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">หมายเหตุ</label>
                      <input value={editAtt.note} onChange={e => setEditAtt(v => ({ ...v, note: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="แก้ไขโดย admin" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">เวลาเข้างาน</label>
                      <input type="time" value={editAtt.check_in}
                        onChange={e => setEditAtt(v => ({ ...v, check_in: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">เวลาออกงาน</label>
                      <input type="time" value={editAtt.check_out}
                        onChange={e => setEditAtt(v => ({ ...v, check_out: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        สาย (นาที) <span className="text-slate-400 font-normal">— เว้นว่างให้คำนวณอัตโนมัติ</span>
                      </label>
                      <input type="number" value={editAtt.late_minutes} min="0"
                        onChange={e => setEditAtt(v => ({ ...v, late_minutes: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="อัตโนมัติ" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        OT (นาที) <span className="text-slate-400 font-normal">— เว้นว่างให้คำนวณอัตโนมัติ</span>
                      </label>
                      <input type="number" value={editAtt.ot_minutes} min="0"
                        onChange={e => setEditAtt(v => ({ ...v, ot_minutes: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="อัตโนมัติ" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setEditAtt(null); setAddingNew(false); }}
                      className="px-4 py-2 text-sm rounded-lg bg-white border border-slate-300 text-slate-600 hover:bg-slate-50">ยกเลิก</button>
                    <button onClick={saveAtt} disabled={saving}
                      className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold disabled:opacity-50">
                      {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                  </div>
                </div>
              )}

              {/* Records list */}
              {attLoading ? (
                <p className="text-center text-slate-400 py-6">กำลังโหลด...</p>
              ) : attRecords.length === 0 && !editAtt ? (
                <p className="text-center text-slate-400 py-6">ไม่มีข้อมูลการลงเวลาเดือนนี้</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      {['วันที่', 'เข้างาน', 'ออกงาน', 'สาย', 'OT', 'หมายเหตุ', ''].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attRecords.map(rec => (
                      <tr key={rec.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium">{thaiDate(rec.work_date)}</td>
                        <td className="px-3 py-2">{toThaiTime(rec.check_in_time) || '—'}</td>
                        <td className="px-3 py-2">{toThaiTime(rec.check_out_time) || '—'}</td>
                        <td className="px-3 py-2">
                          {rec.late_minutes > 0
                            ? <span className="text-red-600 font-medium">{rec.late_minutes} นาที</span>
                            : <span className="text-green-600">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          {rec.ot_minutes > 0
                            ? <span className="text-indigo-600 font-medium">{rec.ot_minutes} นาที</span>
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-400 text-xs max-w-[120px] truncate">{rec.note || '—'}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => startEditAtt(rec)}
                            className="text-xs text-blue-600 underline hover:text-blue-800">แก้ไข</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
