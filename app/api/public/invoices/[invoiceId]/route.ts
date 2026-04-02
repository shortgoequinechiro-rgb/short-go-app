import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/auth'

/**
 * Public endpoint — no auth required.
 * Returns only the data a client needs to view and pay an invoice.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { invoiceId } = await params

    // Fetch invoice (only the fields a client should see)
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
        subtotal_cents,
        tax_cents,
        stripe_payment_url,
        owner_id,
        horse_id,
        practitioner_id,
        invoice_line_items (
          id,
          description,
          quantity,
          unit_price_cents
        )
      `
      )
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Fetch owner name
    const { data: owner } = await supabaseAdmin
      .from('owners')
      .select('full_name')
      .eq('id', invoice.owner_id)
      .single()

    // Fetch horse name
    const { data: horse } = await supabaseAdmin
      .from('horses')
      .select('name')
      .eq('id', invoice.horse_id)
      .single()

    // Fetch practitioner (practice name + payment handles)
    const { data: practitioner } = await supabaseAdmin
      .from('practitioners')
      .select('practice_name, full_name, location, venmo_handle, paypal_email, zelle_info, cash_app_handle')
      .eq('id', invoice.practitioner_id)
      .single()

    return NextResponse.json({
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        status: invoice.status,
        total_cents: invoice.total_cents,
        subtotal_cents: invoice.subtotal_cents,
        tax_cents: invoice.tax_cents,
        stripe_payment_url: invoice.stripe_payment_url,
        line_items: invoice.invoice_line_items,
      },
      owner_name: owner?.full_name || 'Client',
      horse_name: horse?.name || '',
      practice_name: practitioner?.practice_name || 'Stride Chiropractic',
      practitioner_name: practitioner?.full_name || '',
      location: practitioner?.location || '',
      payment_options: {
        stripe_url: invoice.stripe_payment_url || null,
        venmo_handle: practitioner?.venmo_handle || null,
        paypal_email: practitioner?.paypal_email || null,
        zelle_info: practitioner?.zelle_info || null,
        cash_app_handle: practitioner?.cash_app_handle || null,
      },
    })
  } catch (err) {
    console.error('Public invoice route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
