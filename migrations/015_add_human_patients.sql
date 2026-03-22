-- Human patients table
CREATE TABLE IF NOT EXISTS human_patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date,
  phone text,
  email text,
  address text,
  emergency_contact text,
  emergency_phone text,
  insurance_provider text,
  insurance_id text,
  chief_complaint text,
  medical_history text,
  medications text,
  allergies text,
  notes text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Human visits table
CREATE TABLE IF NOT EXISTS human_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES human_patients(id) ON DELETE CASCADE,
  practitioner_id uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  reason_for_visit text,
  subjective text,
  objective text,
  assessment text,
  plan text,
  treated_areas text,
  recommendations text,
  follow_up text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE human_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE human_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners see own human patients"
  ON human_patients FOR ALL
  USING (practitioner_id = auth.uid());

CREATE POLICY "Practitioners see own human visits"
  ON human_visits FOR ALL
  USING (practitioner_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_human_patients_practitioner ON human_patients(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_human_visits_patient ON human_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_human_visits_practitioner ON human_visits(practitioner_id);
