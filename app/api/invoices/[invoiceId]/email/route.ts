import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '../../../../lib/auth'
import { Resend } from 'resend'
import { generateInvoicePdf } from '../generateInvoicePdf'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { user, error } = await requireAuth(request)
    if (error) return error

    const { invoiceId } = await params

    // Fetch invoice with line items
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select(
        `
        *,
        invoice_line_items (
          id,
          description,
          quantity,
          unit_price_cents
        )
      `
      )
      .eq('id', invoiceId)
      .eq('practitioner_id', user.id)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Fetch owner info from owners table
    const { data: owner, error: ownerError } = await supabaseAdmin
      .from('owners')
      .select('full_name, email, phone, address')
      .eq('id', invoice.owner_id)
      .single()

    if (ownerError || !owner || !owner.email) {
      return NextResponse.json(
        { error: 'Owner email not found. Please add an email address for this owner.' },
        { status: 404 }
      )
    }

    // Fetch horse info
    const { data: horse, error: horseError } = await supabaseAdmin
      .from('horses')
      .select('name')
      .eq('id', invoice.horse_id)
      .single()

    if (horseError || !horse) {
      return NextResponse.json({ error: 'Horse not found' }, { status: 404 })
    }

    // Fetch practitioner info
    const { data: practitioner, error: practitionerError } = await supabaseAdmin
      .from('users')
      .select('full_name, practice_name, location')
      .eq('id', invoice.practitioner_id)
      .single()

    if (practitionerError || !practitioner) {
      return NextResponse.json({ error: 'Practitioner not found' }, { status: 404 })
    }

    // Map line items for PDF (convert cents to dollars for display)
    const lineItemsForPdf = invoice.invoice_line_items.map(
      (item: { id: string; description: string; quantity: number; unit_price_cents: number }) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price_cents / 100,
        total: (item.unit_price_cents * item.quantity) / 100,
      })
    )

    // Map invoice for PDF (convert cents to dollars)
    const invoiceForPdf = {
      ...invoice,
      subtotal: invoice.subtotal_cents / 100,
      tax: (invoice.tax_cents || 0) / 100,
      total: invoice.total_cents / 100,
    }

    // Generate PDF
    const pdfBytes = await generateInvoicePdf(
      invoiceForPdf,
      lineItemsForPdf,
      owner,
      horse,
      practitioner
    )

    // Format line items summary for email
    const lineItemsSummary = lineItemsForPdf
      .map(
        (item: { description: string; quantity: number; total: number }) =>
          `<li style="padding: 8px 0; border-bottom: 1px solid #eee;">${item.description} (Qty: ${item.quantity}) — $${item.total.toFixed(2)}</li>`
      )
      .join('')

    const totalDollars = invoice.total_cents / 100
    const subtotalDollars = invoice.subtotal_cents / 100

    // Build Stripe payment link if available
    const paymentLinkHtml = invoice.stripe_payment_url
      ? `<div style="text-align: center; margin: 30px 0;">
          <a href="${invoice.stripe_payment_url}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Pay Now — $${totalDollars.toFixed(2)}</a>
        </div>`
      : ''

    // Create email HTML body
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Invoice from ${practitioner.practice_name || 'Stride Chiropractic'}</h2>
        <p style="color: #666;">Hello ${owner.full_name},</p>
        <p style="color: #666;">Please find your invoice details below. A PDF copy is also attached.</p>

        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <div style="margin-bottom: 15px;">
            <p style="color: #999; font-size: 12px; margin: 0 0 5px 0;">INVOICE NUMBER</p>
            <p style="color: #333; font-size: 18px; font-weight: bold; margin: 0;">${invoice.invoice_number}</p>
          </div>
          <div style="margin-bottom: 15px;">
            <p style="color: #999; font-size: 12px; margin: 0 0 5px 0;">PATIENT</p>
            <p style="color: #333; font-size: 16px; font-weight: bold; margin: 0;">${horse.name}</p>
          </div>
          <div style="margin-bottom: 15px;">
            <p style="color: #999; font-size: 12px; margin: 0 0 5px 0;">DATE</p>
            <p style="color: #333; margin: 0;">${new Date(invoice.invoice_date).toLocaleDateString()}</p>
          </div>
          ${invoice.due_date ? `<div>
            <p style="color: #999; font-size: 12px; margin: 0 0 5px 0;">DUE DATE</p>
            <p style="color: #333; margin: 0;">${new Date(invoice.due_date).toLocaleDateString()}</p>
          </div>` : ''}
        </div>

        <div style="margin: 20px 0;">
          <h3 style="color: #333; margin: 0 0 15px 0;">Services</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${lineItemsSummary}
          </ul>
        </div>

        <div style="background-color: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="color: #666;">Subtotal:</span>
            <span style="color: #333; font-weight: bold;">$${subtotalDollars.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 2px solid #ddd; padding-top: 10px;">
            <span style="color: #333; font-weight: bold; font-size: 16px;">Total Due:</span>
            <span style="color: #333; font-weight: bold; font-size: 16px;">$${totalDollars.toFixed(2)}</span>
          </div>
        </div>

        ${paymentLinkHtml}

        <p style="color: #666; font-size: 14px; margin-top: 20px;">If you have any questions about this invoice, please don't hesitate to contact us.</p>

        <p style="color: #999; font-size: 12px; margin-top: 40px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
          Thank you for your business.
        </p>
      </div>
    `

    // Convert PDF bytes to Buffer for attachment
    const pdfBuffer = Buffer.from(pdfBytes)

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'noreply@stride.app',
      to: owner.email,
      subject: `Invoice ${invoice.invoice_number} from ${practitioner.practice_name || 'Stride Chiropractic'}`,
      html: emailHtml,
      attachments: [
        {
          filename: `invoice-${invoice.invoice_number}.pdf`,
          content: pdfBuffer,
        },
      ],
    })

    if (emailResponse.error) {
      console.error('Email send error:', emailResponse.error)
      return NextResponse.json(
        { error: 'Failed to send email: ' + emailResponse.error.message },
        { status: 500 }
      )
    }

    // Log the communication
    const emailId = emailResponse.data?.id || null
    await supabaseAdmin.from('communication_log').insert({
      practitioner_id: user.id,
      owner_id: invoice.owner_id,
      invoice_id: invoiceId,
      channel: 'email',
      message_type: 'invoice',
      recipient: owner.email,
      subject: `Invoice ${invoice.invoice_number} from ${practitioner.practice_name || 'Stride Chiropractic'}`,
      body_preview: `Invoice for $${(invoice.total_cents / 100).toFixed(2)}`,
      status: 'sent',
      external_id: emailId,
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
      emailId: emailResponse.data?.id,
      sentTo: owner.email,
    })
  } catch (error) {
    console.error('Email route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
