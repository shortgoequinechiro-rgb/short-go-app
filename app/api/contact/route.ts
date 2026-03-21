import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const fromEmail = process.env.FROM_EMAIL

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, practiceName, message } = await req.json()

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required.' },
        { status: 400 }
      )
    }

    if (!fromEmail) {
      console.error('FROM_EMAIL env variable is not set')
      return NextResponse.json(
        { error: 'Email service is not configured.' },
        { status: 500 }
      )
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0f2040; border-bottom: 2px solid #c9a227; padding-bottom: 8px;">
          New Contact Form Submission
        </h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #0f2040; width: 140px;">Name</td>
            <td style="padding: 8px 12px;">${name}</td>
          </tr>
          <tr style="background: #f8f8f8;">
            <td style="padding: 8px 12px; font-weight: bold; color: #0f2040;">Email</td>
            <td style="padding: 8px 12px;"><a href="mailto:${email}">${email}</a></td>
          </tr>
          ${phone ? `<tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #0f2040;">Phone</td>
            <td style="padding: 8px 12px;">${phone}</td>
          </tr>` : ''}
          ${practiceName ? `<tr style="background: #f8f8f8;">
            <td style="padding: 8px 12px; font-weight: bold; color: #0f2040;">Practice</td>
            <td style="padding: 8px 12px;">${practiceName}</td>
          </tr>` : ''}
        </table>
        <div style="margin-top: 20px; padding: 16px; background: #f0f4f8; border-radius: 8px;">
          <p style="font-weight: bold; color: #0f2040; margin: 0 0 8px;">Message</p>
          <p style="margin: 0; white-space: pre-wrap; color: #333;">${message}</p>
        </div>
      </div>
    `

    await resend.emails.send({
      from: fromEmail,
      to: ['shortgoequinechiro@gmail.com'],
      replyTo: email,
      subject: `Stride Contact: ${name}`,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Contact form error:', err)
    return NextResponse.json(
      { error: 'Failed to send message. Please try again.' },
      { status: 500 }
    )
  }
}
