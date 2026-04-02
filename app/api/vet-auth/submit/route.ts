import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/vet-auth/submit
 * Public endpoint — called by the vet authorization form (no auth required).
 * The vet fills out the form via a public URL and submits their authorization.
 */

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const supabase = getAdminSupabase()

  let body: {
    horseId: string
    additionalHorseIds?: string[]
    vetName: string
    vetLicenseNumber?: string
    vetPracticeName?: string
    vetPhone?: string
    vetEmail?: string
    vetExamConfirmed: boolean
    vetNotes?: string
    signatureData?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { horseId, additionalHorseIds, vetName, vetLicenseNumber, vetPracticeName, vetPhone, vetEmail, vetExamConfirmed, vetNotes, signatureData } = body

  if (!horseId || !vetName) {
    return NextResponse.json({ error: 'Horse ID and veterinarian name are required.' }, { status: 400 })
  }

  if (!vetExamConfirmed) {
    return NextResponse.json({ error: 'Veterinary exam confirmation is required.' }, { status: 400 })
  }

  // Combine primary horse with any additional selected animals
  const allHorseIds = [horseId, ...(additionalHorseIds || [])]
  // Deduplicate
  const uniqueHorseIds = [...new Set(allHorseIds)]

  // Look up all horses to get their practitioner_ids
  const { data: horses, error: horseError } = await supabase
    .from('horses')
    .select('id, name, practitioner_id, owner_id')
    .in('id', uniqueHorseIds)

  if (horseError || !horses || horses.length === 0) {
    return NextResponse.json({ error: 'Animal(s) not found.' }, { status: 404 })
  }

  // Verify all additional animals belong to the same owner as the primary
  const primaryHorse = horses.find((h) => h.id === horseId)
  if (!primaryHorse) {
    return NextResponse.json({ error: 'Primary animal not found.' }, { status: 404 })
  }

  const invalidSiblings = horses.filter(
    (h) => h.id !== horseId && h.owner_id !== primaryHorse.owner_id
  )
  if (invalidSiblings.length > 0) {
    return NextResponse.json({ error: 'All animals must belong to the same owner.' }, { status: 400 })
  }

  // Default expiration: 1 year from today
  const today = new Date().toISOString().split('T')[0]
  const oneYearFromNow = new Date(
    Date.now() + 365 * 24 * 60 * 60 * 1000
  ).toISOString().split('T')[0]

  // Create authorization records for all selected animals
  const authRecords = horses.map((horse) => ({
    practitioner_id: horse.practitioner_id,
    horse_id: horse.id,
    vet_name: vetName,
    vet_license_number: vetLicenseNumber || null,
    vet_practice_name: vetPracticeName || null,
    vet_phone: vetPhone || null,
    vet_email: vetEmail || null,
    authorization_date: today,
    expires_at: oneYearFromNow,
    status: 'active',
    source: 'digital_form',
    vet_exam_confirmed: vetExamConfirmed,
    vet_notes: vetNotes || null,
    signature_data: signatureData || null,
  }))

  const { data: newAuths, error: insertError } = await supabase
    .from('vet_authorizations')
    .insert(authRecords)
    .select('id, horse_id')

  if (insertError) {
    console.error('Failed to insert vet authorization(s):', insertError)
    return NextResponse.json({ error: 'Failed to save authorization.' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    count: newAuths?.length || 0,
    ids: (newAuths || []).map((a) => a.id),
  })
}
