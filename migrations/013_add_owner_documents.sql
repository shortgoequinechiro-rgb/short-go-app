-- Migration 013: Add owner_documents table + storage bucket for owner-level file uploads
-- Stores uploaded files (vet records, x-rays, etc.) and links to generated intake/consent PDFs

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE owner_documents (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id        uuid REFERENCES owners(id) ON DELETE CASCADE NOT NULL,
  practitioner_id uuid REFERENCES auth.users(id) NOT NULL,
  file_name       text NOT NULL,
  file_path       text NOT NULL,          -- path inside the "owner-documents" storage bucket
  file_type       text,                   -- MIME type (application/pdf, image/jpeg, etc.)
  file_size       bigint,                 -- size in bytes
  category        text DEFAULT 'upload',  -- 'upload' | 'intake' | 'consent'
  source_id       uuid,                   -- optional FK to intake_forms.id or consent_forms.id
  note            text,
  uploaded_at     timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX ON owner_documents (owner_id, uploaded_at DESC);
CREATE INDEX ON owner_documents (practitioner_id);

-- ── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE owner_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners can manage their own owner documents"
  ON owner_documents
  FOR ALL
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());

-- ── Storage bucket ───────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('owner-documents', 'owner-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload into their own folder
CREATE POLICY "Practitioners can upload owner documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'owner-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can read their own documents
CREATE POLICY "Practitioners can read their own owner documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'owner-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can delete their own documents
CREATE POLICY "Practitioners can delete their own owner documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'owner-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
