-- Migration 008: Add patient_records table for storing uploaded vet records, imaging, etc.

CREATE TABLE patient_records (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  horse_id        uuid REFERENCES horses(id) ON DELETE CASCADE NOT NULL,
  file_name       text NOT NULL,
  file_path       text NOT NULL,
  file_type       text,
  note            text,
  uploaded_at     timestamptz DEFAULT now(),
  practitioner_id uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX ON patient_records (horse_id, uploaded_at DESC);

-- Row Level Security
ALTER TABLE patient_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners can manage their own patient records"
  ON patient_records
  FOR ALL
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());
