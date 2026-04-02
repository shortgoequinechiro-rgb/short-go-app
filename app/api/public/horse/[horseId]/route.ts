import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/public/horse/[horseId]
 * Public endpoint — returns horse name, species, and practitioner info.
 * Used by the public vet authorization form.
 * Only returns non-sensitive fields.
 * Also returns sibling animals (same owner) so the vet can authorize multiple at once.
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
    .select('id, name, species, breed, practitioner_id, owner_id')
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

  // Get owner name for display
  let ownerName: string | null = null
  if (horse.owner_id) {
    const { data: owner } = await supabase
      .from('owners')
      .select('full_name')
      .eq('id', horse.owner_id)
      .single()
    ownerName = owner?.full_name || null
  }

  // Check for existing active authorizations
  const today = new Date().toISOString().split('T')[0]
  const { data: existingAuths } = await supabase
    .from('vet_authorizations')
    .select('id, vet_name, authorization_date, expires_at, status, horse_id')
    .eq('horse_id', horseId)
    .eq('status', 'active')
    .gte('expires_at', today)
    .order('created_at', { ascending: false })

  // Get sibling animals (same owner, same practitioner) so vet can authorize multiple
  let siblingAnimals: { id: string; name: string; species: string; breed: string | null; hasActiveAuth: boolean }[] = []
  if (horse.owner_id) {
    const { data: siblings } = await supabase
      .from('horses')
      .select('id, name, species, breed')
      .eq('owner_id', horse.owner_id)
      .eq('practitioner_id', horse.practitioner_id)
      .neq('id', horseId)
      .eq('archived', false)
      .order('name')

    if (siblings && siblings.length > 0) {
      // Check which siblings already have active authorizations
      const siblingIds = siblings.map((s) => s.id)
      const { data: siblingAuths } = await supabase
        .from('vet_authorizations')
        .select('horse_id')
        .in('horse_id', siblingIds)
        .eq('status', 'active')
        .gte('expires_at', today)

      const authSet = new Set((siblingAuths || []).map((a) => a.horse_id))
      siblingAnimals = siblings.map((s) => ({
        id: s.id,
        name: s.name,
        species: s.species || 'equine',
        breed: s.breed,
        hasActiveAuth: authSet.has(s.id),
      }))
    }
  }

  return NextResponse.json({
    horse: {
      id: horse.id,
      name: horse.name,
      species: horse.species || 'equine',
      breed: horse.breed,
    },
    practitioner,
    ownerName,
    existingAuths: existingAuths || [],
    siblingAnimals,
  })
}
