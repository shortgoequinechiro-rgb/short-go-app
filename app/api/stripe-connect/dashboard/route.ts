import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStripe } from '../../../lib/stripe'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/stripe-connect/dashboard
 *
 * Creates a login link to the practitioner's Stripe Express dashboard
 * where they can see payouts, transactions, and manage their account.
 */
export async function POST(req: Request) {
  try {
    const { token } = await req.json()
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: practitioner } = await supabaseAdmin
      .from('practitioners')
      .select('stripe_account_id')
      .eq('id', user.id)
      .single()

    if (!practitioner?.stripe_account_id) {
      return NextResponse.json({ error: 'No Stripe Connect account found' }, { status: 404 })
    }

    const stripe = getStripe()

    const loginLink = await stripe.accounts.createLoginLink(
      practitioner.stripe_account_id
    )

    return NextResponse.json({ url: loginLink.url })
  } catch (error) {
    console.error('stripe-connect/dashboard error:', error)
    return NextResponse.json({ error: 'Failed to create Stripe dashboard link' }, { status: 500 })
  }
}
