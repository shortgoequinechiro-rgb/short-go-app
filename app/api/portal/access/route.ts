import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function POST(req: Request) {
  try {
    const { token, patientId } = await req.json()

    if (!token || !patientId) {
      return NextResponse.json({ error: 'Missing token or patient ID' }, { status: 400 })
    }

    const tokenHash = hashToken(token)

    // Validate token
    const { data: tokenRecord, error: tokenErr } = await supabaseAdmin
      .from('portal_access_tokens')
      .select('id, patient_id, practitioner_id, expires_at')
      .eq('token_hash', tokenHash)
      .eq('patient_id', patientId)
      .single()

    if (tokenErr || !tokenRecord) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 403 })
    }

    // Check expiration
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This portal link has expired. Please contact your provider for a new link.' }, { status: 403 })
    }

    // Fetch patient info
    const { data: patient } = await supabaseAdmin
      .from('human_patients')
      .select('first_name, last_name, date_of_birth, chief_complaint, practitioners(practice_name, logo_url, full_name)')
      .eq('id', patientId)
      .single()

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Fetch visits (patient-safe fields only - no subjective/objective)
    const { data: visits } = await supabaseAdmin
      .from('human_visits')
      .select('id, visit_date, reason_for_visit, assessment, plan, treated_areas, recommendations, follow_up')
      .eq('patient_id', patientId)
      .order('visit_date', { ascending: false })
      .limit(20)

    // Fetch upcoming appointments
    const today = new Date().toISOString().split('T')[0]
    const { data: appointments } = await supabaseAdmin
      .from('human_appointments')
      .select('id, appointment_date, appointment_time, location, reason, status')
      .eq('patient_id', patientId)
      .gte('appointment_date', today)
      .in('status', ['scheduled', 'confirmed'])
      .order('appointment_date')
      .limit(5)

    // Log the portal access for HIPAA audit
    await supabaseAdmin.from('audit_log').insert({
      practitioner_id: tokenRecord.practitioner_id,
      user_type: 'patient',
      action: 'view',
      resource_type: 'patient_portal',
      resource_id: patientId,
      details: { token_id: tokenRecord.id },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
    })

    return NextResponse.json({
      patient,
      visits: visits || [],
      appointments: appointments || [],
    })
  } catch (error) {
    console.error('Portal access error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
