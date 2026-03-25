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
      email, full_name, practice_name,
      credentials, city, state, country, website, phone,
    } = body

    // Authenticate: prefer Bearer token; fall back to email verification
    // for cases where email confirmation is required (no session on signup)
    let userId: string

    const authorization = req.headers.get('authorization')
    if (authorization) {
      const token = authorization.replace('Bearer ', '')
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
      if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
    } else {
      // No session token (email confirmation pending).
      // Verify the email matches a recently created auth user.
      if (!email) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 })
      }
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
      if (listError) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
      }
      const matchedUser = users.find(
        u => u.email?.toLowerCase() === email.trim().toLowerCase()
          && Date.now() - new Date(u.created_at).getTime() < 5 * 60 * 1000 // within 5 minutes
      )
      if (!matchedUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = matchedUser.id
    }

    if (!practice_name?.trim()) {
      return NextResponse.json({ error: 'Practice name is required' }, { status: 400 })
    }

    // Upsert the practitioner record
    const { error: upsertError } = await supabaseAdmin
      .from('practitioners')
      .upsert({
        id: userId,
        email: email || null,
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
