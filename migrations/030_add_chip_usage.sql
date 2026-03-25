-- Track quick-add chip usage frequency per practitioner
-- Used to sort chips by most-used-first on the visit page
CREATE TABLE IF NOT EXISTS chip_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  practitioner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chip_id text NOT NULL,
  use_count integer NOT NULL DEFAULT 1,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (practitioner_id, chip_id)
);

-- Fast lookup by practitioner
CREATE INDEX idx_chip_usage_practitioner ON chip_usage(practitioner_id);

-- Enable RLS
ALTER TABLE chip_usage ENABLE ROW LEVEL SECURITY;

-- Practitioners can only see/modify their own chip usage
CREATE POLICY "Users can view own chip usage"
  ON chip_usage FOR SELECT
  USING (auth.uid() = practitioner_id);

CREATE POLICY "Users can insert own chip usage"
  ON chip_usage FOR INSERT
  WITH CHECK (auth.uid() = practitioner_id);

CREATE POLICY "Users can update own chip usage"
  ON chip_usage FOR UPDATE
  USING (auth.uid() = practitioner_id);
