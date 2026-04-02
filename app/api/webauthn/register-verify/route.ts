import { NextResponse } from 'next/server'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import type { RegistrationResponseJSON } from '@simplewebauthn/server'
import { requireAuth, supabaseAdmin } from '../../../lib/auth'

const RP_ID = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 'localhost'
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function POST(req: Request) {
  const { user, error } = await requireAuth(req)
  if (error) return error

  try {
    const body = await req.json() as { response: RegistrationResponseJSON; deviceName?: string }

    // Retrieve the stored challenge
    const { data: challenges } = await supabaseAdmin
      .from('webauthn_challenges')
      .select('*')
      .eq('practitioner_id', user!.id)
      .eq('type', 'registration')
      .order('created_at', { ascending: false })
      .limit(1)

    if (!challenges || challenges.length === 0) {
      return NextResponse.json({ error: 'No pending registration challenge' }, { status: 400 })
    }

    const expectedChallenge = challenges[0].challenge

    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo

    // Store the credential
    const { error: insertError } = await supabaseAdmin
      .from('passkey_credentials')
      .insert({
        practitioner_id: user!.id,
        credential_id: credential.id,
        public_key: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        device_name: body.deviceName || `${credentialDeviceType}${credentialBackedUp ? ' (synced)' : ''}`,
        transports: credential.transports || ['internal'],
      })

    if (insertError) {
      console.error('Failed to store credential:', insertError)
      return NextResponse.json({ error: 'Failed to store credential' }, { status: 500 })
    }

    // Clean up used challenge
    await supabaseAdmin
      .from('webauthn_challenges')
      .delete()
      .eq('id', challenges[0].id)

    return NextResponse.json({ verified: true })
  } catch (err) {
    console.error('WebAuthn register-verify error:', err)
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
