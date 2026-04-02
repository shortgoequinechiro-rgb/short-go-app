import { NextResponse } from 'next/server'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import { supabaseAdmin } from '../../../lib/auth'

const RP_ID = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 'localhost'
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function POST(req: Request) {
  try {
    const body = await req.json() as { response: AuthenticationResponseJSON }

    // Look up the credential by its ID
    const { data: creds } = await supabaseAdmin
      .from('passkey_credentials')
      .select('*')
      .eq('credential_id', body.response.id)
      .limit(1)

    if (!creds || creds.length === 0) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 400 })
    }

    const storedCred = creds[0]

    // Find a matching challenge (most recent authentication challenge)
    const { data: challenges } = await supabaseAdmin
      .from('webauthn_challenges')
      .select('*')
      .eq('type', 'authentication')
      .order('created_at', { ascending: false })
      .limit(1)

    if (!challenges || challenges.length === 0) {
      return NextResponse.json({ error: 'No pending authentication challenge' }, { status: 400 })
    }

    const expectedChallenge = challenges[0].challenge

    // Decode the stored public key from base64url
    const publicKeyBytes = Uint8Array.from(
      Buffer.from(storedCred.public_key, 'base64url')
    )

    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      credential: {
        id: storedCred.credential_id,
        publicKey: publicKeyBytes,
        counter: storedCred.counter,
        transports: storedCred.transports || ['internal'],
      },
    })

    if (!verification.verified) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 400 })
    }

    // Update counter and last_used_at
    await supabaseAdmin
      .from('passkey_credentials')
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', storedCred.id)

    // Clean up used challenge
    await supabaseAdmin
      .from('webauthn_challenges')
      .delete()
      .eq('id', challenges[0].id)

    // Sign the user in by generating a Supabase session via admin
    // We use the service role to create a custom token / magic link sign-in
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(storedCred.practitioner_id)
    if (!userData?.user?.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 400 })
    }

    // Generate a magic link that auto-signs in (OTP-based, no email sent)
    const { data: otpData, error: otpError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email,
    })

    if (otpError || !otpData) {
      console.error('Failed to generate sign-in link:', otpError)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    // Return the token hash and email so the client can verify the OTP
    return NextResponse.json({
      verified: true,
      email: userData.user.email,
      token_hash: otpData.properties?.hashed_token,
    })
  } catch (err) {
    console.error('WebAuthn authenticate-verify error:', err)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
