import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { token } = await req.json()
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 })
    }

    // Verify the JWT and get user identity
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the Stripe customer ID for this practitioner
    const { data: practitioner } = await supabaseAdmin
      .from('practitioners')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!practitioner?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found. Please subscribe first.' },
        { status: 404 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Create a Stripe Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: practitioner.stripe_customer_id,
      return_url: `${appUrl}/billing`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('billing/portal error:', error)
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 })
  }
}
