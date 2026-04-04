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

    // Check if practitioner has a connected Stripe account
    const { data: practitioner } = await supabaseAdmin
      .from('practitioners')
      .select('stripe_account_id, stripe_charges_enabled')
      .eq('id', user.id)
      .single();

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // If the practitioner has a connected & active Stripe account,
    // create a Checkout Session on their connected account so the
    // payment goes directly to them.
    if (practitioner?.stripe_account_id && practitioner?.stripe_charges_enabled) {
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
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
          payment_intent_data: {
            // No application_fee_amount — practitioner keeps 100%
            metadata: {
              invoiceId,
              practitionerId: user.id,
            },
          },
          metadata: {
            invoiceId,
            practitionerId: user.id,
          },
          success_url: `${appUrl}/pay/${invoiceId}?paid=true`,
          cancel_url: `${appUrl}/pay/${invoiceId}`,
        },
        {
          stripeAccount: practitioner.stripe_account_id,
        }
      );

      // Update invoice with payment link details
      const updateData: Record<string, string> = {
        stripe_payment_link_id: session.id,
        stripe_payment_url: session.url!,
        updated_at: new Date().toISOString(),
      };

      if (invoice.status === 'draft') {
        updateData.status = 'sent';
      }

      const { error: updateError } = await supabaseAdmin
        .from('invoices')
        .update(updateData)
        .eq('id', invoiceId);

      if (updateError) {
        console.error('Failed to update invoice with payment link:', updateError);
        return NextResponse.json({ error: 'Failed to create payment link.' }, { status: 500 });
      }

      return NextResponse.json({
        url: session.url,
        linkId: session.id,
      });
    }

    // Fallback: create a Payment Link on the platform account (original behavior)
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
