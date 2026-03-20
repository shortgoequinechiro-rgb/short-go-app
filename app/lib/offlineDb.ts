import Dexie, { type Table } from 'dexie'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Cached data types (read cache — mirrors Supabase rows) ─────────────────

export interface CachedOwner {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  address: string | null
  archived: boolean
  practitioner_id: string
  cachedAt: number
}

export interface CachedHorse {
  id: string
  owner_id: string | null
  name: string
  breed: string | null
  age: string | null
  sex: string | null
  species: string | null
  discipline: string | null
  barn_location: string | null
  archived: boolean
  practitioner_id: string
  cachedAt: number
}

export interface CachedVisit {
  id: string
  horse_id: string
  visit_date: string | null
  reason_for_visit: string | null
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  quick_notes: string | null
  practitioner_id: string
  cachedAt: number
}

export interface CachedAppointment {
  id: string
  horse_id: string | null
  owner_id: string | null
  appointment_date: string
  appointment_time: string | null
  duration_minutes: number | null
  location: string | null
  reason: string | null
  status: string
  provider_name: string | null
  notes: string | null
  practitioner_id: string
  cachedAt: number
}

// ── Pending write types (offline queue) ────────────────────────────────────

export interface PendingHorse {
  localId: string
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
  localId: string
  localHorseId: string | null
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

export interface PendingVisit {
  localId: string
  horseId: string
  visitDate: string
  reasonForVisit: string | null
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  quickNotes: string | null
  createdAt: string
}

export interface PendingAppointment {
  localId: string
  horseId: string | null
  ownerId: string
  appointmentDate: string
  appointmentTime: string | null
  durationMinutes: number
  location: string | null
  reason: string | null
  status: string
  providerName: string | null
  notes: string | null
  createdAt: string
}

// ── Database ──────────────────────────────────────────────────────────────────

class OfflineDB extends Dexie {
  // Read cache tables
  cachedOwners!: Table<CachedOwner>
  cachedHorses!: Table<CachedHorse>
  cachedVisits!: Table<CachedVisit>
  cachedAppointments!: Table<CachedAppointment>

  // Write queue tables
  pendingHorses!: Table<PendingHorse>
  pendingIntakeForms!: Table<PendingIntakeForm>
  pendingVisits!: Table<PendingVisit>
  pendingAppointments!: Table<PendingAppointment>

