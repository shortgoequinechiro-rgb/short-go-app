-- Migration 009: Add logo_url column to practitioners table

ALTER TABLE practitioners ADD COLUMN IF NOT EXISTS logo_url text;
