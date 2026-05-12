import React, { useEffect, useState } from 'react';
import { api } from '../api';

const card = { background: 'white', border: '1px solid var(--brand-beige)', borderRadius: 16 };
const thHead = { background: '#f7f3ed', color: 'var(--brand-sage)' };

export default function Settings() {
  const [radius, setRadius] = useState('');
  const [radiusInput, setRadiusInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.settings()
      .then(s => {
        const r = s.store_radius_m || '10000';
        setRadius(r);
        setRadiusInput(r);
      })
      .catch(e => setMsg({ ok: false, text: e.message }))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    const val = parseInt(radiusInput);
    if (!val || val < 50) { setMsg({ ok: false, text: 'รัศมีต้องมากกว่า 50 เมตร' }); return; }
    setSaving(true);
    setMsg(null);
    try {
      const updated = await api.saveSettings({ store_radius_m: val });
      setRadius(updated.store_radius_m);
      setRadiusInput(updated.store_radius_m);
      setMsg({ ok: true, text: 'บันทึกการตั้งค่าแล้ว' });
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  }

  const radiusKm = (parseInt(radius) / 1000).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold" style={{ color: 'var(--brand-dark)' }}>ตั้งค่าระบบ</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--brand-light)' }}>กำหนดค่าพารามิเตอร์การทำงานของระบบ</p>
      </div>

      <div style={{ height: 1, background: 'var(--brand-beige)' }} />

      {/* GPS Radius */}
      <div style={card} className="overflow-hidden">
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--brand-beige)' }}>
          <h3 className="font-semibold text-sm tracking-wide" style={{ color: 'var(--brand-dark)' }}>
            ◎ รัศมีการลงเวลา
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--brand-light)' }}>
            พนักงานต้องอยู่ภายในรัศมีนี้จากตำแหน่งร้านจึงจะลงเวลาได้
          </p>
        </div>

        <div className="px-6 py-6 space-y-5">
          {loading ? (
            <p className="text-sm" style={{ color: 'var(--brand-light)' }}>กำลังโหลด...</p>
          ) : (
            <>
              {/* Current value display */}
              <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(107,124,82,0.06)', border: '1px solid rgba(107,124,82,0.15)' }}>
                <div className="text-3xl font-bold" style={{ color: 'var(--brand-sage)' }}>
                  {parseInt(radius).toLocaleString()}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--brand-dark)' }}>เมตร</p>
                  <p className="text-xs" style={{ color: 'var(--brand-light)' }}>= {radiusKm} กิโลเมตร</p>
                </div>
              </div>

              {/* Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium" style={{ color: 'var(--brand-dark)' }}>
                  ปรับรัศมี (เมตร)
                </label>
                <div className="flex gap-3 items-start">
                  <div className="flex-1 space-y-2">
                    <input
                      type="number"
                      value={radiusInput}
                      onChange={e => setRadiusInput(e.target.value)}
                      min="50"
                      max="100000"
                      step="100"
                      className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none"
                      style={{ borderColor: 'var(--brand-beige)', color: 'var(--brand-dark)' }}
                      placeholder="เช่น 10000"
                    />
                    <input
                      type="range"
                      value={radiusInput}
                      onChange={e => setRadiusInput(e.target.value)}
                      min="50"
                      max="50000"
                      step="50"
                      className="w-full accent-green-700"
                    />
                    <div className="flex justify-between text-xs" style={{ color: 'var(--brand-light)' }}>
                      <span>50 ม.</span>
                      <span>{parseInt(radiusInput || 0).toLocaleString()} ม. ({(parseInt(radiusInput || 0) / 1000).toFixed(2)} กม.)</span>
                      <span>50 กม.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Presets */}
              <div className="space-y-2">
                <p className="text-xs font-medium" style={{ color: 'var(--brand-light)' }}>ค่าที่นิยมใช้</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '100 ม.', value: 100 },
                    { label: '500 ม.', value: 500 },
                    { label: '1 กม.', value: 1000 },
                    { label: '5 กม.', value: 5000 },
                    { label: '10 กม.', value: 10000 },
                  ].map(p => (
                    <button key={p.value}
                      onClick={() => setRadiusInput(String(p.value))}
                      className="px-3 py-1.5 text-xs rounded-lg border transition-all font-medium"
                      style={parseInt(radiusInput) === p.value
                        ? { background: 'var(--brand-sage)', color: '#fff', borderColor: 'var(--brand-sage)' }
                        : { background: 'white', color: 'var(--brand-mid)', borderColor: 'var(--brand-beige)' }
                      }>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              {msg && (
                <div className={`text-sm px-4 py-2.5 rounded-xl ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {msg.ok ? '✅' : '❌'} {msg.text}
                </div>
              )}

              {/* Save button */}
              <div className="flex justify-end">
                <button onClick={save} disabled={saving || String(radiusInput) === String(radius)}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
                  style={{ background: 'var(--brand-sage)' }}>
                  {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
