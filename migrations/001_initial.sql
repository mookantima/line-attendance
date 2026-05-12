-- Line Attendance System - Initial Schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  line_user_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'employee' CHECK (role IN ('employee', 'manager', 'admin')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  work_date DATE NOT NULL,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  check_in_photo TEXT,
  check_out_photo TEXT,
  check_in_lat NUMERIC(10,7),
  check_in_lng NUMERIC(10,7),
  check_out_lat NUMERIC(10,7),
  check_out_lng NUMERIC(10,7),
  late_minutes INTEGER DEFAULT 0,
  ot_minutes INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present', 'absent', 'leave', 'holiday')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, work_date)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  leave_type VARCHAR(20) NOT NULL CHECK (leave_type IN ('personal', 'annual')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INTEGER NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_balance (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  year INTEGER NOT NULL,
  personal_total INTEGER DEFAULT 5,
  personal_used INTEGER DEFAULT 0,
  annual_total INTEGER DEFAULT 0,
  annual_used INTEGER DEFAULT 0,
  UNIQUE(user_id, year)
);

CREATE TABLE IF NOT EXISTS user_sessions (
  line_user_id VARCHAR(100) PRIMARY KEY,
  state VARCHAR(50) DEFAULT 'idle',
  data JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(work_date);
CREATE INDEX IF NOT EXISTS idx_leave_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);
