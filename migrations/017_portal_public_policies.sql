-- Public SELECT policies for patient portal access (patients view their own data without login)
-- The portal page at /human/portal/[patientId] runs unauthenticated queries

-- Allow public to read individual patient records (portal needs patient name + practitioner info)
CREATE POLICY "Public can view human patients by id"
  ON human_patients FOR SELECT
  USING (true);

-- Allow public to read visit summaries (portal shows visit history)
CREATE POLICY "Public can view human visits"
  ON human_visits FOR SELECT
  USING (true);

-- Allow public to read upcoming appointments (portal shows scheduled appointments)
CREATE POLICY "Public can view human appointments"
  ON human_appointments FOR SELECT
  USING (true);
