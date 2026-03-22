-- Add practice_mode to practitioners table
-- Values: 'both', 'humans', 'animals'
-- Default 'both' so existing practitioners see both options
ALTER TABLE practitioners
ADD COLUMN IF NOT EXISTS practice_mode text NOT NULL DEFAULT 'both'
CHECK (practice_mode IN ('both', 'humans', 'animals'));
