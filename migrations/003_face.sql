-- Add reference photo for face verification
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reference_photo TEXT;

-- Table to log face verification failures
CREATE TABLE IF NOT EXISTS face_alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  photo_url TEXT NOT NULL,
  confidence NUMERIC(5,2),
  action VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
