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
      <div className="flex flex-col items-center px-6 pt-8 pb-6"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Leaf emblem */}
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mb-3">
          <ellipse cx="24" cy="24" rx="22" ry="22"
            fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
          <path d="M24 8 C14 16, 12 28, 24 38 C36 28, 34 16, 24 8Z"
            fill="none" stroke="#c8d4b0" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M24 8 L24 38" stroke="#c8d4b0" strokeWidth="1" strokeDasharray="2 2"/>
          <path d="M16 22 Q24 18 32 22" stroke="#c8d4b0" strokeWidth="1" fill="none"/>
          <path d="M15 28 Q24 24 33 28" stroke="#c8d4b0" strokeWidth="1" fill="none"/>
        </svg>
        <p className="font-light tracking-[0.2em] text-xs uppercase"
          style={{ color: '#c8d4b0', letterSpacing: '0.25em' }}>Olivia</p>
        <p className="text-xs tracking-widest mt-0.5"
          style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, letterSpacing: '0.3em' }}>
          NAILS SPA
        </p>
        <div className="mt-3 text-center">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
            Admin Dashboard
          </p>
        </div>
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
