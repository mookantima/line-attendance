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
    <div className="min-h-screen flex items-center justify-center bg-slate-800">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-96">
        <h1 className="text-2xl font-bold text-center mb-2 text-slate-800">ระบบลงเวลางาน</h1>
        <p className="text-center text-slate-500 mb-8 text-sm">Dashboard สำหรับผู้จัดการ</p>
        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            placeholder="รหัสผ่าน"
            value={pass}
            onChange={e => setPass(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {err && <p className="text-red-500 text-sm">{err}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
          >
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
      <main className="flex-1 p-6 overflow-auto">
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
