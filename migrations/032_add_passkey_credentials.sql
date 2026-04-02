-- Migration 032: Add passkey/WebAuthn credentials table for biometric login
-- Stores registered passkeys (Face ID, Touch ID, fingerprint, etc.)

CREATE TABLE IF NOT EXISTS passkey_credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id   TEXT NOT NULL UNIQUE,          -- base64url-encoded credential ID
  public_key      TEXT NOT NULL,                  -- base64url-encoded public key
  counter         BIGINT NOT NULL DEFAULT 0,      -- signature counter (replay protection)
  device_name     TEXT,                            -- user-friendly label ("iPhone 15", etc.)
  transports      TEXT[],                          -- e.g. {'internal','hybrid'}
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at    TIMESTAMPTZ
);

-- Index for fast lookup during authentication
CREATE INDEX idx_passkey_credentials_practitioner ON passkey_credentials(practitioner_id);
CREATE INDEX idx_passkey_credentials_credential_id ON passkey_credentials(credential_id);

-- RLS: practitioners can only see/manage their own passkeys
ALTER TABLE passkey_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners can view own passkeys"
  ON passkey_credentials FOR SELECT
  USING (practitioner_id = auth.uid());

CREATE POLICY "Practitioners can insert own passkeys"
  ON passkey_credentials FOR INSERT
  WITH CHECK (practitioner_id = auth.uid());

CREATE POLICY "Practitioners can update own passkeys"
  ON passkey_credentials FOR UPDATE
  USING (practitioner_id = auth.uid());

CREATE POLICY "Practitioners can delete own passkeys"
  ON passkey_credentials FOR DELETE
  USING (practitioner_id = auth.uid());

-- Also need a challenges table for temporary WebAuthn challenge storage
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge       TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes')
);

CREATE INDEX idx_webauthn_challenges_practitioner ON webauthn_challenges(practitioner_id);

-- Allow service role to manage challenges (no RLS needed, server-side only)
ALTER TABLE webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- Cleanup: auto-delete expired challenges (run periodically or let them accumulate harmlessly)
