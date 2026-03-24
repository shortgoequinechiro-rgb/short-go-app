import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '../../../../lib/auth'
import { generateInvoicePdf } from '../generateInvoicePdf'

export async function GET(
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

    if (ownerError || !owner) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
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

    // Return PDF response
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
