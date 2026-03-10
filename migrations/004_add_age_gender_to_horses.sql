-- STEP: Add age and gender columns to the horses table
ALTER TABLE horses ADD COLUMN IF NOT EXISTS age text;
ALTER TABLE horses ADD COLUMN IF NOT EXISTS gender text;
