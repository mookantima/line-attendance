import React, { useEffect, useState } from 'react';
import { api } from '../api';

const DAY_NAMES = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];
const DAY_FULL  = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
const MONTHS    = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function toThaiTime(utcStr) {
  if (!utcStr) return null;
  const d = new Date(new Date(utcStr).getTime() + 7 * 3600000);
  return d.toISOString().substr(11, 5);
}

function dateStr(d) { return new Date(d).toISOString().slice(0, 10); }

export default function Calendar() {
  const now = new Date(Date.now() + 7 * 3600000);
  const [year, setYear]   = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [dayModal, setDayModal] = useState(null);     // { date, dateStr }
  const [offModal, setOffModal] = useState(null);     // { emp }
  const [offSaving, setOffSaving] = useState(false);
  const [offMsg, setOffMsg] = useState(null);
  const [selectedEmp, setSelectedEmp] = useState('all');

  function load() {
    setLoading(true);
    api.calendar(year, month)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(load, [year, month]);

  // Build calendar grid
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay    = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const today       = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

  function getDayData(day) {
    if (!data) return {};
    const ds = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayOfWeek = new Date(ds).getDay();

    const attendance = data.attendance.filter(a => dateStr(a.work_date) === ds);
    const leaves = data.leaves.filter(l => ds >= dateStr(l.start_date) && ds <= dateStr(l.end_date));

    const empsWithStatus = data.employees
      .filter(e => selectedEmp === 'all' || e.id === parseInt(selectedEmp))
      .map(emp => {
        const att = attendance.find(a => a.user_id === emp.id);
        const leave = leaves.find(l => l.user_id === emp.id);
        const isOff = (emp.weekly_off || []).includes(dayOfWeek);
        return {
          ...emp,
          att, leave, isOff,
          status: att ? 'present' : leave ? 'leave' : isOff ? 'off' : ds <= today ? 'absent' : 'future',
        };
      });

    return { ds, dayOfWeek, empsWithStatus };
  }

  function statusColor(status) {
    if (status === 'present') return { bg: 'rgba(107,124,82,0.15)', dot: '#4e5e3a' };
    if (status === 'leave')   return { bg: 'rgba(180,130,40,0.12)', dot: '#7a5a10' };
    if (status === 'off')     return { bg: 'rgba(120,120,120,0.08)', dot: '#999' };
    if (status === 'absent')  return { bg: 'rgba(185,60,60,0.1)',  dot: '#8b2020' };
    return { bg: 'transparent', dot: '#ccc' };
  }

  async function saveWeeklyOff(emp, days) {
    setOffSaving(true);
    try {
      await api.setWeeklyOff(emp.id, days);
      setOffMsg({ ok: true, text: 'บันทึกสำเร็จ' });
      load();
      setTimeout(() => { setOffModal(null); setOffMsg(null); }, 800);
    } catch (e) {
      setOffMsg({ ok: false, text: e.message });
    } finally {
      setOffSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold" style={{ color: 'var(--brand-dark)' }}>ปฏิทินการเข้างาน</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}
            className="rounded-xl px-3 py-2 text-sm outline-none"
            style={{ border: '1.5px solid var(--brand-beige)', background: 'white' }}>
            <option value="all">พนักงานทุกคน</option>
            {data?.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select value={month} onChange={e => setMonth(+e.target.value)}
            className="rounded-xl px-3 py-2 text-sm outline-none"
            style={{ border: '1.5px solid var(--brand-beige)', background: 'white' }}>
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)}
            className="rounded-xl px-3 py-2 text-sm outline-none"
            style={{ border: '1.5px solid var(--brand-beige)', background: 'white' }}>
            {[2025,2026,2027].map(y => <option key={y}>{y}</option>)}
          </select>
          <button onClick={() => setOffModal({ mode: 'list' })}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: 'var(--brand-sage)' }}>
            ⚙ วันหยุดพนักงาน
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap text-xs">
        {[
          { label: 'มาทำงาน',  bg: 'rgba(107,124,82,0.15)', dot: '#4e5e3a' },
          { label: 'ลา',        bg: 'rgba(180,130,40,0.12)', dot: '#7a5a10' },
          { label: 'วันหยุด',   bg: 'rgba(120,120,120,0.08)', dot: '#999' },
          { label: 'ขาดงาน',   bg: 'rgba(185,60,60,0.1)',   dot: '#8b2020' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: l.dot }} />
            <span style={{ color: 'var(--brand-text)' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--brand-light)' }}>กำลังโหลด...</div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--brand-beige)' }}>
          {/* Day headers */}
          <div className="grid grid-cols-7">
            {DAY_NAMES.map((d, i) => (
              <div key={d} className="py-3 text-center text-xs font-semibold tracking-wide"
                style={{ background: 'var(--brand-dark)', color: i === 0 ? '#f8a' : i === 6 ? '#adf' : '#c8d4b0' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7">
            {/* Empty cells before month starts */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e${i}`} style={{ borderRight: '1px solid var(--brand-beige)', borderBottom: '1px solid var(--brand-beige)', minHeight: 90 }} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const { ds, dayOfWeek, empsWithStatus } = getDayData(day);
              const isToday = ds === today;
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

              return (
                <div key={day}
                  onClick={() => empsWithStatus?.length && setDayModal({ ds, day, empsWithStatus })}
                  className="cursor-pointer transition-colors hover:bg-stone-50"
                  style={{
                    borderRight: '1px solid var(--brand-beige)',
                    borderBottom: '1px solid var(--brand-beige)',
                    minHeight: 90, padding: 8,
                    background: isWeekend ? 'rgba(120,120,120,0.03)' : undefined,
                  }}>
                  {/* Date number */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full"
                      style={isToday
                        ? { background: 'var(--brand-sage)', color: 'white' }
                        : { color: isWeekend ? '#aaa' : 'var(--brand-dark)' }}>
                      {day}
                    </span>
                  </div>

                  {/* Employee dots */}
                  <div className="space-y-0.5">
                    {empsWithStatus?.slice(0, 4).map(emp => {
                      const { bg, dot } = statusColor(emp.status);
                      return (
                        <div key={emp.id} className="flex items-center gap-1 rounded px-1"
                          style={{ background: bg }}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
                          <span className="text-xs truncate" style={{ color: dot, fontSize: 10, maxWidth: 60 }}>
                            {emp.nickname || emp.name.split(' ')[0]}
                          </span>
                        </div>
                      );
                    })}
                    {empsWithStatus?.length > 4 && (
                      <div className="text-xs" style={{ color: 'var(--brand-light)', fontSize: 10 }}>
                        +{empsWithStatus.length - 4} คน
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day detail modal */}
      {dayModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col"
            style={{ background: 'var(--brand-cream)' }}>
            <div className="px-6 py-4 flex justify-between items-center"
              style={{ borderBottom: '1px solid var(--brand-beige)' }}>
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--brand-dark)' }}>
                  {dayModal.day} {MONTHS[month-1]} {year}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--brand-light)' }}>
                  {DAY_FULL[new Date(dayModal.ds).getDay()]}
                </p>
              </div>
              <button onClick={() => setDayModal(null)} style={{ color: 'var(--brand-light)' }} className="text-xl">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
              {dayModal.empsWithStatus.map(emp => {
                const { bg, dot } = statusColor(emp.status);
                const statusLabel = { present:'มาทำงาน', leave:'ลา', off:'วันหยุด', absent:'ขาดงาน', future:'ยังไม่ถึง' }[emp.status];
                return (
                  <div key={emp.id} className="rounded-xl px-4 py-3 flex items-center justify-between"
                    style={{ background: bg, border: `1px solid ${dot}30` }}>
                    <div>
                      <p className="font-medium text-sm" style={{ color: 'var(--brand-dark)' }}>{emp.name}</p>
                      {emp.att && (
                        <p className="text-xs mt-0.5" style={{ color: dot }}>
                          เข้า {toThaiTime(emp.att.check_in_time) || '—'} · ออก {toThaiTime(emp.att.check_out_time) || '—'}
                          {emp.att.late_minutes > 0 && ` · สาย ${emp.att.late_minutes} น.`}
                        </p>
                      )}
                      {emp.leave && (
                        <p className="text-xs mt-0.5" style={{ color: dot }}>
                          {emp.leave.leave_type === 'personal' ? 'ลากิจ' : 'ลาพักร้อน'}
                          {' · '}{emp.leave.status === 'pending' ? 'รออนุมัติ' : 'อนุมัติแล้ว'}
                        </p>
                      )}
                      {emp.isOff && !emp.att && !emp.leave && (
                        <p className="text-xs mt-0.5" style={{ color: dot }}>วันหยุดประจำสัปดาห์</p>
                      )}
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{ background: `${dot}20`, color: dot }}>
                      {statusLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Weekly off settings modal */}
      {offModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl shadow-xl w-full max-w-lg" style={{ background: 'var(--brand-cream)' }}>
            <div className="px-6 py-4 flex justify-between items-center"
              style={{ borderBottom: '1px solid var(--brand-beige)' }}>
              <h3 className="font-semibold" style={{ color: 'var(--brand-dark)' }}>⚙ ตั้งค่าวันหยุดประจำสัปดาห์</h3>
              <button onClick={() => { setOffModal(null); setOffMsg(null); }}
                style={{ color: 'var(--brand-light)' }} className="text-xl">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {offMsg && (
                <div className={`p-3 rounded-xl text-sm ${offMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {offMsg.ok ? '✅' : '❌'} {offMsg.text}
                </div>
              )}
              {data?.employees.map(emp => (
                <EmpOffRow key={emp.id} emp={emp} onSave={saveWeeklyOff} saving={offSaving} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmpOffRow({ emp, onSave, saving }) {
  const [selected, setSelected] = useState(emp.weekly_off || []);
  const [saved, setSaved] = useState(false);

  function toggle(d) {
    setSelected(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
    setSaved(false);
  }

  async function save() {
    await onSave(emp, selected);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="rounded-xl p-4" style={{ background: 'white', border: '1px solid var(--brand-beige)' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="font-medium text-sm" style={{ color: 'var(--brand-dark)' }}>
          {emp.name}{emp.nickname ? ` (${emp.nickname})` : ''}
        </p>
        <button onClick={save} disabled={saving}
          className="text-xs px-3 py-1 rounded-lg text-white font-medium"
          style={{ background: saved ? '#4a8a4a' : 'var(--brand-sage)' }}>
          {saved ? '✓ บันทึกแล้ว' : 'บันทึก'}
        </button>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {['อา','จ','อ','พ','พฤ','ศ','ส'].map((d, i) => (
          <button key={i} onClick={() => toggle(i)}
            className="w-9 h-9 rounded-full text-xs font-medium transition-all"
            style={selected.includes(i)
              ? { background: 'var(--brand-sage)', color: 'white' }
              : { background: 'var(--brand-beige)', color: 'var(--brand-text)' }}>
            {d}
          </button>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="text-xs mt-2" style={{ color: 'var(--brand-light)' }}>
          หยุด: {selected.sort().map(d => ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'][d]).join(', ')}
        </p>
      )}
    </div>
  );
}
