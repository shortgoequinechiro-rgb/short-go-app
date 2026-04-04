-- Migration 041: Add Stripe Connect fields for practitioner payment collection
-- Allows practitioners to connect their own Stripe account via Stripe Connect Express

ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS stripe_account_id         text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_connect_status      text DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarded_at timestamptz;

-- stripe_connect_status values:
--   'not_connected' — default, no Stripe Connect account
--   'onboarding'    — account created but onboarding not finished
--   'active'        — fully verified, charges & payouts enabled
--   'restricted'    — account has restrictions (needs more info)

COMMENT ON COLUMN practitioners.stripe_account_id IS 'Stripe Connect Express account ID (acct_xxx)';
COMMENT ON COLUMN practitioners.stripe_connect_status IS 'not_connected | onboarding | active | restricted';
COMMENT ON COLUMN practitioners.stripe_charges_enabled IS 'Whether this connected account can accept charges';
COMMENT ON COLUMN practitioners.stripe_payouts_enabled IS 'Whether this connected account can receive payouts';
