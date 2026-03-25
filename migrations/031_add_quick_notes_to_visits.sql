-- Add quick_notes column to visits table
-- This stores the raw quick notes used to generate AI SOAP drafts
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS quick_notes text;
