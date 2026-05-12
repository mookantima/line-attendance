import React from 'react';
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'ภาพรวม', icon: '📊' },
  { to: '/attendance', label: 'การลงเวลา', icon: '🕐' },
  { to: '/leave', label: 'การลางาน', icon: '📅' },
  { to: '/payroll', label: 'สรุปเงินเดือน', icon: '💰' },
  { to: '/employees', label: 'พนักงาน / เงินเดือน', icon: '👥' },
];

export default function Sidebar({ onLogout }) {
  return (
    <aside className="w-56 bg-slate-800 text-white flex flex-col shrink-0">
      <div className="px-6 py-5 border-b border-slate-700">
        <h1 className="font-bold text-lg leading-tight">ระบบลงเวลา</h1>
        <p className="text-slate-400 text-xs mt-1">Admin Dashboard</p>
      </div>
      <nav className="flex-1 py-4 space-y-1 px-3">
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700'
              }`
            }
          >
            <span>{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700">
        <button
          onClick={onLogout}
          className="w-full text-slate-400 hover:text-white text-sm py-2 hover:bg-slate-700 rounded-lg transition"
        >
          ออกจากระบบ
        </button>
      </div>
    </aside>
  );
}
