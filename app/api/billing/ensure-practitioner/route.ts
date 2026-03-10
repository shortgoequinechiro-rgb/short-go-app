import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // Check if practitioner record already exists
    const { data: existing } = await supabaseAdmin
      .from('practitioners')
      .select('*')
      .eq('id', user.id)
      .single()

    if (existing) {
      return NextResponse.json(existing)
    }

    // Create new practitioner record with 14-day free trial
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 14)

    const { data: newPractitioner, error: insertError } = await supabaseAdmin
      .from('practitioners')
      .insert({
        id: user.id,
        email: user.email,
        subscription_status: 'trialing',
        trial_ends_at: trialEnd.toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error('ensure-practitioner insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create practitioner record' }, { status: 500 })
    }

    return NextResponse.json(newPractitioner)
  } catch (error) {
    console.error('ensure-practitioner error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
