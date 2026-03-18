import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Uses the service role key so this route bypasses RLS.
// Only returns limited public-facing practitioner info (name + logo).
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ practitionerId: string }> }
) {
  const { practitionerId } = await params

  if (!practitionerId) {
    return NextResponse.json({ error: 'practitionerId is required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('practitioners')
    .select('id, practice_name, full_name, logo_url')
    .eq('id', practitionerId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Practitioner not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
