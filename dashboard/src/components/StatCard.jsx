import React from 'react';

const styles = {
  sage:   { background: 'rgba(107,124,82,0.1)',  border: '1px solid rgba(107,124,82,0.25)', color: '#4e5e3a' },
  green:  { background: 'rgba(74,140,74,0.08)',  border: '1px solid rgba(74,140,74,0.2)',   color: '#2d6a2d' },
  red:    { background: 'rgba(185,60,60,0.08)',  border: '1px solid rgba(185,60,60,0.2)',   color: '#8b2020' },
  amber:  { background: 'rgba(180,130,40,0.08)', border: '1px solid rgba(180,130,40,0.2)',  color: '#7a5a10' },
  cream:  { background: 'white',                  border: '1px solid var(--brand-beige)',    color: 'var(--brand-text)' },
  blue:   { background: 'rgba(107,124,82,0.1)',  border: '1px solid rgba(107,124,82,0.25)', color: '#4e5e3a' },
};

export default function StatCard({ label, value, sub, color = 'sage', icon }) {
  const s = styles[color] || styles.sage;
  return (
    <div className="rounded-2xl p-5" style={s}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide uppercase opacity-70">{label}</p>
          <p className="text-3xl font-bold mt-1">{value ?? '—'}</p>
          {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
        </div>
        {icon && <span className="text-2xl opacity-60">{icon}</span>}
      </div>
    </div>
  );
}
