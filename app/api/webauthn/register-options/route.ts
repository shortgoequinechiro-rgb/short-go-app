import { NextResponse } from 'next/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { requireAuth } from '../../../lib/auth'
import { supabaseAdmin } from '../../../lib/auth'

const RP_NAME = 'Chiro Stride'
const RP_ID = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 'localhost'

export async function POST(req: Request) {
  const { user, error } = await requireAuth(req)
  if (error) return error

  try {
    // Get existing passkeys for this user (to exclude during registration)
    const { data: existing } = await supabaseAdmin
      .from('passkey_credentials')
      .select('credential_id')
      .eq('practitioner_id', user!.id)

    const excludeCredentials = (existing || []).map((cred) => ({
      id: cred.credential_id,
      transports: ['internal' as const, 'hybrid' as const],
    }))

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: user!.email || user!.id,
      userID: new TextEncoder().encode(user!.id),
      userDisplayName: user!.email || 'Practitioner',
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Face ID, Touch ID, fingerprint — built-in only
        userVerification: 'required',
        residentKey: 'required',
      },
      excludeCredentials,
    })

    // Store the challenge server-side for verification
    await supabaseAdmin.from('webauthn_challenges').insert({
      practitioner_id: user!.id,
      challenge: options.challenge,
      type: 'registration',
    })

    return NextResponse.json(options)
  } catch (err) {
    console.error('WebAuthn register-options error:', err)
    return NextResponse.json({ error: 'Failed to generate registration options' }, { status: 500 })
  }
}
