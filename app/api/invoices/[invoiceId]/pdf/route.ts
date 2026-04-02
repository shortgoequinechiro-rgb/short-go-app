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

    // Fetch owner info
    const { data: owner, error: ownerError } = await supabaseAdmin
      .from('owners')
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
    const { data: practitionerRaw, error: practitionerError } = await supabaseAdmin
      .from('practitioners')
      .select('full_name, practice_name, location')
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
    }

    const safeOwner = {
      full_name: owner.full_name || 'Client',
      email: owner.email || '',
      phone: owner.phone || undefined,
      address: owner.address || undefined,
    }

    // Convert cents to dollars for PDF generation
    const lineItemsForPdf = (invoice.invoice_line_items || []).map(
      (item: { id: string; description: string; quantity: number; unit_price_cents: number }) => ({
        id: item.id,
        description: item.description || 'Service',
        quantity: item.quantity || 1,
        unit_price: (item.unit_price_cents || 0) / 100,
        total: ((item.unit_price_cents || 0) * (item.quantity || 1)) / 100,
      })
    )

    const invoiceForPdf = {
      ...invoice,
      invoice_number: invoice.invoice_number || 'N/A',
      invoice_date: invoice.invoice_date || new Date().toISOString(),
      due_date: invoice.due_date || invoice.invoice_date || new Date().toISOString(),
      status: invoice.status || 'draft',
      subtotal: invoice.subtotal_cents / 100,
      tax: (invoice.tax_cents || 0) / 100,
      total: invoice.total_cents / 100,
    }

    // Generate PDF
    const pdfBytes = await generateInvoicePdf(
      invoiceForPdf,
      lineItemsForPdf,
      safeOwner,
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
