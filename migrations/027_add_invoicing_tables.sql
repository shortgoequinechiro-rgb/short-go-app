-- =====================================================
-- MIGRATION 027: Add invoicing tables
-- Run this in Supabase SQL Editor (postgres role)
-- =====================================================

-- 1. Services table — practitioner's configurable price menu
CREATE TABLE IF NOT EXISTS services (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  practitioner_id uuid NOT NULL REFERENCES auth.users(id),
  name          text NOT NULL,
  description   text,
  price_cents   bigint NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_practitioner_active ON services(practitioner_id, is_active);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practitioner_own_services"
  ON services FOR ALL
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());

-- 2. Invoices table — per-visit invoice headers
CREATE TABLE IF NOT EXISTS invoices (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  practitioner_id       uuid NOT NULL REFERENCES auth.users(id),
  visit_id              uuid REFERENCES visits(id),
  owner_id              uuid REFERENCES owners(id),
  horse_id              uuid REFERENCES horses(id),
  invoice_number        text NOT NULL,
  invoice_date          date NOT NULL DEFAULT CURRENT_DATE,
  due_date              date,
  status                text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  subtotal_cents        bigint NOT NULL DEFAULT 0,
  tax_cents             bigint NOT NULL DEFAULT 0,
  total_cents           bigint NOT NULL DEFAULT 0,
  notes                 text,
  payment_method        text CHECK (payment_method IN ('stripe', 'cash', 'check', 'venmo', 'other')),
  paid_at               timestamptz,
  payment_reference     text,
  stripe_payment_link_id text,
  stripe_payment_url    text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_practitioner_status ON invoices(practitioner_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_practitioner_date ON invoices(practitioner_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_owner ON invoices(owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_practitioner ON invoices(practitioner_id, invoice_number);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practitioner_own_invoices"
  ON invoices FOR ALL
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());

-- 3. Invoice line items — individual service charges per invoice
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id      uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  service_id      uuid REFERENCES services(id),
  description     text NOT NULL,
  quantity        int NOT NULL DEFAULT 1,
  unit_price_cents bigint NOT NULL DEFAULT 0,
  total_cents     bigint NOT NULL DEFAULT 0,
  sort_order      int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_line_items_invoice ON invoice_line_items(invoice_id);

ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Line items inherit access through invoice ownership
CREATE POLICY "practitioner_own_line_items"
  ON invoice_line_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_line_items.invoice_id
        AND invoices.practitioner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_line_items.invoice_id
        AND invoices.practitioner_id = auth.uid()
    )
  );
