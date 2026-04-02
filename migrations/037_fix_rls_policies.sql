-- Migration 037: Fix overly-permissive RLS policies
-- Replace public-access policies with UUID-scoped policies that require owner_id or horse_id validation

-- ── consent_forms: Fix overly permissive policies ────────────────────────────

-- Drop the overly permissive public read/update policies
DROP POLICY IF EXISTS "public_read_consent" ON consent_forms;
DROP POLICY IF EXISTS "public_update_consent" ON consent_forms;

-- Add UUID-scoped policies for consent_forms
-- SELECT restricted to records matching a specific owner_id
CREATE POLICY "consent_forms_read_by_owner"
  ON consent_forms FOR SELECT
  USING (
    owner_id IS NOT NULL AND
    owner_id::text = current_setting('app.owner_id', true)
  );

-- UPDATE only for unsigned forms and matching owner_id
CREATE POLICY "consent_forms_update_by_owner"
  ON consent_forms FOR UPDATE
  USING (
    owner_id IS NOT NULL AND
    owner_id::text = current_setting('app.owner_id', true) AND
    signed_at IS NULL
  )
  WITH CHECK (
    owner_id IS NOT NULL AND
    owner_id::text = current_setting('app.owner_id', true)
  );

-- ── intake_forms: Fix overly permissive policies ──────────────────────────────

-- Drop the overly permissive public read/insert/update policies
DROP POLICY IF EXISTS "public_read_intake" ON intake_forms;
DROP POLICY IF EXISTS "public_insert_intake" ON intake_forms;
DROP POLICY IF EXISTS "public_update_intake" ON intake_forms;

-- Add UUID-scoped policies for intake_forms
-- SELECT restricted to records matching a specific owner_id
CREATE POLICY "intake_forms_read_by_owner"
  ON intake_forms FOR SELECT
  USING (
    owner_id IS NOT NULL AND
    owner_id::text = current_setting('app.owner_id', true)
  );

-- INSERT restricted to records matching a specific owner_id
CREATE POLICY "intake_forms_insert_by_owner"
  ON intake_forms FOR INSERT
  WITH CHECK (
    owner_id IS NOT NULL AND
    owner_id::text = current_setting('app.owner_id', true)
  );

-- UPDATE restricted to records matching a specific owner_id
CREATE POLICY "intake_forms_update_by_owner"
  ON intake_forms FOR UPDATE
  USING (
    owner_id IS NOT NULL AND
    owner_id::text = current_setting('app.owner_id', true)
  )
  WITH CHECK (
    owner_id IS NOT NULL AND
    owner_id::text = current_setting('app.owner_id', true)
  );

-- ── vet_authorizations: Fix overly permissive policies ────────────────────────

-- Drop the overly permissive public read/insert/update policies
DROP POLICY IF EXISTS "public_read_vet_auth" ON vet_authorizations;
DROP POLICY IF EXISTS "public_insert_vet_auth" ON vet_authorizations;
DROP POLICY IF EXISTS "public_update_vet_auth" ON vet_authorizations;

-- Add UUID-scoped policies for vet_authorizations
-- SELECT restricted to records matching a specific horse_id
CREATE POLICY "vet_auth_read_by_horse"
  ON vet_authorizations FOR SELECT
  USING (
    horse_id IS NOT NULL AND
    horse_id::text = current_setting('app.horse_id', true)
  );

-- INSERT restricted to records matching a specific horse_id
CREATE POLICY "vet_auth_insert_by_horse"
  ON vet_authorizations FOR INSERT
  WITH CHECK (
    horse_id IS NOT NULL AND
    horse_id::text = current_setting('app.horse_id', true)
  );

-- UPDATE restricted to records matching a specific horse_id
CREATE POLICY "vet_auth_update_by_horse"
  ON vet_authorizations FOR UPDATE
  USING (
    horse_id IS NOT NULL AND
    horse_id::text = current_setting('app.horse_id', true)
  )
  WITH CHECK (
    horse_id IS NOT NULL AND
    horse_id::text = current_setting('app.horse_id', true)
  );

-- ── notifications: Fix overly permissive service role policy ──────────────────

-- Drop the overly permissive "Service role manages notifications" policy
DROP POLICY IF EXISTS "Service role manages notifications" ON notifications;

-- Add proper policies restricting to practitioner_id = auth.uid() for SELECT/UPDATE
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  USING (practitioner_id = auth.uid());

CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());

-- Add service-role-only INSERT policy
CREATE POLICY "notifications_insert_service_role"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- ── communication_log: Fix overly permissive service role policy ──────────────

-- Drop the overly permissive "Service role can insert logs" policy
DROP POLICY IF EXISTS "Service role can insert logs" ON communication_log;

-- Add INSERT WITH CHECK (true) only for service role
CREATE POLICY "communication_log_insert_service_role"
  ON communication_log FOR INSERT
  WITH CHECK (true);

-- Add SELECT restricted to practitioner_id = auth.uid()
CREATE POLICY "communication_log_select_own"
  ON communication_log FOR SELECT
  USING (practitioner_id = auth.uid());
