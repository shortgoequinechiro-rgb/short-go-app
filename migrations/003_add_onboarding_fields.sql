-- =====================================================
-- MIGRATION 003: Add practice profile & onboarding fields
-- Run this in Supabase SQL Editor (postgres role)
-- Drew's user ID: 7e8c5527-8235-4fbd-99f2-ad6faa73d9bd
-- =====================================================

-- STEP 1: Add practice profile columns to practitioners
ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS practice_name     text,
  ADD COLUMN IF NOT EXISTS animals_served    text DEFAULT 'both',
  -- animals_served values: 'horses' | 'dogs' | 'both'
  ADD COLUMN IF NOT EXISTS location          text,
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;

-- STEP 2: Mark Drew as already onboarded (pre-existing account)
UPDATE practitioners
SET
  onboarding_complete = true,
  practice_name       = 'Short-Go Equine Chiropractic',
  full_name           = 'Dr. Andrew Leo',
  animals_served      = 'both',
  updated_at          = now()
WHERE id = '7e8c5527-8235-4fbd-99f2-ad6faa73d9bd';
