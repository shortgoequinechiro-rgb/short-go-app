-- Migration 034: Veterinary Authorization Tracking
-- Required by Texas Occupations Code Chapter 801 for animal chiropractic.
-- Tracks vet supervision authorizations per horse with expiration dates.

-- ── Vet authorizations table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vet_authorizations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  horse_id          UUID NOT NULL REFERENCES horses(id) ON DELETE CASCADE,

  -- Veterinarian info (captured from the public form or entered manually)
  vet_name          TEXT NOT NULL,
  vet_license_number TEXT,
  vet_practice_name TEXT,
  vet_phone         TEXT,
  vet_email         TEXT,

  -- Authorization details
  authorization_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at        DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 year'),
  status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'expired', 'revoked')),

  -- How the authorization was captured
  source            TEXT NOT NULL DEFAULT 'manual'
                      CHECK (source IN ('manual', 'digital_form', 'upload')),

  -- Digital signature from the public form (base64 data URL)
  signature_data    TEXT,

  -- Optional uploaded document (PDF/image of vet letter)
  document_path     TEXT,

  -- The vet confirms the animal has been examined
  vet_exam_confirmed BOOLEAN NOT NULL DEFAULT false,

  -- Notes from vet (e.g., "cleared for chiropractic, no contraindications")
  vet_notes         TEXT,

  -- Audit
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vet_auth_practitioner ON vet_authorizations(practitioner_id);
CREATE INDEX idx_vet_auth_horse ON vet_authorizations(horse_id);
CREATE INDEX idx_vet_auth_status ON vet_authorizations(status, expires_at);

-- ── RLS policies ──────────────────────────────────────────────────────────────

ALTER TABLE vet_authorizations ENABLE ROW LEVEL SECURITY;

-- Practitioners can manage their own authorizations
CREATE POLICY "practitioner_own_vet_auth"
  ON vet_authorizations FOR ALL
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());

-- Public read access (for the vet authorization form — same pattern as consent_forms)
CREATE POLICY "public_read_vet_auth"
  ON vet_authorizations FOR SELECT
  USING (true);

-- Public insert (vet submitting the digital form)
CREATE POLICY "public_insert_vet_auth"
  ON vet_authorizations FOR INSERT
  WITH CHECK (true);

-- Public update (vet completing a pending authorization)
CREATE POLICY "public_update_vet_auth"
  ON vet_authorizations FOR UPDATE
  USING (true) WITH CHECK (true);

-- ── Track authorization override on visits ────────────────────────────────────
-- When a practitioner creates a visit without a valid authorization,
-- we log that they proceeded with a soft warning.

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS vet_auth_id UUID REFERENCES vet_authorizations(id),
  ADD COLUMN IF NOT EXISTS vet_auth_override BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vet_auth_override_reason TEXT;
