import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '../../../../lib/auth'
import { getStripe } from '../../../../lib/stripe'
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
    const { data: practitionerRaw, error: practitionerError } = await supabaseAdmin
      .from('practitioners')
      .select('full_name, practice_name, location, venmo_handle, paypal_email, zelle_info, cash_app_handle')
      .eq('id', invoice.practitioner_id)
      .single()

    if (practitionerError || !practitionerRaw) {
      return NextResponse.json({ error: 'Practitioner not found' }, { status: 404 })
    }

    // Ensure no null values for PDF generation
    const practitioner = {
      full_name: practitionerRaw.full_name || 'Practitioner',
      practice_name: practitionerRaw.practice_name || 'Stride Chiropractic',
      location: practitionerRaw.location || '',
      venmo_handle: practitionerRaw.venmo_handle || '',
      paypal_email: practitionerRaw.paypal_email || '',
      zelle_info: practitionerRaw.zelle_info || '',
      cash_app_handle: practitionerRaw.cash_app_handle || '',
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

    // Auto-generate a Stripe payment link if one doesn't exist yet
    let paymentUrl = invoice.stripe_payment_url
    if (!paymentUrl) {
      try {
        const stripe = getStripe()
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

        const paymentLink = await stripe.paymentLinks.create({
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: `Invoice ${invoice.invoice_number}`,
                },
                unit_amount: invoice.total_cents,
              },
              quantity: 1,
            },
          ],
          metadata: {
            invoiceId,
            practitionerId: user.id,
          },
          after_completion: {
            type: 'redirect',
            redirect: {
              url: `${appUrl}/invoices/${invoiceId}?paid=true`,
            },
          },
        })

        paymentUrl = paymentLink.url

        // Save the payment link on the invoice for future use
        await supabaseAdmin
          .from('invoices')
          .update({
            stripe_payment_link_id: paymentLink.id,
            stripe_payment_url: paymentLink.url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoiceId)
      } catch (stripeErr) {
        console.error('Failed to auto-generate payment link for email:', stripeErr)
      }
    }

    // Build Stripe payment link button
    const paymentLinkHtml = paymentUrl
      ? `<div style="text-align: center; margin: 30px 0;">
          <a href="${paymentUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Pay Now — $${totalDollars.toFixed(2)}</a>
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

        ${(practitioner.venmo_handle || practitioner.paypal_email || practitioner.zelle_info || practitioner.cash_app_handle) ? `
        <div style="margin: 30px 0; padding: 20px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
          <h3 style="color: #333; margin: 0 0 15px 0; font-size: 16px;">Payment Options</h3>
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            ${practitioner.venmo_handle ? `<tr><td style="padding: 8px 0;">
              <a href="https://venmo.com/${practitioner.venmo_handle.replace('@', '')}?txn=pay&amount=${totalDollars.toFixed(2)}&note=Invoice%20${encodeURIComponent(invoice.invoice_number)}" style="color: #008CFF; text-decoration: none; font-weight: bold;">Pay with Venmo</a>
              <span style="color: #999; font-size: 13px;"> &mdash; ${practitioner.venmo_handle}</span>
            </td></tr>` : ''}
            ${practitioner.paypal_email ? `<tr><td style="padding: 8px 0;">
              <a href="https://paypal.me/${practitioner.paypal_email}/${totalDollars.toFixed(2)}" style="color: #003087; text-decoration: none; font-weight: bold;">Pay with PayPal</a>
              <span style="color: #999; font-size: 13px;"> &mdash; ${practitioner.paypal_email}</span>
            </td></tr>` : ''}
            ${practitioner.zelle_info ? `<tr><td style="padding: 8px 0;">
              <span style="color: #6D1ED4; font-weight: bold;">Pay with Zelle</span>
              <span style="color: #999; font-size: 13px;"> &mdash; Send to: ${practitioner.zelle_info}</span>
            </td></tr>` : ''}
            ${practitioner.cash_app_handle ? `<tr><td style="padding: 8px 0;">
              <a href="https://cash.app/${practitioner.cash_app_handle.replace('$', '')}/${totalDollars.toFixed(2)}" style="color: #00D632; text-decoration: none; font-weight: bold;">Pay with Cash App</a>
              <span style="color: #999; font-size: 13px;"> &mdash; ${practitioner.cash_app_handle}</span>
            </td></tr>` : ''}
          </table>
        </div>` : ''}

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
        { error: 'Failed to send email.' },
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
