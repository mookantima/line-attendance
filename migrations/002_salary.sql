-- Add salary fields to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS salary_type VARCHAR(10) DEFAULT 'monthly'
    CHECK (salary_type IN ('daily', 'monthly')),
  ADD COLUMN IF NOT EXISTS salary_amount NUMERIC(10,2) DEFAULT 0;

-- Commission table (one row per employee per month)
CREATE TABLE IF NOT EXISTS commissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  sales_amount NUMERIC(12,2) DEFAULT 0,
  commission_amount NUMERIC(10,2) DEFAULT 0,
  note TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_commissions_user_ym ON commissions(user_id, year, month);
