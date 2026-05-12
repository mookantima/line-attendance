import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/',           label: 'ภาพรวม',           icon: '◈' },
  { to: '/attendance', label: 'การลงเวลา',         icon: '◷' },
  { to: '/leave',      label: 'การลางาน',          icon: '◻' },
  { to: '/payroll',    label: 'สรุปเงินเดือน',     icon: '◈' },
  { to: '/employees',  label: 'พนักงาน / เงินเดือน', icon: '◉' },
];

export default function Sidebar({ onLogout }) {
  return (
    <aside style={{ background: 'var(--brand-dark)', width: 220 }}
      className="flex flex-col shrink-0 min-h-screen">

      {/* Logo */}
      <div className="flex flex-col items-center px-6 pt-7 pb-5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <img src="/dashboard/logo.png" alt="Olivia Nails Spa"
          style={{ width: 120, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.92 }} />
        <p className="mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: '0.15em' }}>
          Admin Dashboard
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-5 px-3 space-y-0.5">
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ${
                isActive ? 'active-nav' : 'inactive-nav'
              }`
            }
            style={({ isActive }) => isActive
              ? { background: 'var(--brand-sage)', color: '#fff', fontWeight: 500 }
              : { color: 'rgba(255,255,255,0.5)' }
            }
          >
            <span style={{ fontSize: 14, opacity: 0.8 }}>{l.icon}</span>
            <span className="tracking-wide text-xs font-medium"
              style={{ letterSpacing: '0.05em' }}>{l.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="text-center mb-3">
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, letterSpacing: '0.15em' }}>
            OLIVIA NAILS SPA © 2026
          </p>
        </div>
        <button onClick={onLogout}
          className="w-full text-xs py-2 rounded-xl transition"
          style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.05)' }}
          onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.05)'}>
          ออกจากระบบ
        </button>
      </div>
    </aside>
  );
}