  constructor() {
    super('shortGoOfflineDB')

    this.version(1).stores({
      pendingHorses: 'localId, ownerId',
      pendingIntakeForms: 'localId, ownerId',
    })

    this.version(2).stores({
      // Read cache
      cachedOwners: 'id, practitioner_id, cachedAt',
      cachedHorses: 'id, owner_id, practitioner_id, cachedAt',
      cachedVisits: 'id, horse_id, practitioner_id, cachedAt',
      cachedAppointments: 'id, owner_id, appointment_date, practitioner_id, cachedAt',
      // Write queue
      pendingHorses: 'localId, ownerId',
      pendingIntakeForms: 'localId, ownerId',
      pendingVisits: 'localId, horseId',
      pendingAppointments: 'localId, ownerId',
    })
  }
}

export const offlineDb = new OfflineDB()

// ── Cache helpers (call these after successful Supabase fetches) ────────────

const CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours

export async function cacheOwners(owners: CachedOwner[]) {
  const now = Date.now()
  const rows = owners.map(o => ({ ...o, cachedAt: now }))
  await offlineDb.cachedOwners.bulkPut(rows)
}

export async function cacheHorses(horses: CachedHorse[]) {
  const now = Date.now()
  const rows = horses.map(h => ({ ...h, cachedAt: now }))
  await offlineDb.cachedHorses.bulkPut(rows)
}

export async function cacheVisits(visits: CachedVisit[]) {
  const now = Date.now()
  const rows = visits.map(v => ({ ...v, cachedAt: now }))
  await offlineDb.cachedVisits.bulkPut(rows)
}

export async function cacheAppointments(appointments: CachedAppointment[]) {
  const now = Date.now()
  const rows = appointments.map(a => ({ ...a, cachedAt: now }))
  await offlineDb.cachedAppointments.bulkPut(rows)
}

// ── Read from cache (fallback when offline) ─────────────────────────────────

export async function getCachedOwners(practitionerId: string): Promise<CachedOwner[]> {
  const cutoff = Date.now() - CACHE_TTL
  return offlineDb.cachedOwners
    .where('practitioner_id').equals(practitionerId)
    .and(o => o.cachedAt > cutoff)
    .toArray()
}

export async function getCachedHorses(practitionerId: string): Promise<CachedHorse[]> {
  const cutoff = Date.now() - CACHE_TTL
  return offlineDb.cachedHorses
    .where('practitioner_id').equals(practitionerId)
    .and(h => h.cachedAt > cutoff)
    .toArray()
}

export async function getCachedVisitsByHorse(horseId: string): Promise<CachedVisit[]> {
  const cutoff = Date.now() - CACHE_TTL
  return offlineDb.cachedVisits
    .where('horse_id').equals(horseId)
    .and(v => v.cachedAt > cutoff)
    .toArray()
}

export async function getCachedAppointments(practitionerId: string): Promise<CachedAppointment[]> {
  const cutoff = Date.now() - CACHE_TTL
  return offlineDb.cachedAppointments
    .where('practitioner_id').equals(practitionerId)
    .and(a => a.cachedAt > cutoff)
    .toArray()
}

// ── Additional read helpers ──────────────────────────────────────────────────

export async function getCachedHorsesByOwner(ownerId: string): Promise<CachedHorse[]> {
  const cutoff = Date.now() - CACHE_TTL
  return offlineDb.cachedHorses
    .where('owner_id').equals(ownerId)
    .and(h => h.cachedAt > cutoff)
    .toArray()
}

export async function getCachedHorseById(horseId: string): Promise<CachedHorse | undefined> {
  return offlineDb.cachedHorses.get(horseId)
}

export async function getCachedOwnerById(ownerId: string): Promise<CachedOwner | undefined> {
  return offlineDb.cachedOwners.get(ownerId)
}

export async function getCachedVisitsByPractitioner(practitionerId: string): Promise<CachedVisit[]> {
  const cutoff = Date.now() - CACHE_TTL
  return offlineDb.cachedVisits
    .where('practitioner_id').equals(practitionerId)
    .and(v => v.cachedAt > cutoff)
    .toArray()
}

// ── Offline-aware fetch wrapper ─────────────────────────────────────────────
// Tries to run an online fetcher; on failure (or if offline) runs the fallback.

export async function fetchWithOfflineFallback<T>(
  onlineFetcher: () => Promise<T>,
  offlineFallback: () => Promise<T>,
): Promise<{ data: T; fromCache: boolean }> {
  if (!navigator.onLine) {
    return { data: await offlineFallback(), fromCache: true }
  }
  try {
    const data = await onlineFetcher()
    return { data, fromCache: false }
  } catch {
    return { data: await offlineFallback(), fromCache: true }
  }
}

// ── Sync pending data to Supabase ───────────────────────────────────────────

export async function syncPendingData(supabase: SupabaseClient) {
  if (!navigator.onLine) return { synced: 0, failed: 0 }

  const { data: { user } } = await supabase.auth.getUser()
  const practitionerId = user?.id || null

  let synced = 0
  let failed = 0

  // ── Sync pending horses ──
  const horses = await offlineDb.pendingHorses.toArray()
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
    if (!error || error.code === '23505') {
      await offlineDb.pendingHorses.delete(horse.localId)
      if (!error) synced++
    } else {
      failed++
    }
  }

