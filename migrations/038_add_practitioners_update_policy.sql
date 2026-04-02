-- Migration 038: Add UPDATE RLS policy to practitioners table
-- Previously only a SELECT policy existed, so client-side updates
-- (e.g. saving payment handles on the account page) were silently blocked by RLS.

CREATE POLICY "practitioners_update_own"
  ON practitioners FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
