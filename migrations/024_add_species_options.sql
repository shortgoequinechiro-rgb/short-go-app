-- Expand species options to include feline, bovine, porcine, and exotic
-- First, find and drop ANY existing CHECK constraint on the species column
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
    WHERE con.conrelid = 'horses'::regclass
      AND att.attname = 'species'
      AND con.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE horses DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- Add updated CHECK constraint allowing all 6 species
ALTER TABLE horses ADD CONSTRAINT horses_species_check
  CHECK (species IN ('equine', 'canine', 'feline', 'bovine', 'porcine', 'exotic'));
