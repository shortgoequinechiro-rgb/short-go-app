-- =====================================================
-- MIGRATION 025: Add grace_period_ends_at to practitioners
-- Supports 7-day grace period after cancellation or payment failure
-- Run this in Supabase SQL Editor (postgres role)
-- =====================================================

ALTER TABLE practitioners
ADD COLUMN IF NOT EXISTS grace_period_ends_at timestamptz DEFAULT NULL;

-- Also update the default trial from 14 days to 7 days for new rows
ALTER TABLE practitioners
ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '7 days');
