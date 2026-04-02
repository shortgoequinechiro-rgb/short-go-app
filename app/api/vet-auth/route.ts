import { NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '../../lib/auth'

/**
 * GET /api/vet-auth?horse_id=xxx
 * Returns all vet authorizations for a given horse.
 */
export async function GET(req: Request) {
  const { user, error } = await requireAuth(req)
  if (error) return error

  const { searchParams } = new URL(req.url)
  const horseId = searchParams.get('horse_id')

  if (!horseId) {
    return NextResponse.json({ error: 'horse_id is required' }, { status: 400 })
  }

  // Auto-expire stale authorizations
  await supabaseAdmin
    .from('vet_authorizations')
    .update({ status: 'expired' })
    .eq('practitioner_id', user!.id)
    .eq('horse_id', horseId)
    .eq('status', 'active')
    .lte('expires_at', new Date().toISOString().split('T')[0])

  const { data, error: fetchError } = await supabaseAdmin
    .from('vet_authorizations')
    .select('*')
    .eq('practitioner_id', user!.id)
    .eq('horse_id', horseId)
    .order('created_at', { ascending: false })

  if (fetchError) {
    return NextResponse.json({ error: 'Failed to fetch authorizations' }, { status: 500 })
  }

  // Determine if there's a valid (active, non-expired) authorization
  const today = new Date().toISOString().split('T')[0]
  const validAuth = (data || []).find(
    (a) => a.status === 'active' && a.expires_at >= today
  )

  return NextResponse.json({
    authorizations: data || [],
    hasValidAuth: !!validAuth,
    validAuth: validAuth || null,
  })
}

/**
 * POST /api/vet-auth
 * Manually create a vet authorization (practitioner enters vet info).
 */
export async function POST(req: Request) {
  const { user, error } = await requireAuth(req)
  if (error) return error

  const body = await req.json()
  const {
    horse_id,
    vet_name,
    vet_license_number,
    vet_practice_name,
    vet_phone,
    vet_email,
    authorization_date,
    expires_at,
    vet_notes,
    document_path,
  } = body

  if (!horse_id || !vet_name) {
    return NextResponse.json({ error: 'horse_id and vet_name are required' }, { status: 400 })
  }

  // Default expiration: 1 year from authorization date
  const authDate = authorization_date || new Date().toISOString().split('T')[0]
  const expDate = expires_at || new Date(
    new Date(authDate).getTime() + 365 * 24 * 60 * 60 * 1000
  ).toISOString().split('T')[0]

  const { data, error: insertError } = await supabaseAdmin
    .from('vet_authorizations')
    .insert({
      practitioner_id: user!.id,
      horse_id,
      vet_name,
      vet_license_number: vet_license_number || null,
      vet_practice_name: vet_practice_name || null,
      vet_phone: vet_phone || null,
      vet_email: vet_email || null,
      authorization_date: authDate,
      expires_at: expDate,
      vet_notes: vet_notes || null,
      document_path: document_path || null,
      source: 'manual',
      vet_exam_confirmed: true,
      status: 'active',
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('Failed to create vet authorization:', insertError)
    return NextResponse.json({ error: 'Failed to save authorization' }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: data?.id })
}

/**
 * DELETE /api/vet-auth?id=xxx
 * Revoke a vet authorization.
 */
export async function DELETE(req: Request) {
  const { user, error } = await requireAuth(req)
  if (error) return error

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  await supabaseAdmin
    .from('vet_authorizations')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('practitioner_id', user!.id)

  return NextResponse.json({ revoked: true })
}
