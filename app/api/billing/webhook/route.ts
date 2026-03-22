import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getStripe } from '../../../lib/stripe'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Look up a practitioner row by their Stripe customer ID */
async function getPractitionerByCustomer(customerId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('practitioners')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()
  return data?.id ?? null
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const stripe = getStripe()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {

      // Fired when a checkout session completes (new subscription started)
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const userId = session.metadata?.supabase_user_id
        if (!userId) break

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        )

        // Map Stripe status to our simplified status
        const status = subscription.status === 'trialing' ? 'trialing' : 'active'

        await supabaseAdmin
          .from('practitioners')
          .update({
            subscription_id: subscription.id,
            stripe_customer_id: session.customer as string,
            subscription_status: status,
            trial_ends_at: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)
        break
      }

      // Fired when a subscription changes (upgrade, downgrade, trial → active, etc.)
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription

        // Prefer metadata, fall back to customer lookup
        const userId =
          (sub.metadata?.supabase_user_id as string | undefined) ||
          (await getPractitionerByCustomer(sub.customer as string))

        if (!userId) break

        await supabaseAdmin
          .from('practitioners')
          .update({
            subscription_id: sub.id,
            subscription_status: sub.status,
            trial_ends_at: sub.trial_end
              ? new Date(sub.trial_end * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)
        break
      }

      // Fired when a subscription is cancelled
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = await getPractitionerByCustomer(sub.customer as string)
        if (!userId) break

        await supabaseAdmin
          .from('practitioners')
          .update({
            subscription_status: 'canceled',
            subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)
        break
      }

      // Fired when a payment fails (card declined, expired, etc.)
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const userId = await getPractitionerByCustomer(invoice.customer as string)
        if (!userId) break

        await supabaseAdmin
          .from('practitioners')
          .update({
            subscription_status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)
        break
      }

      // Fired when a previously failed invoice is paid (account reinstated)
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null }
        // Only update if it's a subscription invoice (not a one-time charge)
        if (!invoice.subscription) break

        const userId = await getPractitionerByCustomer(invoice.customer as string)
        if (!userId) break

        await supabaseAdmin
          .from('practitioners')
          .update({
            subscription_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