  // ── Sync pending intake forms ──
  const forms = await offlineDb.pendingIntakeForms.toArray()
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
    if (!error || error.code === '23505') {
      await offlineDb.pendingIntakeForms.delete(form.localId)
      if (!error) synced++
    } else {
      failed++
    }
  }

  // ── Sync pending visits ──
  const visits = await offlineDb.pendingVisits.toArray()
  for (const visit of visits) {
    const { error } = await supabase.from('visits').insert({
      id: visit.localId,
      horse_id: visit.horseId,
      visit_date: visit.visitDate,
      reason_for_visit: visit.reasonForVisit,
      subjective: visit.subjective,
      objective: visit.objective,
      assessment: visit.assessment,
      plan: visit.plan,
      quick_notes: visit.quickNotes,
      practitioner_id: practitionerId,
    })
    if (!error || error.code === '23505') {
      await offlineDb.pendingVisits.delete(visit.localId)
      if (!error) synced++
    } else {
      failed++
    }
  }

  // ── Sync pending appointments ──
  const appointments = await offlineDb.pendingAppointments.toArray()
  for (const appt of appointments) {
    const { error } = await supabase.from('appointments').insert({
      id: appt.localId,
      horse_id: appt.horseId,
      owner_id: appt.ownerId,
      appointment_date: appt.appointmentDate,
      appointment_time: appt.appointmentTime,
      duration_minutes: appt.durationMinutes,
      location: appt.location,
      reason: appt.reason,
      status: appt.status,
      provider_name: appt.providerName,
      notes: appt.notes,
      practitioner_id: practitionerId,
    })
    if (!error || error.code === '23505') {
      await offlineDb.pendingAppointments.delete(appt.localId)
      if (!error) synced++
    } else {
      failed++
    }
  }

  return { synced, failed }
}

// ── Pending count ─────────────────────────────────────────────────────────────

export async function getPendingCount(): Promise<number> {
  const [horses, forms, visits, appointments] = await Promise.all([
    offlineDb.pendingHorses.count(),
    offlineDb.pendingIntakeForms.count(),
    offlineDb.pendingVisits.count(),
    offlineDb.pendingAppointments.count(),
  ])
  return horses + forms + visits + appointments
}

// ── Bulk cache refresh (call on app load when online) ────────────────────────

export async function refreshOfflineCache(supabase: SupabaseClient) {
  if (!navigator.onLine) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  try {
    // Cache owners
    const { data: owners } = await supabase
      .from('owners')
      .select('id, full_name, phone, email, address, archived, practitioner_id')
      .eq('practitioner_id', user.id)
      .eq('archived', false)

    if (owners) await cacheOwners(owners as CachedOwner[])

    // Cache horses
    const { data: horses } = await supabase
      .from('horses')
      .select('id, owner_id, name, breed, age, sex, species, discipline, barn_location, archived, practitioner_id')
      .eq('practitioner_id', user.id)
      .eq('archived', false)

    if (horses) await cacheHorses(horses as CachedHorse[])

    // Cache recent visits (last 90 days)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const { data: visits } = await supabase
      .from('visits')
      .select('id, horse_id, visit_date, reason_for_visit, subjective, objective, assessment, plan, quick_notes, practitioner_id')
      .eq('practitioner_id', user.id)
      .gte('visit_date', ninetyDaysAgo.toISOString().split('T')[0])

    if (visits) await cacheVisits(visits as CachedVisit[])

    // Cache upcoming appointments (next 30 days)
    const today = new Date().toISOString().split('T')[0]
    const thirtyDaysOut = new Date()
    thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30)
    const { data: appointments } = await supabase
      .from('appointments')
      .select('id, horse_id, owner_id, appointment_date, appointment_time, duration_minutes, location, reason, status, provider_name, notes, practitioner_id')
      .eq('practitioner_id', user.id)
      .gte('appointment_date', today)
      .lte('appointment_date', thirtyDaysOut.toISOString().split('T')[0])

    if (appointments) await cacheAppointments(appointments as CachedAppointment[])
  } catch (err) {
    console.warn('[offlineDb] cache refresh failed:', err)
  }
}
