import Dexie, { type Table } from 'dexie'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PendingHorse {
  localId: string        // client-generated UUID
  ownerId: string
  name: string
  breed: string | null
  age: string | null
  sex: string | null
  species: string
  archived: boolean
  createdAt: string
}

export interface PendingIntakeForm {
  localId: string        // client-generated UUID
  localHorseId: string | null   // may point to a PendingHorse.localId or existing horse id
  isNewHorse: boolean
  ownerId: string
  submittedAt: string
  formDate: string
  referralSource: string[]
  animalName: string
  animalAge: string | null
  animalBreed: string | null
  animalDob?: string | null
  animalGender: string | null
  animalHeight: string | null
  animalColor: string | null
  reasonForCare: string | null
  healthProblems: string | null
  behaviorChanges: string | null
  conditionsIllnesses: string | null
  medicationsSupplements: string | null
  useOfAnimal: string | null
  previousChiroCare: boolean | null
  consentSigned: boolean
  signatureData: string | null
  signedName: string
}

// ── Database ──────────────────────────────────────────────────────────────────

class OfflineDB extends Dexie {
  pendingHorses!: Table<PendingHorse>
  pendingIntakeForms!: Table<PendingIntakeForm>

  constructor() {
    super('shortGoOfflineDB')
    this.version(1).stores({
      pendingHorses: 'localId, ownerId',
      pendingIntakeForms: 'localId, ownerId',
    })
  }
}

export const offlineDb = new OfflineDB()

// ── Sync ──────────────────────────────────────────────────────────────────────

export async function syncPendingData(supabase: SupabaseClient) {
  if (!navigator.onLine) return { synced: 0, failed: 0 }

  const { data: { user } } = await supabase.auth.getUser()
  const practitionerId = user?.id || null

  const horses = await offlineDb.pendingHorses.toArray()
  const forms = await offlineDb.pendingIntakeForms.toArray()

  let synced = 0
  let failed = 0

  // Sync horses first (forms depend on them)
  for (const horse of horses) {
    const { error } = await supabase.from('horses').insert({
      id: horse.localId,
      owner_id: horse.ownerId,
      name: horse.name,
      breed: horse.breed,
      age: horse.age,
      sex: horse.sex,
      species: horse.species,
      archived: horse.archived,
      practitioner_id: practitionerId,
    })
    if (!error) {
      await offlineDb.pendingHorses.delete(horse.localId)
      synced++
    } else {
      // If it already exists (duplicate sync attempt), still remove from queue
      if (error.code === '23505') {
        await offlineDb.pendingHorses.delete(horse.localId)
      } else {
        failed++
      }
    }
  }

  // Sync intake forms
  for (const form of forms) {
    const { error } = await supabase.from('intake_forms').insert({
      id: form.localId,
      owner_id: form.ownerId,
      horse_id: form.localHorseId,
      submitted_at: form.submittedAt,
      form_date: form.formDate,
      referral_source: form.referralSource,
      animal_name: form.animalName,
      animal_age: form.animalAge,
      animal_breed: form.animalBreed,
      animal_dob: form.animalDob,
      animal_gender: form.animalGender,
      animal_height: form.animalHeight,
      animal_color: form.animalColor,
      reason_for_care: form.reasonForCare,
      health_problems: form.healthProblems,
      behavior_changes: form.behaviorChanges,
      conditions_illnesses: form.conditionsIllnesses,
      medications_supplements: form.medicationsSupplements,
      use_of_animal: form.useOfAnimal,
      previous_chiro_care: form.previousChiroCare,
      consent_signed: form.consentSigned,
      signature_data: form.signatureData,
      signed_name: form.signedName,
      practitioner_id: practitionerId,
    })
    if (!error) {
      await offlineDb.pendingIntakeForms.delete(form.localId)
      synced++
    } else {
      if (error.code === '23505') {
        await offlineDb.pendingIntakeForms.delete(form.localId)
      } else {
        failed++
      }
    }
  }

  return { synced, failed }
}

// ── Pending count ─────────────────────────────────────────────────────────────

export async function getPendingCount(): Promise<number> {
  const [horses, forms] = await Promise.all([
    offlineDb.pendingHorses.count(),
    offlineDb.pendingIntakeForms.count(),
  ])
  return horses + forms
}
