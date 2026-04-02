import { NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '../../../lib/auth'

/**
 * GET /api/quickbooks/status
 * Returns current QuickBooks connection status for the practitioner.
 */
export async function GET(req: Request) {
  const { user, error } = await requireAuth(req)
  if (error) return error

  const { data: conn } = await supabaseAdmin
    .from('quickbooks_connections')
    .select('realm_id, company_name, connected_at, last_synced_at')
    .eq('practitioner_id', user!.id)
    .single()

  return NextResponse.json({
    connected: !!conn,
    connection: conn || null,
  })
}

/**
 * DELETE /api/quickbooks/status
 * Disconnects QuickBooks for the practitioner.
 */
export async function DELETE(req: Request) {
  const { user, error } = await requireAuth(req)
  if (error) return error

  await supabaseAdmin
    .from('quickbooks_connections')
    .delete()
    .eq('practitioner_id', user!.id)

  return NextResponse.json({ disconnected: true })
}
