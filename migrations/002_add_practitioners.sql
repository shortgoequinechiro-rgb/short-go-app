-- =====================================================
-- MIGRATION 002: Add practitioners table for billing
-- Run this in Supabase SQL Editor (postgres role)
-- Drew's user ID: 7e8c5527-8235-4fbd-99f2-ad6faa73d9bd
-- =====================================================

-- STEP 1: Create practitioners table
CREATE TABLE IF NOT EXISTS practitioners (
  id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               text,
  full_name           text,
  stripe_customer_id  text UNIQUE,
  subscription_status text NOT NULL DEFAULT 'trialing',
  -- status values: trialing | active | past_due | canceled | incomplete
  subscription_id     text,
  trial_ends_at       timestamptz DEFAULT (now() + interval '14 days'),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- STEP 2: Enable RLS
ALTER TABLE practitioners ENABLE ROW LEVEL SECURITY;

-- STEP 3: Practitioners can read their own record (for client-side billing check)
CREATE POLICY "practitioners_read_own"
  ON practitioners FOR SELECT
  USING (id = auth.uid());

-- Note: INSERT and UPDATE are done exclusively via API routes using the
-- service role key, which bypasses RLS. No client-side insert policies needed.

-- STEP 4: Backfill Drew as permanently active (grandfathered founder account)
INSERT INTO practitioners (id, subscription_status, trial_ends_at)
VALUES ('7e8c5527-8235-4fbd-99f2-ad6faa73d9bd', 'active', NULL)
ON CONFLICT (id) DO UPDATE
  SET subscription_status = 'active',
      trial_ends_at = NULL,
      updated_at = now();
