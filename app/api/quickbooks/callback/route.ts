import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/auth'
import { getOAuthClient } from '../../../lib/quickbooks'

/**
 * GET /api/quickbooks/callback
 * Handles the OAuth redirect from QuickBooks.
 * Stores tokens and redirects back to account settings.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const practitionerId = url.searchParams.get('state')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (!practitionerId) {
    return NextResponse.redirect(`${appUrl}/account?tab=billing&qb=error&reason=missing_state`)
  }

  try {
    const oauthClient = getOAuthClient()
    const authResponse = await oauthClient.createToken(req.url)
    const token = authResponse.getJson()

    const realmId = url.searchParams.get('realmId')
    if (!realmId) {
      return NextResponse.redirect(`${appUrl}/account?tab=billing&qb=error&reason=missing_realm`)
    }

    // Fetch company name from QB
    let companyName = null
    try {
      const companyRes = await fetch(
        `${process.env.QUICKBOOKS_ENVIRONMENT === 'sandbox' ? 'https://sandbox-quickbooks.api.intuit.com' : 'https://quickbooks.api.intuit.com'}/v3/company/${realmId}/companyinfo/${realmId}`,
        {
          headers: {
            Authorization: `Bearer ${token.access_token}`,
            Accept: 'application/json',
          },
        }
      )
      if (companyRes.ok) {
        const companyData = await companyRes.json()
        companyName = companyData.CompanyInfo?.CompanyName || null
      }
    } catch {
      // Non-critical — we'll just skip company name
    }

    // Upsert connection (one per practitioner)
    const { error: upsertError } = await supabaseAdmin
      .from('quickbooks_connections')
      .upsert(
        {
          practitioner_id: practitionerId,
          realm_id: realmId,
          access_token: token.access_token,
          refresh_token: token.refresh_token,
          token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
          company_name: companyName,
          connected_at: new Date().toISOString(),
        },
        { onConflict: 'practitioner_id' }
      )

    if (upsertError) {
      console.error('Failed to store QB connection:', upsertError)
      return NextResponse.redirect(`${appUrl}/account?tab=billing&qb=error&reason=db_error`)
    }

    return NextResponse.redirect(`${appUrl}/account?tab=billing&qb=connected`)
  } catch (err) {
    console.error('QB callback error:', err)
    return NextResponse.redirect(`${appUrl}/account?tab=billing&qb=error&reason=token_error`)
  }
}
