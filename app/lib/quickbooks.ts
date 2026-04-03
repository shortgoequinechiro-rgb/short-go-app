/**
 * QuickBooks Online integration helpers.
 *
 * Environment variables required:
 *   QUICKBOOKS_CLIENT_ID
 *   QUICKBOOKS_CLIENT_SECRET
 *   QUICKBOOKS_REDIRECT_URI   (e.g. https://short-go-app.vercel.app/api/quickbooks/callback)
 *   QUICKBOOKS_ENVIRONMENT    ("sandbox" | "production", defaults to "production")
 */

import OAuthClient from 'intuit-oauth'
import { supabaseAdmin } from './auth'

// ── OAuth client singleton ────────────────────────────────────────────────────

let _oauthClient: OAuthClient | null = null

export function getOAuthClient(): OAuthClient {
  if (_oauthClient) return _oauthClient

  _oauthClient = new OAuthClient({
    clientId: process.env.QUICKBOOKS_CLIENT_ID!,
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
    environment: (process.env.QUICKBOOKS_ENVIRONMENT as 'sandbox' | 'production') || 'production',
    redirectUri: process.env.QUICKBOOKS_REDIRECT_URI!,
  })

  return _oauthClient
}

// ── Token management ──────────────────────────────────────────────────────────

export async function getQBConnection(practitionerId: string) {
  const { data, error } = await supabaseAdmin
    .from('quickbooks_connections')
    .select('*')
    .eq('practitioner_id', practitionerId)
    .single()

  if (error || !data) return null
  return data
}

/**
 * Get a valid access token, refreshing if expired.
 */
export async function getValidToken(practitionerId: string): Promise<string | null> {
  const conn = await getQBConnection(practitionerId)
  if (!conn) return null

  const expiresAt = new Date(conn.token_expires_at)
  const now = new Date()

  // If token is still valid (with 5 min buffer), return it
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return conn.access_token
  }

  // Refresh the token
  try {
    const oauthClient = getOAuthClient()
    oauthClient.setToken({
      access_token: conn.access_token,
      refresh_token: conn.refresh_token,
      token_type: 'bearer',
      expires_in: 0,
    })

    const authResponse = await oauthClient.refresh()
    const newToken = authResponse.getJson()

    await supabaseAdmin
      .from('quickbooks_connections')
      .update({
        access_token: newToken.access_token,
        refresh_token: newToken.refresh_token,
        token_expires_at: new Date(Date.now() + newToken.expires_in * 1000).toISOString(),
      })
      .eq('practitioner_id', practitionerId)

    return newToken.access_token
  } catch (err) {
    console.error('Failed to refresh QB token:', err)
    return null
  }
}

// ── QuickBooks API helpers ────────────────────────────────────────────────────

const QB_ENV = process.env.QUICKBOOKS_ENVIRONMENT || 'production'
const QB_BASE_URL = QB_ENV === 'sandbox'
  ? 'https://sandbox-quickbooks.api.intuit.com'
  : 'https://quickbooks.api.intuit.com'

console.log('[QB Config] QUICKBOOKS_ENVIRONMENT =', JSON.stringify(process.env.QUICKBOOKS_ENVIRONMENT), '→ QB_BASE_URL =', QB_BASE_URL)

async function qbFetch(
  method: string,
  path: string,
  realmId: string,
  accessToken: string,
  body?: object
) {
  const url = `${QB_BASE_URL}/v3/company/${realmId}${path}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QB API ${method} ${path}: ${res.status} — ${text}`)
  }

  return res.json()
}

// ── Item helpers ─────────────────────────────────────────────────────────────

/**
 * QuickBooks requires an ItemRef on every SalesItemLineDetail line.
 * Find the default "Services" item in QB, or create one if it doesn't exist.
 * Returns the QB Item ID as a string.
 */
