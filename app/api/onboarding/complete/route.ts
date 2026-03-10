import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { token, full_name, practice_name, animals_served, location } = body

    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 })
    }

    if (!practice_name?.trim()) {
      return NextResponse.json({ error: 'Practice name is required' }, { status: 400 })
    }

    // Verify JWT and get user identity
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Upsert the practitioner record (handles both new and existing accounts)
    const { error: upsertError } = await supabaseAdmin
      .from('practitioners')
      .upsert({
        id: user.id,
        email: user.email,
        full_name: full_name?.trim() || null,
        practice_name: practice_name.trim(),
        animals_served: animals_served || 'both',
        location: location?.trim() || null,
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      })

    if (upsertError) {
      console.error('onboarding/complete upsert error:', upsertError)
      return NextResponse.json({ error: 'Failed to save practice profile' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('onboarding/complete error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
