import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth'
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
  const { user, error: authError } = await requireAuth(_req)
  if (authError) return authError

  const { ownerId } = await params

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://short-go-app.vercel.app'

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({ error: 'Twilio is not configured.' }, { status: 500 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server misconfiguration: missing SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 })
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

  // Verify the authenticated practitioner owns this client
  if (owner.practitioner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
    // Save the pending action so it auto-sends after opt-in
    await supabase.from('owners').update({ pending_sms_action: 'consent' }).eq('id', ownerId)
    return NextResponse.json(
      { error: 'SMS_CONSENT_REQUIRED', needsConsent: true },
      { status: 403 }
    )
  }

  const digits = owner.phone.replace(/\D/g, '')
  const toNumber = digits.startsWith('1') ? `+${digits}` : `+1${digits}`

  const consentUrl = `${appUrl}/consent/${ownerId}`
  const firstName = owner.full_name?.split(' ')[0] || owner.full_name || 'there'

  const client = twilio(accountSid, authToken)

  try {
    const message = await client.messages.create({
      from: fromNumber,
      to: toNumber,
      body: `Hi ${firstName}! ${doctorName} sent you a consent form to sign before your appointment. It only takes a minute: ${consentUrl}`,
    })

    if (message.errorCode) {
      console.error(`Twilio error ${message.errorCode}: ${message.errorMessage}`)
      return NextResponse.json(
        { error: 'Failed to send SMS.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, sid: message.sid })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Twilio error:', msg)
    return NextResponse.json({ error: 'Failed to send SMS.' }, { status: 500 })
  }
}
