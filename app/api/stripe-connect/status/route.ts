import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStripe } from '../../../lib/stripe'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/stripe-connect/status
 *
 * Checks the current Stripe Connect account status for the practitioner.
 * Fetches the latest state from Stripe and syncs it to the database.
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
      .select('stripe_account_id, stripe_connect_status, stripe_charges_enabled, stripe_payouts_enabled')
      .eq('id', user.id)
      .single()

    if (!practitioner?.stripe_account_id) {
      return NextResponse.json({
        status: 'not_connected',
        charges_enabled: false,
        payouts_enabled: false,
      })
    }

    // Fetch live status from Stripe
    const stripe = getStripe()
    const account = await stripe.accounts.retrieve(practitioner.stripe_account_id)

    const chargesEnabled = account.charges_enabled ?? false
    const payoutsEnabled = account.payouts_enabled ?? false

    // Determine connect status
    let connectStatus = 'onboarding'
    if (chargesEnabled && payoutsEnabled) {
      connectStatus = 'active'
    } else if (account.requirements?.disabled_reason) {
      connectStatus = 'restricted'
    }

    // Sync back to database if anything changed
    if (
      connectStatus !== practitioner.stripe_connect_status ||
      chargesEnabled !== practitioner.stripe_charges_enabled ||
      payoutsEnabled !== practitioner.stripe_payouts_enabled
    ) {
      const updateData: Record<string, unknown> = {
        stripe_connect_status: connectStatus,
        stripe_charges_enabled: chargesEnabled,
        stripe_payouts_enabled: payoutsEnabled,
        updated_at: new Date().toISOString(),
      }

      if (connectStatus === 'active' && practitioner.stripe_connect_status !== 'active') {
        updateData.stripe_connect_onboarded_at = new Date().toISOString()
      }

      await supabaseAdmin
        .from('practitioners')
        .update(updateData)
        .eq('id', user.id)
    }

    return NextResponse.json({
      status: connectStatus,
      charges_enabled: chargesEnabled,
      payouts_enabled: payoutsEnabled,
      account_id: practitioner.stripe_account_id,
      requirements: account.requirements?.currently_due ?? [],
    })
  } catch (error) {
    console.error('stripe-connect/status error:', error)
    return NextResponse.json({ error: 'Failed to check Stripe Connect status' }, { status: 500 })
  }
}
