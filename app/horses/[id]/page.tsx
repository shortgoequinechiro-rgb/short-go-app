'use client'

import Link from 'next/link'
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

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
  species: 'equine' | 'canine' | null
  archived: boolean
  medical_alerts?: string | null
  history_notes?: string | null
  behavioral_notes?: string | null
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
  providerName: 'Dr. Andrew Leo',
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
  const horseId = params.id as string

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'info' | 'visits' | 'photos'>('visits')

  const [owners, setOwners] = useState<Owner[]>([])
  const [horse, setHorse] = useState<Horse | null>(null)
  const [ownerOtherHorses, setOwnerOtherHorses] = useState<Horse[]>([])
  const [selectedOwnerHorseId, setSelectedOwnerHorseId] = useState('')
  const [consentOnFile, setConsentOnFile] = useState<{ signed_at: string; signed_name: string } | null | undefined>(undefined)
  const [upcomingAppointments, setUpcomingAppointments] = useState<{ id: string; appointment_date: string; appointment_time: string | null; reason: string | null; status: string }[]>([])
  type IntakeForm = { id: string; submitted_at: string; signed_name: string | null; animal_name: string; reason_for_care: string | null; health_problems: string | null; medications_supplements: string | null; previous_chiro_care: boolean | null; referral_source: string[] | null }
  const [intakeForms, setIntakeForms] = useState<IntakeForm[]>([])

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
  const [horseSpeciesEdit, setHorseSpeciesEdit] = useState<'equine' | 'canine'>('equine')
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
  const [providerName, setProviderName] = useState('Dr. Andrew Leo')
  const [reasonForVisit, setReasonForVisit] = useState('')
  const [quickNotes, setQuickNotes] = useState('')
  const [subjective, setSubjective] = useState('')
  const [objective, setObjective] = useState('')
  const [assessment, setAssessment] = useState('')
  const [plan, setPlan] = useState('')
  const [treatedAreas, setTreatedAreas] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [followUp, setFollowUp] = useState('')

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

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return false
    }

    setUserEmail(user.email || '')
    setCheckingAuth(false)
    return true
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
      setMessage(`Error loading owners: ${error.message}`)
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
    setHorseSpeciesEdit((data.species as 'equine' | 'canine') || 'equine')
    setHorseOwnerIdEdit(data.owner_id || '')
    setBehavioralNotesEdit(data.behavioral_notes || '')

    setOwnerNameEdit(data.owners?.full_name || '')
    setOwnerPhoneEdit(data.owners?.phone || '')
    setOwnerEmailEdit(data.owners?.email || '')
    setOwnerAddressEdit(data.owners?.address || '')

    if (data.owner_id) saveRecentOwner(data.owner_id)
    saveRecentHorse(data.id)
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
      setMessage(`Error loading visits: ${error.message}`)
      return
    }

    const visitData = (data || []) as Visit[]
    setVisits(visitData)

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

  async function saveHorseInfo() {
    setMessage('')

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

  async function saveBehavioralNotes() {
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
    setHorseSpeciesEdit((horse?.species as 'equine' | 'canine') || 'equine')
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
    setVisitDate(emptyVisitForm.visitDate)
    setVisitLocation(emptyVisitForm.visitLocation)
    setProviderName(emptyVisitForm.providerName)
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
  }

  async function startEditVisit(visit: Visit) {
    const derivedTreatedAreas =
      anatomyRegionNamesByVisit[visit.id]?.length
        ? anatomyRegionNamesByVisit[visit.id].join(', ')
        : ''

    setEditingVisitId(visit.id)
    setVisitDate(visit.visit_date || '')
    setVisitLocation(visit.location || '')
    setProviderName(visit.provider_name || 'Dr. Andrew Leo')
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

    if (autoEmailAfterSave && savedVisitId) {
      try {
        setMessage('Visit saved. Sending PDF to owner...')
        await sendVisitEmail(savedVisitId)
        setMessage('Visit saved and PDF emailed successfully.')
      } catch (error: any) {
        setMessage(`Visit saved, but email failed: ${error?.message || 'Unknown error'}`)
      }
    }

    resetVisitForm()
    await loadVisits()
  }

  async function deleteVisit(visitId: string) {
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

  async function sendOwnerSummary(visitId: string) {
    setSendingOwnerSummaryId(visitId)
    setMessage('Generating & sending owner summary…')
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
    }

    init()
  }, [horseId])

  useEffect(() => {
    if (horse?.owner_id) {
      loadOwnerOtherHorses(horse.owner_id)

      // Load consent status for this owner
      async function loadConsent() {
        try {
          const { data } = await supabase
            .from('consent_forms')
            .select('signed_at, signed_name')
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
        .select('id, submitted_at, signed_name, animal_name, reason_for_care, health_problems, medications_supplements, previous_chiro_care, referral_source')
        .eq('horse_id', horseId)
        .order('submitted_at', { ascending: false })
      setIntakeForms(data || [])
    }
    loadIntakeForms()
  }, [horseId])

  // Load upcoming appointments for this horse
  useEffect(() => {
    if (!horseId) return
    async function loadAppts() {
      const today = new Date().toISOString().split('T')[0]
      try {
        const { data } = await supabase
          .from('appointments')
          .select('id, appointment_date, appointment_time, reason, status')
          .eq('horse_id', horseId)
          .gte('appointment_date', today)
          .neq('status', 'cancelled')
          .order('appointment_date', { ascending: true })
          .limit(3)
        setUpcomingAppointments(data || [])
      } catch {
        setUpcomingAppointments([])
      }
    }
    loadAppts()
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
    <main className="min-h-screen bg-[#edf2f7] p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-3xl bg-white p-6 shadow-md">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold text-slate-900">
              {horse?.name || 'Patient Record'}
            </h1>
            {horse?.species === 'canine' ? (
              <span className="rounded-xl bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">🐕 Canine</span>
            ) : (
              <span className="rounded-xl bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">🐴 Equine</span>
            )}
            {horse?.behavioral_notes && (
              <span className="rounded-xl bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
                ⚠️ Behavioral Alert
              </span>
            )}
            {horse?.owner_id && consentOnFile !== undefined && (
              consentOnFile ? (
                <span className="rounded-xl bg-emerald-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
                  ✓ Consent on File
                </span>
              ) : (
                <span className="rounded-xl bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
                  ✗ No Consent
                </span>
              )
            )}
          </div>
          <p className="mt-2 text-slate-600">
            {horse?.breed || '—'} • {horse?.sex || '—'} • {horse?.age || '—'} • {horse?.discipline || '—'} • {horse?.barn_location || '—'}
          </p>
          {horse?.medical_alerts && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="mt-0.5 text-lg leading-none">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-amber-900">Medical Alerts</p>
                <p className="mt-0.5 text-sm text-amber-800">{horse.medical_alerts}</p>
              </div>
            </div>
          )}
        </div>

        {/* Tab navigation */}
        <div className="mt-6 flex gap-1 rounded-2xl bg-[#edf2f7] p-1.5 shadow-sm">
          {(['visits', 'info', 'photos'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-[#0f2040] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white hover:shadow-sm'
              }`}
            >
              {tab === 'info' ? 'Info' : tab === 'visits' ? 'Visits' : 'Photos'}
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
                  <button
                    onClick={() => setEditingHorse(true)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    Edit
                  </button>
                ) : null}
              </div>

              {!editingHorse ? (
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  <InfoRow label="Patient Name" value={horse?.name || '—'} />
                  <InfoRow label="Species" value={horse?.species === 'canine' ? 'Canine (Dog)' : 'Equine (Horse)'} />
                  <InfoRow label="Breed" value={horse?.breed || '—'} />
                  <InfoRow label="Sex" value={horse?.sex || '—'} />
                  <InfoRow label="Age" value={horse?.age || '—'} />
                  <InfoRow label={horse?.species === 'canine' ? 'Activity / Sport' : 'Discipline'} value={horse?.discipline || '—'} />
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
                      placeholder={horseSpeciesEdit === 'canine' ? 'Dog name' : 'Horse name'}
                    />
                  </Field>

                  <Field label="Species">
                    <select
                      value={horseSpeciesEdit}
                      onChange={(e) => setHorseSpeciesEdit(e.target.value as 'equine' | 'canine')}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    >
                      <option value="equine">Equine (Horse)</option>
                      <option value="canine">Canine (Dog)</option>
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

                  <Field label={horseSpeciesEdit === 'canine' ? 'Activity / Sport' : 'Discipline'}>
                    <input
                      value={horseDisciplineEdit}
                      onChange={(e) => setHorseDisciplineEdit(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder={horseSpeciesEdit === 'canine' ? 'Agility, hunting, sport, etc.' : 'Discipline'}
                    />
                  </Field>

                  <Field label="Location">
                    <input
                      value={horseBarnLocationEdit}
                      onChange={(e) => setHorseBarnLocationEdit(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder={horseSpeciesEdit === 'canine' ? 'City, kennel, or home' : 'Barn location'}
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
            {intakeForms.length > 0 && (
              <div className="rounded-3xl bg-white p-6 shadow-md">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg leading-none">📋</span>
                  <h2 className="text-xl font-semibold text-slate-900">Intake Forms</h2>
                </div>
                <div className="space-y-4">
                  {intakeForms.map((form) => (
                    <div key={form.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {form.animal_name}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Signed by {form.signed_name || '—'} · {new Date(form.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-xl bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">✓ Signed</span>
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-600">
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
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-3xl bg-white p-6 shadow-md">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-900">Owner Info</h2>
                {!editingOwner ? (
                  <button
                    onClick={() => setEditingOwner(true)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    Edit
                  </button>
                ) : null}
              </div>

              {!editingOwner ? (
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  <InfoRow label="Owner" value={horse?.owners?.full_name || '—'} />
                  <InfoRow label="Phone" value={formatPhone(horse?.owners?.phone)} />
                  <InfoRow label="Email" value={horse?.owners?.email || '—'} />
                  <InfoRow label="Address" value={horse?.owners?.address || '—'} />

                  {/* Consent status */}
                  {horse?.owner_id && consentOnFile !== undefined && (
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {consentOnFile ? (
                            <>
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">✓</span>
                              <div>
                                <p className="text-xs font-semibold text-emerald-700">Consent on file</p>
                                <p className="text-xs text-slate-400">
                                  Signed {new Date(consentOnFile.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-xs font-bold">!</span>
                              <p className="text-xs font-semibold text-amber-700">No consent on file</p>
                            </>
                          )}
                        </div>
                        <Link
                          href={`/consent/${horse.owner_id}?horseId=${horseId}`}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
                        >
                          {consentOnFile ? 'View / Renew' : 'Get Consent →'}
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 grid gap-4">
                  <Field label="Owner Name">
                    <input
                      value={ownerNameEdit}
                      onChange={(e) => setOwnerNameEdit(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Owner name"
                    />
                  </Field>

                  <Field label="Phone">
                    <input
                      value={ownerPhoneEdit}
                      onChange={(e) => setOwnerPhoneEdit(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Phone"
                    />
                  </Field>

                  <Field label="Email">
                    <input
                      value={ownerEmailEdit}
                      onChange={(e) => setOwnerEmailEdit(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Email"
                    />
                  </Field>

                  <Field label="Address">
                    <textarea
                      value={ownerAddressEdit}
                      onChange={(e) => setOwnerAddressEdit(e.target.value)}
                      className="min-h-[96px] w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Owner address"
                    />
                  </Field>

                  <div className="flex gap-2">
                    <button
                      onClick={saveOwnerInfo}
                      className="rounded-xl bg-[#0f2040] px-4 py-3 text-sm text-white hover:bg-[#162d55] transition-colors"
                    >
                      Save Owner Info
                    </button>
                    <button
                      onClick={cancelOwnerEdit}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-5 border-t border-slate-200 pt-5">
                <Field label="Other Horses For This Owner">
                  <select
                    value={selectedOwnerHorseId}
                    onChange={(e) => handleOwnerHorseJump(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  >
                    <option value="">Select a horse</option>
                    {ownerOtherHorses.map((ownerHorse) => (
                      <option key={ownerHorse.id} value={ownerHorse.id}>
                        {ownerHorse.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>

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

            {/* ── Upcoming Appointments Banner ── */}
            <div className="rounded-3xl border border-blue-100 bg-white px-6 py-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-slate-900">Upcoming Appointments</span>
                  {upcomingAppointments.length > 0 && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">{upcomingAppointments.length}</span>
                  )}
                </div>
                <Link
                  href={`/appointments?horseId=${horseId}`}
                  className="shrink-0 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition"
                >
                  + Book
                </Link>
              </div>
              {upcomingAppointments.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">No upcoming appointments. Book one to get started.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {upcomingAppointments.map(a => {
                    const [y, m, d] = a.appointment_date.split('-').map(Number)
                    const dateStr = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                    const timeStr = a.appointment_time ? (() => { const [h, min] = a.appointment_time!.split(':').map(Number); const ampm = h >= 12 ? 'PM' : 'AM'; return ` · ${h % 12 || 12}:${String(min).padStart(2, '0')} ${ampm}` })() : ''
                    return (
                      <div key={a.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2.5">
                        <div>
                          <span className="text-sm font-medium text-slate-800">{dateStr}{timeStr}</span>
                          {a.reason && <span className="ml-2 text-xs text-slate-500">{a.reason}</span>}
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                          {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                        </span>
                      </div>
                    )
                  })}
                  <Link href={`/appointments?horseId=${horseId}`} className="block text-xs text-center text-slate-400 hover:text-slate-600 pt-1">
                    View all appointments →
                  </Link>
                </div>
              )}
            </div>

            {/* Spine Assessment + Progress Tracker Banners */}
            <div className="flex items-center justify-between rounded-3xl border border-[#0f2040]/10 bg-white px-6 py-4 shadow-md">
              <div>
                <p className="font-semibold text-slate-900">Spine Assessment</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {editingVisitId
                    ? 'Linked to the visit you\'re editing — results will appear in the PDF.'
                    : 'Check each spinal segment for left / right issues.'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/horses/${horse?.id}/progress`}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Progress
                </Link>
                <Link
                  href={editingVisitId
                    ? `/horses/${horse?.id}/spine?visitId=${editingVisitId}&species=${horse?.species || 'equine'}`
                    : `/horses/${horse?.id}/spine?species=${horse?.species || 'equine'}`}
                  className="rounded-2xl bg-[#0f2040] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#162d55]"
                >
                  Open →
                </Link>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-md">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 className="text-2xl font-semibold text-slate-900">
                  {editingVisitId ? 'Edit Visit' : 'Add Visit'}
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
                ) : null}
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

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={generateSoap}
                      disabled={generatingSoap}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 disabled:opacity-50"
                    >
                      {generatingSoap ? 'Generating SOAP...' : 'Generate SOAP'}
                    </button>
                    {quickNotes && (
                      <button
                        type="button"
                        onClick={() => setQuickNotes('')}
                        className="rounded-xl border border-slate-200 px-3 py-3 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <Field label="Subjective">
                  <textarea
                    value={subjective}
                    onChange={(e) => setSubjective(e.target.value)}
                    className="min-h-28 w-full rounded-xl border border-slate-300 px-4 py-3"
                    placeholder="What the owner reports"
                  />
                </Field>

                <Field label="Objective">
                  <textarea
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    className="min-h-28 w-full rounded-xl border border-slate-300 px-4 py-3"
                    placeholder="Observed findings"
                  />
                </Field>

                <Field label="Assessment">
                  <textarea
                    value={assessment}
                    onChange={(e) => setAssessment(e.target.value)}
                    className="min-h-28 w-full rounded-xl border border-slate-300 px-4 py-3"
                    placeholder="Clinical impression"
                  />
                </Field>

                <Field label="Plan">
                  <textarea
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    className="min-h-28 w-full rounded-xl border border-slate-300 px-4 py-3"
                    placeholder="Treatment plan / next steps"
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
                            <Link
                              href={`/anatomy?visitId=${visit.id}&horseName=${encodeURIComponent(horse?.name || '')}`}
                              className="rounded-xl border border-[#0f2040] bg-[#0f2040] px-3 py-2 text-sm text-white hover:bg-[#162d55] transition-colors"
                            >
                              Open Anatomy
                            </Link>

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
                              onClick={() => sendOwnerSummary(visit.id)}
                              disabled={sendingOwnerSummaryId === visit.id}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
                            >
                              {sendingOwnerSummaryId === visit.id ? 'Sending…' : 'Owner Summary'}
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
      </div>
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