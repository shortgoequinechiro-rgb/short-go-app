import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Save practitioner profile right after signup, even before email confirmation.
 * Uses the user ID (returned by supabase.auth.signUp) + service role key.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      user_id, email, full_name, practice_name,
      credentials, city, state, country, website, phone,
    } = body

    if (!user_id) {
      return NextResponse.json({ error: 'No user_id provided' }, { status: 400 })
    }

    if (!practice_name?.trim()) {
      return NextResponse.json({ error: 'Practice name is required' }, { status: 400 })
    }

    // Verify this user actually exists in auth.users
    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id)
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 401 })
    }

    // Upsert the practitioner record
    const { error: upsertError } = await supabaseAdmin
      .from('practitioners')
      .upsert({
        id: user.id,
        email: email || user.email,
        full_name: full_name?.trim() || null,
        credentials: credentials?.trim() || null,
        practice_name: practice_name.trim(),
        animals_served: 'both',
        city: city?.trim() || null,
        state: state?.trim() || null,
        country: country?.trim() || null,
        website: website?.trim() || null,
        phone: phone?.trim() || null,
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      })

    if (upsertError) {
      console.error('setup-profile upsert error:', upsertError)
      return NextResponse.json({ error: 'Failed to save practice profile' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('setup-profile error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
