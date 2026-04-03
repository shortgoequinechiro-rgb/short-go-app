-- Migration 040: Add qb_payment_url to invoices for QuickBooks payment links
-- When QB Payments is enabled and an invoice is synced to QB, this stores the
-- customer-facing payment URL so owners can pay directly through QuickBooks.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS qb_payment_url TEXT;
