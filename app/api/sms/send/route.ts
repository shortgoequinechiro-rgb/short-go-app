import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { practitionerId, to, body, patientId } = await req.json()

    if (!practitionerId || !to || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const twilioSid = process.env.TWILIO_ACCOUNT_SID
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER

    let twilioMsgSid = null

    if (twilioSid && twilioAuth && twilioFrom) {
      const cleanTo = to.replace(/\D/g, '')
      const formattedTo = cleanTo.startsWith('1') ? `+${cleanTo}` : `+1${cleanTo}`

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: twilioFrom,
            To: formattedTo,
            Body: body,
          }).toString(),
        }
      )

      const twilioData = await twilioRes.json()
      twilioMsgSid = twilioData.sid
    }

    // Save to database
    const { data, error } = await supabaseAdmin.from('sms_messages').insert({
      practitioner_id: practitionerId,
      patient_id: patientId || null,
      direction: 'outbound',
      phone_number: to,
      body,
      twilio_sid: twilioMsgSid,
      status: 'sent',
    }).select().single()

    if (error) {
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
    }

    return NextResponse.json({ id: data?.id, status: 'sent' })
  } catch (error) {
    console.error('SMS send error:', error)
    return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 })
  }
}
