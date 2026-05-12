CREATE TABLE IF NOT EXISTS payroll_extras (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  product_commission NUMERIC(10,2) DEFAULT 0,
  holiday_pay NUMERIC(10,2) DEFAULT 0,
  social_security NUMERIC(10,2) DEFAULT 0,
  absent_deduction NUMERIC(10,2) DEFAULT 0,
  note TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);
