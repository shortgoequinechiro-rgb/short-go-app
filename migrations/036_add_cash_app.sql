-- Migration 036: Add Cash App payment handle to practitioners
-- Extends payment options alongside Venmo, PayPal, and Zelle.

ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS cash_app_handle TEXT;

-- Update the invoices payment_method CHECK constraint to include 'cash_app'
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_payment_method_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_payment_method_check
  CHECK (payment_method IN ('stripe', 'cash', 'check', 'venmo', 'cash_app', 'other'));
