import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, supabaseAdmin } from '../../../lib/auth'

/**
 * GET /api/intake/[formId]
 * Authenticated endpoint — returns full intake form data for the view page.
 * Uses the service role key to bypass RLS (practitioner is verified via auth).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError

  const { formId } = await params

  const { data, error } = await supabaseAdmin
    .from('intake_forms')
    .select(`
      *,
      owners ( full_name, phone, email, address ),
      horses ( id, name, species ),
      practitioners ( practice_name, full_name )
    `)
    .eq('id', formId)
    .eq('practitioner_id', user!.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 })
  }

  return NextResponse.json(data)
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
