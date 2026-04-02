-- Migration 035: Add payment link fields (Venmo, PayPal, Zelle) to practitioners
-- Allows practitioners to configure their payment handles, shown on invoices and emails.

ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS venmo_handle TEXT,
  ADD COLUMN IF NOT EXISTS paypal_email TEXT,
  ADD COLUMN IF NOT EXISTS zelle_info TEXT;
