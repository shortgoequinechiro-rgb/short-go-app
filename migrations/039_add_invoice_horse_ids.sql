-- Migration 039: Add horse_ids array column to invoices for multi-patient invoices
-- The existing horse_id column is kept for backward compatibility (stores the primary patient).
-- horse_ids stores all patient IDs included on the invoice.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS horse_ids uuid[] DEFAULT '{}';

-- Backfill: populate horse_ids from existing horse_id values
UPDATE invoices
SET horse_ids = ARRAY[horse_id]
WHERE horse_id IS NOT NULL AND (horse_ids IS NULL OR horse_ids = '{}');
