import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Twilio incoming SMS webhook.
 * Handles opt-in (YES) and opt-out (STOP) replies from clients.
 *
 * Configure in Twilio Console:
 *   Phone Number > Messaging > "A Message Comes In" webhook URL:
 *   https://your-app.vercel.app/api/sms/incoming
 */

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  // Twilio sends form-encoded data
  const formData = await req.formData()
  const from = formData.get('From') as string | null
  const body = (formData.get('Body') as string | null)?.trim().toUpperCase() || ''

  if (!from) {
    return twimlResponse('')
  }

  // Normalize the incoming phone number to match our stored format
  const digits = from.replace(/\D/g, '')
  // Try multiple formats to match: +18881234567, 8881234567, (888) 123-4567, etc.
  const possibleFormats = [
    digits,                                    // 18881234567
    digits.replace(/^1/, ''),                  // 8881234567
    `+${digits}`,                              // +18881234567
  ]

  const supabase = getAdminSupabase()

  // Find the owner by phone number
  const { data: owners } = await supabase
    .from('owners')
    .select('id, phone, sms_consent_status')

  if (!owners || owners.length === 0) {
    return twimlResponse('')
  }

  // Match owner by normalized phone digits
  const owner = owners.find(o => {
    if (!o.phone) return false
    const ownerDigits = o.phone.replace(/\D/g, '')
    return possibleFormats.includes(ownerDigits) || possibleFormats.includes(`1${ownerDigits}`)
  })

  if (!owner) {
    return twimlResponse('')
  }

  const optInKeywords = ['YES', 'Y', 'OPTIN', 'OPT IN', 'START', 'SUBSCRIBE']
  const optOutKeywords = ['STOP', 'NO', 'N', 'OPTOUT', 'OPT OUT', 'UNSUBSCRIBE', 'CANCEL', 'QUIT']

  if (optInKeywords.includes(body)) {
    await supabase.rpc('update_sms_consent', {
      p_owner_id: owner.id,
      p_status: 'opted_in',
      p_responded_at: new Date().toISOString(),
    })
    return twimlResponse(
      "You're now opted in to receive texts from Short Go Equine Chiropractic. Reply STOP at any time to unsubscribe."
    )
  }

  if (optOutKeywords.includes(body)) {
    await supabase.rpc('update_sms_consent', {
      p_owner_id: owner.id,
      p_status: 'opted_out',
      p_responded_at: new Date().toISOString(),
    })
    return twimlResponse(
      "You've been unsubscribed from Short Go Equine Chiropractic texts. You will not receive any more messages. Reply YES to re-subscribe."
    )
  }

  // For any other message, don't reply
  return twimlResponse('')
}

/** Return a TwiML response */
function twimlResponse(message: string) {
  const twiml = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`

  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}