async function getOrCreateServicesItem(
  realmId: string,
  accessToken: string
): Promise<string> {
  // Search for an existing "Services" item (QB creates one by default in most accounts)
  try {
    const query = encodeURIComponent("select * from Item where Name = 'Services' and Type = 'Service'")
    const searchResult = await qbFetch('GET', `/query?query=${query}`, realmId, accessToken)
    if (searchResult.QueryResponse?.Item?.length > 0) {
      return String(searchResult.QueryResponse.Item[0].Id)
    }
  } catch (err) {
    console.log('[QB] Services item search failed, will try to create:', err instanceof Error ? err.message : err)
  }

  // If "Services" doesn't exist, find any Service-type item
  try {
    const query = encodeURIComponent("select * from Item where Type = 'Service' maxresults 1")
    const searchResult = await qbFetch('GET', `/query?query=${query}`, realmId, accessToken)
    if (searchResult.QueryResponse?.Item?.length > 0) {
      return String(searchResult.QueryResponse.Item[0].Id)
    }
  } catch {
    // Fall through to create
  }

  // Create a "Services" item
  try {
    const result = await qbFetch('POST', '/item', realmId, accessToken, {
      Name: 'Services',
      Type: 'Service',
      IncomeAccountRef: { name: 'Services' },
    })
    return String(result.Item.Id)
  } catch (err) {
    // Last resort: try with a generic income account
    console.error('[QB] Failed to create Services item:', err instanceof Error ? err.message : err)

    // Try to find any income account to use
    const acctQuery = encodeURIComponent("select * from Account where AccountType = 'Income' maxresults 1")
    const acctResult = await qbFetch('GET', `/query?query=${acctQuery}`, realmId, accessToken)
    if (acctResult.QueryResponse?.Account?.length > 0) {
      const acct = acctResult.QueryResponse.Account[0]
      const result = await qbFetch('POST', '/item', realmId, accessToken, {
        Name: 'Services',
        Type: 'Service',
        IncomeAccountRef: { value: String(acct.Id), name: acct.Name },
      })
      return String(result.Item.Id)
    }

    throw new Error('Cannot find or create a Services item in QuickBooks. Please create a Service-type item in your QuickBooks account.')
  }
}

// ── Customer sync ─────────────────────────────────────────────────────────────

/**
 * Find or create a QuickBooks Customer from a Chiro Stride owner.
 * Returns the QB Customer ID.
 */
export async function syncOwnerToQBCustomer(
  practitionerId: string,
  owner: { id: string; full_name: string; email: string | null; phone: string | null }
): Promise<string | null> {
  const conn = await getQBConnection(practitionerId)
  if (!conn) return null

  const accessToken = await getValidToken(practitionerId)
  if (!accessToken) return null

  // Check if owner already has a QB customer ID
  const { data: ownerData } = await supabaseAdmin
    .from('owners')
    .select('qb_customer_id')
    .eq('id', owner.id)
    .single()

  if (ownerData?.qb_customer_id) {
    return ownerData.qb_customer_id
  }

  // Search QB for existing customer by name
  try {
    const query = encodeURIComponent(`select * from Customer where DisplayName = '${owner.full_name.replace(/'/g, "''")}'`)
    console.log('QB customer search query:', query, 'realmId:', conn.realm_id)
    const searchResult = await qbFetch('GET', `/query?query=${query}`, conn.realm_id, accessToken)

    if (searchResult.QueryResponse?.Customer?.length > 0) {
      const qbCustomerId = String(searchResult.QueryResponse.Customer[0].Id)
      await supabaseAdmin
        .from('owners')
        .update({ qb_customer_id: qbCustomerId })
        .eq('id', owner.id)
      return qbCustomerId
    }
  } catch (searchErr) {
    console.error('QB customer search failed:', searchErr instanceof Error ? searchErr.message : searchErr)
    // Search failed, try to create
  }

  // Create new QB customer
  try {
    const customerData: Record<string, unknown> = {
      DisplayName: owner.full_name,
    }
    if (owner.email) {
      customerData.PrimaryEmailAddr = { Address: owner.email }
    }
    if (owner.phone) {
      customerData.PrimaryPhone = { FreeFormNumber: owner.phone }
    }

    console.log('Creating QB customer:', JSON.stringify(customerData), 'realmId:', conn.realm_id, 'baseUrl:', QB_BASE_URL)
    const result = await qbFetch('POST', '/customer', conn.realm_id, accessToken, customerData)
    const qbCustomerId = String(result.Customer.Id)

    await supabaseAdmin
      .from('owners')
      .update({ qb_customer_id: qbCustomerId })
      .eq('id', owner.id)

    return qbCustomerId
  } catch (err) {
    console.error('Failed to create QB customer:', err)
    return null
  }
}

// ── Invoice sync ──────────────────────────────────────────────────────────────

type InvoiceForSync = {
  id: string
  invoice_number: string
  owner_id: string
  total_cents: number
  line_items: Array<{
    description: string
    quantity: number
    unit_price_cents: number
  }>
}

/**
 * Push a Chiro Stride invoice to QuickBooks.
 */
