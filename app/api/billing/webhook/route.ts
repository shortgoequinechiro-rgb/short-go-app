import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getStripe } from '../../../lib/stripe'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// In App Router, the body is NOT auto-parsed — req.text() returns the raw body.
// No config export needed (that's a Pages Router pattern).

/** Look up a practitioner row by their Stripe customer ID */
async function getPractitionerByCustomer(customerId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('practitioners')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()
  return data?.id ?? null
}

/** Check if a webhook event has already been processed */
async function isEventProcessed(eventId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('webhook_events')
    .select('id')
    .eq('stripe_event_id', eventId)
    .single()
  return !!data
}

/** Mark a webhook event as processed */
async function markEventProcessed(eventId: string): Promise<void> {
  await supabaseAdmin
    .from('webhook_events')
    .insert({
      stripe_event_id: eventId,
      created_at: new Date().toISOString(),
    })
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

  // Check idempotency: skip if we've already processed this event
  if (await isEventProcessed(event.id)) {
    console.log(`Webhook event ${event.id} already processed, skipping`)
    return NextResponse.json({ received: true })
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

        const { error } = await supabaseAdmin
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

        if (error) throw error
        await markEventProcessed(event.id)
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

        const { error } = await supabaseAdmin
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

        if (error) throw error
        await markEventProcessed(event.id)
        break
      }

      // Fired when a subscription is cancelled
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = await getPractitionerByCustomer(sub.customer as string)
        if (!userId) break

        // 7-day grace period before full lockout
        const gracePeriodEnd = new Date()
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7)

        const { error } = await supabaseAdmin
          .from('practitioners')
          .update({
            subscription_status: 'canceled',
            subscription_id: null,
            grace_period_ends_at: gracePeriodEnd.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)

        if (error) throw error
        await markEventProcessed(event.id)
        break
      }

      // Fired when a payment fails (card declined, expired, etc.)
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const userId = await getPractitionerByCustomer(invoice.customer as string)
        if (!userId) break

        // 7-day grace period before full lockout
        const gracePeriodEnd = new Date()
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7)

        const { error } = await supabaseAdmin
          .from('practitioners')
          .update({
            subscription_status: 'past_due',
            grace_period_ends_at: gracePeriodEnd.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)

        if (error) throw error
        await markEventProcessed(event.id)
        break
      }

      // Fired when a previously failed invoice is paid (account reinstated)
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null }
        // Only update if it's a subscription invoice (not a one-time charge)
        if (!invoice.subscription) break

        const userId = await getPractitionerByCustomer(invoice.customer as string)
        if (!userId) break

        const { error } = await supabaseAdmin
          .from('practitioners')
          .update({
            subscription_status: 'active',
            grace_period_ends_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)

        if (error) throw error
        await markEventProcessed(event.id)
        break
      }

      // Fired when a subscription is paused
      case 'customer.subscription.paused': {
        const sub = event.data.object as Stripe.Subscription
        const userId = await getPractitionerByCustomer(sub.customer as string)
        if (!userId) break

        const { error } = await supabaseAdmin
          .from('practitioners')
          .update({
            subscription_status: 'paused',
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)

        if (error) throw error
        await markEventProcessed(event.id)
        break
      }

      // Unhandled event type
      default: {
        console.log(`Unhandled webhook event type: ${event.type}`)
        break
      }
    }

    // Mark event as processed on success
    if (event.type !== 'customer.subscription.paused' &&
        event.type !== 'checkout.session.completed' &&
        event.type !== 'customer.subscription.updated' &&
        event.type !== 'customer.subscription.deleted' &&
        event.type !== 'invoice.payment_failed' &&
        event.type !== 'invoice.payment_succeeded') {
      // For unhandled events, still mark as processed to avoid spam
      await markEventProcessed(event.id)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
