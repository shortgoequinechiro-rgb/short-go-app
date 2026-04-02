import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '../../../lib/auth'

/**
 * GET /api/intake/[formId]
 * Authenticated endpoint — returns full intake form data for the view page.
 * Uses the service role key to bypass RLS (practitioner is verified via auth).
 * Does explicit lookups instead of PostgREST joins to avoid FK dependency issues.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError

  const { formId } = await params

  // 1. Fetch the intake form itself
  const { data: form, error } = await supabaseAdmin
    .from('intake_forms')
    .select('*')
    .eq('id', formId)
    .eq('practitioner_id', user!.id)
    .single()

  if (error || !form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 })
  }

  // 2. Fetch related data in parallel
  const [ownerRes, horseRes, practRes] = await Promise.all([
    form.owner_id
      ? supabaseAdmin.from('owners').select('full_name, phone, email, address').eq('id', form.owner_id).single()
      : Promise.resolve({ data: null }),
    form.horse_id
      ? supabaseAdmin.from('horses').select('id, name, species').eq('id', form.horse_id).single()
      : Promise.resolve({ data: null }),
    supabaseAdmin.from('practitioners').select('practice_name, full_name').eq('id', user!.id).single(),
  ])

  return NextResponse.json({
    ...form,
    owners: ownerRes.data || null,
    horses: horseRes.data || null,
    practitioners: practRes.data || null,
  })
}

/**
 * PATCH /api/intake/[formId]
 * Authenticated endpoint — toggle archive status.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError

  const { formId } = await params
  const body = await req.json()

  const { error } = await supabaseAdmin
    .from('intake_forms')
    .update({ archived: body.archived })
    .eq('id', formId)
    .eq('practitioner_id', user!.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to update form' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
