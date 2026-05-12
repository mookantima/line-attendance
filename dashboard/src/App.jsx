import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Leave from './pages/Leave';
import Payroll from './pages/Payroll';
import Employees from './pages/Employees';
import { setPassword } from './api';

function Login({ onLogin }) {
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!pass) return;
    setPassword(pass);
    onLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--brand-dark)' }}>
      {/* Background leaf pattern */}
      <div className="absolute inset-0 overflow-hidden opacity-5 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <svg key={i} width="200" height="200" viewBox="0 0 48 48"
            style={{ position: 'absolute', top: `${[10,50,70,20,60,40][i]}%`, left: `${[10,70,30,80,15,55][i]}%` }}>
            <path d="M24 4 C10 16, 8 32, 24 44 C40 32, 38 16, 24 4Z" fill="#c8d4b0"/>
          </svg>
        ))}
      </div>

      <div className="relative rounded-3xl shadow-2xl p-10 w-96"
        style={{ background: 'var(--brand-cream)' }}>
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/dashboard/logo.png" alt="Olivia Nails Spa"
            style={{ width: 140, objectFit: 'contain', marginBottom: 16 }} />
          <div className="w-12" style={{ height: 1, background: 'var(--brand-beige)' }}/>
          <p className="mt-3 text-xs" style={{ color: 'var(--brand-light)' }}>Admin Dashboard</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            placeholder="รหัสผ่าน"
            value={pass}
            onChange={e => setPass(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: 'white', border: '1.5px solid var(--brand-beige)',
              color: 'var(--brand-text)' }}
            onFocus={e => e.target.style.borderColor = 'var(--brand-sage)'}
            onBlur={e => e.target.style.borderColor = 'var(--brand-beige)'}
          />
          {err && <p className="text-red-500 text-sm">{err}</p>}
          <button type="submit"
            className="w-full font-medium py-3 rounded-xl text-sm text-white transition"
            style={{ background: 'var(--brand-sage)' }}
            onMouseEnter={e => e.target.style.background = 'var(--brand-mid)'}
            onMouseLeave={e => e.target.style.background = 'var(--brand-sage)'}>
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('dashboard_pass'));

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <div className="flex min-h-screen">
      <Sidebar onLogout={() => { localStorage.removeItem('dashboard_pass'); setAuthed(false); }} />
      <main className="flex-1 p-6 overflow-auto" style={{ background: 'var(--brand-cream)' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/leave" element={<Leave />} />
          <Route path="/payroll" element={<Payroll />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
