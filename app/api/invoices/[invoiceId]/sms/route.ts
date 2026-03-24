import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '../../../../lib/auth'
import twilio from 'twilio'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { user, error } = await requireAuth(request)
    if (error) return error

    const { invoiceId } = await params

    // Fetch invoice
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select(
        `
        id,
        invoice_number,
        invoice_date,
        due_date,
        status,
        total_cents,
        stripe_payment_url,
        owner_id,
        horse_id,
        practitioner_id
      `
      )
      .eq('id', invoiceId)
      .eq('practitioner_id', user.id)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Fetch owner with phone
    const { data: owner, error: ownerError } = await supabaseAdmin
      .from('owners')
      .select('full_name, phone, email')
      .eq('id', invoice.owner_id)
      .single()

    if (ownerError || !owner || !owner.phone) {
      return NextResponse.json(
        { error: 'Owner phone number not found. Please add a phone number for this owner.' },
        { status: 404 }
      )
    }

    // Fetch horse name
    const { data: horse } = await supabaseAdmin
      .from('horses')
      .select('name')
      .eq('id', invoice.horse_id)
      .single()

    // Fetch practitioner info
    const { data: practitioner } = await supabaseAdmin
      .from('users')
      .select('practice_name')
      .eq('id', invoice.practitioner_id)
      .single()

    const practiceName = practitioner?.practice_name || 'Stride Chiropractic'
    const totalDollars = (invoice.total_cents / 100).toFixed(2)
    const horseName = horse?.name || 'your horse'

    // Build SMS message
    let smsBody = `Hi ${owner.full_name}! This is ${practiceName}. `
    smsBody += `Invoice ${invoice.invoice_number} for ${horseName} — $${totalDollars}.`

    if (invoice.due_date) {
      smsBody += ` Due: ${new Date(invoice.due_date).toLocaleDateString()}.`
    }

    if (invoice.stripe_payment_url) {
      smsBody += `\n\nPay online: ${invoice.stripe_payment_url}`
    }

    smsBody += `\n\nQuestions? Reply to this text or contact us directly.`

    // Format phone number (ensure it has +1 prefix for US)
    let phone = owner.phone.replace(/\D/g, '')
    if (phone.length === 10) {
      phone = '1' + phone
    }
    if (!phone.startsWith('+')) {
      phone = '+' + phone
    }

    // Send SMS via Twilio
    const message = await twilioClient.messages.create({
      body: smsBody,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    })

    // Log the communication
    await supabaseAdmin.from('communication_log').insert({
      practitioner_id: user.id,
      owner_id: invoice.owner_id,
      invoice_id: invoiceId,
      channel: 'sms',
      message_type: 'invoice',
      recipient: owner.phone,
      subject: null,
      body_preview: smsBody.substring(0, 100),
      status: 'sent',
      external_id: message.sid,
    })

    // Update invoice status to 'sent' if currently 'draft'
    if (invoice.status === 'draft') {
      await supabaseAdmin
        .from('invoices')
        .update({ status: 'sent', updated_at: new Date().toISOString() })
        .eq('id', invoiceId)
    }

    return NextResponse.json({
      success: true,
      messageSid: message.sid,
      sentTo: owner.phone,
    })
  } catch (err) {
    console.error('SMS route error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
