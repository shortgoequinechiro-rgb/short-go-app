-- Migration 012: Add SMS consent tracking to owners table
-- Supports opt-in flow required by Twilio toll-free verification

ALTER TABLE owners ADD COLUMN IF NOT EXISTS sms_consent_status text DEFAULT 'none'
  CHECK (sms_consent_status IN ('none', 'pending', 'opted_in', 'opted_out'));

ALTER TABLE owners ADD COLUMN IF NOT EXISTS sms_consent_sent_at timestamptz;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS sms_consent_responded_at timestamptz;

-- RPC to update consent status (bypasses schema cache issues)
CREATE OR REPLACE FUNCTION update_sms_consent(
  p_owner_id uuid,
  p_status text,
  p_sent_at timestamptz DEFAULT NULL,
  p_responded_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE owners
  SET sms_consent_status = p_status,
      sms_consent_sent_at = COALESCE(p_sent_at, sms_consent_sent_at),
      sms_consent_responded_at = COALESCE(p_responded_at, sms_consent_responded_at)
  WHERE id = p_owner_id;
$$;

NOTIFY pgrst, 'reload schema';
