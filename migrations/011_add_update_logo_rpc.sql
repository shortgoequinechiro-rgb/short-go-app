-- Migration 011: RPC function to update practitioner logo_url
-- Bypasses PostgREST schema cache issues with newly added columns

CREATE OR REPLACE FUNCTION update_practitioner_logo(p_id uuid, p_logo_url text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE practitioners
  SET logo_url = p_logo_url, updated_at = now()
  WHERE id = p_id;
$$;
