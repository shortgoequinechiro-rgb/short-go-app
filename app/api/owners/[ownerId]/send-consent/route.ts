import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

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

  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.FROM_EMAIL || 'Short-Go Equine Chiropractic <info@mail.shortgochiro.com>'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://short-go-app.vercel.app'

  if (!resendKey) {
    return NextResponse.json({ error: 'Email service is not configured.' }, { status: 500 })
  }

  const supabase = getAdminSupabase()

  const { data: owner, error } = await supabase
    .from('owners')
    .select('id, full_name, email')
    .eq('id', ownerId)
    .single()

  if (error || !owner) {
    return NextResponse.json({ error: 'Owner not found.' }, { status: 404 })
  }

  if (!owner.email) {
    return NextResponse.json(
      { error: 'This owner does not have an email address on file.' },
      { status: 400 }
    )
  }

  const consentUrl = `${appUrl}/consent/${ownerId}`
  const firstName = owner.full_name?.split(' ')[0] || owner.full_name || 'there'

  const resend = new Resend(resendKey)

  const { error: emailError } = await resend.emails.send({
    from: fromEmail,
    to: owner.email,
    subject: 'Consent Form – Short-Go Equine Chiropractic',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 16px;color:#1e293b">
        <h2 style="margin:0 0 8px">Hi ${firstName},</h2>
        <p style="margin:0 0 24px;color:#475569">
          Dr. Leo has sent you a consent form to review and sign before your appointment.
          It only takes a minute to complete.
        </p>
        <a href="${consentUrl}"
           style="display:inline-block;background:#0f2040;color:#fff;font-weight:600;
                  padding:14px 28px;border-radius:12px;text-decoration:none;font-size:15px">
          Review &amp; Sign Consent Form →
        </a>
        <p style="margin:32px 0 0;font-size:12px;color:#94a3b8">
          Short-Go Equine Chiropractic · Dr. Andrew Leo, D.C. c.AVCA
        </p>
      </div>
    `,
  })

  if (emailError) {
    return NextResponse.json({ error: `Email error: ${emailError.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
