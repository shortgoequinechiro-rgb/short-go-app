-- ============================================================================
-- Migration 020: AI Compliance, SOAP Templates, Patient Recall, Google Reviews
-- 1. SOAP Templates (soap_templates)
-- 2. Compliance Scan Results (compliance_scans)
-- 3. Patient Recall (recall_settings, recall_messages)
-- 4. Google Review Requests (review_request_settings, review_requests)
-- ============================================================================

-- ── 1. SOAP NOTE TEMPLATES ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS soap_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('initial_exam', 're_exam', 'maintenance', 'specific_complaint', 'general')),
  chief_complaint text,
  subjective text,
  objective text,
  assessment text,
  plan text,
  treated_areas text,
  recommendations text,
  follow_up text,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE soap_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage own soap templates"
  ON soap_templates FOR ALL USING (practitioner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_soap_templates_practitioner ON soap_templates(practitioner_id);


-- ── 2. COMPLIANCE SCAN RESULTS ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES human_visits(id) ON DELETE SET NULL,
  superbill_id uuid REFERENCES superbills(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES human_patients(id) ON DELETE SET NULL,
  scan_date timestamptz NOT NULL DEFAULT now(),
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  issues jsonb DEFAULT '[]'::jsonb,  -- [{type, severity, message, suggestion}]
  score integer CHECK (score BETWEEN 0 AND 100),  -- compliance score
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE compliance_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage own compliance scans"
  ON compliance_scans FOR ALL USING (practitioner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_compliance_scans_practitioner ON compliance_scans(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_compliance_scans_visit ON compliance_scans(visit_id);


-- ── 3. PATIENT RECALL & REACTIVATION ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recall_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL UNIQUE REFERENCES practitioners(id) ON DELETE CASCADE,
  recall_enabled boolean NOT NULL DEFAULT true,
  inactive_days integer NOT NULL DEFAULT 30,  -- days without visit before recall
  reminder_method text NOT NULL DEFAULT 'email' CHECK (reminder_method IN ('email', 'sms', 'both')),
  message_template text DEFAULT 'Hi {first_name}, we noticed it''s been a while since your last visit. We''d love to help you stay on track with your care. Call us or book online to schedule your next appointment!',
  follow_up_days integer[] DEFAULT '{7,14,30}'::integer[],  -- send follow-ups at these intervals
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE recall_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage own recall settings"
  ON recall_settings FOR ALL USING (practitioner_id = auth.uid());

CREATE TABLE IF NOT EXISTS recall_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES human_patients(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('email', 'sms')),
  message_text text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'responded')),
  days_inactive integer,
  follow_up_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE recall_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage own recall messages"
  ON recall_messages FOR ALL USING (practitioner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_recall_messages_practitioner ON recall_messages(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_recall_messages_patient ON recall_messages(patient_id);


-- ── 4. GOOGLE REVIEW REQUESTS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS review_request_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL UNIQUE REFERENCES practitioners(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  google_review_url text,  -- the practitioner's Google review link
  delay_hours integer NOT NULL DEFAULT 2,  -- hours after visit to send request
  min_visits_before_ask integer NOT NULL DEFAULT 2,  -- only ask after N visits
  send_method text NOT NULL DEFAULT 'email' CHECK (send_method IN ('email', 'sms', 'both')),
  message_template text DEFAULT 'Hi {first_name}, thank you for choosing our practice! If you had a great experience, we''d really appreciate a Google review. It helps others find quality care. {review_link}',
  cooldown_days integer NOT NULL DEFAULT 90,  -- don't ask again for N days
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE review_request_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage own review request settings"
  ON review_request_settings FOR ALL USING (practitioner_id = auth.uid());

CREATE TABLE IF NOT EXISTS review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES human_patients(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES human_visits(id) ON DELETE SET NULL,
  method text NOT NULL CHECK (method IN ('email', 'sms')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'clicked', 'reviewed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage own review requests"
  ON review_requests FOR ALL USING (practitioner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_review_requests_practitioner ON review_requests(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_patient ON review_requests(patient_id);


-- ── 5. UPDATE AUDIT LOG RESOURCE TYPES ───────────────────────────────────────
-- (Handled in application code — no DDL needed since we store as text)
