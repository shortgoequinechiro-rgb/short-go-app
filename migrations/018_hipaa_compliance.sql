-- Portal access tokens (replaces public RLS policies)
CREATE TABLE IF NOT EXISTS portal_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES human_patients(id) ON DELETE CASCADE,
  practitioner_id uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE portal_access_tokens ENABLE ROW LEVEL SECURITY;

-- Practitioners manage their own tokens
CREATE POLICY "Practitioners manage own portal tokens"
  ON portal_access_tokens FOR ALL
  USING (practitioner_id = auth.uid());

-- Service role can validate tokens (used by API route)
-- No public access needed - API route uses service role

CREATE INDEX IF NOT EXISTS idx_portal_tokens_hash ON portal_access_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_patient ON portal_access_tokens(patient_id);

-- Audit log table for HIPAA compliance
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid REFERENCES practitioners(id) ON DELETE SET NULL,
  user_type text NOT NULL DEFAULT 'practitioner' CHECK (user_type IN ('practitioner', 'patient', 'system')),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  details jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Practitioners can read their own audit logs
CREATE POLICY "Practitioners read own audit logs"
  ON audit_log FOR SELECT
  USING (practitioner_id = auth.uid());

-- Insert policy for authenticated users
CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_log FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_log_practitioner ON audit_log(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);

-- Drop the public SELECT policies we added earlier (migration 017)
-- These are the HIPAA-violating policies
DROP POLICY IF EXISTS "Public can view human patients by id" ON human_patients;
DROP POLICY IF EXISTS "Public can view human visits" ON human_visits;
DROP POLICY IF EXISTS "Public can view human appointments" ON human_appointments;
