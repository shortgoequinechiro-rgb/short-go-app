-- Expand species options to include feline, bovine, porcine, and exotic
-- The species column is a text column with no CHECK constraint, so no schema change needed.
-- This migration is a no-op placeholder documenting the new valid species values:
--   equine, canine, feline, bovine, porcine, exotic
-- If a CHECK constraint exists on the species column, run:
-- ALTER TABLE horses DROP CONSTRAINT IF EXISTS horses_species_check;
-- ALTER TABLE horses ADD CONSTRAINT horses_species_check
--   CHECK (species IN ('equine', 'canine', 'feline', 'bovine', 'porcine', 'exotic'));
SELECT 1;
