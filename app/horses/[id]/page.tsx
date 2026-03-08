'use client'

import Link from 'next/link'
import { ChangeEvent, useEffect, useMemo, useState } from 'react'
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
  archived: boolean
  medical_alerts?: string | null
  history_notes?: string | null
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

  const [owners, setOwners] = useState<Owner[]>([])
  const [horse, setHorse] = useState<Horse | null>(null)
  const [ownerOtherHorses, setOwnerOtherHorses] = useState<Horse[]>([])
  const [selectedOwnerHorseId, setSelectedOwnerHorseId] = useState('')
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
  const [horseOwnerIdEdit, setHorseOwnerIdEdit] = useState('')

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

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
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
    setHorseOwnerIdEdit(data.owner_id || '')

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
      setMessage('Horse name is required.')
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
      })
      .eq('id', horseId)

    if (error) {
      setMessage(`Error updating horse: ${error.message}`)
      return
    }

    setEditingHorse(false)
    setEditingOwner(false)
    setMessage('Horse info updated successfully. History preserved with the horse record.')
    await loadHorse()
    await loadOwnerOtherHorses(horseOwnerIdEdit)
    await loadVisits()
  }

  function cancelHorseEdit() {
    setEditingHorse(false)
    setHorseNameEdit(horse?.name || '')
    setHorseBreedEdit(horse?.breed || '')
    setHorseSexEdit(horse?.sex || '')
    setHorseAgeEdit(horse?.age || '')
    setHorseDisciplineEdit(horse?.discipline || '')
    setHorseBarnLocationEdit(horse?.barn_location || '')
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

  function startEditVisit(visit: Visit) {
    const derivedTreatedAreas =
      anatomyRegionNamesByVisit[visit.id]?.length
        ? anatomyRegionNamesByVisit[visit.id].join(', ')
        : ''

    setEditingVisitId(visit.id)
    setVisitDate(visit.visit_date || '')
    setVisitLocation(visit.location || '')
    setProviderName(visit.provider_name || 'Dr. Andrew Leo')
    setReasonForVisit(visit.reason_for_visit || '')
    setQuickNotes('')
    setSubjective(visit.subjective || '')
    setObjective(visit.objective || '')
    setAssessment(visit.assessment || '')
    setPlan(visit.plan || '')
    setTreatedAreas(visit.treated_areas || derivedTreatedAreas || '')
    setRecommendations(visit.recommendations || '')
    setFollowUp(visit.follow_up || '')
    setAutoEmailAfterSave(false)

    window.scrollTo({ top: 0, behavior: 'smooth' })
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
    } else {
      setOwnerOtherHorses([])
      setSelectedOwnerHorseId('')
    }
  }, [horse?.owner_id])

  useEffect(() => {
    setSelectedOwnerHorseId(horseId)
  }, [horseId])

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-slate-700">Checking login...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <Link
                href="/"
                className="text-sm font-medium text-slate-500 hover:text-slate-900"
              >
                ← Back to Dashboard
              </Link>

              <h1 className="mt-3 text-3xl font-bold text-slate-900">
                {horse?.name || 'Horse Record'}
              </h1>

              <p className="mt-2 text-slate-600">
                {horse?.breed || '—'} • {horse?.sex || '—'} • {horse?.age || '—'} • {horse?.discipline || '—'} • {horse?.barn_location || '—'}
              </p>
            </div>

            <div className="flex flex-col gap-2 md:items-end">
              <p className="text-sm text-slate-500">
                Signed in as: {userEmail || 'Unknown user'}
              </p>
              <button
                onClick={handleSignOut}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-900">Horse Info</h2>
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
                  <InfoRow label="Horse Name" value={horse?.name || '—'} />
                  <InfoRow label="Breed" value={horse?.breed || '—'} />
                  <InfoRow label="Sex" value={horse?.sex || '—'} />
                  <InfoRow label="Age" value={horse?.age || '—'} />
                  <InfoRow label="Discipline" value={horse?.discipline || '—'} />
                  <InfoRow label="Barn" value={horse?.barn_location || '—'} />
                  <InfoRow label="Owner" value={horse?.owners?.full_name || '—'} />
                </div>
              ) : (
                <div className="mt-4 grid gap-4">
                  <Field label="Horse Name">
                    <input
                      value={horseNameEdit}
                      onChange={(e) => setHorseNameEdit(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Horse name"
                    />
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
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Gelding">Gelding</option>
                      <option value="Mare">Mare</option>
                      <option value="Stallion">Stallion</option>
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

                  <Field label="Discipline">
                    <input
                      value={horseDisciplineEdit}
                      onChange={(e) => setHorseDisciplineEdit(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Discipline"
                    />
                  </Field>

                  <Field label="Barn Location">
                    <input
                      value={horseBarnLocationEdit}
                      onChange={(e) => setHorseBarnLocationEdit(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Barn location"
                    />
                  </Field>

                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                    New owner after save: <span className="font-semibold">{currentHorseOwnerName}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={saveHorseInfo}
                      className="rounded-xl bg-slate-900 px-4 py-3 text-sm text-white"
                    >
                      Save Horse Info
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

            <div className="rounded-3xl bg-white p-6 shadow-sm">
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
                      className="rounded-xl bg-slate-900 px-4 py-3 text-sm text-white"
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

            <div className="rounded-3xl bg-white p-6 shadow-sm">
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
                        {visit.visit_date || 'No date'} - {visit.reason_for_visit || 'Visit'}
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
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  />
                </Field>

                <button
                  onClick={addPhoto}
                  disabled={uploadingPhoto}
                  className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50"
                >
                  {uploadingPhoto ? 'Uploading Photo...' : 'Upload Photo'}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
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
                      className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm text-white"
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

                <Field label="Provider Name">
                  <input
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    placeholder="Provider"
                  />
                </Field>

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
                    <textarea
                      value={quickNotes}
                      onChange={(e) => setQuickNotes(e.target.value)}
                      className="min-h-32 w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder={`Example:
stiff left shoulder
shortened stride at trot
improved after adjustment
recommend 2 light days`}
                    />
                  </Field>

                  <div className="mt-3">
                    <button
                      onClick={generateSoap}
                      disabled={generatingSoap}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 disabled:opacity-50"
                    >
                      {generatingSoap ? 'Generating SOAP...' : 'Generate SOAP'}
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

                <Field label="Treated Areas">
                  <div className="space-y-2">
                    <input
                      value={treatedAreas}
                      onChange={(e) => setTreatedAreas(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Shoulder, thoracic, cervical, etc."
                    />
                    {editingVisitId && activeVisitRegionNames.length > 0 ? (
                      <button
                        type="button"
                        onClick={useAnatomyRegionsForTreatedAreas}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900"
                      >
                        Use Anatomy Regions
                      </button>
                    ) : null}
                  </div>
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
                    className="rounded-xl bg-slate-900 px-5 py-3 text-white"
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

            <div className="rounded-3xl bg-white p-6 shadow-sm">
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
                              {visit.reason_for_visit || 'Visit'}
                            </p>
                            <p className="text-sm text-slate-500">
                              {visit.visit_date || 'No date'}
                            </p>

                            <div className="mt-2">
                              {anatomyRegionCounts[visit.id] ? (
                                <span className="inline-flex rounded-2xl bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                                  Anatomy Notes: {anatomyRegionCounts[visit.id]} region
                                  {anatomyRegionCounts[visit.id] === 1 ? '' : 's'}
                                </span>
                              ) : (
                                <span className="inline-flex rounded-2xl bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                                  No anatomy notes yet
                                </span>
                              )}
                            </div>

                            {anatomyRegionNamesByVisit[visit.id]?.length ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {anatomyRegionNamesByVisit[visit.id].map((regionName) => (
                                  <span
                                    key={`${visit.id}-${regionName}`}
                                    className="inline-flex rounded-2xl bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
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
                              className="rounded-xl border border-slate-900 bg-slate-900 px-3 py-2 text-sm text-white"
                            >
                              Open Anatomy
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

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <NoteBlock label="Subjective" value={visit.subjective} />
                          <NoteBlock label="Objective" value={visit.objective} />
                          <NoteBlock label="Assessment" value={visit.assessment} />
                          <NoteBlock label="Plan" value={visit.plan} />
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <p className="text-sm text-slate-700">
                            <span className="font-medium">Treated Areas:</span> {visit.treated_areas || '—'}
                          </p>
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

            <div className="rounded-3xl bg-white p-6 shadow-sm">
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
                              Date Taken: {photo.taken_at || '—'}
                            </p>
                            <p className="text-sm text-slate-600">
                              Visit Date: {photo.visits?.visit_date || '—'}
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
        </div>
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