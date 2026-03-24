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
    // Authenticate user
    const { user, error } = await requireAuth(request)
    if (error) return error

    const { invoiceId } = await params

    // Fetch invoice with line items
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select(
        `
        *,
        line_items (
          id,
          description,
          quantity,
          unit_price,
          total
        )
      `
      )
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Verify user owns this invoice or is the practitioner
    const { data: practitionerCheck } = await supabaseAdmin
      .from('invoices')
      .select('practitioner_id')
      .eq('id', invoiceId)
      .single()

    if (practitionerCheck?.practitioner_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Fetch owner info
    const { data: owner, error: ownerError } = await supabaseAdmin
      .from('users')
      .select('full_name, email, phone, address')
      .eq('id', invoice.owner_id)
      .single()

    if (ownerError || !owner || !owner.email) {
      return NextResponse.json(
        { error: 'Owner email not found' },
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

    // Generate PDF
    const pdfBytes = await generateInvoicePdf(
      invoice,
      invoice.line_items,
      owner,
      horse,
      practitioner
    )

    // Format line items summary for email
    const lineItemsSummary = invoice.line_items
      .map(
        (item: { description: string; quantity: number; total: number }) =>
          `<li>${item.description} (Qty: ${item.quantity}) - $${item.total.toFixed(2)}</li>`
      )
      .join('')

    // Create email HTML body
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Invoice from ${practitioner.practice_name}</h2>
        <p style="color: #666;">Hello ${owner.full_name},</p>
        <p style="color: #666;">Please find your invoice attached below.</p>

        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div>
              <p style="color: #999; font-size: 12px; margin: 0 0 5px 0;">INVOICE NUMBER</p>
              <p style="color: #333; font-size: 18px; font-weight: bold; margin: 0;">${invoice.invoice_number}</p>
            </div>
            <div>
              <p style="color: #999; font-size: 12px; margin: 0 0 5px 0;">INVOICE DATE</p>
              <p style="color: #333; font-size: 18px; font-weight: bold; margin: 0;">${new Date(invoice.invoice_date).toLocaleDateString()}</p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div>
              <p style="color: #999; font-size: 12px; margin: 0 0 5px 0;">DUE DATE</p>
              <p style="color: #333; font-size: 18px; font-weight: bold; margin: 0;">${new Date(invoice.due_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p style="color: #999; font-size: 12px; margin: 0 0 5px 0;">STATUS</p>
              <p style="color: #333; font-size: 18px; font-weight: bold; margin: 0;">${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}</p>
            </div>
          </div>

          <div style="border-top: 1px solid #e0e0e0; padding-top: 20px;">
            <p style="color: #999; font-size: 12px; margin: 0 0 10px 0;">PATIENT</p>
            <p style="color: #333; font-size: 16px; font-weight: bold; margin: 0;">${horse.name}</p>
          </div>
        </div>

        <div style="margin: 20px 0;">
          <h3 style="color: #333; margin: 0 0 15px 0;">Line Items</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${lineItemsSummary}
          </ul>
        </div>

        <div style="background-color: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="color: #666;">Subtotal:</span>
            <span style="color: #333; font-weight: bold;">$${invoice.subtotal.toFixed(2)}</span>
          </div>
          ${
            invoice.tax > 0
              ? `<div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span style="color: #666;">Tax:</span>
              <span style="color: #333; font-weight: bold;">$${invoice.tax.toFixed(2)}</span>
            </div>`
              : ''
          }
          <div style="display: flex; justify-content: space-between; border-top: 2px solid #ddd; padding-top: 10px;">
            <span style="color: #333; font-weight: bold; font-size: 16px;">Total ${invoice.status === 'paid' ? 'Paid' : 'Due'}:</span>
            <span style="color: #333; font-weight: bold; font-size: 16px;">$${invoice.total.toFixed(2)}</span>
          </div>
        </div>

        <p style="color: #666; font-size: 14px; margin-top: 20px;">If you have any questions about this invoice, please don't hesitate to contact ${practitioner.practice_name} directly.</p>

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
      subject: `Invoice ${invoice.invoice_number} from ${practitioner.practice_name}`,
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
        { error: 'Failed to send email' },
        { status: 500 }
      )
    }

    // Update invoice status to 'sent' if currently 'draft'
    if (invoice.status === 'draft') {
      const { error: updateError } = await supabaseAdmin
        .from('invoices')
        .update({ status: 'sent' })
        .eq('id', invoiceId)

      if (updateError) {
        console.error('Status update error:', updateError)
        // Don't fail the entire request if status update fails
      }
    }

    return NextResponse.json({
      success: true,
      emailId: emailResponse.data?.id,
    })
  } catch (error) {
    console.error('Email route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
