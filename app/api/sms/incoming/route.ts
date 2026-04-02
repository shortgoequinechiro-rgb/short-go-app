import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createNotification } from '../../../lib/notifications'

/**
 * Twilio incoming SMS webhook.
 * Handles opt-in (YES) and opt-out (STOP) replies from clients.
 *
 * Configure in Twilio Console:
 *   Phone Number > Messaging > "A Message Comes In" webhook URL:
 *   https://short-go-app.vercel.app/api/sms/incoming
 */

// ── In-memory rate limiter (per phone number, resets on deploy) ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_MINUTE = 10

function isRateLimited(phoneNumber: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(phoneNumber)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(phoneNumber, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  entry.count++
  if (entry.count > MAX_REQUESTS_PER_MINUTE) return true
  return false
}

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  // ── Twilio signature verification ──
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN
  const twilioSignature = req.headers.get('x-twilio-signature') || ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://short-go-app.vercel.app'
  const webhookUrl = `${appUrl}/api/sms/incoming`

  if (!twilioAuthToken) {
    console.error('[sms/incoming] TWILIO_AUTH_TOKEN not configured')
    return twimlResponse('')
  }

  // Clone the request to read body twice (once for validation, once for processing)
  const rawBody = await req.text()
  const urlParams = new URLSearchParams(rawBody)
  const params: Record<string, string> = {}
  urlParams.forEach((value, key) => { params[key] = value })

  // Validate Twilio request signature
  const isValid = twilio.validateRequest(twilioAuthToken, twilioSignature, webhookUrl, params)
  if (!isValid) {
    console.warn('[sms/incoming] Invalid Twilio signature — rejecting request')
    return new NextResponse('Forbidden', { status: 403 })
  }

  // Twilio sends form-encoded data
  const from = params['From'] || null
  const body = (params['Body'] || '').trim().toUpperCase()

  // ── Rate limiting per phone number ──
  if (from && isRateLimited(from)) {
    console.warn(`[sms/incoming] Rate limit exceeded for ${from}`)
    return new NextResponse('Too Many Requests', { status: 429 })
  }

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
    .select('id, phone, sms_consent_status, pending_sms_action, full_name, practitioner_id')

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

  // Fetch practice name if available
  let practiceName = 'Your Care Provider'
  if (owner.practitioner_id) {
    const { data: practitioner } = await supabase
      .from('practitioners')
      .select('practice_name')
      .eq('id', owner.practitioner_id)
      .single()
    if (practitioner?.practice_name) practiceName = practitioner.practice_name
  }

  if (optInKeywords.includes(body)) {
    await supabase.rpc('update_sms_consent', {
      p_owner_id: owner.id,
      p_status: 'opted_in',
      p_responded_at: new Date().toISOString(),
    })

    // Create notification for practitioner
    await createNotification(
      owner.practitioner_id || '',
      'sms_received',
      'SMS Received',
      `From ${owner.full_name || from}: Opted in to SMS`
    )

    // Auto-send any pending form
    const pendingAction = owner.pending_sms_action
    if (pendingAction === 'intake' || pendingAction === 'consent') {
      // Clear the pending action first
      await supabase.from('owners').update({ pending_sms_action: null }).eq('id', owner.id)

      // Send the pending form
      try {
        await sendPendingForm(owner, pendingAction, supabase)
      } catch {
        // Don't fail the opt-in if the form send fails
      }
    }

    return twimlResponse(
      `You're now opted in to receive texts from ${practiceName}. Reply STOP at any time to unsubscribe.`
    )
  }

  if (optOutKeywords.includes(body)) {
    await supabase.rpc('update_sms_consent', {
      p_owner_id: owner.id,
      p_status: 'opted_out',
      p_responded_at: new Date().toISOString(),
    })

    // Create notification for practitioner
    await createNotification(
      owner.practitioner_id || '',
      'sms_received',
      'SMS Received',
      `From ${owner.full_name || from}: Opted out of SMS`
    )

    return twimlResponse(
      `You've been unsubscribed from ${practiceName} texts. You will not receive any more messages. Reply YES to re-subscribe.`
    )
  }

  // For any other message, create notification
  if (body) {
    await createNotification(
      owner.practitioner_id || '',
      'sms_received',
      'SMS Received',
      `From ${owner.full_name || from}: ${body.substring(0, 50)}${body.length > 50 ? '...' : ''}`
    )
  }

  // For any other message, don't reply
  return twimlResponse('')
}

/** Auto-send the intake or consent form after opt-in */
async function sendPendingForm(
  owner: { id: string; full_name: string | null; phone: string | null; practitioner_id: string | null },
  action: 'intake' | 'consent',
  supabase: ReturnType<typeof getAdminSupabase>
) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://short-go-app.vercel.app'

  if (!accountSid || !authToken || !fromNumber || !owner.phone) return

  let doctorName = 'Your practitioner'
  if (owner.practitioner_id) {
    const { data: prac } = await supabase
      .from('practitioners')
      .select('full_name')
      .eq('id', owner.practitioner_id)
      .single()
    if (prac?.full_name) doctorName = prac.full_name
  }

  const digits = owner.phone.replace(/\D/g, '')
  const toNumber = digits.startsWith('1') ? `+${digits}` : `+1${digits}`
  const firstName = owner.full_name?.split(' ')[0] || owner.full_name || 'there'

  const client = twilio(accountSid, authToken)

  if (action === 'intake') {
    const intakeUrl = `${appUrl}/intake/${owner.id}`
    await client.messages.create({
      from: fromNumber,
      to: toNumber,
      body: `Hi ${firstName}! ${doctorName} sent you an intake form to complete before your appointment. Fill it out here: ${intakeUrl}`,
    })
  } else {
    const consentUrl = `${appUrl}/consent/${owner.id}`
    await client.messages.create({
      from: fromNumber,
      to: toNumber,
      body: `Hi ${firstName}! ${doctorName} sent you a consent form to sign before your appointment. It only takes a minute: ${consentUrl}`,
    })
  }
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
