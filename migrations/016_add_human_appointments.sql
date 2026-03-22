-- Human appointments table
CREATE TABLE IF NOT EXISTS human_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES human_patients(id) ON DELETE SET NULL,
  practitioner_id uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  appointment_date date NOT NULL,
  appointment_time text,
  duration_minutes integer DEFAULT 30,
  location text,
  reason text,
  notes text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')),
  confirmation_sent boolean NOT NULL DEFAULT false,
  reminder_sent boolean NOT NULL DEFAULT false,
  provider_name text,
  -- Patient contact info (denormalized for appointments without patient record)
  patient_name text,
  patient_phone text,
  patient_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Human intake forms
CREATE TABLE IF NOT EXISTS human_intake_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES human_patients(id) ON DELETE SET NULL,
  practitioner_id uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  -- Personal info
  first_name text,
  last_name text,
  date_of_birth date,
  phone text,
  email text,
  address text,
  -- Emergency contact
  emergency_contact text,
  emergency_phone text,
  -- Insurance
  insurance_provider text,
  insurance_id text,
  insurance_group text,
  insurance_phone text,
  -- Health history
  chief_complaint text,
  pain_location text,
  pain_duration text,
  pain_scale integer CHECK (pain_scale BETWEEN 0 AND 10),
  pain_description text,
  medical_history text,
  surgeries text,
  medications text,
  allergies text,
  family_history text,
  -- Lifestyle
  occupation text,
  exercise_habits text,
  sleep_quality text,
  stress_level text,
  -- Consent
  signature_data text,
  signed_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'reviewed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE human_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE human_intake_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners see own human appointments"
  ON human_appointments FOR ALL
  USING (practitioner_id = auth.uid());

CREATE POLICY "Practitioners see own human intake forms"
  ON human_intake_forms FOR ALL
  USING (practitioner_id = auth.uid());

-- Public access for intake forms (patients fill these without login)
CREATE POLICY "Public can view human intake forms"
  ON human_intake_forms FOR SELECT
  USING (true);

CREATE POLICY "Public can update human intake forms"
  ON human_intake_forms FOR UPDATE
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_human_appointments_practitioner ON human_appointments(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_human_appointments_patient ON human_appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_human_appointments_date ON human_appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_human_intake_forms_practitioner ON human_intake_forms(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_human_intake_forms_patient ON human_intake_forms(patient_id);
