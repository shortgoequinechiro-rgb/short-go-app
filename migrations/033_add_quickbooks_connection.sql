-- Migration 033: QuickBooks Online integration
-- Stores OAuth tokens and sync status for QuickBooks connections

CREATE TABLE IF NOT EXISTS quickbooks_connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  realm_id        TEXT NOT NULL,                  -- QuickBooks company ID
  access_token    TEXT NOT NULL,
  refresh_token   TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  company_name    TEXT,                            -- display name from QB
  connected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at  TIMESTAMPTZ
);

CREATE INDEX idx_qb_connections_practitioner ON quickbooks_connections(practitioner_id);

ALTER TABLE quickbooks_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners can view own QB connection"
  ON quickbooks_connections FOR SELECT
  USING (practitioner_id = auth.uid());

CREATE POLICY "Practitioners can delete own QB connection"
  ON quickbooks_connections FOR DELETE
  USING (practitioner_id = auth.uid());

-- Add QB sync columns to existing invoices table
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS qb_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS qb_sync_status TEXT DEFAULT 'none' CHECK (qb_sync_status IN ('none', 'pending', 'synced', 'failed')),
  ADD COLUMN IF NOT EXISTS qb_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS qb_synced_at TIMESTAMPTZ;

-- Map owners to QuickBooks customer IDs
ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS qb_customer_id TEXT;
