import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessToken = authHeader.split(' ')[1]

    // Verify the practitioner's session
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(accessToken)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { patientId, expiresInDays = 30 } = await req.json()

    if (!patientId) {
      return NextResponse.json({ error: 'Patient ID required' }, { status: 400 })
    }

    // Generate a cryptographically secure token
    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = hashToken(rawToken)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)

    // Store the hashed token
    const { error: insertError } = await supabaseAdmin
      .from('portal_access_tokens')
      .insert({
        patient_id: patientId,
        practitioner_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      })

    if (insertError) {
      console.error('Token insert error:', insertError)
      return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 })
    }

    // Log the token generation
    await supabaseAdmin.from('audit_log').insert({
      practitioner_id: user.id,
      user_type: 'practitioner',
      action: 'generate_portal_token',
      resource_type: 'portal_access_tokens',
      resource_id: patientId,
      details: { expires_at: expiresAt.toISOString(), expires_in_days: expiresInDays },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
    })

    return NextResponse.json({ token: rawToken, expiresAt: expiresAt.toISOString() })
  } catch (error) {
    console.error('Generate token error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
