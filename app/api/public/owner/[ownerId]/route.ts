import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Uses the service role key so this route bypasses RLS.
// Only returns the specific owner + their horses for the given UUID.
// The UUID in the URL acts as an unguessable access token for intake/consent forms.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ownerId: string }> }
) {
  const { ownerId } = await params

  if (!ownerId) {
    return NextResponse.json({ error: 'ownerId is required' }, { status: 400 })
  }

  const [ownerResult, horsesResult] = await Promise.all([
    supabaseAdmin
      .from('owners')
      .select('id, full_name, phone, email, address, practitioner_id')
      .eq('id', ownerId)
      .single(),
    supabaseAdmin
      .from('horses')
      .select('id, name, species, breed, age, sex, barn_location, gender')
      .eq('owner_id', ownerId)
      .order('name'),
  ])

  if (ownerResult.error || !ownerResult.data) {
    return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
  }

  return NextResponse.json({
    owner: ownerResult.data,
    horses: horsesResult.data || [],
  })
}
