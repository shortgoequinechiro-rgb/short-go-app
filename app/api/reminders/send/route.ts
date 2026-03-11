import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'

// ── Admin Supabase ────────────────────────────────────────────────────────────

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

/** Returns the date N days from now as a YYYY-MM-DD string (UTC). */
function daysFromNow(n: number) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + n)
  return toISODate(d)
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

// ── Email builder ─────────────────────────────────────────────────────────────

function buildReminderEmail(opts: {
  ownerName: string
  patientName: string
  dateStr: string
  timeStr: string
  location: string | null
  reason: string | null
  durationMinutes: number | null
  practiceName: string
  providerName: string
  confirmUrl: string
}) {
  const { ownerName, patientName, dateStr, timeStr, location, reason, durationMinutes, practiceName, providerName, confirmUrl } = opts

  const subject = `Reminder: ${patientName}'s appointment is ${dateStr}`

  const text =
    `Hi ${ownerName},\n\n` +
    `This is a friendly reminder that ${patientName}'s chiropractic appointment is coming up.\n\n` +
    `Date: ${dateStr}${timeStr}\n` +
    (durationMinutes ? `Duration: ${durationMinutes} minutes\n` : '') +
    (location ? `Location: ${location}\n` : '') +
    (reason ? `Reason: ${reason}\n` : '') +
    `\nPlease confirm your appointment here:\n${confirmUrl}\n\n` +
    `We look forward to seeing you!\n\n${providerName}\n${practiceName}`

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <div style="background:#0f172a;padding:28px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${practiceName}</h1>
      <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">Appointment Reminder</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 16px;color:#374151;font-size:15px;">Hi ${ownerName},</p>
      <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
        This is a friendly reminder that <strong>${patientName}</strong>'s chiropractic appointment is coming up.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;width:90px;">Date</td>
            <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:500;">${dateStr}${timeStr}</td>
          </tr>
          ${durationMinutes ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;">Duration</td><td style="padding:6px 0;color:#1e293b;font-size:13px;">${durationMinutes} minutes</td></tr>` : ''}
          ${location ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;">Location</td><td style="padding:6px 0;color:#1e293b;font-size:13px;">${location}</td></tr>` : ''}
          ${reason ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;">Reason</td><td style="padding:6px 0;color:#1e293b;font-size:13px;">${reason}</td></tr>` : ''}
        </table>
      </div>
      <div style="text-align:center;margin:24px 0;">
        <a href="${confirmUrl}"
           style="display:inline-block;background:#16a34a;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;letter-spacing:0.01em;">
          ✓ Confirm My Appointment
        </a>
        <p style="margin:10px 0 0;color:#94a3b8;font-size:11px;">One click — no login required</p>
      </div>
      <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
        If you need to reschedule, please contact us directly.
      </p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">${providerName} · ${practiceName}</p>
    </div>
  </div>
</body>
</html>`

  return { subject, text, html }
}

// ── SMS builder ───────────────────────────────────────────────────────────────

function buildReminderSms(opts: {
  ownerFirstName: string
  patientName: string
  dateStr: string
  timeStr: string
  providerName: string
  confirmUrl: string
}) {
  const { ownerFirstName, patientName, dateStr, timeStr, providerName, confirmUrl } = opts
  return `Hi ${ownerFirstName}! Reminder: ${patientName}'s appt with ${providerName} is ${dateStr}${timeStr}. Confirm here: ${confirmUrl} — Reply STOP to unsubscribe.`
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits.startsWith('1') ? `+${digits}` : `+1${digits}`
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // ── Auth: require CRON_SECRET ─────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.FROM_EMAIL
  const twilioSid = process.env.TWILIO_ACCOUNT_SID
  const twilioToken = process.env.TWILIO_AUTH_TOKEN
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER

  const hasEmail = Boolean(resendKey && fromEmail)
  const hasSms   = Boolean(twilioSid && twilioToken && twilioFrom)

  if (!hasEmail) {
    return NextResponse.json({ error: 'Email not configured (RESEND_API_KEY / FROM_EMAIL missing).' }, { status: 500 })
  }

  const supabase = getAdminSupabase()
  const resend   = new Resend(resendKey!)
  const smsClient = hasSms ? twilio(twilioSid!, twilioToken!) : null

  // ── Find appointments to remind ───────────────────────────────────────────
  // We remind for appointments happening tomorrow OR the day after (catches
  // timezone edge cases where "tomorrow" slips a day). De-dupe by reminder_sent.
  const tomorrow     = daysFromNow(1)
  const dayAfter     = daysFromNow(2)

  const { data: appointments, error: fetchErr } = await supabase
    .from('appointments')
    .select(`
      id,
      appointment_date,
      appointment_time,
      duration_minutes,
      location,
      reason,
      status,
      reminder_sent,
      provider_name,
      owner_id,
      horse_id,
      owners ( id, full_name, email, phone ),
      horses ( name, species, owners ( full_name, email, phone ) )
    `)
    .in('appointment_date', [tomorrow, dayAfter])
    .eq('reminder_sent', false)
    .in('status', ['scheduled', 'confirmed'])

  if (fetchErr) {
    console.error('[reminders] fetch error:', fetchErr)
    return NextResponse.json({ error: 'Failed to fetch appointments.' }, { status: 500 })
  }

  if (!appointments || appointments.length === 0) {
    return NextResponse.json({ success: true, sent: 0, skipped: 0, message: 'No reminders to send.' })
  }

  // ── Process each appointment ──────────────────────────────────────────────
  const results: Array<{ id: string; email?: string; sms?: string; error?: string }> = []

  for (const appt of appointments) {
    const apptAny = appt as any

    // Resolve owner — direct owner link takes priority, fall back to horse.owners
    const owner = apptAny.owners ?? apptAny.horses?.owners ?? null
    const patientName = apptAny.horses?.name ?? 'your animal'

    if (!owner) {
      results.push({ id: appt.id, error: 'No owner found' })
      continue
    }

    const ownerName      = owner.full_name ?? 'there'
    const ownerFirstName = ownerName.split(' ')[0]
    const dateStr        = fmtDate(appt.appointment_date)
    const timeStr        = fmtTime(appt.appointment_time)
    const providerName   = appt.provider_name ?? 'Dr. Andrew Leo D.C., M.S., cAVCA'
    const practiceName   = 'Short-Go Equine Chiropractic'
    const appUrl         = process.env.NEXT_PUBLIC_APP_URL || 'https://short-go-app.vercel.app'
    const confirmUrl     = `${appUrl}/api/appointments/${appt.id}/confirm`

    const result: { id: string; email?: string; sms?: string; error?: string } = { id: appt.id }
    let anySent = false

    // ── Email ──────────────────────────────────────────────────────────────
    if (owner.email) {
      try {
        const { subject, text, html } = buildReminderEmail({
          ownerName,
          patientName,
          dateStr,
          timeStr,
          location: appt.location,
          reason: appt.reason,
          durationMinutes: appt.duration_minutes,
          practiceName,
          providerName,
          confirmUrl,
        })

        const emailResult = await resend.emails.send({
          from: fromEmail!,
          to: owner.email,
          subject,
          text,
          html,
        })

        if ((emailResult as any)?.error) {
          result.error = `Email error: ${(emailResult as any).error.message}`
        } else {
          result.email = owner.email
          anySent = true
        }
      } catch (err: any) {
        result.error = `Email exception: ${err?.message}`
      }
    }

    // ── SMS ────────────────────────────────────────────────────────────────
    if (hasSms && smsClient && owner.phone) {
      try {
        const body = buildReminderSms({ ownerFirstName, patientName, dateStr, timeStr, providerName, confirmUrl })
        const msg = await smsClient.messages.create({
          from: twilioFrom!,
          to: normalizePhone(owner.phone),
          body,
        })
        if (msg.errorCode) {
          result.error = (result.error ? result.error + ' | ' : '') + `SMS error ${msg.errorCode}`
        } else {
          result.sms = owner.phone
          anySent = true
        }
      } catch (err: any) {
        result.error = (result.error ? result.error + ' | ' : '') + `SMS exception: ${err?.message}`
      }
    }

    // ── Mark reminder_sent only if at least one channel succeeded ──────────
    if (anySent) {
      await supabase
        .from('appointments')
        .update({ reminder_sent: true })
        .eq('id', appt.id)
    }

    results.push(result)
  }

  const sent    = results.filter(r => r.email || r.sms).length
  const skipped = results.filter(r => !r.email && !r.sms).length
  const errors  = results.filter(r => r.error)

  console.log(`[reminders] sent=${sent} skipped=${skipped} errors=${errors.length}`)

  return NextResponse.json({
    success: true,
    sent,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
    results,
  })
}
