-- =====================================================
-- MIGRATION 022: Add practitioner profile fields
-- Adds credentials, city, state, country, website, phone
-- to support comprehensive signup form
-- =====================================================

ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS credentials  text,
  ADD COLUMN IF NOT EXISTS city         text,
  ADD COLUMN IF NOT EXISTS state        text,
  ADD COLUMN IF NOT EXISTS country      text,
  ADD COLUMN IF NOT EXISTS website      text,
  ADD COLUMN IF NOT EXISTS phone        text;
