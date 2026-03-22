import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Twilio webhook for incoming SMS
export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const from = formData.get('From')?.toString() || ''
    const body = formData.get('Body')?.toString() || ''
    const messageSid = formData.get('MessageSid')?.toString() || ''

    if (!from || !body) {
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    const cleanPhone = from.replace(/\D/g, '')

    // Try to find which practitioner this message is for
    // by matching the phone number to a patient
    const { data: patients } = await supabaseAdmin
      .from('human_patients')
      .select('id, practitioner_id, phone')
      .or(`phone.eq.${from},phone.eq.${cleanPhone},phone.eq.+${cleanPhone}`)
      .limit(1)

    const patient = patients?.[0]

    if (patient) {
      await supabaseAdmin.from('sms_messages').insert({
        practitioner_id: patient.practitioner_id,
        patient_id: patient.id,
        direction: 'inbound',
        phone_number: from,
        body,
        twilio_sid: messageSid,
        status: 'received',
      })
    } else {
      // Save without practitioner mapping — admin can sort it out
      // Try to match by looking at recent outbound messages to this number
      const { data: recent } = await supabaseAdmin
        .from('sms_messages')
        .select('practitioner_id, patient_id')
        .eq('phone_number', cleanPhone)
        .eq('direction', 'outbound')
        .order('created_at', { ascending: false })
        .limit(1)

      await supabaseAdmin.from('sms_messages').insert({
        practitioner_id: recent?.[0]?.practitioner_id || null,
        patient_id: recent?.[0]?.patient_id || null,
        direction: 'inbound',
        phone_number: from,
        body,
        twilio_sid: messageSid,
        status: 'received',
      })
    }

    // Return TwiML response (empty — no auto-reply)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    )
  } catch (error) {
    console.error('SMS webhook error:', error)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }
}
