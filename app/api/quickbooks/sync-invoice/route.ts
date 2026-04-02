import { NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '../../../lib/auth'
import { syncInvoiceToQB } from '../../../lib/quickbooks'

/**
 * POST /api/quickbooks/sync-invoice
 * Manually trigger a sync of a specific invoice to QuickBooks.
 * Body: { invoiceId: string }
 */
export async function POST(req: Request) {
  const { user, error } = await requireAuth(req)
  if (error) return error

  const { invoiceId } = await req.json()
  if (!invoiceId) {
    return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 })
  }

  // Load the invoice with line items
  const { data: invoice } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, owner_id, total_cents')
    .eq('id', invoiceId)
    .eq('practitioner_id', user!.id)
    .single()

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  const { data: lineItems } = await supabaseAdmin
    .from('invoice_line_items')
    .select('description, quantity, unit_price_cents')
    .eq('invoice_id', invoiceId)

  // Mark as pending
  await supabaseAdmin
    .from('invoices')
    .update({ qb_sync_status: 'pending' })
    .eq('id', invoiceId)

  const result = await syncInvoiceToQB(user!.id, {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    owner_id: invoice.owner_id,
    total_cents: invoice.total_cents,
    line_items: (lineItems || []).map((li) => ({
      description: li.description || '',
      quantity: li.quantity || 1,
      unit_price_cents: li.unit_price_cents || 0,
    })),
  })

  if (result.success) {
    return NextResponse.json({ synced: true, qbInvoiceId: result.qbInvoiceId })
  } else {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
}
