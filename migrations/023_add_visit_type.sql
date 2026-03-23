-- Add visit_type column to visits table
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS visit_type text
    CHECK (visit_type IN ('initial', 'follow_up', 'maintenance'));
