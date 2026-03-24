CREATE TABLE IF NOT EXISTS communication_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  practitioner_id UUID NOT NULL REFERENCES auth.users(id),
  owner_id UUID REFERENCES owners(id),
  invoice_id UUID REFERENCES invoices(id),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  message_type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  body_preview TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'bounced')),
  external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comm_log_practitioner ON communication_log(practitioner_id);
CREATE INDEX idx_comm_log_owner ON communication_log(owner_id);
CREATE INDEX idx_comm_log_created ON communication_log(created_at DESC);

ALTER TABLE communication_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioners can view own logs" ON communication_log
  FOR SELECT USING (practitioner_id = auth.uid());
CREATE POLICY "Service role can insert logs" ON communication_log
  FOR INSERT WITH CHECK (true);
