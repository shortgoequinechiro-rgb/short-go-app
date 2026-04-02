import { NextResponse } from 'next/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { supabaseAdmin } from '../../../lib/auth'

const RP_ID = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || 'localhost'

export async function POST() {
  try {
    // For passkey authentication, we don't need to know the user upfront —
    // the authenticator provides the credential ID and we look it up.
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'required',
      // Empty allowCredentials = the device will offer any resident key for this RP
    })

    // Store challenge without a practitioner_id (we don't know who yet)
    await supabaseAdmin.from('webauthn_challenges').insert({
      challenge: options.challenge,
      type: 'authentication',
    })

    return NextResponse.json(options)
  } catch (err) {
    console.error('WebAuthn authenticate-options error:', err)
    return NextResponse.json({ error: 'Failed to generate authentication options' }, { status: 500 })
  }
}
