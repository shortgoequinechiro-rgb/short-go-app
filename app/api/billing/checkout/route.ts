import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStripe } from '../../../lib/stripe'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VALID_PRICE_IDS = [
  process.env.STRIPE_PRICE_MONTHLY,
  process.env.STRIPE_PRICE_ANNUAL,
].filter(Boolean)

export async function POST(req: Request) {
  try {
    const { token, priceId } = await req.json()
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 })
    }

    // Validate price ID — must be one of our configured prices
    const selectedPrice = priceId || process.env.STRIPE_PRICE_MONTHLY
    if (!VALID_PRICE_IDS.includes(selectedPrice)) {
      return NextResponse.json({ error: 'Invalid price selected' }, { status: 400 })
    }

    // Verify the JWT and get user identity
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get practitioner record to check for existing Stripe customer
    const { data: practitioner } = await supabaseAdmin
      .from('practitioners')
      .select('stripe_customer_id, subscription_status')
      .eq('id', user.id)
      .single()

    const stripe = getStripe()

    // Get or create Stripe customer
    let customerId = practitioner?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      // Save the new customer ID back to practitioners table
      await supabaseAdmin
        .from('practitioners')
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq('id', user.id)
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Create Stripe Checkout session — no trial here.
    // The 7-day free trial is handled locally (no card required).
    // Users only reach Checkout when they're ready to subscribe.
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: selectedPrice, quantity: 1 }],
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      allow_promotion_codes: true,
      success_url: `${appUrl}/dashboard?subscription=success`,
      cancel_url: `${appUrl}/billing`,
      metadata: { supabase_user_id: user.id },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('billing/checkout error:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