export async function syncInvoiceToQB(
  practitionerId: string,
  invoice: InvoiceForSync
): Promise<{ success: boolean; qbInvoiceId?: string; error?: string }> {
  const conn = await getQBConnection(practitionerId)
  if (!conn) return { success: false, error: 'No QuickBooks connection' }

  const accessToken = await getValidToken(practitionerId)
  if (!accessToken) return { success: false, error: 'Failed to get valid token' }

  try {
    // Get owner info for customer mapping
    const { data: owner } = await supabaseAdmin
      .from('owners')
      .select('id, full_name, email, phone')
      .eq('id', invoice.owner_id)
      .single()

    if (!owner) return { success: false, error: 'Owner not found' }

    // Sync owner as QB Customer
    const qbCustomerId = await syncOwnerToQBCustomer(practitionerId, owner)
    if (!qbCustomerId) return { success: false, error: 'Failed to sync customer to QB' }

    // Find or create a "Services" item in QB to use as the ItemRef
    // (QB requires ItemRef on SalesItemLineDetail lines)
    const servicesItemId = await getOrCreateServicesItem(conn.realm_id, accessToken)

    // Build QB invoice
    const qbInvoice = {
      CustomerRef: { value: qbCustomerId },
      DocNumber: invoice.invoice_number,
      Line: invoice.line_items.map((item) => ({
        DetailType: 'SalesItemLineDetail',
        Amount: item.quantity * item.unit_price_cents / 100,
        Description: item.description,
        SalesItemLineDetail: {
          ItemRef: { value: servicesItemId },
          Qty: item.quantity,
          UnitPrice: item.unit_price_cents / 100,
        },
      })),
    }

    const result = await qbFetch('POST', '/invoice', conn.realm_id, accessToken, qbInvoice)
    const qbInvoiceId = String(result.Invoice.Id)

    // Build the QB customer-facing payment URL if QB Payments is enabled
    // Format: https://app.qbo.intuit.com/app/customerportal?txnId=<id>&txnType=invoice&realmId=<realmId>
    const qbPaymentUrl = `https://app.qbo.intuit.com/app/customerportal?txnId=${qbInvoiceId}&txnType=invoice&realmId=${conn.realm_id}`

    // Update local invoice with QB ID and payment URL
    await supabaseAdmin
      .from('invoices')
      .update({
        qb_invoice_id: qbInvoiceId,
        qb_payment_url: qbPaymentUrl,
        qb_sync_status: 'synced',
        qb_sync_error: null,
        qb_synced_at: new Date().toISOString(),
      })
      .eq('id', invoice.id)

    return { success: true, qbInvoiceId }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to sync invoice to QB:', errorMsg)

    // Mark as failed
    await supabaseAdmin
      .from('invoices')
      .update({
        qb_sync_status: 'failed',
        qb_sync_error: errorMsg,
      })
      .eq('id', invoice.id)

    return { success: false, error: errorMsg }
  }
}

// ── Payment sync ──────────────────────────────────────────────────────────────

/**
 * Record a payment in QuickBooks when an invoice is marked as paid.
 */
export async function syncPaymentToQB(
  practitionerId: string,
  invoiceId: string,
  amountCents: number,
  paymentMethod: string
): Promise<{ success: boolean; error?: string }> {
  const conn = await getQBConnection(practitionerId)
  if (!conn) return { success: false, error: 'No QuickBooks connection' }

  const accessToken = await getValidToken(practitionerId)
  if (!accessToken) return { success: false, error: 'Failed to get valid token' }

  // Get the invoice's QB ID and owner
  const { data: invoice } = await supabaseAdmin
    .from('invoices')
    .select('qb_invoice_id, owner_id')
    .eq('id', invoiceId)
    .single()

  if (!invoice?.qb_invoice_id) {
    return { success: false, error: 'Invoice not synced to QB yet' }
  }

  const { data: owner } = await supabaseAdmin
    .from('owners')
    .select('qb_customer_id')
    .eq('id', invoice.owner_id)
    .single()

  if (!owner?.qb_customer_id) {
    return { success: false, error: 'Owner not synced to QB' }
  }

  try {
    const payment = {
      CustomerRef: { value: owner.qb_customer_id },
      TotalAmt: amountCents / 100,
      Line: [
        {
          Amount: amountCents / 100,
          LinkedTxn: [
            {
              TxnId: invoice.qb_invoice_id,
              TxnType: 'Invoice',
            },
          ],
        },
      ],
      PrivateNote: `Payment via ${paymentMethod} — synced from Chiro Stride`,
    }

    await qbFetch('POST', '/payment', conn.realm_id, accessToken, payment)
    return { success: true }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to sync payment to QB:', errorMsg)
    return { success: false, error: errorMsg }
  }
}
