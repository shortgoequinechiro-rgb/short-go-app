'use client'

import Link from 'next/link'
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import {
  offlineDb,
  cacheHorses,
  cacheVisits,
  getCachedHorseById,
  getCachedVisitsByHorse,
  getCachedOwners,
} from '../../lib/offlineDb'
import {
  SUBJECTIVE_CHIPS, OBJECTIVE_CHIPS, ASSESSMENT_CHIPS, PLAN_CHIPS,
  buildSubjectiveSentence, buildObjectiveSentence, buildAssessmentSentence, buildPlanSentence,
  QuickAddChipsSection,
} from '../../components/QuickAddChips'
import { useChipUsage } from '../../hooks/useChipUsage'

type SpeciesType = 'equine' | 'canine' | 'feline' | 'bovine' | 'porcine' | 'exotic'

type Owner = {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  address: string | null
  archived: boolean
}

type Horse = {
  id: string
  owner_id: string | null
  name: string
  breed: string | null
  sex: string | null
  age: string | null
  discipline: string | null
  barn_location: string | null
  species: SpeciesType | null
  archived: boolean
  medical_alerts?: string | null
  history_notes?: string | null
  behavioral_notes?: string | null
  profile_photo_path?: string | null
  owners?: {
    full_name: string
    phone: string | null
    email: string | null
    address: string | null
  } | null
}

type Visit = {
  id: string
  horse_id: string | null
  visit_date: string | null
  location: string | null
  provider_name: string | null
  reason_for_visit: string | null
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  treated_areas: string | null
  recommendations: string | null
  follow_up: string | null
}

type Photo = {
  id: string
  horse_id: string | null
  visit_id: string | null
  caption: string | null
  body_area: string | null
  taken_at: string | null
  image_url: string | null
  image_path?: string | null
  visits?: {
    visit_date: string | null
  } | null
}

type PhotoWithSignedUrl = Photo & {
  signed_url?: string | null
}

type VisitAnatomyRegionRow = {
  visit_id: string
  region_key: string
  notes: string | null
}

type VisitAnatomySummaryItem = {
  regionKey: string
  regionLabel: string
  notes: string
}

type PatientRecord = {
  id: string
  horse_id: string
  file_name: string
  file_path: string
  file_type: string | null
  note: string | null
  uploaded_at: string
  practitioner_id: string | null
}

const RECENT_HORSE_IDS_KEY = 'shortgo_recent_horse_ids'
const RECENT_OWNER_IDS_KEY = 'shortgo_recent_owner_ids'

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

const emptyVisitForm = {
  visitDate: '',
  visitLocation: '',
  providerName: '',
  reasonForVisit: '',
  quickNotes: '',
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
  treatedAreas: '',
  recommendations: '',
  followUp: '',
}

function speciesEmoji(s: string | null | undefined): string {
  switch (s) {
    case 'canine': return '🐕'
    case 'feline': return '🐱'
    case 'bovine': return '🐄'
    case 'porcine': return '🐷'
    case 'exotic': return '🦎'
    default: return '🐴'
  }
}

function speciesLabel(s: string | null | undefined): string {
  switch (s) {
    case 'canine': return 'Canine'
    case 'feline': return 'Feline'
    case 'bovine': return 'Bovine'
    case 'porcine': return 'Porcine'
    case 'exotic': return 'Exotic'
    default: return 'Equine'
  }
}

function getNamePlaceholder(species: string | null | undefined): string {
  switch (species) {
    case 'canine': return 'Dog name'
    case 'feline': return 'Cat name'
    case 'bovine': return 'Cow name'
    case 'porcine': return 'Pig name'
    case 'exotic': return 'Animal name'
    default: return 'Horse name'
  }
}

function getDisciplineLabel(species: string | null | undefined): string {
  if (species === 'equine') return 'Discipline'
  return 'Activity / Sport'
}

function getDisciplinePlaceholder(species: string | null | undefined): string {
  if (species === 'equine') return 'Discipline'
  if (species === 'canine') return 'Agility, hunting, sport, etc.'
  return 'Activity / Sport'
}

function getBarnLocationPlaceholder(species: string | null | undefined): string {
  if (species === 'canine') return 'City, kennel, or home'
  return 'Barn location'
}

const REGION_LABELS: Record<string, string> = {
  pollAtlas: 'Poll / Atlas',
  withers: 'Withers',
  thoracolumbar: 'Thoracolumbar',
  siJoint: 'SI Joint',
  hock: 'Hock',
}

