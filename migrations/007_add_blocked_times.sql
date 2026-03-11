-- Blocked time slots: prevent scheduling during specific times
CREATE TABLE IF NOT EXISTS blocked_times (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  practitioner_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  block_date       date NOT NULL,
  start_time       time NOT NULL,
  end_time         time NOT NULL,
  label            text,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blocked_times_date ON blocked_times (block_date);
CREATE INDEX IF NOT EXISTS idx_blocked_times_practitioner ON blocked_times (practitioner_id);

-- RLS
ALTER TABLE blocked_times ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practitioner_own_blocked_times"
  ON blocked_times FOR ALL
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());
