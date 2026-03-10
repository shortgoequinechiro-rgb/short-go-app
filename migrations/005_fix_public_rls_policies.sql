-- MIGRATION 005: Remove overly-permissive public SELECT policies on owners and horses.
--
-- These policies allowed any authenticated user (including brand-new accounts)
-- to read ALL owners and horses across every practitioner.
--
-- Public intake/consent form pages now use the /api/public/owner/[ownerId] API
-- route which uses the service role key and only returns data for the specific
-- owner UUID in the URL.

DROP POLICY IF EXISTS "public_read_owners" ON owners;
DROP POLICY IF EXISTS "public_read_horses" ON horses;
