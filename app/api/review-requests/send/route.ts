import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const practitionerId = body.practitionerId

    // Get settings
    const query = supabaseAdmin
      .from('review_request_settings')
      .select('*')
      .eq('enabled', true)

    if (practitionerId) {
      query.eq('practitioner_id', practitionerId)
    }

    const { data: allSettings } = await query

    if (!allSettings || allSettings.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No review settings configured' })
    }

    let totalSent = 0

    for (const s of allSettings) {
      if (!s.google_review_url) continue

      // Get practitioner info
      const { data: prac } = await supabaseAdmin
        .from('practitioners')
        .select('full_name, practice_name')
        .eq('id', s.practitioner_id)
        .single()

      // Get patients
      const { data: patients } = await supabaseAdmin
        .from('human_patients')
        .select('id, first_name, last_name, email, phone')
        .eq('practitioner_id', s.practitioner_id)
        .eq('archived', false)

      if (!patients) continue

      // Get visit counts
      const { data: visits } = await supabaseAdmin
        .from('human_visits')
        .select('patient_id, visit_date, id')
        .eq('practitioner_id', s.practitioner_id)
        .order('visit_date', { ascending: false })

      if (!visits) continue

      const visitCounts = new Map<string, number>()
      const latestVisit = new Map<string, { date: string; id: string }>()
      for (const v of visits) {
        visitCounts.set(v.patient_id, (visitCounts.get(v.patient_id) || 0) + 1)
        if (!latestVisit.has(v.patient_id)) {
          latestVisit.set(v.patient_id, { date: v.visit_date, id: v.id })
        }
      }

      // Check cooldown
      const cooldownCutoff = new Date()
      cooldownCutoff.setDate(cooldownCutoff.getDate() - s.cooldown_days)

      const { data: recentReqs } = await supabaseAdmin
        .from('review_requests')
        .select('patient_id')
        .eq('practitioner_id', s.practitioner_id)
        .gte('sent_at', cooldownCutoff.toISOString())

      const recentlyAsked = new Set(recentReqs?.map(r => r.patient_id) || [])

      for (const patient of patients) {
        const count = visitCounts.get(patient.id) || 0
        const latest = latestVisit.get(patient.id)

        if (count < s.min_visits_before_ask) continue
        if (!latest) continue
        if (recentlyAsked.has(patient.id)) continue
        if (!patient.email && !patient.phone) continue

        const message = (s.message_template || '')
          .replace(/\{first_name\}/g, patient.first_name)
          .replace(/\{last_name\}/g, patient.last_name)
          .replace(/\{practice_name\}/g, prac?.practice_name || prac?.full_name || '')
          .replace(/\{review_link\}/g, s.google_review_url)

        // Send email
        if ((s.send_method === 'email' || s.send_method === 'both') && patient.email) {
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: process.env.EMAIL_FROM || 'noreply@stride.app',
                to: patient.email,
                subject: `${patient.first_name}, would you leave us a review?`,
                html: `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                  <p>${message.replace(/\n/g, '<br>')}</p>
                  <div style="margin-top: 20px; text-align: center;">
                    <a href="${s.google_review_url}" style="display: inline-block; background: #4285f4; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                      Leave a Google Review
                    </a>
                  </div>
                  <p style="color: #888; font-size: 12px; margin-top: 20px;">— ${prac?.practice_name || prac?.full_name || 'Your Care Team'}</p>
                </div>`,
              }),
            })

            await supabaseAdmin.from('review_requests').insert({
              practitioner_id: s.practitioner_id,
              patient_id: patient.id,
              visit_id: latest.id,
              method: 'email',
              status: 'sent',
            })
            totalSent++
          } catch (err) {
            console.error('Review email error:', err)
          }
        }

        // Send SMS
        if ((s.send_method === 'sms' || s.send_method === 'both') && patient.phone) {
          try {
            const twilioSid = process.env.TWILIO_ACCOUNT_SID
            const twilioAuth = process.env.TWILIO_AUTH_TOKEN
            const twilioFrom = process.env.TWILIO_PHONE_NUMBER

            if (twilioSid && twilioAuth && twilioFrom) {
              await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
                method: 'POST',
                headers: {
                  'Authorization': 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64'),
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  From: twilioFrom,
                  To: patient.phone,
                  Body: message,
                }).toString(),
              })

              await supabaseAdmin.from('review_requests').insert({
                practitioner_id: s.practitioner_id,
                patient_id: patient.id,
                visit_id: latest.id,
                method: 'sms',
                status: 'sent',
              })
              totalSent++
            }
          } catch (err) {
            console.error('Review SMS error:', err)
          }
        }
      }
    }

    return NextResponse.json({ sent: totalSent })
  } catch (error) {
    console.error('Review request send error:', error)
    return NextResponse.json({ error: 'Failed to send review requests' }, { status: 500 })
  }
}
