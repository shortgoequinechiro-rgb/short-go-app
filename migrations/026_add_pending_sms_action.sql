-- Migration 026: Add pending_sms_action to owners table
-- Stores what form to auto-send after SMS opt-in (intake or consent)

ALTER TABLE owners ADD COLUMN IF NOT EXISTS pending_sms_action text DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
