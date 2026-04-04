-- Migration 042: Add vet info fields to owners and intake_forms
-- Stores default veterinarian info on the owner record and captures
-- vet details submitted via the public intake form.

-- Owner-level default vet
ALTER TABLE owners ADD COLUMN IF NOT EXISTS vet_name text;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS vet_practice_name text;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS vet_phone text;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS vet_email text;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS vet_license_number text;

-- Intake form vet snapshot
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS vet_name text;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS vet_practice_name text;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS vet_phone text;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS vet_email text;

-- Archived flag for intake forms (supports hide/show toggle)
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;

NOTIFY pgrst, 'reload schema';
