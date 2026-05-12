-- Allow sick leave type
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_leave_type_check
  CHECK (leave_type IN ('personal', 'annual', 'sick'));

-- Sick leave balance columns
ALTER TABLE leave_balance ADD COLUMN IF NOT EXISTS sick_total INTEGER DEFAULT 30;
ALTER TABLE leave_balance ADD COLUMN IF NOT EXISTS sick_used INTEGER DEFAULT 0;

-- Half-day support
ALTER TABLE leave_requests ALTER COLUMN days TYPE NUMERIC(5,1);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS half_day_period VARCHAR(10);
-- half_day_period: 'morning' | 'afternoon' | NULL (full day)
