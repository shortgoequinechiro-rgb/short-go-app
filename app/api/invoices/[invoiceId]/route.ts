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
        horse_ids,
        stripe_payment_link_id,
        stripe_payment_url,
        qb_payment_url,
        paid_at,
        payment_method,
        payment_reference,
        created_at,
        updated_at,
        owner:owners(full_name, email, phone),
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

    // Fetch practitioner payment links
    const { data: practitionerData } = await supabaseAdmin
      .from('practitioners')
      .select('venmo_handle, paypal_email, zelle_info, cash_app_handle')
      .eq('id', user.id)
      .single();

    const ownerData = invoice.owner as unknown as Record<string, string> | null;
    const ownerArr = Array.isArray(invoice.owner) ? invoice.owner[0] : null;

    // Resolve horse names for multi-patient invoices
    const horseIds = invoice.horse_ids as string[] | null;
    let horseNames: string[] = [];
    if (horseIds && Array.isArray(horseIds) && horseIds.length > 0) {
      const { data: horsesData } = await supabaseAdmin
        .from('horses')
        .select('id, name')
        .in('id', horseIds);
      if (horsesData) {
        horseNames = horseIds
          .map((id: string) => horsesData.find((h: { id: string; name: string }) => h.id === id)?.name)
          .filter(Boolean) as string[];
      }
    }

    const result = {
      ...invoice,
      owner_name: ownerData?.full_name || ownerArr?.full_name,
      owner_email: ownerData?.email || ownerArr?.email,
      owner_phone: ownerData?.phone || ownerArr?.phone,
      horse_name: (invoice.horse as unknown as Record<string, string> | null)?.name || (Array.isArray(invoice.horse) ? invoice.horse[0]?.name : undefined),
      horse_names: horseNames.length > 0 ? horseNames : undefined,
      venmo_handle: practitionerData?.venmo_handle || null,
      paypal_email: practitionerData?.paypal_email || null,
      zelle_info: practitionerData?.zelle_info || null,
      cash_app_handle: practitionerData?.cash_app_handle || null,
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
        horse_ids,
        stripe_payment_link_id,
        stripe_payment_url,
        qb_payment_url,
        paid_at,
        payment_method,
        payment_reference,
        created_at,
        updated_at,
        owner:owners(full_name, email, phone),
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

    const updOwnerData = updatedInvoice.owner as unknown as Record<string, string> | null;
    const updOwnerArr = Array.isArray(updatedInvoice.owner) ? updatedInvoice.owner[0] : null;
    const result = {
      ...updatedInvoice,
      owner_name: updOwnerData?.full_name || updOwnerArr?.full_name,
      owner_email: updOwnerData?.email || updOwnerArr?.email,
      owner_phone: updOwnerData?.phone || updOwnerArr?.phone,
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;
    const { invoiceId } = await params;

    // Verify ownership
    const { data: invoice, error: fetchError } = await supabaseAdmin
      .from('invoices')
      .select('id, practitioner_id, status')
      .eq('id', invoiceId)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.practitioner_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Allow deleting any invoice (paid invoices require ?force=true)
    // This is handled on the frontend with a stronger confirmation

    // Delete line items first (foreign key constraint)
    await supabaseAdmin
      .from('invoice_line_items')
      .delete()
      .eq('invoice_id', invoiceId);

    // Delete communication logs for this invoice
    await supabaseAdmin
      .from('communication_log')
      .delete()
      .eq('invoice_id', invoiceId);

    // Delete the invoice
    const { error: deleteError } = await supabaseAdmin
      .from('invoices')
      .delete()
      .eq('id', invoiceId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
