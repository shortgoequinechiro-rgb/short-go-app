import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, supabaseAdmin } from '../../../../lib/auth';
import { getStripe } from '../../../../lib/stripe';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;
    const { invoiceId } = await params;

    // Fetch invoice
    const { data: invoice, error: fetchError } = await supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, total_cents, status, practitioner_id')
      .eq('id', invoiceId)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Verify ownership
    if (invoice.practitioner_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Initialize Stripe
    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Create payment link
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
    });

    // Update invoice with payment link details
    const updateData: Record<string, string> = {
      stripe_payment_link_id: paymentLink.id,
      stripe_payment_url: paymentLink.url,
      updated_at: new Date().toISOString(),
    };

    // Update status to 'sent' if currently 'draft'
    if (invoice.status === 'draft') {
      updateData.status = 'sent';
    }

    const { error: updateError } = await supabaseAdmin
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId);

    if (updateError) {
      console.error('Failed to update invoice with payment link:', updateError)
      return NextResponse.json({ error: 'Failed to create payment link.' }, { status: 500 });
    }

    return NextResponse.json({
      url: paymentLink.url,
      linkId: paymentLink.id,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error) {
      console.error('Payment link route error:', error)
      return NextResponse.json({ error: 'Failed to create payment link.' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
