-- =====================================================
-- MIGRATION 001: Add multi-tenancy to stride-app
-- Run this once in Supabase SQL Editor (postgres role)
-- Drew's user ID: 7e8c5527-8235-4fbd-99f2-ad6faa73d9bd
-- =====================================================

-- STEP 1: Add practitioner_id to every table
ALTER TABLE owners               ADD COLUMN IF NOT EXISTS practitioner_id uuid REFERENCES auth.users(id);
ALTER TABLE horses               ADD COLUMN IF NOT EXISTS practitioner_id uuid REFERENCES auth.users(id);
ALTER TABLE visits               ADD COLUMN IF NOT EXISTS practitioner_id uuid REFERENCES auth.users(id);
ALTER TABLE appointments         ADD COLUMN IF NOT EXISTS practitioner_id uuid REFERENCES auth.users(id);
ALTER TABLE photos               ADD COLUMN IF NOT EXISTS practitioner_id uuid REFERENCES auth.users(id);
ALTER TABLE spine_assessments    ADD COLUMN IF NOT EXISTS practitioner_id uuid REFERENCES auth.users(id);
ALTER TABLE visit_anatomy_regions ADD COLUMN IF NOT EXISTS practitioner_id uuid REFERENCES auth.users(id);
ALTER TABLE consent_forms        ADD COLUMN IF NOT EXISTS practitioner_id uuid REFERENCES auth.users(id);
ALTER TABLE intake_forms         ADD COLUMN IF NOT EXISTS practitioner_id uuid REFERENCES auth.users(id);

-- STEP 2: Backfill all of Drew's existing data
UPDATE owners                SET practitioner_id = '7e8c5527-8235-4fbd-99f2-ad6faa73d9bd' WHERE practitioner_id IS NULL;
UPDATE horses                SET practitioner_id = '7e8c5527-8235-4fbd-99f2-ad6faa73d9bd' WHERE practitioner_id IS NULL;
UPDATE visits                SET practitioner_id = '7e8c5527-8235-4fbd-99f2-ad6faa73d9bd' WHERE practitioner_id IS NULL;
UPDATE appointments          SET practitioner_id = '7e8c5527-8235-4fbd-99f2-ad6faa73d9bd' WHERE practitioner_id IS NULL;
UPDATE photos                SET practitioner_id = '7e8c5527-8235-4fbd-99f2-ad6faa73d9bd' WHERE practitioner_id IS NULL;
UPDATE spine_assessments     SET practitioner_id = '7e8c5527-8235-4fbd-99f2-ad6faa73d9bd' WHERE practitioner_id IS NULL;
UPDATE visit_anatomy_regions SET practitioner_id = '7e8c5527-8235-4fbd-99f2-ad6faa73d9bd' WHERE practitioner_id IS NULL;
UPDATE consent_forms         SET practitioner_id = '7e8c5527-8235-4fbd-99f2-ad6faa73d9bd' WHERE practitioner_id IS NULL;
UPDATE intake_forms          SET practitioner_id = '7e8c5527-8235-4fbd-99f2-ad6faa73d9bd' WHERE practitioner_id IS NULL;

-- STEP 3: Enable Row Level Security on all tables
ALTER TABLE owners                ENABLE ROW LEVEL SECURITY;
ALTER TABLE horses                ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits                ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE spine_assessments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_anatomy_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_forms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_forms          ENABLE ROW LEVEL SECURITY;

-- STEP 4: RLS policies for core practitioner tables
-- Each practitioner can only see and modify their own data
CREATE POLICY "practitioner_own_owners"
  ON owners FOR ALL
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());

CREATE POLICY "practitioner_own_horses"
  ON horses FOR ALL
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());

CREATE POLICY "practitioner_own_visits"
  ON visits FOR ALL
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());

CREATE POLICY "practitioner_own_appointments"
  ON appointments FOR ALL
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());

CREATE POLICY "practitioner_own_photos"
  ON photos FOR ALL
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());

CREATE POLICY "practitioner_own_spine"
  ON spine_assessments FOR ALL
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());

CREATE POLICY "practitioner_own_anatomy"
  ON visit_anatomy_regions FOR ALL
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());

-- STEP 5: RLS policies for public-facing forms
-- consent_forms: practitioner manages, horse owner can read + sign
CREATE POLICY "practitioner_own_consent"
  ON consent_forms FOR ALL
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());

CREATE POLICY "public_read_consent"
  ON consent_forms FOR SELECT
  USING (true);

CREATE POLICY "public_update_consent"
  ON consent_forms FOR UPDATE
  USING (true) WITH CHECK (true);

-- intake_forms: practitioner manages, horse owner can read + submit
CREATE POLICY "practitioner_own_intake"
  ON intake_forms FOR ALL
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());

CREATE POLICY "public_read_intake"
  ON intake_forms FOR SELECT
  USING (true);

CREATE POLICY "public_insert_intake"
  ON intake_forms FOR INSERT
  WITH CHECK (true);

CREATE POLICY "public_update_intake"
  ON intake_forms FOR UPDATE
  USING (true) WITH CHECK (true);

-- Public SELECT on owners + horses so intake/consent form pages load without auth
-- (owner UUID in URL acts as the access token — UUIDs are practically unguessable)
CREATE POLICY "public_read_owners" ON owners FOR SELECT USING (true);
CREATE POLICY "public_read_horses" ON horses FOR SELECT USING (true);
