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

  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.FROM_EMAIL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stride-app.vercel.app'

  if (!resendApiKey) {
    return NextResponse.json({ error: 'Missing RESEND_API_KEY' }, { status: 500 })
  }
  if (!fromEmail) {
    return NextResponse.json({ error: 'Missing FROM_EMAIL' }, { status: 500 })
  }

  const supabase = getAdminSupabase()

  const { data: owner, error } = await supabase
    .from('owners')
    .select('id, full_name, email, practitioner_id')
    .eq('id', ownerId)
    .single()

  if (error || !owner) {
    return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
  }

  let practitioner: any = null
  if (owner.practitioner_id) {
    const { data: prac } = await supabase
      .from('practitioners')
      .select('logo_url')
      .eq('id', owner.practitioner_id)
      .single()
    practitioner = prac
  }

  if (!owner.email) {
    return NextResponse.json(
      { error: 'This owner does not have an email address on file.' },
      { status: 400 }
    )
  }

  const intakeUrl = `${appUrl}/intake/${ownerId}`
  const firstName = owner.full_name?.split(' ')[0] || owner.full_name || 'there'

  const resend = new Resend(resendApiKey)

  const result = await resend.emails.send({
    from: fromEmail,
    to: owner.email,
    subject: 'Please complete your intake form – Stride Equine Chiropractic',
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
        <div style="background: #0f2040; padding: 24px 32px; border-radius: 12px 12px 0 0;">
          ${practitioner?.logo_url ? `<img src="${practitioner.logo_url}" alt="Logo" style="max-height: 48px; margin-bottom: 8px; display: block;" />` : ''}
          <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 700;">
            Stride Equine Chiropractic
          </h1>
        </div>

        <div style="background: #f8fafc; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="margin: 0 0 16px; font-size: 16px;">Hi ${firstName},</p>

          <p style="margin: 0 0 16px; font-size: 15px; color: #475569;">
            Please take a moment to fill out your patient intake form before your appointment.
            It only takes a few minutes and helps us provide the best possible care.
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${intakeUrl}"
               style="background: #0f2040; color: white; text-decoration: none; padding: 14px 32px;
                      border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
              Complete Intake Form →
            </a>
          </div>

          <p style="margin: 0 0 8px; font-size: 13px; color: #94a3b8;">
            Or copy and paste this link into your browser:
          </p>
          <p style="margin: 0; font-size: 13px; color: #64748b; word-break: break-all;">
            ${intakeUrl}
          </p>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0;" />

          <p style="margin: 0; font-size: 13px; color: #94a3b8;">
            Dr. Andrew Leo D.C., M.S., cAVCA<br/>
            Stride Equine Chiropractic
          </p>
        </div>
      </div>
    `,
    text: `Hi ${firstName},\n\nPlease fill out your intake form before your appointment:\n\n${intakeUrl}\n\nThank you,\nDr. Andrew Leo D.C., M.S., cAVCA\nStride Equine Chiropractic`,
  })

  if ((result as any)?.error) {
    return NextResponse.json(
      { error: (result as any).error.message || 'Failed to send email.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
