import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * GET /api/appointments/[appointmentId]/confirm
 *
 * Public endpoint — no auth required. The owner clicks this link from their
 * reminder email. We mark the appointment confirmed and redirect to a
 * friendly success page.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  const { appointmentId } = await params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stride-app.vercel.app'

  const supabase = getAdminSupabase()

  // Fetch the appointment so we can pass the patient name to the success page
  const { data: appt, error: fetchErr } = await supabase
    .from('appointments')
    .select(`
      id, status, appointment_date, appointment_time,
      horses ( name ),
      owners ( full_name )
    `)
    .eq('id', appointmentId)
    .single()

  if (fetchErr || !appt) {
    return NextResponse.redirect(`${appUrl}/confirmed?error=not_found`)
  }

  // Already cancelled — don't accidentally re-open it
  if (appt.status === 'cancelled') {
    return NextResponse.redirect(`${appUrl}/confirmed?error=cancelled`)
  }

  // Mark confirmed (idempotent — safe to click multiple times)
  if (appt.status !== 'confirmed') {
    await supabase
      .from('appointments')
      .update({ status: 'confirmed', confirmation_sent: true })
      .eq('id', appointmentId)
  }

  const apptAny = appt as any
  const patientName = apptAny.horses?.name ?? apptAny.owners?.full_name ?? 'your appointment'
  const date = appt.appointment_date ?? ''

  return NextResponse.redirect(
    `${appUrl}/confirmed?name=${encodeURIComponent(patientName)}&date=${encodeURIComponent(date)}`
  )
}
