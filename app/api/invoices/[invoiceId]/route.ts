import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '../../../lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;
    const { invoiceId } = await params;

    const { data: invoice, error: fetchError } = await supabaseAdmin
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
      .eq('practitioner_id', user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const result = {
      ...invoice,
      owner_name: (invoice.owner as unknown as Record<string, string> | null)?.full_name || (Array.isArray(invoice.owner) ? invoice.owner[0]?.full_name : undefined),
      horse_name: (invoice.horse as unknown as Record<string, string> | null)?.name || (Array.isArray(invoice.horse) ? invoice.horse[0]?.name : undefined),
      owner: undefined,
      horse: undefined,
    };

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;
    const { invoiceId } = await params;
    const body = await request.json();

    const { status, notes, due_date, line_items } = body;

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

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status !== undefined) {
      updateData.status = status;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (due_date !== undefined) {
      updateData.due_date = due_date;
    }

    // Handle line items if provided
    if (line_items !== undefined) {
      if (!Array.isArray(line_items) || line_items.length === 0) {
        return NextResponse.json(
          { error: 'line_items must be a non-empty array' },
          { status: 400 }
        );
      }

      // Calculate new totals
      const subtotalCents = line_items.reduce(
        (sum: number, item: { quantity: number; unit_price_cents: number }) => sum + item.quantity * item.unit_price_cents,
        0
      );
      updateData.subtotal_cents = subtotalCents;
      updateData.total_cents = subtotalCents;

      // Delete existing line items
      const { error: deleteError } = await supabaseAdmin
        .from('invoice_line_items')
        .delete()
        .eq('invoice_id', invoiceId);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      // Insert new line items
      const lineItemsData = line_items.map((item: { service_id: string; description: string; quantity: number; unit_price_cents: number }) => ({
        invoice_id: invoiceId,
        service_id: item.service_id,
        description: item.description,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
      }));

      const { error: insertError } = await supabaseAdmin
        .from('invoice_line_items')
        .insert(lineItemsData);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    // Update invoice
    const { error: updateError } = await supabaseAdmin
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

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
