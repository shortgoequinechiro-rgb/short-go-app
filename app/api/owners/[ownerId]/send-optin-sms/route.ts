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

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({ error: 'Twilio is not configured.' }, { status: 500 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server misconfiguration: missing SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 })
  }

  const supabase = getAdminSupabase()

  const { data: owner, error } = await supabase
    .from('owners')
    .select('id, full_name, phone')
    .eq('id', ownerId)
    .single()

  if (error || !owner) {
    const detail = error?.message || 'No owner row returned'
    return NextResponse.json({ error: `Owner not found: ${detail}` }, { status: 404 })
  }

  if (!owner.phone) {
    return NextResponse.json(
      { error: 'This owner does not have a phone number on file.' },
      { status: 400 }
    )
  }

  const digits = owner.phone.replace(/\D/g, '')
  const toNumber = digits.startsWith('1') ? `+${digits}` : `+1${digits}`
  const firstName = owner.full_name?.split(' ')[0] || owner.full_name || 'there'

  const client = twilio(accountSid, authToken)

  try {
    const message = await client.messages.create({
      from: fromNumber,
      to: toNumber,
      body: `Hi ${firstName}! Short Go Equine Chiropractic would like to send you appointment reminders, intake forms, and consent forms via text. Reply YES to opt in or STOP to opt out. Msg & data rates may apply.`,
    })

    if (message.errorCode) {
      return NextResponse.json(
        { error: `Twilio error ${message.errorCode}: ${message.errorMessage}` },
        { status: 500 }
      )
    }

    // Mark consent as pending
    await supabase.rpc('update_sms_consent', {
      p_owner_id: ownerId,
      p_status: 'pending',
      p_sent_at: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, sid: message.sid })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Twilio error: ${msg}` }, { status: 500 })
  }
}
