import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase env vars.')
  return createClient(supabaseUrl, serviceRoleKey)
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function fmtTime(t: string | null) {
  if (!t) return ''
  const [h, min] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return ` at ${hour}:${String(min).padStart(2, '0')} ${ampm}`
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  try {
    const { appointmentId } = await params
    const body = await req.json()
    const type: 'confirmation' | 'reminder' = body.type || 'confirmation'

    const resendApiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.FROM_EMAIL
    if (!resendApiKey) return NextResponse.json({ error: 'Missing RESEND_API_KEY.' }, { status: 500 })
    if (!fromEmail) return NextResponse.json({ error: 'Missing FROM_EMAIL.' }, { status: 500 })

    const supabase = getAdminSupabase()

    const { data: appt, error: apptError } = await supabase
      .from('appointments')
      .select(`
        *,
        horses (
          name,
          breed,
          owners ( full_name, email )
        )
      `)
      .eq('id', appointmentId)
      .single()

    if (apptError || !appt) {
      return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 })
    }

    const horse = appt.horses as any
    const owner = horse?.owners as any

    if (!owner?.email) {
      return NextResponse.json({ error: 'Owner does not have an email address on file.' }, { status: 400 })
    }

    const horseName = horse?.name || 'your horse'
    const ownerName = owner?.full_name || ''
    const dateStr = fmtDate(appt.appointment_date)
    const timeStr = fmtTime(appt.appointment_time)
    const location = appt.location ? `\nLocation: ${appt.location}` : ''
    const reason = appt.reason ? `\nReason: ${appt.reason}` : ''
    const duration = appt.duration_minutes ? `\nDuration: ${appt.duration_minutes} minutes` : ''

    const isConfirmation = type === 'confirmation'
    const subject = isConfirmation
      ? `Appointment Confirmed — ${horseName} on ${dateStr}`
      : `Reminder: ${horseName}'s appointment is ${dateStr}`

    const greeting = ownerName ? `Hi ${ownerName},\n\n` : 'Hello,\n\n'

    const body_text = isConfirmation
      ? `${greeting}Your appointment for ${horseName} has been confirmed.\n\nDate: ${dateStr}${timeStr}${duration}${location}${reason}\n\nIf you need to reschedule or have any questions, please don't hesitate to reach out.\n\nThank you,\nDr. Andrew Leo D.C., M.S., cAVCA\nShort-Go Equine Chiropractic`
      : `${greeting}This is a friendly reminder that ${horseName}'s chiropractic appointment is coming up.\n\nDate: ${dateStr}${timeStr}${duration}${location}${reason}\n\nWe look forward to seeing you!\n\nDr. Andrew Leo D.C., M.S., cAVCA\nShort-Go Equine Chiropractic`

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <div style="background:#0f172a;padding:28px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Short-Go Equine Chiropractic</h1>
      <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">${isConfirmation ? 'Appointment Confirmation' : 'Appointment Reminder'}</p>
    </div>
    <div style="padding:28px 32px;">
      ${ownerName ? `<p style="margin:0 0 16px;color:#374151;font-size:15px;">Hi ${ownerName},</p>` : ''}
      <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
        ${isConfirmation
          ? `Your appointment for <strong>${horseName}</strong> has been confirmed.`
          : `This is a friendly reminder that <strong>${horseName}</strong>'s appointment is coming up.`}
      </p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;width:90px;">Date</td>
            <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:500;">${dateStr}${timeStr}</td>
          </tr>
          ${appt.duration_minutes ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;">Duration</td><td style="padding:6px 0;color:#1e293b;font-size:13px;">${appt.duration_minutes} minutes</td></tr>` : ''}
          ${appt.location ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;">Location</td><td style="padding:6px 0;color:#1e293b;font-size:13px;">${appt.location}</td></tr>` : ''}
          ${appt.reason ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;">Reason</td><td style="padding:6px 0;color:#1e293b;font-size:13px;">${appt.reason}</td></tr>` : ''}
        </table>
      </div>

      <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
        ${isConfirmation
          ? 'If you need to reschedule or have any questions, please reach out.'
          : 'We look forward to seeing you!'}
      </p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">Dr. Andrew Leo D.C., M.S., cAVCA · Short-Go Equine Chiropractic</p>
    </div>
  </div>
</body>
</html>`

    const resend = new Resend(resendApiKey)
    const result = await resend.emails.send({
      from: fromEmail,
      to: owner.email,
      subject,
      text: body_text,
      html: htmlBody,
    })

    if ((result as any)?.error) {
      return NextResponse.json({ error: (result as any).error.message || 'Send failed.' }, { status: 500 })
    }

    // Mark sent flag
    const updateField = isConfirmation ? { confirmation_sent: true } : { reminder_sent: true }
    await supabase.from('appointments').update(updateField).eq('id', appointmentId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('appointment email route error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to send email.' }, { status: 500 })
  }
}
