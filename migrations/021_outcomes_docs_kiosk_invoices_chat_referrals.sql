-- ============================================================================
-- Migration 021: Outcome Measures, Document Management, Kiosk Mode,
--   Patient Statements, Two-Way SMS, Referral Tracking
-- ============================================================================

-- ── 1. OUTCOME MEASURES ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS outcome_questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('NDI', 'ODI', 'VAS', 'DASH', 'PHQ9', 'GAD7', 'custom')),
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  scoring_guide jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE outcome_questionnaires ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioners manage own questionnaires" ON outcome_questionnaires FOR ALL USING (practitioner_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_outcome_questionnaires_prac ON outcome_questionnaires(practitioner_id);

CREATE TABLE IF NOT EXISTS outcome_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES human_patients(id) ON DELETE CASCADE,
  questionnaire_id uuid NOT NULL REFERENCES outcome_questionnaires(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES human_visits(id) ON DELETE SET NULL,
  responses jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_score numeric,
  max_score numeric,
  percentage numeric,
  interpretation text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE outcome_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioners manage own outcome responses" ON outcome_responses FOR ALL USING (practitioner_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_outcome_responses_patient ON outcome_responses(patient_id);
CREATE INDEX IF NOT EXISTS idx_outcome_responses_questionnaire ON outcome_responses(questionnaire_id);

-- ── 2. DOCUMENT / IMAGING MANAGEMENT ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES human_patients(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer,
  storage_path text NOT NULL,
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('xray', 'mri', 'ct_scan', 'lab_report', 'referral', 'insurance', 'consent', 'imaging', 'correspondence', 'other')),
  description text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE patient_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioners manage own documents" ON patient_documents FOR ALL USING (practitioner_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_patient_documents_patient ON patient_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_prac ON patient_documents(practitioner_id);

-- ── 3. KIOSK MODE SETTINGS ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kiosk_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL UNIQUE REFERENCES practitioners(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  pin_code text,
  welcome_message text DEFAULT 'Welcome! Please check in for your appointment.',
  show_intake_form boolean NOT NULL DEFAULT true,
  show_consent_form boolean NOT NULL DEFAULT true,
  auto_logout_seconds integer NOT NULL DEFAULT 120,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE kiosk_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioners manage own kiosk settings" ON kiosk_settings FOR ALL USING (practitioner_id = auth.uid());

CREATE TABLE IF NOT EXISTS kiosk_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES human_patients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES human_appointments(id) ON DELETE SET NULL,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  intake_completed boolean NOT NULL DEFAULT false,
  consent_signed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE kiosk_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioners manage own kiosk checkins" ON kiosk_checkins FOR ALL USING (practitioner_id = auth.uid());
-- Public insert for kiosk
CREATE POLICY "Public kiosk checkin" ON kiosk_checkins FOR INSERT WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_kiosk_checkins_prac ON kiosk_checkins(practitioner_id);

-- ── 4. PATIENT STATEMENTS / INVOICING ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES human_patients(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  date_issued date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  tax numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  amount_paid numeric(10,2) NOT NULL DEFAULT 0,
  balance_due numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'void')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE patient_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioners manage own invoices" ON patient_invoices FOR ALL USING (practitioner_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_patient_invoices_patient ON patient_invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_invoices_prac ON patient_invoices(practitioner_id);

-- ── 5. TWO-WAY SMS CHAT ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES human_patients(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  phone_number text NOT NULL,
  body text NOT NULL,
  twilio_sid text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'received', 'read')),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioners manage own sms messages" ON sms_messages FOR ALL USING (practitioner_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_sms_messages_prac ON sms_messages(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_patient ON sms_messages(patient_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_phone ON sms_messages(phone_number);

-- ── 6. REFERRAL SOURCE TRACKING ─────────────────────────────────────────────

ALTER TABLE human_patients ADD COLUMN IF NOT EXISTS referral_source text;
ALTER TABLE human_patients ADD COLUMN IF NOT EXISTS referral_details text;

CREATE TABLE IF NOT EXISTS referral_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('google', 'social_media', 'referral', 'insurance_directory', 'walk_in', 'website', 'event', 'other')),
  is_active boolean NOT NULL DEFAULT true,
  patient_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE referral_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioners manage own referral sources" ON referral_sources FOR ALL USING (practitioner_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_referral_sources_prac ON referral_sources(practitioner_id);
