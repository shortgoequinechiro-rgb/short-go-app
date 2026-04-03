import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '../../lib/auth';
import { createNotification } from '../../lib/notifications';
import { getQBConnection, syncInvoiceToQB } from '../../lib/quickbooks';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const ownerId = searchParams.get('owner_id');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let query = supabaseAdmin
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
      .eq('practitioner_id', user.id);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }

    if (from) {
      query = query.gte('invoice_date', from);
    }

    if (to) {
      query = query.lte('invoice_date', to);
    }

    const { data, error: queryError } = await query.order('invoice_date', { ascending: false });

    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    // Resolve all horse names for invoices with horse_ids
    const allHorseIds = new Set<string>();
    for (const inv of data) {
      const ids = inv.horse_ids as string[] | null;
      if (ids && Array.isArray(ids)) {
        ids.forEach((id: string) => allHorseIds.add(id));
      }
    }

    let horseNameMap: Record<string, string> = {};
    if (allHorseIds.size > 0) {
      const { data: horsesData } = await supabaseAdmin
        .from('horses')
        .select('id, name')
        .in('id', Array.from(allHorseIds));
      if (horsesData) {
        horseNameMap = Object.fromEntries(horsesData.map((h: { id: string; name: string }) => [h.id, h.name]));
      }
    }

    const invoices = data.map((invoice: Record<string, unknown>) => {
      const ownerData = invoice.owner as unknown as Record<string, string> | null;
      const ids = invoice.horse_ids as string[] | null;
      const horseNames = ids && Array.isArray(ids)
        ? ids.map((id: string) => horseNameMap[id]).filter(Boolean)
        : [];
      return {
        ...invoice,
        owner_name: ownerData?.full_name,
        owner_email: ownerData?.email,
        owner_phone: ownerData?.phone,
        horse_name: (invoice.horse as unknown as Record<string, string> | null)?.name,
        horse_names: horseNames.length > 0 ? horseNames : undefined,
        owner: undefined,
        horse: undefined,
      };
    });

    return NextResponse.json(invoices);
  } catch (e) {
    if (e instanceof Error && e.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;
    const body = await request.json();

    const { visit_id, owner_id, horse_id, horse_ids, line_items, notes, due_date } = body;

    // Support both single horse_id and horse_ids array
    const resolvedHorseIds: string[] = horse_ids && Array.isArray(horse_ids) && horse_ids.length > 0
      ? horse_ids
      : horse_id ? [horse_id] : [];
    const primaryHorseId = resolvedHorseIds[0] || null;

    if (!owner_id || resolvedHorseIds.length === 0 || !line_items || !Array.isArray(line_items) || line_items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: owner_id, horse_id/horse_ids, line_items' },
        { status: 400 }
      );
    }

    // Generate invoice number as INV-{YYYYMM}-{sequential}
    const now = new Date();
    const yearMonth = now.toISOString().slice(0, 7).replace('-', '');

    const { data: existingInvoices, error: countError } = await supabaseAdmin
      .from('invoices')
      .select('invoice_number')
      .eq('practitioner_id', user.id)
      .like('invoice_number', `INV-${yearMonth}-%`)
      .order('invoice_number', { ascending: false })
      .limit(1);

    if (countError) {
      console.error('[INVOICE CREATE] countError:', countError);
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    let sequential = 1;
    if (existingInvoices && existingInvoices.length > 0) {
      const lastNumber = existingInvoices[0].invoice_number;
      const lastSeq = parseInt(lastNumber.split('-').pop() || '0', 10);
      sequential = lastSeq + 1;
    }
    const invoiceNumber = `INV-${yearMonth}-${String(sequential).padStart(4, '0')}`;

    // Calculate totals
    const subtotalCents = line_items.reduce(
      (sum: number, item: { quantity: number; unit_price_cents: number }) => sum + item.quantity * item.unit_price_cents,
      0
    );
    const totalCents = subtotalCents;

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .insert([
        {
          practitioner_id: user.id,
          visit_id,
          owner_id,
          horse_id: primaryHorseId,
          horse_ids: resolvedHorseIds,
          invoice_number: invoiceNumber,
          invoice_date: new Date().toISOString().split('T')[0],
          due_date,
          status: 'draft',
          subtotal_cents: subtotalCents,
          total_cents: totalCents,
          notes,
        },
      ])
      .select()
      .single();

    if (invoiceError) {
      console.error('[INVOICE CREATE] invoiceError:', invoiceError, 'payload:', { practitioner_id: user.id, visit_id, owner_id, horse_id: primaryHorseId, horse_ids: resolvedHorseIds, invoice_number: invoiceNumber });
      return NextResponse.json({ error: invoiceError.message }, { status: 500 });
    }

    // Create line items
    const lineItemsData = line_items.map((item: { service_id: string; description: string; quantity: number; unit_price_cents: number }) => ({
      invoice_id: invoice.id,
      service_id: item.service_id,
      description: item.description,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
    }));

    const { error: lineItemsError } = await supabaseAdmin
      .from('invoice_line_items')
      .insert(lineItemsData);

    if (lineItemsError) {
      console.error('[INVOICE CREATE] lineItemsError:', lineItemsError, 'lineItemsData:', lineItemsData);
      return NextResponse.json({ error: lineItemsError.message }, { status: 500 });
    }

    // Fetch the complete invoice with relations
    const { data: completeInvoice, error: fetchError } = await supabaseAdmin
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
        created_at,
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
      .eq('id', invoice.id)
      .single();

    if (fetchError) {
      console.error('[INVOICE CREATE] fetchError:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Resolve all horse names for the invoice
    let horseNames: string[] = [];
    if (resolvedHorseIds.length > 0) {
      const { data: horsesData } = await supabaseAdmin
        .from('horses')
        .select('id, name')
        .in('id', resolvedHorseIds);
      if (horsesData) {
        horseNames = resolvedHorseIds
          .map((id: string) => horsesData.find((h: { id: string; name: string }) => h.id === id)?.name)
          .filter(Boolean) as string[];
      }
    }

    const result = {
      ...completeInvoice,
      owner_name: (completeInvoice.owner as unknown as Record<string, string> | null)?.full_name || (Array.isArray(completeInvoice.owner) ? completeInvoice.owner[0]?.full_name : undefined),
      horse_name: (completeInvoice.horse as unknown as Record<string, string> | null)?.name || (Array.isArray(completeInvoice.horse) ? completeInvoice.horse[0]?.name : undefined),
      horse_names: horseNames.length > 0 ? horseNames : undefined,
      owner: undefined,
      horse: undefined,
    };

    // Create notification
    await createNotification(
      user.id,
      'invoice_created',
      'Invoice Created',
      `Invoice ${invoiceNumber} for ${result.owner_name || 'Unknown'}`
    );

    // Sync to QuickBooks if connected (awaited so Vercel doesn't kill the function)
    try {
      const conn = await getQBConnection(user.id);
      if (conn) {
        console.log('[QB Sync] Connection found, syncing invoice', invoiceNumber);
        await supabaseAdmin.from('invoices').update({ qb_sync_status: 'pending' }).eq('id', invoice.id);
        await syncInvoiceToQB(user.id, {
          id: invoice.id,
          invoice_number: invoiceNumber,
          owner_id,
          total_cents: totalCents,
          line_items: line_items.map((li: { description: string; quantity: number; unit_price_cents: number }) => ({
            description: li.description || '',
            quantity: li.quantity || 1,
            unit_price_cents: li.unit_price_cents || 0,
          })),
        });
        console.log('[QB Sync] Invoice', invoiceNumber, 'synced successfully');
      } else {
        console.log('[QB Sync] No QB connection found, skipping sync');
      }
    } catch (qbErr) {
      console.error('[QB Sync] Invoice sync failed:', qbErr instanceof Error ? qbErr.message : qbErr);
      // Don't fail the invoice creation if QB sync fails
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    console.error('[INVOICE CREATE] Unhandled error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
