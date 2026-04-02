import { NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '../../../lib/auth'

/**
 * POST /api/vet-auth/request
 * Sends a vet authorization request via email (Resend) or SMS (Twilio).
 * Body: { horse_id, vet_email?, vet_phone?, vet_name, method: 'email' | 'sms' }
 */
export async function POST(req: Request) {
  const { user, error } = await requireAuth(req)
  if (error) return error

  const { horse_id, vet_email, vet_phone, vet_name, method } = await req.json()

  if (!horse_id || !vet_name) {
    return NextResponse.json({ error: 'horse_id and vet_name are required' }, { status: 400 })
  }

  // Get horse details
  const { data: horse } = await supabaseAdmin
    .from('horses')
    .select('id, name')
    .eq('id', horse_id)
    .eq('practitioner_id', user!.id)
    .single()

  if (!horse) {
    return NextResponse.json({ error: 'Horse not found' }, { status: 404 })
  }

  // Get practitioner info for the message
  const { data: practitioner } = await supabaseAdmin
    .from('practitioners')
    .select('full_name, practice_name')
    .eq('id', user!.id)
    .single()

  const practiceName = practitioner?.practice_name || practitioner?.full_name || 'Your animal chiropractor'

  // Build the public authorization URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'
  const authUrl = `${baseUrl}/authorize/${horse_id}`

  if (method === 'email' && vet_email) {
    // Send via Resend
    try {
      const resendKey = process.env.RESEND_API_KEY
      if (!resendKey) {
        return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
      }

      const { Resend } = await import('resend')
      const resend = new Resend(resendKey)

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@stride.app',
        to: vet_email,
        subject: `Veterinary Authorization Request — ${horse.name}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e3a5f;">Veterinary Authorization Request</h2>
            <p>Hello Dr. ${vet_name},</p>
            <p><strong>${practiceName}</strong> is requesting your authorization to provide chiropractic care for <strong>${horse.name}</strong>.</p>
            <p>Under Texas Occupations Code Chapter 801, a veterinary examination and authorization is required before animal chiropractic treatment can be provided.</p>
            <p>Please click the link below to review and submit your authorization:</p>
            <p style="text-align: center; margin: 24px 0;">
              <a href="${authUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                Complete Authorization Form
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">This form takes about 2 minutes to complete. The authorization will be valid for 1 year.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #999; font-size: 12px;">Sent by ${practiceName} via Stride</p>
          </div>
        `,
      })

      return NextResponse.json({ sent: true, method: 'email', sentTo: vet_email })
    } catch (err) {
      console.error('Failed to send vet auth email:', err)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }
  } else if (method === 'sms' && vet_phone) {
    // Send via Twilio
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      const fromNumber = process.env.TWILIO_PHONE_NUMBER

      if (!accountSid || !authToken || !fromNumber) {
        return NextResponse.json({ error: 'SMS not configured' }, { status: 500 })
      }

      const twilio = await import('twilio')
      const client = twilio.default(accountSid, authToken)

      await client.messages.create({
        body: `${practiceName} is requesting your veterinary authorization for chiropractic care for ${horse.name}. Please complete the form: ${authUrl}`,
        to: vet_phone,
        from: fromNumber,
      })

      return NextResponse.json({ sent: true, method: 'sms', sentTo: vet_phone })
    } catch (err) {
      console.error('Failed to send vet auth SMS:', err)
      return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Must provide vet_email (for email) or vet_phone (for sms)' }, { status: 400 })
}
