import { NextResponse } from 'next/server'
import OAuthClient from 'intuit-oauth'
import { requireAuth } from '../../../lib/auth'
import { getOAuthClient } from '../../../lib/quickbooks'

/**
 * GET /api/quickbooks/auth
 * Kicks off the QuickBooks OAuth flow.
 * Returns a redirect URL the client should navigate to.
 */
export async function GET(req: Request) {
  const { user, error } = await requireAuth(req)
  if (error) return error

  try {
    const oauthClient = getOAuthClient()

    const authUri = oauthClient.authorizeUri({
      scope: [
        OAuthClient.scopes.Accounting,
      ],
      state: user!.id, // Pass practitioner ID as state for the callback
    })

    return NextResponse.json({ url: authUri })
  } catch (err) {
    console.error('QB auth error:', err)
    return NextResponse.json({ error: 'Failed to generate QuickBooks auth URL' }, { status: 500 })
  }
}
