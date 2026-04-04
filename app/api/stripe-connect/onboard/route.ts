import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStripe } from '../../../lib/stripe'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/stripe-connect/onboard
 *
 * Creates a Stripe Connect Express account for the practitioner (or reuses
 * an existing one) and returns an Account Link URL so they can complete
 * Stripe's hosted onboarding flow.
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
      .select('stripe_account_id, stripe_connect_status, email, full_name, practice_name')
      .eq('id', user.id)
      .single()

    if (!practitioner) {
      return NextResponse.json({ error: 'Practitioner not found' }, { status: 404 })
    }

    const stripe = getStripe()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    let accountId = practitioner.stripe_account_id

    // Create a new Express account if one doesn't exist yet
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: practitioner.email || user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          supabase_user_id: user.id,
          practice_name: practitioner.practice_name || '',
        },
      })

      accountId = account.id

      // Save the account ID and mark as onboarding
      await supabaseAdmin
        .from('practitioners')
        .update({
          stripe_account_id: accountId,
          stripe_connect_status: 'onboarding',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
    }

    // Create an Account Link for the onboarding flow
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/account?tab=billing&stripe_connect=refresh`,
      return_url: `${appUrl}/account?tab=billing&stripe_connect=return`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (error) {
    console.error('stripe-connect/onboard error:', error)
    return NextResponse.json({ error: 'Failed to start Stripe Connect onboarding' }, { status: 500 })
  }
}
