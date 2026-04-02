import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '../../../../lib/auth';
import { createNotification } from '../../../../lib/notifications';
import { getQBConnection, syncPaymentToQB } from '../../../../lib/quickbooks';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;
    const { invoiceId } = await params;
    const body = await request.json();

    const { payment_method, payment_reference } = body;

    // Validate payment_method
    const validMethods = ['cash', 'check', 'venmo', 'stripe', 'other'];
    if (!payment_method || !validMethods.includes(payment_method)) {
      return NextResponse.json(
        { error: 'Invalid payment_method. Must be one of: cash, check, venmo, stripe, other' },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: invoice, error: fetchError } = await supabaseAdmin
      .from('invoices')
      .select('id, practitioner_id')
      .eq('id', invoiceId)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.practitioner_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update invoice to mark as paid
    const updateData = {
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_method,
      payment_reference: payment_reference || null,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabaseAdmin
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Fetch the invoice number for notification
    const { data: invoiceData } = await supabaseAdmin
      .from('invoices')
      .select('invoice_number')
      .eq('id', invoiceId)
      .single();

    // Create notification
    await createNotification(
      user.id,
      'invoice_paid',
      'Payment Received',
      `Invoice ${invoiceData?.invoice_number || 'N/A'} paid via ${payment_method}`
    );

    // Fetch updated invoice with relations
    const { data: updatedInvoice, error: fetchUpdatedError } = await supabaseAdmin
      .from('invoices')
      .select(
        `
        id,
        invoice_number,
        invoice_date,
        due_date,
        status,
        subtotal_cents,
        total_cents,
        notes,
        stripe_payment_link_id,
        stripe_payment_url,
        paid_at,
        payment_method,
        payment_reference,
        created_at,
        updated_at,
        owner:owners(full_name, email),
        horse:horses(name),
        line_items:invoice_line_items(
          id,
          service_id,
          description,
          quantity,
          unit_price_cents
        )
      `
      )
      .eq('id', invoiceId)
      .single();

    if (fetchUpdatedError) {
      return NextResponse.json({ error: fetchUpdatedError.message }, { status: 500 });
    }

    const result = {
      ...updatedInvoice,
      owner_name: (updatedInvoice.owner as unknown as Record<string, string> | null)?.full_name || (Array.isArray(updatedInvoice.owner) ? updatedInvoice.owner[0]?.full_name : undefined),
      horse_name: (updatedInvoice.horse as unknown as Record<string, string> | null)?.name || (Array.isArray(updatedInvoice.horse) ? updatedInvoice.horse[0]?.name : undefined),
      owner: undefined,
      horse: undefined,
    };

    // Fire-and-forget: sync payment to QuickBooks if connected
    getQBConnection(user.id).then((conn) => {
      if (conn) {
        syncPaymentToQB(user.id, invoiceId, updatedInvoice.total_cents || 0, payment_method)
          .catch((err: unknown) => console.error('QB payment sync failed:', err))
      }
    }).catch(() => { /* QB not configured, skip */ })

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
