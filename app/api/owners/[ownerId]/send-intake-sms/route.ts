import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ ownerId: string }> }
) {
  const { ownerId } = await params

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://short-go-app.vercel.app'

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({ error: 'Twilio is not configured.' }, { status: 500 })
  }

  const supabase = getAdminSupabase()

  const { data: owner, error } = await supabase
    .from('owners')
    .select('id, full_name, phone, sms_consent_status, practitioner_id')
    .eq('id', ownerId)
    .single()

  if (error || !owner) {
    return NextResponse.json({ error: 'Owner not found.' }, { status: 404 })
  }

  let doctorName = 'Your practitioner'
  if (owner.practitioner_id) {
    const { data: prac } = await supabase
      .from('practitioners')
      .select('full_name')
      .eq('id', owner.practitioner_id)
      .single()
    if (prac?.full_name) doctorName = prac.full_name
  }

  if (!owner.phone) {
    return NextResponse.json(
      { error: 'This owner does not have a phone number on file.' },
      { status: 400 }
    )
  }

  if (owner.sms_consent_status !== 'opted_in') {
    return NextResponse.json(
      { error: 'SMS_CONSENT_REQUIRED', needsConsent: true },
      { status: 403 }
    )
  }

  // Strip non-digits and ensure +1 country code
  const digits = owner.phone.replace(/\D/g, '')
  const toNumber = digits.startsWith('1') ? `+${digits}` : `+1${digits}`

  const intakeUrl = `${appUrl}/intake/${ownerId}`
  const firstName = owner.full_name?.split(' ')[0] || owner.full_name || 'there'

  const client = twilio(accountSid, authToken)

  try {
    const message = await client.messages.create({
      from: fromNumber,
      to: toNumber,
      body: `Hi ${firstName}! ${doctorName} sent you an intake form to complete before your appointment. Fill it out here: ${intakeUrl}`,
    })

    if (message.errorCode) {
      return NextResponse.json(
        { error: `Twilio error ${message.errorCode}: ${message.errorMessage}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, sid: message.sid })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Twilio error: ${msg}` }, { status: 500 })
  }
}
