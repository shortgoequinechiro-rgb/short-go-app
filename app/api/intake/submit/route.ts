import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type AnimalPayload = {
  selectedHorseId: string
  species: 'equine' | 'canine'
  name: string
  age: string
  breed: string
  dob: string
  gender: string
  height: string
  color: string
  reasonForCare: string
  healthProblems: string
  behaviorChanges: string
  conditionsIllnesses: string
  medications: string
  useOfAnimal: string
  previousChiroCare: boolean | null
}

export async function POST(req: NextRequest) {
  const supabase = getAdminSupabase()

  let body: {
    ownerId: string
    referralSources: string[]
    animals: AnimalPayload[]
    signatureData: string | null
    signedName: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { ownerId, referralSources, animals, signatureData, signedName } = body

  if (!ownerId || !animals?.length) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  // Fetch owner to get practitioner_id
  const { data: owner, error: ownerError } = await supabase
    .from('owners')
    .select('id, practitioner_id')
    .eq('id', ownerId)
    .single()

  if (ownerError || !owner) {
    return NextResponse.json({ error: 'Owner not found.' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const results: { horseId: string | null; formId: string | null; name: string }[] = []

  for (const animal of animals) {
    const resolvedAnimalName = animal.name.trim() || 'Unknown Patient'
    let resolvedHorseId: string | null = animal.selectedHorseId !== 'new' ? animal.selectedHorseId : null

    // Create new horse record if needed
    if (animal.selectedHorseId === 'new') {
      const { data: newHorse, error: horseError } = await supabase
        .from('horses')
        .insert({
          owner_id: ownerId,
          name: resolvedAnimalName,
          breed: animal.breed || null,
          age: animal.age || null,
          sex: animal.gender || null,
          species: animal.species,
          archived: false,
          practitioner_id: owner.practitioner_id,
        })
        .select('id')
        .single()

      if (horseError || !newHorse) {
        return NextResponse.json(
          { error: `Could not create patient record for "${resolvedAnimalName}": ${horseError?.message || 'unknown error'}` },
          { status: 500 }
        )
      }

      resolvedHorseId = newHorse.id
    }

    // Insert intake form
    const { data: newForm, error: formError } = await supabase
      .from('intake_forms')
      .insert({
        owner_id: ownerId,
        horse_id: resolvedHorseId,
        submitted_at: now,
        practitioner_id: owner.practitioner_id,
        form_date: now.split('T')[0],
        referral_source: referralSources,
        animal_name: resolvedAnimalName,
        animal_age: animal.age || null,
        animal_breed: animal.breed || null,
        animal_dob: animal.dob || null,
        animal_gender: animal.gender || null,
        animal_height: animal.height || null,
        animal_color: animal.color || null,
        reason_for_care: animal.reasonForCare || null,
        health_problems: animal.healthProblems || null,
        behavior_changes: animal.behaviorChanges || null,
        conditions_illnesses: animal.conditionsIllnesses || null,
        medications_supplements: animal.medications || null,
        use_of_animal: animal.useOfAnimal || null,
        previous_chiro_care: animal.previousChiroCare,
        consent_signed: true,
        signature_data: signatureData,
        signed_name: signedName,
      })
      .select('id')
      .single()

    if (formError) {
      // If form insert fails and we just created a horse, clean it up
      if (animal.selectedHorseId === 'new' && resolvedHorseId) {
        await supabase.from('horses').delete().eq('id', resolvedHorseId)
      }
      return NextResponse.json(
        { error: `Submission error for "${resolvedAnimalName}": ${formError.message}` },
        { status: 500 }
      )
    }

    results.push({ horseId: resolvedHorseId, formId: newForm?.id ?? null, name: resolvedAnimalName })
  }

  return NextResponse.json({ success: true, results })
}