export default function HorseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const horseId = params.id as string

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [practitionerName, setPractitionerName] = useState('')
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'info' | 'visits' | 'photos' | 'records'>('info')
  const [pendingSpineId, setPendingSpineId] = useState<string | null>(null)

  const [owners, setOwners] = useState<Owner[]>([])
  const [horse, setHorse] = useState<Horse | null>(null)
  const [ownerOtherHorses, setOwnerOtherHorses] = useState<Horse[]>([])
  const [selectedOwnerHorseId, setSelectedOwnerHorseId] = useState('')
  const [consentOnFile, setConsentOnFile] = useState<{ id: string; signed_at: string; signed_name: string; signature_data: string | null; horses_acknowledged: string | null; notes: string | null; form_version: string | null } | null | undefined>(undefined)
  type IntakeForm = { id: string; submitted_at: string; signed_name: string | null; animal_name: string; reason_for_care: string | null; health_problems: string | null; medications_supplements: string | null; previous_chiro_care: boolean | null; referral_source: string[] | null; archived: boolean | null }
  const [intakeForms, setIntakeForms] = useState<IntakeForm[]>([])
  const [showArchivedIntake, setShowArchivedIntake] = useState(false)

  // Multi-contact roles
  type HorseContact = { id: string; horse_id: string; name: string; role: string; phone: string | null; email: string | null; notes: string | null }
  const [contacts, setContacts] = useState<HorseContact[]>([])
  const [contactsNoTable, setContactsNoTable] = useState(false)
  const [showContactForm, setShowContactForm] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [contactForm, setContactForm] = useState({ name: '', role: 'Trainer', phone: '', email: '', notes: '' })
  const [savingContact, setSavingContact] = useState(false)
  const [contactMsg, setContactMsg] = useState('')
  const [visits, setVisits] = useState<Visit[]>([])
  const [photos, setPhotos] = useState<PhotoWithSignedUrl[]>([])

  const [anatomyRegionCounts, setAnatomyRegionCounts] = useState<Record<string, number>>({})
  const [anatomyRegionNamesByVisit, setAnatomyRegionNamesByVisit] = useState<Record<string, string[]>>({})
  const [anatomyNotesByVisit, setAnatomyNotesByVisit] = useState<Record<string, VisitAnatomySummaryItem[]>>({})
  const [expandedAnatomyVisits, setExpandedAnatomyVisits] = useState<Record<string, boolean>>({})

  const [editingHorse, setEditingHorse] = useState(false)
  const [horseNameEdit, setHorseNameEdit] = useState('')
  const [horseBreedEdit, setHorseBreedEdit] = useState('')
  const [horseSexEdit, setHorseSexEdit] = useState('')
  const [horseAgeEdit, setHorseAgeEdit] = useState('')
  const [horseDisciplineEdit, setHorseDisciplineEdit] = useState('')
  const [horseBarnLocationEdit, setHorseBarnLocationEdit] = useState('')
  const [horseSpeciesEdit, setHorseSpeciesEdit] = useState<SpeciesType>('equine')
  const [horseOwnerIdEdit, setHorseOwnerIdEdit] = useState('')
  const [behavioralNotesEdit, setBehavioralNotesEdit] = useState('')
  const [savingBehavioralNotes, setSavingBehavioralNotes] = useState(false)

  const [editingOwner, setEditingOwner] = useState(false)
  const [ownerNameEdit, setOwnerNameEdit] = useState('')
  const [ownerPhoneEdit, setOwnerPhoneEdit] = useState('')
  const [ownerEmailEdit, setOwnerEmailEdit] = useState('')
  const [ownerAddressEdit, setOwnerAddressEdit] = useState('')

  const [editingVisitId, setEditingVisitId] = useState<string | null>(null)
  const [generatingSoap, setGeneratingSoap] = useState(false)
  const [emailingVisitId, setEmailingVisitId] = useState<string | null>(null)
  const [autoEmailAfterSave, setAutoEmailAfterSave] = useState(false)

  const [visitDate, setVisitDate] = useState('')
  const [visitLocation, setVisitLocation] = useState('')
  const [providerName, setProviderName] = useState('')
  const [reasonForVisit, setReasonForVisit] = useState('')
  const [quickNotes, setQuickNotes] = useState('')
  const [subjective, setSubjective] = useState('')
  const [objective, setObjective] = useState('')
  const [assessment, setAssessment] = useState('')
  const [plan, setPlan] = useState('')
  const [treatedAreas, setTreatedAreas] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [followUp, setFollowUp] = useState('')

  // ── Quick Add chip selections ──
  const [subjectiveChips, setSubjectiveChips] = useState<Set<string>>(new Set())
  const [objectiveChips, setObjectiveChips] = useState<Set<string>>(new Set())
  const [assessmentChips, setAssessmentChips] = useState<Set<string>>(new Set())
  const [planChips, setPlanChips] = useState<Set<string>>(new Set())

  // ── Chip usage tracking (most-used-first sorting) ──
  const { usageMap, recordUsage } = useChipUsage(userId || null)

  function toggleChip(setter: React.Dispatch<React.SetStateAction<Set<string>>>, chipId: string) {
    setter(prev => {
      const next = new Set(prev)
      if (next.has(chipId)) next.delete(chipId)
      else next.add(chipId)
      return next
    })
  }

  // Generate all SOAP fields from chip selections (rule-based)
  function generateFromSelections() {
    const sub = buildSubjectiveSentence(subjectiveChips)
    const obj = buildObjectiveSentence(objectiveChips)
    const asx = buildAssessmentSentence(assessmentChips)
    const pln = buildPlanSentence(planChips)

    if (sub) setSubjective(sub)
    if (obj) setObjective(obj)
    if (asx) setAssessment(asx)
    if (pln) setPlan(pln)

    // Auto-fill follow up from plan chips
    const followUpChipIds = ['plan_2wk', 'plan_3wk', 'plan_monthly', 'plan_prn']
    const selFU = PLAN_CHIPS.flatMap(c => c.chips).filter(c => planChips.has(c.id) && followUpChipIds.includes(c.id))
    if (selFU.length > 0) setFollowUp(selFU.map(c => c.label).join(', '))
  }

  const [selectedPhotoVisitId, setSelectedPhotoVisitId] = useState('')
  const [photoCaption, setPhotoCaption] = useState('')
  const [photoBodyArea, setPhotoBodyArea] = useState('')
  const [photoTakenAt, setPhotoTakenAt] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [showCameraModal, setShowCameraModal] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Profile photo state
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)
  const [uploadingProfilePhoto, setUploadingProfilePhoto] = useState(false)
  const [showProfileCameraModal, setShowProfileCameraModal] = useState(false)
  const [profileCameraError, setProfileCameraError] = useState<string | null>(null)
  const profileVideoRef = useRef<HTMLVideoElement>(null)
  const profileCanvasRef = useRef<HTMLCanvasElement>(null)
  const profileStreamRef = useRef<MediaStream | null>(null)
  const profileFileInputRef = useRef<HTMLInputElement>(null)

  // Records state
  const [records, setRecords] = useState<PatientRecord[]>([])
  const [recordFile, setRecordFile] = useState<File | null>(null)
  const [recordNote, setRecordNote] = useState('')
  const [uploadingRecord, setUploadingRecord] = useState(false)
  const [recordMsg, setRecordMsg] = useState('')
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [editingRecordNote, setEditingRecordNote] = useState('')
  const recordFileInputRef = useRef<HTMLInputElement>(null)

  async function checkUser() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setUserEmail(session.user.email || '')
          setUserId(session.user.id)
          setCheckingAuth(false)
          return true
        }
        router.push('/login')
        return false
      }

      setUserEmail(user.email || '')
      setUserId(user.id)

      // Fetch practitioner name (skip when offline)
      if (navigator.onLine) {
        const { data: practitioner } = await supabase
          .from('practitioners')
          .select('full_name')
          .eq('id', user.id)
          .single()
        if (practitioner?.full_name) {
          setPractitionerName(practitioner.full_name)
        }
      }

      setCheckingAuth(false)
      return true
    } catch {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUserEmail(session.user.email || '')
        setUserId(session.user.id)
        setCheckingAuth(false)
        return true
      }
      router.push('/login')
      return false
    }
  }

  function saveRecentHorse(id: string) {
    if (typeof window === 'undefined') return
    const existing = window.localStorage.getItem(RECENT_HORSE_IDS_KEY)
    const parsed: string[] = existing ? JSON.parse(existing) : []
    const updated = [id, ...parsed.filter((item) => item !== id)].slice(0, 3)
    window.localStorage.setItem(RECENT_HORSE_IDS_KEY, JSON.stringify(updated))
  }

  function saveRecentOwner(id: string) {
    if (typeof window === 'undefined') return
    const existing = window.localStorage.getItem(RECENT_OWNER_IDS_KEY)
    const parsed: string[] = existing ? JSON.parse(existing) : []
    const updated = [id, ...parsed.filter((item) => item !== id)].slice(0, 3)
    window.localStorage.setItem(RECENT_OWNER_IDS_KEY, JSON.stringify(updated))
  }

  async function loadOwners() {
    const { data, error } = await supabase
      .from('owners')
      .select('id, full_name, phone, email, address, archived')
      .eq('archived', false)
      .order('full_name', { ascending: true })

    if (error) {
      // Offline fallback
      if (userId) {
        try {
          const cached = await getCachedOwners(userId)
          setOwners(cached.map(o => ({ ...o })) as unknown as Owner[])
        } catch { /* ignore */ }
      }
      return
    }

    setOwners((data || []) as Owner[])
  }

  async function loadHorse() {
    const { data, error } = await supabase
      .from('horses')
      .select(`
        *,
        owners (
          full_name,
          phone,
          email,
          address
        )
      `)
      .eq('id', horseId)
      .eq('archived', false)
      .single()

    if (error) {
      // Offline fallback
      try {
        const cached = await getCachedHorseById(horseId)
        if (cached) {
          const fallback = { ...cached, owners: null, medical_alerts: null, history_notes: null, behavioral_notes: null, profile_photo_path: null } as unknown as Horse
          setHorse(fallback)
          setHorseNameEdit(cached.name || '')
          setHorseBreedEdit(cached.breed || '')
          setHorseSexEdit(cached.sex || '')
          setHorseAgeEdit(cached.age || '')
          setHorseDisciplineEdit(cached.discipline || '')
          setHorseBarnLocationEdit(cached.barn_location || '')
          setHorseSpeciesEdit((cached.species as SpeciesType) || 'equine')
          setHorseOwnerIdEdit(cached.owner_id || '')
          return
        }
      } catch { /* ignore */ }
      setMessage(`Error loading horse: ${error.message}`)
      return
    }

    setHorse(data as Horse)

    setHorseNameEdit(data.name || '')
    setHorseBreedEdit(data.breed || '')
    setHorseSexEdit(data.sex || '')
    setHorseAgeEdit(data.age || '')
    setHorseDisciplineEdit(data.discipline || '')
    setHorseBarnLocationEdit(data.barn_location || '')
    setHorseSpeciesEdit((data.species as SpeciesType) || 'equine')
    setHorseOwnerIdEdit(data.owner_id || '')
    setBehavioralNotesEdit(data.behavioral_notes || '')

    setOwnerNameEdit(data.owners?.full_name || '')
    setOwnerPhoneEdit(data.owners?.phone || '')
    setOwnerEmailEdit(data.owners?.email || '')
    setOwnerAddressEdit(data.owners?.address || '')

    if (data.owner_id) saveRecentOwner(data.owner_id)
    saveRecentHorse(data.id)

    if (data.profile_photo_path) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from('horse-photos')
        .createSignedUrl(data.profile_photo_path, 604800)
      if (signedData?.signedUrl) {
        setProfilePhotoUrl(signedData.signedUrl)
      } else if (signedError) {
        console.warn('Could not generate profile photo URL:', signedError.message)
      }
    }
  }

  async function loadOwnerOtherHorses(currentOwnerId: string | null) {
    if (!currentOwnerId) {
      setOwnerOtherHorses([])
      setSelectedOwnerHorseId('')
      return
    }

    const { data, error } = await supabase
      .from('horses')
      .select('id, owner_id, name, breed, sex, age, discipline, barn_location, archived')
      .eq('owner_id', currentOwnerId)
      .eq('archived', false)
      .order('name', { ascending: true })

    if (error) {
      setMessage(`Error loading owner horses: ${error.message}`)
      return
    }

    setOwnerOtherHorses((data || []) as Horse[])
    setSelectedOwnerHorseId(horseId)
  }

  async function loadVisits() {
    const { data, error } = await supabase
      .from('visits')
      .select('*')
      .eq('horse_id', horseId)
      .order('visit_date', { ascending: false })

    if (error) {
      // Offline fallback
      try {
        const cached = await getCachedVisitsByHorse(horseId)
        if (cached.length > 0) {
          const mapped = cached
            .sort((a, b) => (b.visit_date || '').localeCompare(a.visit_date || ''))
            .map(v => ({ ...v, location: null, provider_name: null, treated_areas: null, recommendations: null, follow_up: null })) as unknown as Visit[]
          setVisits(mapped)
        }
      } catch { /* ignore */ }
      return
    }

    const visitData = (data || []) as Visit[]
    setVisits(visitData)

    // Cache for offline
    try {
      await cacheVisits(visitData.map(v => ({
        id: v.id, horse_id: v.horse_id || horseId, visit_date: v.visit_date,
        reason_for_visit: v.reason_for_visit, subjective: v.subjective,
        objective: v.objective, assessment: v.assessment, plan: v.plan,
        quick_notes: null, practitioner_id: userId, cachedAt: Date.now(),
      })))
    } catch { /* ignore */ }

    if (visitData.length === 0) {
      setAnatomyRegionCounts({})
      setAnatomyRegionNamesByVisit({})
      setAnatomyNotesByVisit({})
      setExpandedAnatomyVisits({})
      return
    }

    const { data: anatomyData, error: anatomyError } = await supabase
      .from('visit_anatomy_regions')
      .select('visit_id, region_key, notes')
      .in('visit_id', visitData.map((visit) => visit.id))

    if (anatomyError) {
      setMessage(`Error loading anatomy note data: ${anatomyError.message}`)
      return
    }

    const counts: Record<string, number> = {}
    const namesByVisit: Record<string, string[]> = {}
    const notesByVisit: Record<string, VisitAnatomySummaryItem[]> = {}

    for (const row of (anatomyData || []) as VisitAnatomyRegionRow[]) {
      const visitId = row.visit_id
      const regionLabel = REGION_LABELS[row.region_key] || row.region_key

      counts[visitId] = (counts[visitId] || 0) + 1

      if (!namesByVisit[visitId]) namesByVisit[visitId] = []
      if (!namesByVisit[visitId].includes(regionLabel)) {
        namesByVisit[visitId].push(regionLabel)
      }

      if (!notesByVisit[visitId]) notesByVisit[visitId] = []
      notesByVisit[visitId].push({
        regionKey: row.region_key,
        regionLabel,
        notes: row.notes || '',
      })
    }

    setAnatomyRegionCounts(counts)
    setAnatomyRegionNamesByVisit(namesByVisit)
    setAnatomyNotesByVisit(notesByVisit)
  }

  async function loadPhotos() {
    const { data, error } = await supabase
      .from('photos')
      .select(`
        *,
        visits (
          visit_date
        )
      `)
      .eq('horse_id', horseId)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(`Error loading photos: ${error.message}`)
      return
    }

    const photoData = (data || []) as Photo[]

    const signedPhotos = await Promise.all(
      photoData.map(async (photo) => {
        if (!photo.image_path) return { ...photo, signed_url: null }

        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('horse-photos')
          .createSignedUrl(photo.image_path, 60 * 60)

        if (signedUrlError) {
          console.error('Signed URL error:', signedUrlError.message, photo.image_path)
          return { ...photo, signed_url: null }
        }

        return { ...photo, signed_url: signedUrlData.signedUrl }
      })
    )

    setPhotos(signedPhotos)
  }

  // ── Records CRUD ──────────────────────────────────────────────────────────

  async function loadRecords() {
    const { data, error } = await supabase
      .from('patient_records')
      .select('*')
      .eq('horse_id', horseId)
      .order('uploaded_at', { ascending: false })

    if (error) {
      // Table may not exist yet
      if (error.code === '42P01') return
      console.error('Error loading records:', error.message)
      return
    }
    setRecords((data ?? []) as PatientRecord[])
  }

  async function uploadRecord() {
    if (!recordFile) { setRecordMsg('Please select a file.'); return }
    if (!navigator.onLine) { setRecordMsg('Cannot upload files while offline. Please reconnect and try again.'); return }
    setUploadingRecord(true)
    setRecordMsg('')

    const { data: { user } } = await supabase.auth.getUser()
    const ext = recordFile.name.split('.').pop() || 'file'
    const safeName = recordFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `records/${horseId}/${Date.now()}_${safeName}`

    const { error: storageErr } = await supabase.storage
      .from('horse-photos')
      .upload(filePath, recordFile)

    if (storageErr) {
      setUploadingRecord(false)
      setRecordMsg('Upload failed: ' + storageErr.message)
      return
    }

    const { error: dbErr } = await supabase.from('patient_records').insert({
      horse_id: horseId,
      file_name: recordFile.name,
      file_path: filePath,
      file_type: ext.toLowerCase(),
      note: recordNote || null,
      uploaded_at: new Date().toISOString(),
      practitioner_id: user?.id,
    })

    setUploadingRecord(false)

    if (dbErr) {
      // Clean up uploaded file if DB insert fails
      await supabase.storage.from('horse-photos').remove([filePath])
      if (dbErr.code === '42P01') {
        setRecordMsg('The patient_records table does not exist. Please run migration 008_add_patient_records.sql in Supabase.')
      } else {
        setRecordMsg('Error saving record: ' + dbErr.message)
      }
      return
    }

    setRecordFile(null)
    setRecordNote('')
    setRecordMsg('Record uploaded successfully.')
    if (recordFileInputRef.current) recordFileInputRef.current.value = ''
    setTimeout(() => setRecordMsg(''), 3000)
    await loadRecords()
  }

  async function deleteRecord(rec: PatientRecord) {
    if (!navigator.onLine) { setRecordMsg('Cannot delete records while offline. Please reconnect and try again.'); return }
    if (!confirm(`Delete "${rec.file_name}"? This cannot be undone.`)) return
    await supabase.storage.from('horse-photos').remove([rec.file_path])
    await supabase.from('patient_records').delete().eq('id', rec.id)
    setRecords(prev => prev.filter(r => r.id !== rec.id))
  }

  async function updateRecordNote(id: string, note: string) {
    if (!navigator.onLine) { setRecordMsg('Cannot update records while offline. Please reconnect and try again.'); return }
    await supabase.from('patient_records').update({ note: note || null }).eq('id', id)
    setRecords(prev => prev.map(r => r.id === id ? { ...r, note: note || null } : r))
    setEditingRecordId(null)
    setEditingRecordNote('')
  }

  async function downloadRecord(rec: PatientRecord) {
    if (!navigator.onLine) { setRecordMsg('Cannot download records while offline.'); return }
    const { data, error } = await supabase.storage
      .from('horse-photos')
      .createSignedUrl(rec.file_path, 300)
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
  }

  async function saveHorseInfo() {
    setMessage('')
    if (!navigator.onLine) { setMessage('Cannot edit patient info while offline.'); return }

    if (!horseNameEdit.trim()) {
      setMessage('Patient name is required.')
      return
    }

    if (!horseOwnerIdEdit) {
      setMessage('Please select an owner.')
      return
    }

    const { error } = await supabase
      .from('horses')
      .update({
        owner_id: horseOwnerIdEdit,
        name: horseNameEdit,
        breed: horseBreedEdit || null,
        sex: horseSexEdit || null,
        age: horseAgeEdit || null,
        discipline: horseDisciplineEdit || null,
        barn_location: horseBarnLocationEdit || null,
        species: horseSpeciesEdit,
      })
      .eq('id', horseId)

    if (error) {
      setMessage(`Error updating patient: ${error.message}`)
      return
    }

    setEditingHorse(false)
    setEditingOwner(false)
    setMessage('Patient info updated successfully. History preserved with the record.')
    await loadHorse()
    await loadOwnerOtherHorses(horseOwnerIdEdit)
    await loadVisits()
  }

  async function deletePatient() {
    if (!navigator.onLine) { setMessage('Cannot delete patients while offline. Please reconnect and try again.'); return }
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${horse?.name || 'this patient'}? This will also delete all visits, intake forms, photos, and contacts linked to this record. This cannot be undone.`
    )
    if (!confirmed) return
    const { error } = await supabase.from('horses').delete().eq('id', horseId)
    if (error) { setMessage(`Error deleting patient: ${error.message}`); return }
    router.push('/dashboard')
  }

  async function saveBehavioralNotes() {
    if (!navigator.onLine) { setMessage('Cannot save behavioral notes while offline. Please reconnect and try again.'); return }
    setSavingBehavioralNotes(true)
    const { error } = await supabase
      .from('horses')
      .update({ behavioral_notes: behavioralNotesEdit.trim() || null })
      .eq('id', horseId)
    setSavingBehavioralNotes(false)
    if (error) { setMessage(`Error saving behavioral notes: ${error.message}`); return }
    await loadHorse()
  }

  function cancelHorseEdit() {
    setEditingHorse(false)
    setHorseNameEdit(horse?.name || '')
    setHorseBreedEdit(horse?.breed || '')
    setHorseSexEdit(horse?.sex || '')
    setHorseAgeEdit(horse?.age || '')
    setHorseDisciplineEdit(horse?.discipline || '')
    setHorseBarnLocationEdit(horse?.barn_location || '')
    setHorseSpeciesEdit((horse?.species as SpeciesType) || 'equine')
    setHorseOwnerIdEdit(horse?.owner_id || '')
  }

  async function saveOwnerInfo() {
    setMessage('')

    if (!horse?.owner_id) {
      setMessage('No owner is linked to this horse.')
      return
    }

    if (!ownerNameEdit.trim()) {
      setMessage('Owner name is required.')
      return
    }

    const { error } = await supabase
      .from('owners')
      .update({
        full_name: ownerNameEdit,
        phone: ownerPhoneEdit || null,
        email: ownerEmailEdit || null,
        address: ownerAddressEdit || null,
      })
      .eq('id', horse.owner_id)

    if (error) {
      setMessage(`Error updating owner: ${error.message}`)
      return
    }

    setEditingOwner(false)
    setMessage('Owner info updated successfully.')
    await loadOwners()
    await loadHorse()
  }

  function cancelOwnerEdit() {
    setEditingOwner(false)
    setOwnerNameEdit(horse?.owners?.full_name || '')
    setOwnerPhoneEdit(horse?.owners?.phone || '')
    setOwnerEmailEdit(horse?.owners?.email || '')
    setOwnerAddressEdit(horse?.owners?.address || '')
  }

  function resetVisitForm() {
    setEditingVisitId(null)
    setPendingSpineId(null)
    setVisitDate(emptyVisitForm.visitDate)
    setVisitLocation(emptyVisitForm.visitLocation)
    setProviderName(practitionerName)
    setReasonForVisit(emptyVisitForm.reasonForVisit)
    setQuickNotes(emptyVisitForm.quickNotes)
    setSubjective(emptyVisitForm.subjective)
    setObjective(emptyVisitForm.objective)
    setAssessment(emptyVisitForm.assessment)
    setPlan(emptyVisitForm.plan)
    setTreatedAreas(emptyVisitForm.treatedAreas)
    setRecommendations(emptyVisitForm.recommendations)
    setFollowUp(emptyVisitForm.followUp)
    setAutoEmailAfterSave(false)
    setSubjectiveChips(new Set())
    setObjectiveChips(new Set())
    setAssessmentChips(new Set())
    setPlanChips(new Set())
  }

  async function startEditVisit(visit: Visit) {
    const derivedTreatedAreas =
      anatomyRegionNamesByVisit[visit.id]?.length
        ? anatomyRegionNamesByVisit[visit.id].join(', ')
        : ''

    setEditingVisitId(visit.id)
    setVisitDate(visit.visit_date || '')
    setVisitLocation(visit.location || '')
    setProviderName(visit.provider_name || practitionerName)
    setReasonForVisit(visit.reason_for_visit || '')
    setSubjective(visit.subjective || '')
    setObjective(visit.objective || '')
    setAssessment(visit.assessment || '')
    setPlan(visit.plan || '')
    setTreatedAreas(visit.treated_areas || derivedTreatedAreas || '')
    setRecommendations(visit.recommendations || '')
    setFollowUp(visit.follow_up || '')
    setAutoEmailAfterSave(false)

    window.scrollTo({ top: 0, behavior: 'smooth' })

    // Load spine findings for this visit and pre-fill Quick Notes
    const LABEL: Record<string, string> = {
      tmj: 'TMJ', poll: 'Poll',
      c1: 'C1 (Atlas)', c2: 'C2 (Axis)', c3: 'C3', c4: 'C4', c5: 'C5', c6: 'C6', c7: 'C7',
      sacrum: 'Sacrum', si_joint: 'SI Joint', coccygeal: 'Coccygeal',
    }
    const segLabel = (key: string) =>
      LABEL[key] ?? key.replace(/^([tTlLcC])(\d+)$/, (_, p, n) => p.toUpperCase() + n)

    try {
      const { data: spineData } = await supabase
        .from('spine_assessments')
        .select('findings, notes')
        .eq('visit_id', visit.id)
        .order('assessed_at', { ascending: false })
        .limit(1)

      const row = spineData?.[0]
      if (row?.findings) {
        const findings = row.findings as Record<string, { left: boolean; right: boolean }>
        const flagged = Object.entries(findings)
          .filter(([, f]) => f.left || f.right)
          .map(([key, f]) => {
            const side = f.left && f.right ? 'Bilateral' : f.left ? 'Left' : 'Right'
            return `${segLabel(key)} (${side})`
          })

        if (flagged.length > 0) {
          const spineText = [
            `Spine Findings: ${flagged.join(', ')}`,
            row.notes ? `Spine Notes: ${row.notes}` : '',
          ].filter(Boolean).join('\n')
          setQuickNotes(spineText)
          return
        }
      }
    } catch {
      // spine table may not exist yet — just leave Quick Notes empty
    }

    setQuickNotes('')
  }

  function useAnatomyRegionsForTreatedAreas() {
    if (!editingVisitId) return
    const derivedTreatedAreas =
      anatomyRegionNamesByVisit[editingVisitId]?.length
        ? anatomyRegionNamesByVisit[editingVisitId].join(', ')
        : ''
    setTreatedAreas(derivedTreatedAreas)
  }

  async function generateSoap() {
    setMessage('')

    if (!quickNotes.trim()) {
      setMessage('Add quick notes first.')
      return
    }

    const anatomyContext =
      editingVisitId && anatomyNotesByVisit[editingVisitId]?.length
        ? anatomyNotesByVisit[editingVisitId]
            .map((item) => `${item.regionLabel}: ${item.notes || 'No notes provided.'}`)
            .join('\n')
        : ''

    try {
      setGeneratingSoap(true)

      const response = await fetch('/api/generate-soap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quickNotes,
          horseName: horse?.name || '',
          species: horse?.species || 'equine',
          discipline: horse?.discipline || '',
          anatomyContext,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage(data.error || 'Failed to generate SOAP.')
        return
      }

      setSubjective(data.subjective || '')
      setObjective(data.objective || '')
      setAssessment(data.assessment || '')
      setPlan(data.plan || '')
      setMessage(anatomyContext ? 'SOAP draft generated with anatomy notes.' : 'SOAP draft generated.')
    } catch (error) {
      console.error(error)
      setMessage('Failed to generate SOAP.')
    } finally {
      setGeneratingSoap(false)
    }
  }

  async function sendVisitEmail(visitId: string) {
    if (!navigator.onLine) throw new Error('Cannot send emails while offline.')
    const response = await fetch(`/api/visits/${visitId}/email`, {
      method: 'POST',
    })

    let data: any = null
    try {
      data = await response.json()
    } catch {}

    if (!response.ok) {
      throw new Error(data?.error || 'Failed to email PDF.')
    }
  }

  async function saveVisit() {
    setMessage('')

    if (!visitDate) {
      setMessage('Visit date is required.')
      return
    }

    if (!reasonForVisit.trim()) {
      setMessage('Reason for visit is required.')
      return
    }

    // Ensure we have a valid practitioner ID before saving
    let currentUserId = userId
    if (!currentUserId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        currentUserId = user.id
        setUserId(user.id)
      } else {
        setMessage('Unable to verify your session. Please refresh and try again.')
        return
      }
    }

    const payload = {
      horse_id: horseId,
      owner_id: horse?.owner_id || null,
      visit_date: visitDate,
      location: visitLocation || null,
      provider_name: providerName || null,
      reason_for_visit: reasonForVisit || null,
      subjective: subjective || null,
      objective: objective || null,
      assessment: assessment || null,
      plan: plan || null,
      treated_areas: treatedAreas || null,
      recommendations: recommendations || null,
      follow_up: followUp || null,
      practitioner_id: currentUserId,
    }

    // Offline: queue new visits (edits require online)
    if (!navigator.onLine && !editingVisitId) {
      try {
        const localId = crypto.randomUUID()
        await offlineDb.pendingVisits.add({
          localId,
          horseId,
          visitDate: visitDate,
          reasonForVisit: reasonForVisit || null,
          subjective: subjective || null,
          objective: objective || null,
          assessment: assessment || null,
          plan: plan || null,
          quickNotes: null,
          createdAt: new Date().toISOString(),
        })
        setMessage('Visit saved offline — will sync when back online.')
        resetVisitForm()
        await loadVisits()
      } catch {
        setMessage('Failed to save visit offline.')
      }
      return
    }

    let savedVisitId: string | null = editingVisitId

    if (editingVisitId) {
      const { error } = await supabase
        .from('visits')
        .update(payload)
        .eq('id', editingVisitId)

      if (error) {
        setMessage(`Error updating visit: ${error.message}`)
        return
      }

      setMessage('Visit updated successfully.')
    } else {
      const { data, error } = await supabase
        .from('visits')
        .insert([payload])
        .select('id')
        .single()

      if (error) {
        setMessage(`Error saving visit: ${error.message}`)
        return
      }

      savedVisitId = data.id
      setMessage('Visit saved successfully.')
    }

    // Link spine assessment to the new visit if we came from the new visit flow
    if (pendingSpineId && savedVisitId) {
      await supabase
        .from('spine_assessments')
        .update({ visit_id: savedVisitId })
        .eq('id', pendingSpineId)
      setPendingSpineId(null)
    }


    if (autoEmailAfterSave && savedVisitId) {
      try {
        setMessage('Visit saved. Sending PDF to owner...')
        await sendVisitEmail(savedVisitId)
        setMessage('Visit saved and PDF emailed successfully.')
      } catch (error: any) {
        setMessage(`Visit saved, but email failed: ${error?.message || 'Unknown error'}`)
      }
    }

    // Record chip usage for most-used-first sorting
    const allUsedChips = [
      ...Array.from(subjectiveChips),
      ...Array.from(objectiveChips),
      ...Array.from(assessmentChips),
      ...Array.from(planChips),
    ]
    if (allUsedChips.length > 0) {
      recordUsage(allUsedChips)
    }

    resetVisitForm()
    await loadVisits()
  }

  async function deleteVisit(visitId: string) {
    if (!navigator.onLine) { setMessage('Cannot delete visits while offline.'); return }
    const confirmed = window.confirm('Delete this visit record?')
    if (!confirmed) return

    const { error } = await supabase.from('visits').delete().eq('id', visitId)

    if (error) {
      setMessage(`Error deleting visit: ${error.message}`)
      return
    }

    if (editingVisitId === visitId) resetVisitForm()

    setMessage('Visit deleted successfully.')
    await loadVisits()
  }

  async function addPhoto() {
    setMessage('')
    if (!navigator.onLine) { setMessage('Cannot upload photos while offline.'); return }

    if (!selectedFile) {
      setMessage('Please choose an image file.')
      return
    }

    try {
      setUploadingPhoto(true)

      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
      const filePath = `${horseId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('horse-photos')
        .upload(filePath, selectedFile)

      if (uploadError) {
        setMessage(`Error uploading photo: ${uploadError.message}`)
        return
      }

      const { error: insertError } = await supabase.from('photos').insert([
        {
          horse_id: horseId,
          visit_id: selectedPhotoVisitId || null,
          caption: photoCaption || null,
          body_area: photoBodyArea || null,
          taken_at: photoTakenAt || null,
          image_url: null,
          image_path: filePath,
          practitioner_id: userId,
        },
      ])

      if (insertError) {
        setMessage(`Photo uploaded, but database save failed: ${insertError.message}`)
        return
      }

      setMessage('Photo uploaded successfully.')
      setSelectedPhotoVisitId('')
      setPhotoCaption('')
      setPhotoBodyArea('')
      setPhotoTakenAt('')
      setSelectedFile(null)
      await loadPhotos()
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function deletePhoto(photo: PhotoWithSignedUrl) {
    if (!navigator.onLine) { setMessage('Cannot delete photos while offline.'); return }
    const confirmed = window.confirm('Delete this photo?')
    if (!confirmed) return

    if (photo.image_path) {
      const { error: storageError } = await supabase.storage
        .from('horse-photos')
        .remove([photo.image_path])

      if (storageError) {
        setMessage(`Error deleting file from storage: ${storageError.message}`)
        return
      }
    }

    const { error } = await supabase.from('photos').delete().eq('id', photo.id)

    if (error) {
      setMessage(`Error deleting photo record: ${error.message}`)
      return
    }

    setMessage('Photo deleted successfully.')
    await loadPhotos()
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null
    setSelectedFile(file)
  }

  async function openCamera() {
    setCameraError(null)
    setShowCameraModal(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      // Wait for the modal to mount before assigning srcObject
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      }, 50)
    } catch {
      setCameraError('Could not access camera. Please allow camera permission and try again.')
    }
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
      setSelectedFile(file)
      closeCamera()
    }, 'image/jpeg', 0.92)
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setShowCameraModal(false)
    setCameraError(null)
  }

  // ── Profile Photo ──────────────────────────────────────────────────────────

  async function openProfileCamera() {
    setProfileCameraError(null)
    setShowProfileCameraModal(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      profileStreamRef.current = stream
      setTimeout(() => {
        if (profileVideoRef.current) {
          profileVideoRef.current.srcObject = stream
        }
      }, 50)
    } catch {
      setProfileCameraError('Could not access camera. Please allow camera permission and try again.')
    }
  }

  function captureProfilePhoto() {
    if (!profileVideoRef.current || !profileCanvasRef.current) return
    const video = profileVideoRef.current
    const canvas = profileCanvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(async (blob) => {
      if (!blob) return
      closeProfileCamera()
      await uploadProfilePhoto(blob)
    }, 'image/jpeg', 0.92)
  }

  function closeProfileCamera() {
    profileStreamRef.current?.getTracks().forEach((t) => t.stop())
    profileStreamRef.current = null
    setShowProfileCameraModal(false)
    setProfileCameraError(null)
  }

  async function uploadProfilePhoto(file: Blob | File) {
    if (!navigator.onLine) { setMessage('Cannot upload profile photos while offline.'); return }
    setUploadingProfilePhoto(true)

    // Show an immediate local preview so the photo appears right away
    const localPreviewUrl = URL.createObjectURL(file)
    setProfilePhotoUrl(localPreviewUrl)

    try {
      const filePath = `${horseId}/profile/profile-${Date.now()}.jpg`
      const oldPath = horse?.profile_photo_path ?? null

      // 1. Upload the new file first
      const { error: uploadError } = await supabase.storage
        .from('horse-photos')
        .upload(filePath, file, { contentType: 'image/jpeg', upsert: true })

      if (uploadError) {
        setMessage(`Error uploading profile photo: ${uploadError.message}`)
        setProfilePhotoUrl(null)
        return
      }

      // 2. Update the DB to point at the new file
      const { data: updateData, error: updateError } = await supabase
        .from('horses')
        .update({ profile_photo_path: filePath })
        .eq('id', horseId)
        .select('id')

      if (updateError) {
        // DB update failed — remove the orphaned upload so storage stays clean
        await supabase.storage.from('horse-photos').remove([filePath])
        setMessage(`Error saving profile photo: ${updateError.message}`)
        setProfilePhotoUrl(null)
        return
      }

      if (!updateData || updateData.length === 0) {
        // RLS silently blocked the update — the photo uploaded but won't persist
        await supabase.storage.from('horse-photos').remove([filePath])
        setMessage('Photo saved to storage but could not be linked to this record. Make sure migration 006 has been run in Supabase (adds the profile_photo_path column).')
        setProfilePhotoUrl(null)
        return
      }

      // 3. Only now that the DB is updated, remove the old file (best-effort)
      if (oldPath) {
        await supabase.storage.from('horse-photos').remove([oldPath])
      }

      // 4. Replace the local preview with a long-lived signed URL (7 days)
      const { data: signedData } = await supabase.storage
        .from('horse-photos')
        .createSignedUrl(filePath, 604800)

      if (signedData?.signedUrl) setProfilePhotoUrl(signedData.signedUrl)
      setHorse(prev => prev ? { ...prev, profile_photo_path: filePath } : prev)
      setMessage('Profile photo updated.')
    } finally {
      setUploadingProfilePhoto(false)
    }
  }

  async function handleProfileFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    await uploadProfilePhoto(file)
    event.target.value = ''
  }

  async function removeProfilePhoto() {
    if (!horse?.profile_photo_path) return
    if (!confirm('Remove profile photo?')) return

    setUploadingProfilePhoto(true)
    try {
      const oldPath = horse.profile_photo_path

      // 1. Clear the DB column
      const { error: updateError } = await supabase
        .from('horses')
        .update({ profile_photo_path: null })
        .eq('id', horseId)

      if (updateError) {
        setMessage(`Error removing profile photo: ${updateError.message}`)
        return
      }

      // 2. Remove the file from storage (best-effort)
      await supabase.storage.from('horse-photos').remove([oldPath])

      // 3. Update local state
      setProfilePhotoUrl(null)
      setHorse(prev => prev ? { ...prev, profile_photo_path: null } : prev)
      setMessage('Profile photo removed.')
    } finally {
      setUploadingProfilePhoto(false)
    }
  }

  async function emailVisitPdf(visitId: string) {
    try {
      setEmailingVisitId(visitId)
      setMessage('Sending PDF...')
      await sendVisitEmail(visitId)
      setMessage('PDF emailed successfully.')
    } catch (error: any) {
      console.error(error)
      setMessage(error?.message || 'Failed to email PDF.')
    } finally {
      setEmailingVisitId(null)
    }
  }

  const [sendingOwnerSummaryId, setSendingOwnerSummaryId] = useState<string | null>(null)
  const [previewingOwnerSummaryId, setPreviewingOwnerSummaryId] = useState<string | null>(null)
  const [ownerSummaryPreview, setOwnerSummaryPreview] = useState<{ visitId: string; text: string; subject: string; ownerEmail: string | null } | null>(null)

  async function previewOwnerSummary(visitId: string) {
    setPreviewingOwnerSummaryId(visitId)
    setMessage('Generating owner summary preview…')
    try {
      const res = await fetch(`/api/visits/${visitId}/owner-summary`)
      const json = await res.json()
      if (!res.ok) {
        setMessage(json.error || 'Failed to generate preview.')
      } else {
        setOwnerSummaryPreview({ visitId, text: json.summaryText, subject: json.subject, ownerEmail: json.ownerEmail })
        setMessage('')
      }
    } catch {
      setMessage('Failed to generate preview.')
    } finally {
      setPreviewingOwnerSummaryId(null)
    }
  }

  async function sendOwnerSummary(visitId: string) {
    setSendingOwnerSummaryId(visitId)
    setOwnerSummaryPreview(null)
    setMessage('Sending owner summary…')
    try {
      const res = await fetch(`/api/visits/${visitId}/owner-summary`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) setMessage(json.error || 'Failed to send owner summary.')
      else setMessage('Owner summary emailed successfully.')
    } catch {
      setMessage('Failed to send owner summary.')
    } finally {
      setSendingOwnerSummaryId(null)
    }
  }

  const currentHorseOwnerName = useMemo(() => {
    return (
      owners.find((owner) => owner.id === horseOwnerIdEdit)?.full_name ||
      horse?.owners?.full_name ||
      '—'
    )
  }, [owners, horseOwnerIdEdit, horse])

  const hasUnsavedChanges = useMemo(() => {
    const horseDirty =
      editingHorse &&
      (
        horseNameEdit !== (horse?.name || '') ||
        horseBreedEdit !== (horse?.breed || '') ||
        horseSexEdit !== (horse?.sex || '') ||
        horseAgeEdit !== (horse?.age || '') ||
        horseDisciplineEdit !== (horse?.discipline || '') ||
        horseBarnLocationEdit !== (horse?.barn_location || '') ||
        horseSpeciesEdit !== ((horse?.species as 'equine' | 'canine') || 'equine') ||
        horseOwnerIdEdit !== (horse?.owner_id || '')
      )

    const ownerDirty =
      editingOwner &&
      (
        ownerNameEdit !== (horse?.owners?.full_name || '') ||
        ownerPhoneEdit !== (horse?.owners?.phone || '') ||
        ownerEmailEdit !== (horse?.owners?.email || '') ||
        ownerAddressEdit !== (horse?.owners?.address || '')
      )

    const visitDirty =
      visitDate !== emptyVisitForm.visitDate ||
      visitLocation !== emptyVisitForm.visitLocation ||
      providerName !== emptyVisitForm.providerName ||
      reasonForVisit !== emptyVisitForm.reasonForVisit ||
      quickNotes !== emptyVisitForm.quickNotes ||
      subjective !== emptyVisitForm.subjective ||
      objective !== emptyVisitForm.objective ||
      assessment !== emptyVisitForm.assessment ||
      plan !== emptyVisitForm.plan ||
      treatedAreas !== emptyVisitForm.treatedAreas ||
      recommendations !== emptyVisitForm.recommendations ||
      followUp !== emptyVisitForm.followUp

    const photoDirty =
      selectedPhotoVisitId !== '' ||
      photoCaption !== '' ||
      photoBodyArea !== '' ||
      photoTakenAt !== '' ||
      selectedFile !== null

    return horseDirty || ownerDirty || visitDirty || photoDirty
  }, [
    editingHorse,
    horseNameEdit,
    horseBreedEdit,
    horseSexEdit,
    horseAgeEdit,
    horseDisciplineEdit,
    horseBarnLocationEdit,
    horseSpeciesEdit,
    horseOwnerIdEdit,
    horse,
    editingOwner,
    ownerNameEdit,
    ownerPhoneEdit,
    ownerEmailEdit,
    ownerAddressEdit,
    visitDate,
    visitLocation,
    providerName,
    reasonForVisit,
    quickNotes,
    subjective,
    objective,
    assessment,
    plan,
    treatedAreas,
    recommendations,
    followUp,
    selectedPhotoVisitId,
    photoCaption,
    photoBodyArea,
    photoTakenAt,
    selectedFile,
  ])

  const activeVisitAnatomyCount = editingVisitId ? anatomyRegionCounts[editingVisitId] || 0 : 0
  const activeVisitRegionNames = editingVisitId ? anatomyRegionNamesByVisit[editingVisitId] || [] : []

  function handleOwnerHorseJump(nextHorseId: string) {
    if (!nextHorseId) return

    if (nextHorseId === horseId) {
      setSelectedOwnerHorseId(nextHorseId)
      return
    }

    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes on this record. Press OK to leave this horse without saving, or Cancel to stay here and save first.'
      )

      if (!confirmed) {
        setSelectedOwnerHorseId(horseId)
        return
      }
    }

    setSelectedOwnerHorseId(nextHorseId)
    router.push(`/horses/${nextHorseId}`)
  }

  useEffect(() => {
    async function init() {
      const isLoggedIn = await checkUser()
      if (!isLoggedIn) return

      await loadOwners()
      await loadHorse()
      await loadVisits()
      await loadPhotos()
      await loadRecords()
    }

    init()
  }, [horseId])

  // ── Handle ?tab= URL param (e.g. after saving from spine+visit page) ──
  const [invoicePromptVisitId, setInvoicePromptVisitId] = useState<string | null>(null)
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    const savedId = searchParams.get('savedVisitId')
    if (tabParam && ['info', 'visits', 'photos', 'records'].includes(tabParam)) {
      setActiveTab(tabParam as typeof activeTab)
    }
    if (savedId) {
      setInvoicePromptVisitId(savedId)
    }
    window.history.replaceState({}, '', `/horses/${horseId}`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // ── Detect redirect from spine assessment (legacy edit flow) ──
  useEffect(() => {
    const fromSpineId = searchParams.get('fromSpine')
    if (!fromSpineId || checkingAuth) return

    async function prefillFromSpine() {
      const { data: spineData } = await supabase
        .from('spine_assessments')
        .select('id, findings, notes')
        .eq('id', fromSpineId)
        .single()

      if (!spineData) return

      const findings = (spineData.findings ?? {}) as Record<string, { left?: boolean; right?: boolean }>

      // Build treated areas summary from flagged segments
      const flagged: string[] = []
      for (const [key, val] of Object.entries(findings)) {
        if (!val.left && !val.right) continue
        const sides: string[] = []
        if (val.left) sides.push('L')
        if (val.right) sides.push('R')
        const label = key.toUpperCase().replace('_', ' ')
        flagged.push(`${label} (${sides.join('/')})`)
      }

      const treatedSummary = flagged.length > 0 ? flagged.join(', ') : ''
      const objectiveSummary = flagged.length > 0
        ? `Spine assessment: ${flagged.length} segment${flagged.length === 1 ? '' : 's'} flagged — ${treatedSummary}${spineData.notes ? `\nNotes: ${spineData.notes}` : ''}`
        : spineData.notes ? `Spine assessment notes: ${spineData.notes}` : ''

      // Pre-fill the visit form
      const todayISO = new Date().toISOString().slice(0, 10)
      setVisitDate(todayISO)
      setReasonForVisit('Chiropractic Adjustment')
      setTreatedAreas(treatedSummary)
      setObjective(objectiveSummary)
      if (spineData.notes) setQuickNotes(spineData.notes)
      setPendingSpineId(fromSpineId)
      setActiveTab('visits')

      // Clear the URL param so refreshing doesn't re-trigger
      window.history.replaceState({}, '', `/horses/${horseId}`)
    }

    prefillFromSpine()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, checkingAuth])

  useEffect(() => {
    if (horse?.owner_id) {
      loadOwnerOtherHorses(horse.owner_id)

      // Load consent status for this owner
      async function loadConsent() {
        try {
          const { data } = await supabase
            .from('consent_forms')
            .select('id, signed_at, signed_name, signature_data, horses_acknowledged, notes, form_version')
            .eq('owner_id', horse!.owner_id!)
            .order('signed_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          setConsentOnFile(data ?? null)
        } catch {
          setConsentOnFile(null)
        }
      }
      loadConsent()
    } else {
      setOwnerOtherHorses([])
      setSelectedOwnerHorseId('')
      setConsentOnFile(null)
    }
  }, [horse?.owner_id])

  // Load intake forms linked to this horse
  useEffect(() => {
    if (!horseId) return
    async function loadIntakeForms() {
      const { data } = await supabase
        .from('intake_forms')
        .select('id, submitted_at, signed_name, animal_name, reason_for_care, health_problems, medications_supplements, previous_chiro_care, referral_source, archived')
        .eq('horse_id', horseId)
        .order('submitted_at', { ascending: false })
      setIntakeForms(data || [])
    }
    loadIntakeForms()
  }, [horseId])


  // Load horse contacts
  async function loadContacts() {
    try {
      const { data, error } = await supabase
        .from('horse_contacts')
        .select('*')
        .eq('horse_id', horseId)
        .order('role')
      if (error) {
        if (error.code === '42P01') setContactsNoTable(true)
        return
      }
      setContacts(data || [])
    } catch {
      setContacts([])
    }
  }

  useEffect(() => {
    if (horseId) loadContacts()
  }, [horseId])

  async function saveContact() {
    if (!contactForm.name.trim()) { setContactMsg('Name is required.'); return }
    if (!navigator.onLine) { setContactMsg('Cannot save contacts while offline. Please reconnect and try again.'); return }
    setSavingContact(true); setContactMsg('')
    const payload = { horse_id: horseId, name: contactForm.name.trim(), role: contactForm.role, phone: contactForm.phone || null, email: contactForm.email || null, notes: contactForm.notes || null }
    const { error } = editingContactId
      ? await supabase.from('horse_contacts').update(payload).eq('id', editingContactId)
      : await supabase.from('horse_contacts').insert(payload)
    setSavingContact(false)
    if (error) { setContactMsg(`Error: ${error.message}`); return }
    await loadContacts()
    setShowContactForm(false); setEditingContactId(null)
    setContactForm({ name: '', role: 'Trainer', phone: '', email: '', notes: '' })
  }

  async function deleteContact(id: string) {
    if (!navigator.onLine) { setContactMsg('Cannot delete contacts while offline. Please reconnect and try again.'); return }
    if (!confirm('Remove this contact?')) return
    await supabase.from('horse_contacts').delete().eq('id', id)
    await loadContacts()
  }

  useEffect(() => {
    setSelectedOwnerHorseId(horseId)
  }, [horseId])

  // ── Pre-fill Quick Notes with latest spine findings for new-visit form ────
  useEffect(() => {
    if (editingVisitId) return          // existing visits handled in startEditVisit
    if (!horseId) return

    const LABEL: Record<string, string> = {
      tmj: 'TMJ', poll: 'Poll',
      c1: 'C1 (Atlas)', c2: 'C2 (Axis)', c3: 'C3', c4: 'C4', c5: 'C5', c6: 'C6', c7: 'C7',
      sacrum: 'Sacrum', si_joint: 'SI Joint', coccygeal: 'Coccygeal',
    }
    const segLabel = (key: string) =>
      LABEL[key] ?? key.replace(/^([tTlLcC])(\d+)$/, (_, p, n) => p.toUpperCase() + n)

    async function loadLatestSpine() {
      try {
        const { data } = await supabase
          .from('spine_assessments')
          .select('findings, notes')
          .eq('horse_id', horseId)
          .order('assessed_at', { ascending: false })
          .limit(1)

        const row = data?.[0]
        if (!row?.findings) return

        const findings = row.findings as Record<string, { left: boolean; right: boolean }>
        const flagged = Object.entries(findings)
          .filter(([, f]) => f.left || f.right)
          .map(([key, f]) => {
            const side = f.left && f.right ? 'Bilateral' : f.left ? 'Left' : 'Right'
            return `${segLabel(key)} (${side})`
          })

        if (flagged.length === 0) return

        const spineText = [
          `Spine Findings: ${flagged.join(', ')}`,
          row.notes ? `Spine Notes: ${row.notes}` : '',
        ].filter(Boolean).join('\n')

        setQuickNotes(prev => prev ? prev : spineText)
      } catch {
        // spine table may not exist yet
      }
    }

    loadLatestSpine()
  }, [horseId, editingVisitId])

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-[#edf2f7] p-8">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-md">
          <p className="text-slate-700">Checking login...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#edf2f7] p-3 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="mb-3 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        >
          ← Back
        </button>

        <div className="rounded-3xl bg-white p-4 shadow-md md:p-6">
          <div className="flex items-start gap-4">

            {/* ── Profile Photo ── */}
            <div className="relative flex-shrink-0">
              <button
                onClick={openProfileCamera}
                title={profilePhotoUrl ? 'Click to update photo' : 'Click to add a profile photo'}
                className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-[#0f2040] bg-slate-100 shadow-md transition md:h-24 md:w-24"
              >
                {profilePhotoUrl ? (
                  <>
                    <img
                      src={profilePhotoUrl}
                      alt={horse?.name || 'Patient'}
                      className="h-full w-full object-cover"
                    />
                    {uploadingProfilePhoto && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <div className="text-lg animate-spin">⏳</div>
                      </div>
                    )}
                  </>
                ) : uploadingProfilePhoto ? (
                  <div className="flex flex-col items-center gap-1 text-slate-500">
                    <div className="text-lg animate-spin">⏳</div>
                    <span className="text-[9px]">Saving…</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-slate-400">
                    <span className="text-3xl">{speciesEmoji(horse?.species)}</span>
                    <span className="text-[9px] font-medium">+ Photo</span>
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="text-2xl">📷</span>
                </div>
              </button>
              {/* Remove photo button */}
              {profilePhotoUrl && !uploadingProfilePhoto && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeProfilePhoto() }}
                  title="Remove profile photo"
                  className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow-md transition hover:bg-red-600"
                >
                  ✕
                </button>
              )}
              {/* Hidden file input fallback */}
              <input
                ref={profileFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfileFileChange}
              />
            </div>

            {/* ── Name, badges, info ── */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 md:text-3xl">
                  {horse?.name || 'Patient Record'}
                </h1>
                <span className={`rounded-xl px-3 py-1 text-xs font-semibold ${
                  horse?.species === 'canine' ? 'bg-amber-100 text-amber-800' :
                  horse?.species === 'feline' ? 'bg-orange-100 text-orange-800' :
                  horse?.species === 'bovine' ? 'bg-stone-100 text-stone-800' :
                  horse?.species === 'porcine' ? 'bg-pink-100 text-pink-800' :
                  horse?.species === 'exotic' ? 'bg-emerald-100 text-emerald-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {speciesEmoji(horse?.species)} {speciesLabel(horse?.species)}
                </span>
                {horse?.behavioral_notes && (
                  <span className="rounded-xl bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
                    ⚠️ Behavioral Alert
                  </span>
                )}
                {consentOnFile ? (
                  <span className="rounded-xl bg-emerald-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
                    ✓ Consent
                  </span>
                ) : (
                  <span className="rounded-xl bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
                    <strong>✗</strong> Consent
                  </span>
                )}
                {intakeForms.length > 0 && (
                  <span className="rounded-xl bg-blue-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
                    📋 Intake on File
                  </span>
                )}
              </div>
              <p className="mt-2 flex flex-wrap gap-x-2 text-sm text-slate-600 md:text-base">
                {[horse?.breed, horse?.sex, horse?.age, horse?.discipline, horse?.barn_location]
                  .filter(Boolean)
                  .map((val, i, arr) => (
                    <span key={i}>
                      <span>{val}</span>
                      {i < arr.length - 1 && <span className="ml-2 text-slate-300">•</span>}
                    </span>
                  ))}
              </p>
            </div>

            {/* ── Start New Visit (far right) ── */}
            <Link
              href={`/horses/${horseId}/spine?newVisit=true&species=${horse?.species || 'equine'}`}
              className="flex-shrink-0 rounded-xl bg-[#0f2040] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#162d55]"
            >
              + Start New Visit
            </Link>
          </div>

          {horse?.medical_alerts && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="mt-0.5 text-lg leading-none">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-amber-900">Medical Alerts</p>
                <p className="mt-0.5 text-sm text-amber-800">{horse.medical_alerts}</p>
              </div>
            </div>
          )}

          {/* ── Owner Info (inline under header) ── */}
          {horse?.owners && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">
                    👤 {horse.owners.full_name}
                  </span>
                  {horse.owners.phone && (
                    <a href={`tel:${horse.owners.phone}`} className="text-blue-600 hover:underline">
                      📞 {formatPhone(horse.owners.phone)}
                    </a>
                  )}
                  {horse.owners.email && (
                    <a href={`mailto:${horse.owners.email}`} className="text-blue-600 hover:underline">
                      ✉️ {horse.owners.email}
                    </a>
                  )}
                  {horse.owners.address && (
                    <span className="text-slate-500">📍 {horse.owners.address}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Consent badge */}
                  {horse.owner_id && consentOnFile !== undefined && (
                    consentOnFile ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        ✓ Consent
                        <a
                          href={`/api/consent/${consentOnFile.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 underline hover:text-emerald-900"
                        >
                          View
                        </a>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        ! No consent
                      </span>
                    )
                  )}
                  {ownerOtherHorses.length > 0 && (
                    <select
                      value={selectedOwnerHorseId}
                      onChange={(e) => handleOwnerHorseJump(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                    >
                      <option value="">Other patients ({ownerOtherHorses.length})</option>
                      {ownerOtherHorses.map((ownerHorse) => (
                        <option key={ownerHorse.id} value={ownerHorse.id}>
                          {ownerHorse.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {horse.owner_id && (
                    <Link
                      href={`/owners/${horse.owner_id}`}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                    >
                      View Owner
                    </Link>
                  )}
                  <button
                    onClick={() => setEditingOwner(true)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Owner Edit Modal ── */}
          {editingOwner && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => cancelOwnerEdit()}>
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">Edit Owner Info</h3>
                  <button onClick={cancelOwnerEdit} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
                </div>
                <div className="space-y-3">
                  <Field label="Owner Name">
                    <input value={ownerNameEdit} onChange={(e) => setOwnerNameEdit(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3" placeholder="Owner name" />
                  </Field>
                  <Field label="Phone">
                    <input value={ownerPhoneEdit} onChange={(e) => setOwnerPhoneEdit(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3" placeholder="Phone" />
                  </Field>
                  <Field label="Email">
                    <input value={ownerEmailEdit} onChange={(e) => setOwnerEmailEdit(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3" placeholder="Email" />
                  </Field>
                  <Field label="Address">
                    <textarea value={ownerAddressEdit} onChange={(e) => setOwnerAddressEdit(e.target.value)} className="min-h-[80px] w-full rounded-xl border border-slate-300 px-4 py-3" placeholder="Owner address" />
                  </Field>
                  <div className="flex gap-2 pt-2">
                    <button onClick={saveOwnerInfo} className="rounded-xl bg-[#0f2040] px-4 py-3 text-sm text-white hover:bg-[#162d55] transition-colors">
                      Save Owner Info
                    </button>
                    <button onClick={cancelOwnerEdit} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tab navigation */}
        <div className="mt-6 flex gap-1 rounded-2xl bg-[#edf2f7] p-1.5 shadow-sm">
          {(['info', 'visits', 'photos', 'records'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-[#0f2040] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white hover:shadow-sm'
              }`}
            >
              {tab === 'info' ? 'Info' : tab === 'visits' ? 'Visits' : tab === 'photos' ? 'Photos' : 'Records'}
            </button>
          ))}
        </div>

        {/* Info Tab */}
        {activeTab === 'info' && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-md">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-900">Patient Info</h2>
                {!editingHorse ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingHorse(true)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={deletePatient}
                      className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>

              {!editingHorse ? (
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  <InfoRow label="Patient Name" value={horse?.name || '—'} />
                  <InfoRow label="Species" value={
                    horse?.species === 'canine' ? 'Canine (Dog)' :
                    horse?.species === 'feline' ? 'Feline (Cat)' :
                    horse?.species === 'bovine' ? 'Bovine (Cow)' :
                    horse?.species === 'porcine' ? 'Porcine (Pig)' :
                    horse?.species === 'exotic' ? 'Exotic' :
                    'Equine (Horse)'
                  } />
                  <InfoRow label="Breed" value={horse?.breed || '—'} />
                  <InfoRow label="Sex" value={horse?.sex || '—'} />
                  <InfoRow label="Age" value={horse?.age || '—'} />
                  <InfoRow label={getDisciplineLabel(horse?.species)} value={horse?.discipline || '—'} />
                  <InfoRow label="Location" value={horse?.barn_location || '—'} />
                  <InfoRow label="Owner" value={horse?.owners?.full_name || '—'} />
                </div>
              ) : (
                <div className="mt-4 grid gap-4">
                  <Field label="Patient Name">
                    <input
                      value={horseNameEdit}
                      onChange={(e) => setHorseNameEdit(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder={getNamePlaceholder(horseSpeciesEdit)}
                    />
                  </Field>

                  <Field label="Species">
                    <select
                      value={horseSpeciesEdit}
                      onChange={(e) => setHorseSpeciesEdit(e.target.value as SpeciesType)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    >
                      <option value="equine">Equine (Horse)</option>
                      <option value="canine">Canine (Dog)</option>
                      <option value="feline">Feline (Cat)</option>
                      <option value="bovine">Bovine (Cow)</option>
                      <option value="porcine">Porcine (Pig)</option>
                      <option value="exotic">Exotic</option>
                    </select>
                  </Field>

                  <Field label="Owner">
                    <select
                      value={horseOwnerIdEdit}
                      onChange={(e) => setHorseOwnerIdEdit(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    >
                      <option value="">Select owner</option>
                      {owners.map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.full_name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Breed">
                    <input
                      value={horseBreedEdit}
                      onChange={(e) => setHorseBreedEdit(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Breed"
                    />
                  </Field>

                  <Field label="Sex">
                    <select
                      value={horseSexEdit}
                      onChange={(e) => setHorseSexEdit(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    >
                      <option value="">Select sex</option>
                      {horseSpeciesEdit === 'canine' ? (
                        <>
                          <option value="Male">Male (Intact)</option>
                          <option value="Female">Female (Intact)</option>
                          <option value="Neutered">Neutered (Male)</option>
                          <option value="Spayed">Spayed (Female)</option>
                        </>
                      ) : (
                        <>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Gelding">Gelding</option>
                          <option value="Mare">Mare</option>
                          <option value="Stallion">Stallion</option>
                        </>
                      )}
                    </select>
                  </Field>

                  <Field label="Age">
                    <input
                      value={horseAgeEdit}
                      onChange={(e) => setHorseAgeEdit(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Age"
                    />
                  </Field>

                  <Field label={getDisciplineLabel(horseSpeciesEdit)}>
                    <input
                      value={horseDisciplineEdit}
                      onChange={(e) => setHorseDisciplineEdit(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder={getDisciplinePlaceholder(horseSpeciesEdit)}
                    />
                  </Field>

                  <Field label="Location">
                    <input
                      value={horseBarnLocationEdit}
                      onChange={(e) => setHorseBarnLocationEdit(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder={getBarnLocationPlaceholder(horseSpeciesEdit)}
                    />
                  </Field>

                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                    New owner after save: <span className="font-semibold">{currentHorseOwnerName}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={saveHorseInfo}
                      className="rounded-xl bg-[#0f2040] px-4 py-3 text-sm text-white hover:bg-[#162d55] transition-colors"
                    >
                      Save Patient Info
                    </button>
                    <button
                      onClick={cancelHorseEdit}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">

            {/* ── Behavioral Notes ── */}
            <div className="rounded-3xl border border-red-200 bg-white p-6 shadow-md">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg leading-none">⚠️</span>
                <h2 className="text-xl font-semibold text-red-700">Behavioral Notes</h2>
              </div>
              <p className="text-sm text-slate-500 mb-3">
                Flag anything the provider should know before adjusting — biting, kicking, anxiety, etc. If filled in, a red alert badge appears at the top of this record.
              </p>
              <textarea
                value={behavioralNotesEdit}
                onChange={(e) => setBehavioralNotesEdit(e.target.value)}
                rows={3}
                placeholder="e.g. Bites when touched on left flank, kicks when startled, anxious around new people…"
                className="w-full resize-none rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 placeholder:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={saveBehavioralNotes}
                  disabled={savingBehavioralNotes}
                  className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {savingBehavioralNotes ? 'Saving…' : 'Save Notes'}
                </button>
                {horse?.behavioral_notes && !behavioralNotesEdit.trim() && (
                  <span className="text-xs text-slate-400">Clear the field and save to remove the alert.</span>
                )}
              </div>
            </div>

            {/* ── Intake Forms ── */}
            {intakeForms.length > 0 && (() => {
              const activeForms = intakeForms.filter(f => !f.archived)
              const archivedForms = intakeForms.filter(f => f.archived)
              const visibleForms = showArchivedIntake ? intakeForms : activeForms

              const renderCard = (form: IntakeForm) => (
                <div key={form.id} className={`rounded-2xl border p-4 ${form.archived ? 'border-slate-100 bg-slate-50/50 opacity-60' : 'border-slate-100 bg-slate-50'}`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        {form.animal_name}
                        {form.archived && <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-600">Archived</span>}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Signed by {form.signed_name || '—'} · {new Date(form.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!form.archived && <span className="rounded-xl bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">✓ Signed</span>}
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-600 mb-3">
                    {form.reason_for_care && (
                      <p><span className="font-medium text-slate-700">Reason: </span>{form.reason_for_care}</p>
                    )}
                    {form.health_problems && (
                      <p><span className="font-medium text-slate-700">Health concerns: </span>{form.health_problems}</p>
                    )}
                    {form.medications_supplements && (
                      <p><span className="font-medium text-slate-700">Medications: </span>{form.medications_supplements}</p>
                    )}
                    {form.previous_chiro_care !== null && (
                      <p><span className="font-medium text-slate-700">Previous chiro care: </span>{form.previous_chiro_care ? 'Yes' : 'No'}</p>
                    )}
                    {form.referral_source && form.referral_source.length > 0 && (
                      <p><span className="font-medium text-slate-700">Referred by: </span>{form.referral_source.join(', ')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                    <a
                      href={`/api/intake/${form.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
                    >
                      📄 View PDF
                    </a>
                    <Link
                      href={`/intake/view/${form.id}`}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                    >
                      View Form →
                    </Link>
                  </div>
                </div>
              )

              return (
                <div className="rounded-3xl bg-white p-6 shadow-md">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg leading-none">📋</span>
                      <h2 className="text-xl font-semibold text-slate-900">Intake Forms</h2>
                    </div>
                    {archivedForms.length > 0 && (
                      <button
                        onClick={() => setShowArchivedIntake(v => !v)}
                        className="text-xs text-slate-400 hover:text-slate-600 transition"
                      >
                        {showArchivedIntake ? 'Hide archived' : `Show archived (${archivedForms.length})`}
                      </button>
                    )}
                  </div>
                  <div className="space-y-4">
                    {visibleForms.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">All intake forms are archived.</p>
                    ) : (
                      visibleForms.map(renderCard)
                    )}
                  </div>
                </div>
              )
            })()}

            {/* ── Additional Contacts Card ── */}
            <div className="rounded-3xl bg-white p-6 shadow-md">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h2 className="text-xl font-semibold text-slate-900">Additional Contacts</h2>
                  <button
                    onClick={() => { setEditingContactId(null); setContactForm({ name: '', role: 'Trainer', phone: '', email: '', notes: '' }); setContactMsg(''); setShowContactForm(v => !v) }}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 hover:bg-slate-50 transition"
                  >
                    {showContactForm && !editingContactId ? 'Cancel' : '+ Add'}
                  </button>
                </div>

                {/* Setup hint */}
                {contactsNoTable && (
                  <pre className="overflow-x-auto rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-slate-700 leading-relaxed">{`CREATE TABLE horse_contacts (\n  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,\n  horse_id uuid REFERENCES horses(id) ON DELETE CASCADE NOT NULL,\n  name text NOT NULL,\n  role text NOT NULL DEFAULT 'Other',\n  phone text,\n  email text,\n  notes text,\n  created_at timestamptz DEFAULT now()\n);\nCREATE INDEX ON horse_contacts(horse_id);`}</pre>
                )}

                {/* Inline add/edit form */}
                {showContactForm && (
                  <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Name *</label>
                        <input value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Role</label>
                        <select value={contactForm.role} onChange={e => setContactForm(f => ({ ...f, role: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                          {['Trainer', 'Barn Manager', 'Veterinarian', 'Farrier', 'Emergency Contact', 'Other'].map(r => <option key={r}>{r}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Phone</label>
                        <input value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Email</label>
                        <input value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Notes</label>
                      <input value={contactForm.notes} onChange={e => setContactForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Primary trainer, prefers texts" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                    </div>
                    {contactMsg && <p className="text-xs text-red-500">{contactMsg}</p>}
                    <div className="flex gap-2">
                      <button onClick={saveContact} disabled={savingContact} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
                        {savingContact ? 'Saving…' : editingContactId ? 'Update' : 'Save Contact'}
                      </button>
                      <button onClick={() => { setShowContactForm(false); setEditingContactId(null) }} className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-600">Cancel</button>
                    </div>
                  </div>
                )}

                {/* Contact list */}
                {contacts.length === 0 && !showContactForm ? (
                  <p className="text-sm text-slate-400">No additional contacts yet — add trainers, vets, barn managers, and more.</p>
                ) : (
                  <div className="space-y-2">
                    {contacts.map(c => (
                      <div key={c.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">{c.name}</span>
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">{c.role}</span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                            {c.phone && <span>{c.phone}</span>}
                            {c.email && <span>{c.email}</span>}
                            {c.notes && <span className="italic">{c.notes}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => { setEditingContactId(c.id); setContactForm({ name: c.name, role: c.role, phone: c.phone || '', email: c.email || '', notes: c.notes || '' }); setContactMsg(''); setShowContactForm(true) }} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-white transition">Edit</button>
                          <button onClick={() => deleteContact(c.id)} className="rounded-lg border border-red-100 px-2.5 py-1 text-xs text-red-400 hover:bg-red-50 transition">×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Visits Tab */}
        {activeTab === 'visits' && (
        <div className="mt-6 space-y-6">

            {/* Invoice prompt after saving a visit */}
            {invoicePromptVisitId && (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-emerald-900">Visit saved!</p>
                    <p className="mt-0.5 text-sm text-emerald-700">Would you like to create an invoice for this visit?</p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/invoices/create?visitId=${invoicePromptVisitId}&horseId=${horseId}&ownerId=${horse?.owner_id || ''}`}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
                    >
                      Create Invoice
                    </Link>
                    <button
                      onClick={() => setInvoicePromptVisitId(null)}
                      className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(editingVisitId || pendingSpineId) && (
            <div className="rounded-3xl bg-white p-6 shadow-md">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 className="text-2xl font-semibold text-slate-900">
                  {editingVisitId ? 'Edit Visit' : 'New Visit'}
                </h2>

                {editingVisitId ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={resetVisitForm}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900"
                    >
                      Cancel Edit
                    </button>

                    <Link
                      href={`/anatomy?visitId=${editingVisitId}&horseName=${encodeURIComponent(horse?.name || '')}`}
                      className="rounded-xl border border-[#0f2040] bg-[#0f2040] px-4 py-2 text-sm text-white hover:bg-[#162d55] transition-colors"
                    >
                      Open Anatomy For This Visit
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/anatomy?horseName=${encodeURIComponent(horse?.name || '')}`}
                      className="rounded-xl border border-[#0f2040] bg-[#0f2040] px-4 py-2 text-sm text-white hover:bg-[#162d55] transition-colors"
                    >
                      Open Anatomy Viewer
                    </Link>
                  </div>
                )}
              </div>

              {editingVisitId && activeVisitAnatomyCount > 0 ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    Using saved anatomy notes from this visit
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {activeVisitAnatomyCount} region
                    {activeVisitAnatomyCount === 1 ? '' : 's'} documented
                    {activeVisitRegionNames.length ? ` • ${activeVisitRegionNames.join(', ')}` : ''}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Visit Date">
                  <input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  />
                </Field>

                <Field label="Location">
                  <input
                    value={visitLocation}
                    onChange={(e) => setVisitLocation(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    placeholder="Barn / ranch location"
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field label="Provider Name">
                    <input
                      value={providerName}
                      onChange={(e) => setProviderName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Provider"
                    />
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <Field label="Reason for Visit">
                    <input
                      value={reasonForVisit}
                      onChange={(e) => setReasonForVisit(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Performance maintenance, stiffness, etc."
                    />
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <Field label="Quick Notes for AI SOAP Draft">
                    {/* ── Template chips ── */}
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {[
                        { label: 'Post-competition', text: 'Post-competition soreness. Reduced range of motion through back and hindquarters. Mild tension through poll and withers. Responded well to adjustment.' },
                        { label: 'Routine adjustment', text: 'Routine maintenance adjustment. Owner reports normal performance and behavior. Minor restrictions found at thoracolumbar junction. Full adjustment performed.' },
                        { label: 'Poll tension', text: 'Poll tension and head tilt noted on arrival. Restricted cervical range of motion. Owner reports difficulty bending left. Atlas and C2 adjusted. Good response.' },
                        { label: 'Hind-end asymmetry', text: 'Hind-end asymmetry and reduced impulsion reported by owner. SI joint restriction noted bilaterally, left more pronounced. Adjusted lumbar and sacral regions. Follow up in 2 weeks.' },
                        { label: 'Back soreness', text: 'Back soreness after heavy work week. Reactive mid-thoracic region on palpation. Adjusted T8–T12. Recommended 2 light days and stretching.' },
                        { label: 'New client', text: 'Initial assessment. Owner reports history of stiffness and reluctance to pick up right lead. Full spine evaluated. Multiple restrictions found. Comprehensive adjustment performed. Recommendations discussed.' },
                        { label: 'Pre-event', text: 'Pre-competition tune-up. Horse in good overall condition. Minor restrictions at withers and poll. Light adjustment performed to optimise range of motion ahead of event.' },
                        { label: 'Post-fall/injury', text: 'Follow-up after recent fall/injury. Area of concern assessed carefully. Compensatory patterns noted. Gentle adjustment within comfort tolerance. Reassess in 1 week.' },
                      ].map((t) => (
                        <button
                          key={t.label}
                          type="button"
                          onClick={() => setQuickNotes(prev => prev ? prev + '\n' + t.text : t.text)}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-slate-900 hover:bg-slate-900 hover:text-white transition"
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={quickNotes}
                      onChange={(e) => setQuickNotes(e.target.value)}
                      className="min-h-32 w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Type notes or tap a template above to pre-fill…"
                    />
                  </Field>

                  {quickNotes && (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setQuickNotes('')}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
                      >
                        Clear notes
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Sticky Generate SOAP bar ── */}
                <div className="md:col-span-2 sticky bottom-0 z-20">
                  <div className="rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-3 shadow-lg flex flex-wrap items-center gap-2">
                    {(subjectiveChips.size > 0 || objectiveChips.size > 0 || assessmentChips.size > 0 || planChips.size > 0) && (
                      <button
                        type="button"
                        onClick={generateFromSelections}
                        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition shadow-sm"
                      >
                        Generate SOAP from Selections
                      </button>
                    )}
                    <button
                      onClick={generateSoap}
                      disabled={generatingSoap}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 hover:bg-slate-50 disabled:opacity-50 transition"
                    >
                      {generatingSoap ? 'Generating SOAP...' : 'Generate SOAP with AI'}
                    </button>
                  </div>
                </div>

                <Field label="Subjective">
                  <textarea
                    value={subjective}
                    onChange={(e) => setSubjective(e.target.value)}
                    className="min-h-28 w-full rounded-xl border border-slate-300 px-4 py-3"
                    placeholder="What the owner reports"
                  />
                  <QuickAddChipsSection
                    categories={SUBJECTIVE_CHIPS}
                    selectedIds={subjectiveChips}
                    onToggle={(id) => toggleChip(setSubjectiveChips, id)}
                    onClearSection={() => setSubjectiveChips(new Set())}
                    generatedText={buildSubjectiveSentence(subjectiveChips)}
                    onFill={() => setSubjective(buildSubjectiveSentence(subjectiveChips))}
                    sectionLabel="Subjective"
                    usageMap={usageMap}
                  />
                </Field>

                <Field label="Objective">
                  <textarea
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    className="min-h-28 w-full rounded-xl border border-slate-300 px-4 py-3"
                    placeholder="Observed findings"
                  />
                  <QuickAddChipsSection
                    categories={OBJECTIVE_CHIPS}
                    selectedIds={objectiveChips}
                    onToggle={(id) => toggleChip(setObjectiveChips, id)}
                    onClearSection={() => setObjectiveChips(new Set())}
                    generatedText={buildObjectiveSentence(objectiveChips)}
                    onFill={() => setObjective(buildObjectiveSentence(objectiveChips))}
                    sectionLabel="Objective"
                    usageMap={usageMap}
                  />
                </Field>

                <Field label="Assessment">
                  <textarea
                    value={assessment}
                    onChange={(e) => setAssessment(e.target.value)}
                    className="min-h-28 w-full rounded-xl border border-slate-300 px-4 py-3"
                    placeholder="Clinical impression"
                  />
                  <QuickAddChipsSection
                    categories={ASSESSMENT_CHIPS}
                    selectedIds={assessmentChips}
                    onToggle={(id) => toggleChip(setAssessmentChips, id)}
                    onClearSection={() => setAssessmentChips(new Set())}
                    generatedText={buildAssessmentSentence(assessmentChips)}
                    onFill={() => setAssessment(buildAssessmentSentence(assessmentChips))}
                    sectionLabel="Assessment"
                    usageMap={usageMap}
                  />
                </Field>

                <Field label="Plan">
                  <textarea
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    className="min-h-28 w-full rounded-xl border border-slate-300 px-4 py-3"
                    placeholder="Treatment plan / next steps"
                  />
                  <QuickAddChipsSection
                    categories={PLAN_CHIPS}
                    selectedIds={planChips}
                    onToggle={(id) => toggleChip(setPlanChips, id)}
                    onClearSection={() => setPlanChips(new Set())}
                    generatedText={buildPlanSentence(planChips)}
                    onFill={() => {
                      setPlan(buildPlanSentence(planChips))
                      const followUpChipIds = ['plan_2wk', 'plan_3wk', 'plan_monthly', 'plan_prn']
                      const selFU = PLAN_CHIPS.flatMap(c => c.chips).filter(c => planChips.has(c.id) && followUpChipIds.includes(c.id))
                      if (selFU.length > 0) setFollowUp(selFU.map(c => c.label).join(', '))
                    }}
                    sectionLabel="Plan"
                    usageMap={usageMap}
                  />
                </Field>

                <Field label="Follow Up">
                  <input
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    placeholder="2 weeks, PRN, monthly, etc."
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field label="Recommendations">
                    <textarea
                      value={recommendations}
                      onChange={(e) => setRecommendations(e.target.value)}
                      className="min-h-28 w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Rest, stretches, light work, etc."
                    />
                  </Field>
                </div>

                <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={autoEmailAfterSave}
                      onChange={(e) => setAutoEmailAfterSave(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        Auto-email PDF to owner after saving visit
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Uses the owner email saved on this horse record.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="md:col-span-2">
                  <button
                    onClick={saveVisit}
                    className="rounded-xl bg-[#0f2040] px-5 py-3 text-white hover:bg-[#162d55] transition-colors"
                  >
                    {editingVisitId ? 'Update Visit' : 'Save Visit'}
                  </button>
                </div>
              </div>
            </div>
            )}

            {message ? (
              <div className="rounded-2xl bg-white p-4 text-sm text-slate-700 shadow-sm">
                {message}
              </div>
            ) : null}

            <div className="rounded-3xl bg-white p-6 shadow-md">
              <h2 className="text-2xl font-semibold text-slate-900">Visit History</h2>

              <div className="mt-4 space-y-4">
                {visits.length === 0 ? (
                  <p className="text-slate-500">No visits yet.</p>
                ) : (
                  visits.map((visit) => {
                    const visitAnatomyItems = anatomyNotesByVisit[visit.id] || []
                    const isExpanded = expandedAnatomyVisits[visit.id] || false

                    return (
                      <div
                        key={visit.id}
                        id={`visit-${visit.id}`}
                        className="rounded-2xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {toTitleCase(visit.reason_for_visit)}
                            </p>
                            <p className="text-sm text-slate-500">
                              {formatDate(visit.visit_date)}
                            </p>

                            {(
                              <div className="mt-2">
                                {anatomyRegionCounts[visit.id] ? (
                                  <span className="inline-flex rounded-2xl bg-[#0f2040] px-3 py-1 text-xs font-medium text-white">
                                    Anatomy Notes: {anatomyRegionCounts[visit.id]} region
                                    {anatomyRegionCounts[visit.id] === 1 ? '' : 's'}
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-2xl bg-[#edf2f7] px-3 py-1 text-xs font-medium text-slate-600">
                                    No anatomy notes yet
                                  </span>
                                )}
                              </div>
                            )}

                            {anatomyRegionNamesByVisit[visit.id]?.length ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {anatomyRegionNamesByVisit[visit.id].map((regionName) => (
                                  <span
                                    key={`${visit.id}-${regionName}`}
                                    className="inline-flex rounded-2xl bg-[#edf2f7] px-3 py-1 text-xs font-medium text-slate-600"
                                  >
                                    {regionName}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {(
                              <Link
                                href={`/anatomy?visitId=${visit.id}&horseName=${encodeURIComponent(horse?.name || '')}`}
                                className="rounded-xl border border-[#0f2040] bg-[#0f2040] px-3 py-2 text-sm text-white hover:bg-[#162d55] transition-colors"
                              >
                                Open Anatomy
                              </Link>
                            )}

                            <Link
                              href={`/horses/${horse?.id}/spine?visitId=${visit.id}&species=${horse?.species || 'equine'}`}
                              className="rounded-xl border border-[#0f2040] bg-[#0f2040] px-3 py-2 text-sm text-white hover:bg-[#162d55] transition-colors"
                            >
                              Spine
                            </Link>

                            <a
                              href={`/api/visits/${visit.id}/pdf`}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                            >
                              Export PDF
                            </a>

                            <button
                              onClick={() => emailVisitPdf(visit.id)}
                              disabled={emailingVisitId === visit.id}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
                            >
                              {emailingVisitId === visit.id ? 'Emailing PDF...' : 'Email PDF'}
                            </button>

                            <button
                              onClick={() => previewOwnerSummary(visit.id)}
                              disabled={previewingOwnerSummaryId === visit.id || sendingOwnerSummaryId === visit.id}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
                            >
                              {previewingOwnerSummaryId === visit.id ? 'Generating…' : 'Owner Summary'}
                            </button>

                            <button
                              onClick={() => startEditVisit(visit)}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => deleteVisit(visit.id)}
                              className="rounded-xl border border-red-300 bg-white px-3 py-2 text-sm text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {visitAnatomyItems.length > 0 ? (
                          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-900">
                                Anatomy Note Summaries
                              </p>
                              <button
                                onClick={() => setExpandedAnatomyVisits((prev) => ({
                                  ...prev,
                                  [visit.id]: !prev[visit.id],
                                }))}
                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
                              >
                                {isExpanded ? 'Hide Anatomy Notes' : 'View Anatomy Notes'}
                              </button>
                            </div>

                            {isExpanded ? (
                              <div className="mt-3 space-y-3">
                                {visitAnatomyItems.map((item) => (
                                  <div
                                    key={`${visit.id}-${item.regionKey}`}
                                    className="rounded-xl bg-white p-3"
                                  >
                                    <p className="text-sm font-semibold text-slate-900">
                                      {item.regionLabel}
                                    </p>
                                    <p className="mt-1 text-sm leading-6 text-slate-700">
                                      {item.notes || 'No notes saved for this region.'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        <p className="mt-2 text-sm text-slate-700">
                          <span className="font-medium">Location:</span> {visit.location || '—'}
                        </p>
                        <p className="text-sm text-slate-700">
                          <span className="font-medium">Provider:</span> {visit.provider_name || '—'}
                        </p>

                        {visit.subjective || visit.objective || visit.assessment || visit.plan ? (
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <NoteBlock label="Subjective" value={visit.subjective} />
                            <NoteBlock label="Objective" value={visit.objective} />
                            <NoteBlock label="Assessment" value={visit.assessment} />
                            <NoteBlock label="Plan" value={visit.plan} />
                          </div>
                        ) : (
                          <p className="mt-3 text-sm italic text-slate-400">
                            No SOAP notes recorded — use Edit to add notes.
                          </p>
                        )}

                        <div className="mt-3">
                          <p className="text-sm text-slate-700">
                            <span className="font-medium">Follow Up:</span> {visit.follow_up || '—'}
                          </p>
                        </div>

                        <p className="mt-2 text-sm text-slate-700">
                          <span className="font-medium">Recommendations:</span> {visit.recommendations || '—'}
                        </p>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
        </div>
        )}

        {/* Photos Tab */}
        {activeTab === 'photos' && (
        <div className="mt-6 space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-md">
              <h2 className="text-xl font-semibold text-slate-900">Upload Photo</h2>

              <div className="mt-4 grid gap-4">
                <Field label="Link to Visit (optional)">
                  <select
                    value={selectedPhotoVisitId}
                    onChange={(e) => setSelectedPhotoVisitId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  >
                    <option value="">No visit selected</option>
                    {visits.map((visit) => (
                      <option key={visit.id} value={visit.id}>
                        {formatDate(visit.visit_date)} - {toTitleCase(visit.reason_for_visit)}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Caption">
                  <input
                    value={photoCaption}
                    onChange={(e) => setPhotoCaption(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    placeholder="Before adjustment, left shoulder, etc."
                  />
                </Field>

                <Field label="Body Area">
                  <input
                    value={photoBodyArea}
                    onChange={(e) => setPhotoBodyArea(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    placeholder="Shoulder, back, neck, hind end"
                  />
                </Field>

                <Field label="Date Taken">
                  <input
                    type="date"
                    value={photoTakenAt}
                    onChange={(e) => setPhotoTakenAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  />
                </Field>

                <Field label="Image File">
                  {/* Hidden fallback for browsers that don't support getUserMedia */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    />
                    <button
                      type="button"
                      onClick={openCamera}
                      title="Take a photo with your camera"
                      className="flex items-center gap-2 rounded-xl bg-[#0f2040] px-4 py-3 text-white font-semibold hover:bg-[#162d55] active:scale-95 transition-all shrink-0 shadow-md"
                    >
                      <span className="text-lg leading-none">📷</span>
                      <span className="text-sm whitespace-nowrap">Take Photo</span>
                    </button>
                  </div>
                  {selectedFile && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-emerald-600 font-medium">
                      <span>✓</span> Ready: {selectedFile.name}
                    </p>
                  )}
                </Field>

                {/* Camera Modal */}
                {showCameraModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                        <h3 className="text-lg font-semibold text-slate-900">Take a Photo</h3>
                        <button
                          type="button"
                          onClick={closeCamera}
                          className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                        >
                          ×
                        </button>
                      </div>
                      <div className="relative bg-black">
                        {cameraError ? (
                          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                            <span className="text-4xl">📷</span>
                            <p className="text-sm text-slate-600">{cameraError}</p>
                            <button
                              type="button"
                              onClick={() => { closeCamera(); cameraInputRef.current?.click() }}
                              className="rounded-xl bg-[#0f2040] px-5 py-2.5 text-sm text-white hover:bg-[#162d55]"
                            >
                              Choose from Library Instead
                            </button>
                          </div>
                        ) : (
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full"
                          />
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                      </div>
                      {!cameraError && (
                        <div className="flex gap-3 p-4">
                          <button
                            type="button"
                            onClick={closeCamera}
                            className="flex-1 rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={capturePhoto}
                            className="flex-1 rounded-xl bg-[#0f2040] px-5 py-3 text-sm font-semibold text-white hover:bg-[#162d55] shadow"
                          >
                            📸 Capture
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={addPhoto}
                  disabled={uploadingPhoto}
                  className="rounded-xl bg-[#0f2040] px-5 py-3 text-white hover:bg-[#162d55] transition-colors disabled:opacity-50"
                >
                  {uploadingPhoto ? 'Uploading Photo...' : 'Upload Photo'}
                </button>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-md">
              <h2 className="text-2xl font-semibold text-slate-900">Photo Gallery</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {photos.length === 0 ? (
                  <p className="text-slate-500">No photos yet.</p>
                ) : (
                  photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="overflow-hidden rounded-2xl border border-slate-200"
                    >
                      {photo.signed_url ? (
                        <img
                          src={photo.signed_url}
                          alt={photo.caption || 'Horse photo'}
                          className="h-56 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-56 items-center justify-center bg-slate-100 text-slate-400">
                          Image unavailable
                        </div>
                      )}

                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {photo.caption || 'No caption'}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              Body Area: {photo.body_area || '—'}
                            </p>
                            <p className="text-sm text-slate-600">
                              Date Taken: {formatDate(photo.taken_at)}
                            </p>
                            <p className="text-sm text-slate-600">
                              Visit Date: {formatDate(photo.visits?.visit_date)}
                            </p>
                          </div>

                          <button
                            onClick={() => deletePhoto(photo)}
                            className="rounded-xl border border-red-300 bg-white px-3 py-2 text-sm text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
        </div>
        )}

        {/* Records Tab */}
        {activeTab === 'records' && (
        <div className="mt-6 space-y-6">

          {/* Upload new record */}
          <div className="rounded-3xl bg-white p-6 shadow-md">
            <h2 className="text-xl font-semibold text-slate-900">Upload Record</h2>
            <p className="mt-1 text-sm text-slate-500">Upload vet records, imaging, lab results, or any other files from the owner.</p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">File</label>
                <input
                  ref={recordFileInputRef}
                  type="file"
                  onChange={e => setRecordFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#0f2040] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-[#162d55]"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Note</label>
                <textarea
                  value={recordNote}
                  onChange={e => setRecordNote(e.target.value)}
                  placeholder="e.g. X-ray of left hind hock from 3/10/26, Bloodwork results from Dr. Smith..."
                  className="min-h-[80px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm placeholder-slate-400"
                />
              </div>

              {recordMsg && (
                <p className={`rounded-xl px-3 py-2 text-sm ${recordMsg.includes('Error') || recordMsg.includes('failed') || recordMsg.includes('does not exist') ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                  {recordMsg}
                </p>
              )}

              <button
                onClick={uploadRecord}
                disabled={uploadingRecord || !recordFile}
                className="rounded-xl bg-[#0f2040] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#162d55] disabled:opacity-40"
              >
                {uploadingRecord ? 'Uploading…' : 'Upload Record'}
              </button>
            </div>
          </div>

          {/* Records list */}
          <div className="rounded-3xl bg-white p-6 shadow-md">
            <h2 className="text-xl font-semibold text-slate-900">Uploaded Records</h2>

            {records.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">No records uploaded yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {records.map(rec => {
                  const isEditing = editingRecordId === rec.id
                  const icon = rec.file_type === 'pdf' ? '📄'
                    : ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(rec.file_type || '') ? '🖼️'
                    : ['doc', 'docx'].includes(rec.file_type || '') ? '📝'
                    : ['xls', 'xlsx', 'csv'].includes(rec.file_type || '') ? '📊'
                    : '📎'

                  return (
                    <div key={rec.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="mt-0.5 text-xl leading-none">{icon}</span>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 text-sm truncate">{rec.file_name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Uploaded {new Date(rec.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              {rec.file_type && <span className="ml-1 uppercase text-slate-300">· {rec.file_type}</span>}
                            </p>

                            {isEditing ? (
                              <div className="mt-2 flex items-end gap-2">
                                <textarea
                                  value={editingRecordNote}
                                  onChange={e => setEditingRecordNote(e.target.value)}
                                  className="min-h-[60px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                  placeholder="Add a note about this file…"
                                />
                                <div className="flex flex-col gap-1 shrink-0">
                                  <button
                                    onClick={() => updateRecordNote(rec.id, editingRecordNote)}
                                    className="rounded-lg bg-[#0f2040] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#162d55]"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => { setEditingRecordId(null); setEditingRecordNote('') }}
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : rec.note ? (
                              <p className="mt-1.5 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{rec.note}</p>
                            ) : (
                              <p className="mt-1.5 text-xs text-slate-300 italic">No note</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => downloadRecord(rec)}
                            title="View / Download"
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                          >
                            View
                          </button>
                          <button
                            onClick={() => { setEditingRecordId(rec.id); setEditingRecordNote(rec.note || '') }}
                            title="Edit note"
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteRecord(rec)}
                            title="Delete record"
                            className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* ── Owner Summary Preview Modal ── */}
      {ownerSummaryPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex w-full max-w-xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[90vh]">

            {/* Modal header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4 shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Owner Summary Preview</h3>
                {ownerSummaryPreview.ownerEmail && (
                  <p className="text-xs text-slate-400 mt-0.5">Will be sent to {ownerSummaryPreview.ownerEmail}</p>
                )}
              </div>
              <button
                onClick={() => setOwnerSummaryPreview(null)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Subject line */}
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-3 shrink-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Subject</p>
              <p className="mt-0.5 text-sm text-slate-700">{ownerSummaryPreview.subject}</p>
            </div>

            {/* Email body */}
            <div className="overflow-y-auto px-6 py-5 text-sm leading-relaxed text-slate-700 space-y-4">
              {ownerSummaryPreview.text.split(/\n\n+/).filter(Boolean).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 shrink-0">
              <button
                onClick={() => setOwnerSummaryPreview(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => sendOwnerSummary(ownerSummaryPreview.visitId)}
                disabled={sendingOwnerSummaryId === ownerSummaryPreview.visitId}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition"
              >
                {sendingOwnerSummaryId === ownerSummaryPreview.visitId ? 'Sending…' : 'Send to Owner'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Profile Camera Modal ── */}
      {showProfileCameraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">📷 Profile Photo</h3>
              <button
                type="button"
                onClick={closeProfileCamera}
                className="text-2xl leading-none text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>
            <div className="relative bg-black">
              {profileCameraError ? (
                <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                  <span className="text-4xl">📷</span>
                  <p className="text-sm text-slate-600">{profileCameraError}</p>
                  <button
                    type="button"
                    onClick={() => { closeProfileCamera(); profileFileInputRef.current?.click() }}
                    className="rounded-xl bg-[#0f2040] px-5 py-2.5 text-sm text-white hover:bg-[#162d55]"
                  >
                    Choose from Library Instead
                  </button>
                </div>
              ) : (
                <video
                  ref={profileVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="aspect-square w-full object-cover"
                />
              )}
              <canvas ref={profileCanvasRef} className="hidden" />
            </div>
            {!profileCameraError && (
              <div className="flex flex-col gap-2 p-4">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeProfileCamera}
                    className="flex-1 rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => { closeProfileCamera(); profileFileInputRef.current?.click() }}
                    className="flex-1 rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    📁 Library
                  </button>
                  <button
                    type="button"
                    onClick={captureProfilePhoto}
                    className="flex-1 rounded-xl bg-[#0f2040] px-5 py-3 text-sm font-semibold text-white shadow hover:bg-[#162d55]"
                  >
                    📸 Capture
                  </button>
                </div>
                {profilePhotoUrl && (
                  <button
                    type="button"
                    onClick={() => { closeProfileCamera(); removeProfilePhoto() }}
                    className="w-full rounded-xl border border-red-200 px-5 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    🗑 Remove Photo
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </main>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-800">{value}</p>
    </div>
  )
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'No date'
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function toTitleCase(str: string | null | undefined): string {
  if (!str) return 'Visit'
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function NoteBlock({
  label,
  value,
}: {
  label: string
  value: string | null
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      <p className="mt-1 text-sm text-slate-600">{value || '—'}</p>
    </div>
  )
}