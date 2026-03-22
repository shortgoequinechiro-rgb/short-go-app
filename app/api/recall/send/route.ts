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

    // Get all practitioners with recall enabled (or specific one)
    const query = supabaseAdmin
      .from('recall_settings')
      .select('*')
      .eq('recall_enabled', true)

    if (practitionerId) {
      query.eq('practitioner_id', practitionerId)
    }

    const { data: settings } = await query

    if (!settings || settings.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No recall settings configured' })
    }

    let totalSent = 0

    for (const s of settings) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - s.inactive_days)

      // Get practitioner info
      const { data: prac } = await supabaseAdmin
        .from('practitioners')
        .select('full_name, practice_name, email')
        .eq('id', s.practitioner_id)
        .single()

      // Get all patients for this practitioner
      const { data: patients } = await supabaseAdmin
        .from('human_patients')
        .select('id, first_name, last_name, email, phone')
        .eq('practitioner_id', s.practitioner_id)
        .eq('archived', false)

      if (!patients || patients.length === 0) continue

      // Get latest visit per patient
      const { data: visits } = await supabaseAdmin
        .from('human_visits')
        .select('patient_id, visit_date')
        .eq('practitioner_id', s.practitioner_id)
        .order('visit_date', { ascending: false })

      if (!visits) continue

      const latestVisitMap = new Map<string, string>()
      for (const v of visits) {
        if (!latestVisitMap.has(v.patient_id)) {
          latestVisitMap.set(v.patient_id, v.visit_date)
        }
      }

      // Check which patients already got a recall recently (within follow_up_days[0])
      const recentCutoff = new Date()
      const minFollowUp = Math.min(...(s.follow_up_days || [7]))
      recentCutoff.setDate(recentCutoff.getDate() - minFollowUp)

      const { data: recentRecalls } = await supabaseAdmin
        .from('recall_messages')
        .select('patient_id')
        .eq('practitioner_id', s.practitioner_id)
        .gte('sent_at', recentCutoff.toISOString())

      const recentlyContacted = new Set(recentRecalls?.map(r => r.patient_id) || [])

      const now = new Date()

      for (const patient of patients) {
        const lastVisit = latestVisitMap.get(patient.id)
        if (!lastVisit) continue

        const visitDate = new Date(lastVisit)
        const daysSince = Math.floor((now.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24))

        if (daysSince < s.inactive_days) continue
        if (recentlyContacted.has(patient.id)) continue

        // Build message
        const message = (s.message_template || '')
          .replace(/\{first_name\}/g, patient.first_name)
          .replace(/\{last_name\}/g, patient.last_name)
          .replace(/\{days_inactive\}/g, String(daysSince))
          .replace(/\{practice_name\}/g, prac?.practice_name || prac?.full_name || '')

        // Send email if applicable
        if ((s.reminder_method === 'email' || s.reminder_method === 'both') && patient.email) {
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
                subject: `We miss you, ${patient.first_name}! Time to schedule your next visit`,
                html: `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                  <p>${message.replace(/\n/g, '<br>')}</p>
                  <p style="color: #888; font-size: 12px; margin-top: 20px;">— ${prac?.practice_name || prac?.full_name || 'Your Care Team'}</p>
                </div>`,
              }),
            })

            await supabaseAdmin.from('recall_messages').insert({
              practitioner_id: s.practitioner_id,
              patient_id: patient.id,
              method: 'email',
              message_text: message,
              days_inactive: daysSince,
              follow_up_number: 1,
              status: 'sent',
            })
            totalSent++
          } catch (err) {
            console.error('Recall email error:', err)
          }
        }

        // Send SMS if applicable
        if ((s.reminder_method === 'sms' || s.reminder_method === 'both') && patient.phone) {
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

              await supabaseAdmin.from('recall_messages').insert({
                practitioner_id: s.practitioner_id,
                patient_id: patient.id,
                method: 'sms',
                message_text: message,
                days_inactive: daysSince,
                follow_up_number: 1,
                status: 'sent',
              })
              totalSent++
            }
          } catch (err) {
            console.error('Recall SMS error:', err)
          }
        }
      }
    }

    return NextResponse.json({ sent: totalSent })
  } catch (error) {
    console.error('Recall send error:', error)
    return NextResponse.json({ error: 'Failed to send recall messages' }, { status: 500 })
  }
}
