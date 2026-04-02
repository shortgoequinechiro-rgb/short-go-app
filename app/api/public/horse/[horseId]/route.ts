import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/public/horse/[horseId]
 * Public endpoint — returns horse name, species, and practitioner info.
 * Used by the public vet authorization form.
 * Only returns non-sensitive fields.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ horseId: string }> }
) {
  const { horseId } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: horse, error } = await supabase
    .from('horses')
    .select('id, name, species, breed, practitioner_id')
    .eq('id', horseId)
    .single()

  if (error || !horse) {
    return NextResponse.json({ error: 'Horse not found' }, { status: 404 })
  }

  // Get practitioner name for display
  let practitioner = null
  if (horse.practitioner_id) {
    const { data: pract } = await supabase
      .from('practitioners')
      .select('full_name, practice_name, logo_url')
      .eq('id', horse.practitioner_id)
      .single()
    practitioner = pract
  }

  // Check for existing active authorizations
  const today = new Date().toISOString().split('T')[0]
  const { data: existingAuths } = await supabase
    .from('vet_authorizations')
    .select('id, vet_name, authorization_date, expires_at, status')
    .eq('horse_id', horseId)
    .eq('status', 'active')
    .gte('expires_at', today)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    horse: {
      id: horse.id,
      name: horse.name,
      species: horse.species || 'equine',
      breed: horse.breed,
    },
    practitioner,
    existingAuths: existingAuths || [],
  })
}
