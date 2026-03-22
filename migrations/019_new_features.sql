-- ============================================================================
-- Migration 019: New Features
-- 1. Online Self-Booking (practitioner_availability, booking_settings)
-- 2. Care Plans (care_plans, care_plan_visits)
-- 3. Superbills (superbills table)
-- 4. Automated Reminders column for human_appointments
-- ============================================================================

-- ── 1. ONLINE SELF-BOOKING ──────────────────────────────────────────────────

-- Practitioner booking settings (public booking page config)
CREATE TABLE IF NOT EXISTS booking_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL UNIQUE REFERENCES practitioners(id) ON DELETE CASCADE,
  booking_enabled boolean NOT NULL DEFAULT true,
  booking_slug text UNIQUE,  -- e.g., "dr-smith" for /book/dr-smith
  office_name text,
  office_address text,
  office_phone text,
  booking_instructions text,
  min_notice_hours integer NOT NULL DEFAULT 24,  -- min hours before appointment can be booked
  max_advance_days integer NOT NULL DEFAULT 60,  -- how far out patients can book
  default_duration_minutes integer NOT NULL DEFAULT 30,
  appointment_types jsonb DEFAULT '[]'::jsonb,  -- [{name, duration, description}]
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Weekly availability slots
CREATE TABLE IF NOT EXISTS practitioner_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  start_time text NOT NULL,  -- "09:00"
  end_time text NOT NULL,    -- "17:00"
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE booking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE practitioner_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage own booking settings"
  ON booking_settings FOR ALL USING (practitioner_id = auth.uid());

CREATE POLICY "Public can view booking settings"
  ON booking_settings FOR SELECT USING (true);

CREATE POLICY "Practitioners manage own availability"
  ON practitioner_availability FOR ALL USING (practitioner_id = auth.uid());

CREATE POLICY "Public can view practitioner availability"
  ON practitioner_availability FOR SELECT USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_booking_settings_slug ON booking_settings(booking_slug);
CREATE INDEX IF NOT EXISTS idx_availability_practitioner ON practitioner_availability(practitioner_id);


-- ── 2. CARE PLANS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS care_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES human_patients(id) ON DELETE CASCADE,
  practitioner_id uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Treatment Plan',
  diagnosis text,
  icd10_codes text[],       -- ICD-10 codes for the plan
  goals text,
  frequency text,           -- e.g., "3x/week for 4 weeks, then 2x/week"
  total_visits integer,
  completed_visits integer NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  target_end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Link visits to care plans
CREATE TABLE IF NOT EXISTS care_plan_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id uuid NOT NULL REFERENCES care_plans(id) ON DELETE CASCADE,
  visit_id uuid NOT NULL REFERENCES human_visits(id) ON DELETE CASCADE,
  visit_number integer NOT NULL,
  pain_score integer CHECK (pain_score BETWEEN 0 AND 10),
  functional_score integer CHECK (functional_score BETWEEN 0 AND 100),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE care_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_plan_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage own care plans"
  ON care_plans FOR ALL USING (practitioner_id = auth.uid());

CREATE POLICY "Practitioners manage own care plan visits"
  ON care_plan_visits FOR ALL USING (
    EXISTS (
      SELECT 1 FROM care_plans cp WHERE cp.id = care_plan_visits.care_plan_id AND cp.practitioner_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_care_plans_patient ON care_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_practitioner ON care_plans(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_care_plan_visits_plan ON care_plan_visits(care_plan_id);


-- ── 3. SUPERBILLS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS superbills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid REFERENCES human_visits(id) ON DELETE SET NULL,
  patient_id uuid NOT NULL REFERENCES human_patients(id) ON DELETE CASCADE,
  practitioner_id uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  -- Provider info
  provider_name text,
  provider_npi text,
  provider_tax_id text,
  practice_name text,
  practice_address text,
  practice_phone text,
  -- Patient info (snapshot)
  patient_name text NOT NULL,
  patient_dob date,
  patient_address text,
  patient_phone text,
  -- Insurance info (snapshot)
  insurance_provider text,
  insurance_id text,
  insurance_group text,
  -- Service info
  date_of_service date NOT NULL DEFAULT CURRENT_DATE,
  place_of_service text DEFAULT '11',  -- 11 = Office
  -- Codes
  diagnosis_codes jsonb DEFAULT '[]'::jsonb,  -- [{code, description}]
  procedure_codes jsonb DEFAULT '[]'::jsonb,  -- [{code, description, units, fee}]
  -- Totals
  total_fee numeric(10,2) DEFAULT 0,
  amount_paid numeric(10,2) DEFAULT 0,
  balance_due numeric(10,2) DEFAULT 0,
  payment_method text,
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'submitted')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE superbills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage own superbills"
  ON superbills FOR ALL USING (practitioner_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_superbills_patient ON superbills(patient_id);
CREATE INDEX IF NOT EXISTS idx_superbills_practitioner ON superbills(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_superbills_visit ON superbills(visit_id);
CREATE INDEX IF NOT EXISTS idx_superbills_date ON superbills(date_of_service);


-- ── 4. Add public INSERT for human_appointments (for self-booking) ──────────

CREATE POLICY "Public can insert human appointments"
  ON human_appointments FOR INSERT
  WITH CHECK (true);

-- ── 5. Update audit_log types ───────────────────────────────────────────────

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_user_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_user_type_check
  CHECK (user_type IN ('practitioner', 'patient', 'system', 'public'));
