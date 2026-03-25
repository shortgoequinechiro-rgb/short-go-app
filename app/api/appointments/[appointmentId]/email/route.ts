import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '../../../../lib/auth'

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase env vars.')
  return createClient(supabaseUrl, serviceRoleKey)
}

function generateIcs(appt: {
  id: string
  appointment_date: string
  appointment_time: string | null
  duration_minutes: number | null
  location: string | null
  reason: string | null
  notes: string | null
  horses: { name: string; owners: { full_name: string } | null } | null
}, practiceName: string): string {
  const uid = `appt-${appt.id}@shortgo.equine`
  const [y, m, d] = appt.appointment_date.split('-').map(Number)
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateOnly = `${y}${pad(m)}${pad(d)}`

  const now = new Date()
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`

  let dtStart: string
  let dtEnd: string

  if (appt.appointment_time) {
    const [h, min] = appt.appointment_time.split(':').map(Number)
    const duration = appt.duration_minutes || 60
    const start = new Date(y, m - 1, d, h, min, 0)
    const end   = new Date(start.getTime() + duration * 60_000)
    const fmtLocal = (dt: Date) =>
      `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`
    dtStart = `DTSTART:${fmtLocal(start)}`
    dtEnd   = `DTEND:${fmtLocal(end)}`
  } else {
    const nextDay = new Date(y, m - 1, d + 1)
    const nextDateOnly = `${nextDay.getFullYear()}${pad(nextDay.getMonth() + 1)}${pad(nextDay.getDate())}`
    dtStart = `DTSTART;VALUE=DATE:${dateOnly}`
    dtEnd   = `DTEND;VALUE=DATE:${nextDateOnly}`
  }

  const horseName = appt.horses?.name || 'Horse'
  const ownerName = appt.horses?.owners?.full_name
  const summary   = appt.reason
    ? `${appt.reason} — ${horseName}`
    : `Equine Chiropractic — ${horseName}`
  const descParts = [
    ownerName && `Owner: ${ownerName}`,
    appt.reason && `Reason: ${appt.reason}`,
    appt.duration_minutes && `Duration: ${appt.duration_minutes} min`,
    appt.notes,
  ].filter(Boolean)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${practiceName}//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    dtStart,
    dtEnd,
    `SUMMARY:${summary}`,
    descParts.length ? `DESCRIPTION:${descParts.join('\\n')}` : '',
    appt.location ? `LOCATION:${appt.location}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)

  return lines.join('\r\n')
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
    const { user, error: authError } = await requireAuth(req)
    if (authError) return authError

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
        owners ( full_name, email, practitioner_id ),
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
    // For owner-based appointments the direct owners join is the source of truth;
    // fall back to horse → owners for legacy horse-based appointments.
    const owner = (appt.owners as any) || (horse?.owners as any)

    let practitioner: any = null
    if (owner?.practitioner_id) {
      const { data: prac } = await supabase
        .from('practitioners')
        .select('logo_url, practice_name, full_name')
        .eq('id', owner.practitioner_id)
        .single()
      practitioner = prac
    }

    if (!owner?.email) {
      return NextResponse.json({ error: 'Owner does not have an email address on file.' }, { status: 400 })
    }

    // For owner-based appointments there is no horse; show animal count instead.
    const numAnimals = appt.duration_minutes ? Math.max(1, Math.round(appt.duration_minutes / 15)) : 1
    const horseName = horse?.name || (numAnimals > 1 ? `${numAnimals} animals` : 'your animal')
    const ownerName = owner?.full_name || ''
    const dateStr = fmtDate(appt.appointment_date)
    const timeStr = fmtTime(appt.appointment_time)
    const location = appt.location ? `\nLocation: ${appt.location}` : ''
    const reason = appt.reason ? `\nReason: ${appt.reason}` : ''
    const duration = appt.duration_minutes ? `\nDuration: ${appt.duration_minutes} minutes` : ''

    const isConfirmation = type === 'confirmation'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://short-go-app.vercel.app'
    const confirmUrl = `${appUrl}/api/appointments/${appointmentId}/confirm`

    const subject = isConfirmation
      ? `Appointment Confirmed — ${horseName} on ${dateStr}`
      : `Reminder: ${horseName}'s appointment is ${dateStr}`

    const greeting = ownerName ? `Hi ${ownerName},\n\n` : 'Hello,\n\n'
    const practiceName = practitioner?.practice_name || 'Your Care Provider'
    const doctorName = practitioner?.full_name || 'Your practitioner'

    const body_text = isConfirmation
      ? `${greeting}Your appointment for ${horseName} has been confirmed.\n\nDate: ${dateStr}${timeStr}${duration}${location}${reason}\n\nIf you need to reschedule or have any questions, please don't hesitate to reach out.\n\nThank you,\n${doctorName}\n${practiceName}`
      : `${greeting}This is a friendly reminder that ${horseName}'s chiropractic appointment is coming up.\n\nDate: ${dateStr}${timeStr}${duration}${location}${reason}\n\nPlease confirm your appointment by visiting:\n${confirmUrl}\n\nWe look forward to seeing you!\n\n${doctorName}\n${practiceName}`

    // Confirm button block — only shown in reminder emails
    const confirmBlock = !isConfirmation ? `
      <div style="text-align:center;margin:24px 0;">
        <a href="${confirmUrl}"
           style="display:inline-block;background:#16a34a;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;letter-spacing:0.01em;">
          ✓ Confirm My Appointment
        </a>
        <p style="margin:10px 0 0;color:#94a3b8;font-size:11px;">One click — no login required</p>
      </div>` : ''

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <div style="background:#0f172a;padding:28px 32px;">
      ${practitioner?.logo_url ? `<img src="${practitioner.logo_url}" alt="Logo" style="max-height: 48px; margin-bottom: 8px; display: block;" />` : ''}
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${practiceName}</h1>
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

      ${confirmBlock}

      <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
        ${isConfirmation
          ? 'If you need to reschedule or have any questions, please reach out.'
          : 'If you need to reschedule, please contact us directly.'}
      </p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">${doctorName} · ${practiceName}</p>
    </div>
  </div>
</body>
</html>`

    const resend = new Resend(resendApiKey)

    // Attach .ics calendar invite to confirmation emails
    const attachments = isConfirmation ? [{
      filename: `${(horse?.name || ownerName || 'appointment').replace(/\s+/g, '-')}-${appt.appointment_date}.ics`,
      content: Buffer.from(generateIcs({
        id: appt.id,
        appointment_date: appt.appointment_date,
        appointment_time: appt.appointment_time,
        duration_minutes: appt.duration_minutes,
        location: appt.location,
        reason: appt.reason,
        notes: appt.notes,
        horses: horse ? { name: horse.name, owners: owner ? { full_name: owner.full_name } : null } : null,
      }, practiceName)),
    }] : undefined

    const result = await resend.emails.send({
      from: fromEmail,
      to: owner.email,
      subject,
      text: body_text,
      html: htmlBody,
      attachments,
    })

    if ((result as any)?.error) {
      console.error('Resend error:', (result as any).error)
      return NextResponse.json({ error: 'Failed to send email.' }, { status: 500 })
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
