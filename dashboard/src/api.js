const BASE = '/api';
let password = localStorage.getItem('dashboard_pass') || '';

export function setPassword(p) {
  password = p;
  localStorage.setItem('dashboard_pass', p);
}

async function get(path) {
  const res = await fetch(BASE + path, {
    headers: { 'x-dashboard-password': password },
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function put(path, body) {
  const res = await fetch(BASE + path, {
    method: 'PUT',
    headers: { 'x-dashboard-password': password, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  return res.json();
}

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'x-dashboard-password': password, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  return res.json();
}

async function uploadFile(path, formData) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'x-dashboard-password': password },
    body: formData,
  });
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  return res.json();
}

export const api = {
  summary: () => get('/summary'),
  today: () => get('/today'),
  attendance: (year, month) => get(`/attendance?year=${year}&month=${month}`),
  employees: () => get('/employees'),
  leaves: (year, month) => get(`/leaves?year=${year}&month=${month}`),
  leaveBalance: (year) => get(`/leave-balance?year=${year}`),
  payroll: (year, month) => get(`/payroll?year=${year}&month=${month}`),

  // Employee profile
  updateEmployee: (id, data) => put(`/employees/${id}`, data),
  employeeAttendance: (id, year, month) => get(`/attendance/employee/${id}?year=${year}&month=${month}`),
  manualAttendance: (data) => post('/attendance/manual', data),

  // Salary & commission
  salaryEmployees: () => get('/salary/employees'),
  updateSalary: (id, data) => put(`/salary/employees/${id}`, data),
  commission: (year, month) => get(`/salary/commission?year=${year}&month=${month}`),
  saveCommission: (data) => post('/salary/commission/manual', data),
  uploadCommission: (formData) => uploadFile('/salary/commission/upload', formData),
  commissionTemplate: () => `${BASE}/salary/commission/template`,
};
