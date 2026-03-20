'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type Owner = {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  address: string | null
  archived: boolean
  created_at: string
}

type Horse = {
  id: string
  owner_id: string | null
  name: string
  breed: string | null
  discipline: string | null
  barn_location: string | null
  age: string | null
  sex: string | null
  species: 'equine' | 'canine' | null
  archived: boolean
  created_at: string
  profile_photo_path?: string | null
  owners?: {
    full_name: string
  } | null
}

type Visit = {
  id: string
  horse_id: string
  visit_date: string | null
  reason_for_visit: string | null
  horses?: {
    name: string
    owners?: {
      full_name: string
    } | null
  } | null
}

type TodayAppointment = {
  id: string
  owner_id: string | null
  appointment_time: string | null
  duration_minutes: number | null
  reason: string | null
  status: string
  location: string | null
  notes: string | null
  owners?: { full_name: string; phone: string | null } | null
  horses?: {
    id: string
    name: string
    species?: 'equine' | 'canine' | null
    owners?: { full_name: string; phone: string | null } | null
  } | null
}

const RECENT_OWNER_IDS_KEY = 'shortgo_recent_owner_ids'
const RECENT_HORSE_IDS_KEY = 'shortgo_recent_horse_ids'

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return 'No phone'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

export default function Home() {
  const router = useRouter()

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [practitionerLogoUrl, setPractitionerLogoUrl] = useState<string | null>(null)
  const [practitionerName, setPractitionerName] = useState('')
  const [message, setMessage] = useState('')

  const [owners, setOwners] = useState<Owner[]>([])
  const [horses, setHorses] = useState<Horse[]>([])
  const [visitCount, setVisitCount] = useState(0)
  const [photoCount, setPhotoCount] = useState(0)
  const [visitCountsByHorse, setVisitCountsByHorse] = useState<Record<string, number>>({})
  const [horsePhotoUrls, setHorsePhotoUrls] = useState<Record<string, string>>({})
  const [recentVisits, setRecentVisits] = useState<Visit[]>([])
  const [todayAppointments, setTodayAppointments] = useState<TodayAppointment[]>([])

  const findRecordsRef = useRef<HTMLDivElement>(null)

  function handleStatCardClick() {
    setTimeout(() => {
      findRecordsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')

  const [selectedOwnerIdForAdd, setSelectedOwnerIdForAdd] = useState('')
  const [horseName, setHorseName] = useState('')
  const [horseBreed, setHorseBreed] = useState('')
  const [horseDiscipline, setHorseDiscipline] = useState('')
  const [horseAge, setHorseAge] = useState('')
  const [horseGender, setHorseGender] = useState('')
  const [addSpecies, setAddSpecies] = useState<'equine' | 'canine'>('equine')

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null)

  const [sendingIntake, setSendingIntake] = useState(false)
  const [sendingIntakeSms, setSendingIntakeSms] = useState(false)
  const [sendingConsent, setSendingConsent] = useState(false)
  const [sendingConsentSms, setSendingConsentSms] = useState(false)
  const [editingOwner, setEditingOwner] = useState(false)

  // Inline add patient (in owner panel)
  const [showInlineAddPatient, setShowInlineAddPatient] = useState(false)
  const [inlineHorseName, setInlineHorseName] = useState('')
  const [inlineHorseBreed, setInlineHorseBreed] = useState('')
  const [inlineHorseDiscipline, setInlineHorseDiscipline] = useState('')
  const [inlineHorseAge, setInlineHorseAge] = useState('')
  const [inlineHorseGender, setInlineHorseGender] = useState('')
  const [inlineSpecies, setInlineSpecies] = useState<'equine' | 'canine'>('equine')

  // Modal visibility
  const [showAddOwnerModal, setShowAddOwnerModal] = useState(false)
  const [showAddPatientModal, setShowAddPatientModal] = useState(false)

  // ── Book Appointment Modal ──────────────────────────────────────────────────
  const [showBookModal, setShowBookModal] = useState(false)
  const [bookForm, setBookForm] = useState({
    owner_id: '',
    appointment_date: '',
    appointment_time: '09:00',
    location: '',
    reason: '',
    status: 'scheduled' as 'scheduled' | 'confirmed' | 'completed' | 'cancelled',
    provider_name: '',
    notes: '',
  })
  const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([])
  const [bookSaving, setBookSaving] = useState(false)
  const [bookFormMsg, setBookFormMsg] = useState('')
  const [bookOwnerSearch, setBookOwnerSearch] = useState('')
  const [showBookOwnerSuggestions, setShowBookOwnerSuggestions] = useState(false)
  const bookLocationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [bookLocationSuggestions, setBookLocationSuggestions] = useState<{ description: string; place_id: string }[]>([])
  const [showBookLocationSuggestions, setShowBookLocationSuggestions] = useState(false)

  const filteredBookOwners = useMemo(() => {
    const q = bookOwnerSearch.trim().toLowerCase()
    if (!q) return owners
    return owners.filter(o => o.full_name.toLowerCase().includes(q))
  }, [owners, bookOwnerSearch])

  // Patients belonging to the selected owner
  const ownerPatients = useMemo(() => {
    if (!bookForm.owner_id) return []
    return horses.filter(h => h.owner_id === bookForm.owner_id && !h.archived)
  }, [horses, bookForm.owner_id])

  const bookDuration = selectedPatientIds.length > 0 ? selectedPatientIds.length * 15 : 15

  function togglePatient(id: string) {
    setSelectedPatientIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  function openBookModal() {
    const today = new Date()
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    setBookForm({
      owner_id: '', appointment_date: iso, appointment_time: '09:00',
      location: '', reason: '', status: 'scheduled',
      provider_name: practitionerName, notes: '',
    })
    setSelectedPatientIds([])
    setBookOwnerSearch('')
    setShowBookOwnerSuggestions(false)
    setBookFormMsg('')
    setShowBookModal(true)
  }

  function handleBookLocationChange(value: string) {
    setBookForm(f => ({ ...f, location: value }))
    if (bookLocationDebounceRef.current) clearTimeout(bookLocationDebounceRef.current)
    if (value.trim().length < 2) {
      setBookLocationSuggestions([]); setShowBookLocationSuggestions(false); return
    }
    bookLocationDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?input=${encodeURIComponent(value)}`)
        const data = await res.json()
        if (data.predictions?.length > 0) {
          setBookLocationSuggestions(data.predictions); setShowBookLocationSuggestions(true)
        } else {
          setBookLocationSuggestions([]); setShowBookLocationSuggestions(false)
        }
      } catch { setBookLocationSuggestions([]); setShowBookLocationSuggestions(false) }
    }, 300)
  }

  async function saveBooking() {
    if (!bookForm.owner_id || !bookForm.appointment_date) {
      setBookFormMsg('Owner and date are required.'); return
    }
    setBookSaving(true); setBookFormMsg('')
    const { error } = await supabase.from('appointments').insert({
      horse_id: selectedPatientIds.length === 1 ? selectedPatientIds[0] : null,
      owner_id: bookForm.owner_id,
      appointment_date: bookForm.appointment_date,
      appointment_time: bookForm.appointment_time || null,
      duration_minutes: bookDuration,
      location: bookForm.location || null,
      reason: bookForm.reason || null,
      status: bookForm.status,
      provider_name: bookForm.provider_name || null,
      notes: selectedPatientIds.length > 1
        ? [
            `Patients: ${selectedPatientIds.map(id => horses.find(h => h.id === id)?.name || 'Unknown').join(', ')}`,
            bookForm.notes,
          ].filter(Boolean).join('\n')
        : bookForm.notes || null,
      practitioner_id: userId,
    })
    setBookSaving(false)
    if (error) { setBookFormMsg(`Error: ${error.message}`); return }
    await loadTodayAppointments()
    setShowBookModal(false)
  }

  const [ownerNameEdit, setOwnerNameEdit] = useState('')
  const [ownerPhoneEdit, setOwnerPhoneEdit] = useState('')
  const [ownerEmailEdit, setOwnerEmailEdit] = useState('')
  const [ownerAddressEdit, setOwnerAddressEdit] = useState('')

  const [recentOwnerIds, setRecentOwnerIds] = useState<string[]>([])
  const [recentHorseIds, setRecentHorseIds] = useState<string[]>([])

  // Intake / consent status per owner
  const [ownerIntakeStatus, setOwnerIntakeStatus] = useState<Record<string, boolean>>({})
  const [ownerConsentStatus, setOwnerConsentStatus] = useState<Record<string, boolean>>({})

  // ── Address autocomplete ─────────────────────────────────────────────────────
  const addAddressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editAddressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [addAddressSuggestions, setAddAddressSuggestions] = useState<{ description: string; place_id: string }[]>([])
  const [showAddAddressSuggestions, setShowAddAddressSuggestions] = useState(false)
  const [editAddressSuggestions, setEditAddressSuggestions] = useState<{ description: string; place_id: string }[]>([])
  const [showEditAddressSuggestions, setShowEditAddressSuggestions] = useState(false)

  async function fetchAddressSuggestions(value: string) {
    if (value.trim().length < 2) return []
    try {
      const res = await fetch(`/api/places?input=${encodeURIComponent(value)}`)
      const data = await res.json()
      return data.predictions || []
    } catch {
      return []
    }
  }

  function handleAddAddressChange(value: string) {
    setAddress(value)
    if (addAddressDebounceRef.current) clearTimeout(addAddressDebounceRef.current)
    if (value.trim().length < 2) { setAddAddressSuggestions([]); setShowAddAddressSuggestions(false); return }
    addAddressDebounceRef.current = setTimeout(async () => {
      const results = await fetchAddressSuggestions(value)
      setAddAddressSuggestions(results)
      setShowAddAddressSuggestions(results.length > 0)
    }, 300)
  }

  function handleEditAddressChange(value: string) {
    setOwnerAddressEdit(value)
    if (editAddressDebounceRef.current) clearTimeout(editAddressDebounceRef.current)
    if (value.trim().length < 2) { setEditAddressSuggestions([]); setShowEditAddressSuggestions(false); return }
    editAddressDebounceRef.current = setTimeout(async () => {
      const results = await fetchAddressSuggestions(value)
      setEditAddressSuggestions(results)
      setShowEditAddressSuggestions(results.length > 0)
    }, 300)
  }

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return false
    }

    setUserEmail(user.email || '')
    setUserId(user.id)

    // Fetch practitioner data
    const { data: practitioner } = await supabase
      .from('practitioners')
      .select('logo_url, full_name')
      .eq('id', user.id)
      .single()
    if (practitioner?.logo_url) {
      setPractitionerLogoUrl(practitioner.logo_url)
    }
    if (practitioner?.full_name) {
      setPractitionerName(practitioner.full_name)
    }

    setCheckingAuth(false)
    return true
  }

  async function loadOwners() {
    const { data, error } = await supabase
      .from('owners')
      .select('*')
      .eq('archived', false)
      .order('full_name', { ascending: true })

    if (error) {
      setMessage(`Error loading owners: ${error.message}`)
      return
    }

    const ownerData = (data || []) as Owner[]
    setOwners(ownerData)

    if (!selectedOwnerIdForAdd && ownerData.length > 0) {
      setSelectedOwnerIdForAdd(ownerData[0].id)
    }
  }

  async function loadHorses() {
    const { data, error } = await supabase
      .from('horses')
      .select(
        `
        *,
        owners (
          full_name
        )
      `
      )
      .eq('archived', false)
      .order('name', { ascending: true })

    if (error) {
      setMessage(`Error loading horses: ${error.message}`)
      return
    }

    const horseList = (data || []) as Horse[]
    setHorses(horseList)

    // Generate signed URLs for horses that have a profile photo (7-day expiry)
    const urlMap: Record<string, string> = {}
    await Promise.all(
      horseList
        .filter(h => h.profile_photo_path)
        .map(async (h) => {
          const { data: signedData } = await supabase.storage
            .from('horse-photos')
            .createSignedUrl(h.profile_photo_path!, 604800)
          if (signedData?.signedUrl) urlMap[h.id] = signedData.signedUrl
        })
    )
    setHorsePhotoUrls(urlMap)
  }

  async function loadVisitCount() {
    const { count, error } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })

    if (error) {
      setMessage(`Error loading visit count: ${error.message}`)
      return
    }

    setVisitCount(count || 0)
  }

  async function loadPhotoCount() {
    const { count, error } = await supabase
      .from('photos')
      .select('*', { count: 'exact', head: true })

    if (error) {
      setMessage(`Error loading photo count: ${error.message}`)
      return
    }

    setPhotoCount(count || 0)
  }

  async function loadVisitData() {
    const { data, error } = await supabase
      .from('visits')
      .select(`
        id,
        horse_id,
        visit_date,
        reason_for_visit,
        horses (
          name,
          owners (
            full_name
          )
        )
      `)
      .order('visit_date', { ascending: false })
      .limit(100)

    if (error) return

    const visitData = (data || []) as unknown as Visit[]

    const counts: Record<string, number> = {}
    for (const visit of visitData) {
      counts[visit.horse_id] = (counts[visit.horse_id] || 0) + 1
    }
    setVisitCountsByHorse(counts)
    setRecentVisits(visitData.slice(0, 15))
  }

  async function loadTodayAppointments() {
    const today = new Date()
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        owner_id,
        appointment_time,
        duration_minutes,
        reason,
        status,
        location,
        notes,
        owners ( full_name, phone ),
        horses (
          id,
          name,
          species,
          owners ( full_name, phone )
        )
      `)
      .eq('appointment_date', iso)
      .neq('status', 'cancelled')
      .order('appointment_time', { ascending: true })

    if (!error) setTodayAppointments((data || []) as unknown as TodayAppointment[])
  }

  async function loadFormStatuses() {
    const [intakeRes, consentRes] = await Promise.all([
      supabase.from('intake_forms').select('owner_id'),
      supabase.from('consent_forms').select('owner_id'),
    ])

    if (!intakeRes.error && intakeRes.data) {
      const map: Record<string, boolean> = {}
      for (const row of intakeRes.data) {
        if (row.owner_id) map[row.owner_id] = true
      }
      setOwnerIntakeStatus(map)
    }

    if (!consentRes.error && consentRes.data) {
      const map: Record<string, boolean> = {}
      for (const row of consentRes.data) {
        if (row.owner_id) map[row.owner_id] = true
      }
      setOwnerConsentStatus(map)
    }
  }

  function loadRecentItems() {
    if (typeof window === 'undefined') return

    try {
      const storedOwnerIds = window.localStorage.getItem(RECENT_OWNER_IDS_KEY)
      const storedHorseIds = window.localStorage.getItem(RECENT_HORSE_IDS_KEY)

      setRecentOwnerIds(storedOwnerIds ? JSON.parse(storedOwnerIds) : [])
      setRecentHorseIds(storedHorseIds ? JSON.parse(storedHorseIds) : [])
    } catch {
      setRecentOwnerIds([])
      setRecentHorseIds([])
    }
  }

  function saveRecentOwner(ownerId: string) {
    if (typeof window === 'undefined') return

    try {
      const existing = window.localStorage.getItem(RECENT_OWNER_IDS_KEY)
      const parsed: string[] = existing ? JSON.parse(existing) : []
      const updated = [ownerId, ...parsed.filter((id) => id !== ownerId)].slice(0, 3)

      window.localStorage.setItem(RECENT_OWNER_IDS_KEY, JSON.stringify(updated))
      setRecentOwnerIds(updated)
    } catch {
      // ignore localStorage issues
    }
  }

  async function addOwner() {
    setMessage('')

    if (!fullName.trim()) {
      setMessage('Full name is required.')
      return
    }

    const { error } = await supabase.from('owners').insert([
      {
        full_name: fullName,
        phone: phone || null,
        email: email || null,
        address: address || null,
        archived: false,
        practitioner_id: userId,
      },
    ])

    if (error) {
      setMessage(`Error saving owner: ${error.message}`)
      return
    }

    setMessage('Owner saved successfully.')
    setFullName('')
    setPhone('')
    setEmail('')
    setAddress('')
    setShowAddOwnerModal(false)
    await loadOwners()
  }

  async function addHorse() {
    setMessage('')

    if (!selectedOwnerIdForAdd) {
      setMessage('Please select an owner.')
      return
    }

    if (!horseName.trim()) {
      setMessage('Patient name is required.')
      return
    }

    const { error } = await supabase.from('horses').insert([
      {
        owner_id: selectedOwnerIdForAdd,
        name: horseName,
        breed: horseBreed || null,
        discipline: horseDiscipline || null,
        age: horseAge || null,
        sex: horseGender || null,
        species: addSpecies,
        archived: false,
        practitioner_id: userId,
      },
    ])

    if (error) {
      setMessage(`Error saving patient: ${error.message}`)
      return
    }

    setMessage('Patient saved successfully.')
    setHorseName('')
    setHorseBreed('')
    setHorseDiscipline('')
    setHorseAge('')
    setHorseGender('')
    setAddSpecies('equine')
    setShowAddPatientModal(false)
    await loadHorses()
  }

  async function saveOwnerInfo() {
    setMessage('')

    if (!selectedOwnerId) {
      setMessage('Select an owner first.')
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
      .eq('id', selectedOwnerId)

    if (error) {
      setMessage(`Error updating owner: ${error.message}`)
      return
    }

    setEditingOwner(false)
    setMessage('Owner updated successfully.')
    await loadOwners()
  }

  async function archiveOwner() {
    setMessage('')

    if (!selectedOwnerId || !selectedOwner) {
      setMessage('Select an owner first.')
      return
    }

    const assignedHorses = horses.filter((horse) => horse.owner_id === selectedOwnerId)
    const horseNames = assignedHorses.map((horse) => `"${horse.name}"`)

    let warningMessage = `Archive owner "${selectedOwner.full_name}"?`

    if (assignedHorses.length === 1) {
      warningMessage = `${horseNames[0]} is assigned to ${selectedOwner.full_name}.\n\nArchiving ${selectedOwner.full_name} will archive the horse record as well.\n\nVisits and photos will be preserved.\n\nDo you want to continue?`
    }

    if (assignedHorses.length > 1) {
      warningMessage = `${horseNames.join(', ')} are assigned to ${selectedOwner.full_name}.\n\nArchiving ${selectedOwner.full_name} will archive those horse records as well.\n\nVisits and photos will be preserved.\n\nDo you want to continue?`
    }

    const confirmed = window.confirm(warningMessage)
    if (!confirmed) return

    const { error: ownerError } = await supabase
      .from('owners')
      .update({ archived: true })
      .eq('id', selectedOwnerId)

    if (ownerError) {
      setMessage(`Error archiving owner: ${ownerError.message}`)
      return
    }

    const { error: horseError } = await supabase
      .from('horses')
      .update({ archived: true })
      .eq('owner_id', selectedOwnerId)

    if (horseError) {
      setMessage(`Error archiving horses: ${horseError.message}`)
      return
    }

    setEditingOwner(false)
    setSelectedOwnerId(null)
    setOwnerNameEdit('')
    setOwnerPhoneEdit('')
    setOwnerEmailEdit('')
    setOwnerAddressEdit('')
    setMessage('Owner and related horses archived successfully.')

    await loadOwners()
    await loadHorses()
    await loadVisitCount()
    await loadPhotoCount()
  }

  async function deleteOwner() {
    setMessage('')

    if (!selectedOwnerId || !selectedOwner) {
      setMessage('Select an owner first.')
      return
    }

    const assignedHorses = horses.filter((horse) => horse.owner_id === selectedOwnerId)
    const horseNames = assignedHorses.map((horse) => `"${horse.name}"`)

    let warningMessage = `Delete owner "${selectedOwner.full_name}" permanently?\n\nThis action cannot be undone.`

    if (assignedHorses.length === 1) {
      warningMessage = `${horseNames[0]} is assigned to ${selectedOwner.full_name}.\n\nDeleting ${selectedOwner.full_name} will permanently delete the horse record as well.\n\nThis action cannot be undone.\n\nDo you want to continue?`
    }

    if (assignedHorses.length > 1) {
      warningMessage = `${horseNames.join(', ')} are assigned to ${selectedOwner.full_name}.\n\nDeleting ${selectedOwner.full_name} will permanently delete those horse records as well.\n\nThis action cannot be undone.\n\nDo you want to continue?`
    }

    const confirmed = window.confirm(warningMessage)
    if (!confirmed) return

    const horseIdsToDelete = assignedHorses.map((horse) => horse.id)

    if (horseIdsToDelete.length > 0) {
      const { error: photoDeleteError } = await supabase
        .from('photos')
        .delete()
        .in('horse_id', horseIdsToDelete)

      if (photoDeleteError) {
        setMessage(`Error deleting photos: ${photoDeleteError.message}`)
        return
      }

      const { error: visitDeleteError } = await supabase
        .from('visits')
        .delete()
        .in('horse_id', horseIdsToDelete)

      if (visitDeleteError) {
        setMessage(`Error deleting visits: ${visitDeleteError.message}`)
        return
      }

      const { data: deletedHorses, error: horseDeleteError } = await supabase
        .from('horses')
        .delete()
        .in('id', horseIdsToDelete)
        .select('id')

      if (horseDeleteError) {
        setMessage(`Error deleting horses: ${horseDeleteError.message}`)
        return
      }

      if ((deletedHorses || []).length !== horseIdsToDelete.length) {
        setMessage(
          'Horse delete was blocked. This usually means your Supabase delete policy is not allowing the delete.'
        )
        return
      }
    }

    const { data: deletedOwners, error: ownerDeleteError } = await supabase
      .from('owners')
      .delete()
      .eq('id', selectedOwnerId)
      .select('id')

    if (ownerDeleteError) {
      setMessage(`Error deleting owner: ${ownerDeleteError.message}`)
      return
    }

    if (!deletedOwners || deletedOwners.length === 0) {
      setMessage(
        'Owner delete was blocked. The button worked, but Supabase did not actually delete the row. This is usually a Row Level Security delete policy issue on the owners table.'
      )
      return
    }

    setEditingOwner(false)
    setSelectedOwnerId(null)
    setOwnerNameEdit('')
    setOwnerPhoneEdit('')
    setOwnerEmailEdit('')
    setOwnerAddressEdit('')
    setMessage('Owner and related records deleted permanently.')

    await loadOwners()
    await loadHorses()
    await loadVisitCount()
    await loadPhotoCount()
  }

  async function addInlineHorse() {
    setMessage('')

    if (!selectedOwnerId) return
    if (!inlineHorseName.trim()) {
      setMessage('Patient name is required.')
      return
    }

    const { error } = await supabase.from('horses').insert([{
      owner_id: selectedOwnerId,
      name: inlineHorseName,
      breed: inlineHorseBreed || null,
      discipline: inlineHorseDiscipline || null,
      age: inlineHorseAge || null,
      sex: inlineHorseGender || null,
      species: inlineSpecies,
      archived: false,
      practitioner_id: userId,
    }])

    if (error) {
      setMessage(`Error saving patient: ${error.message}`)
      return
    }

    setInlineHorseName('')
    setInlineHorseBreed('')
    setInlineHorseDiscipline('')
    setInlineHorseAge('')
    setInlineHorseGender('')
    setInlineSpecies('equine')
    setShowInlineAddPatient(false)
    setMessage('Patient saved successfully.')
    await loadHorses()
  }

  function startOwnerEdit(owner: Owner) {
    setEditingOwner(true)
    setOwnerNameEdit(owner.full_name || '')
    setOwnerPhoneEdit(owner.phone || '')
    setOwnerEmailEdit(owner.email || '')
    setOwnerAddressEdit(owner.address || '')
  }

  function cancelOwnerEdit() {
    setEditingOwner(false)
    setOwnerNameEdit(selectedOwner?.full_name || '')
    setOwnerPhoneEdit(selectedOwner?.phone || '')
    setOwnerEmailEdit(selectedOwner?.email || '')
    setOwnerAddressEdit(selectedOwner?.address || '')
  }

  async function sendOptInSms(ownerId: string) {
    const res = await fetch(`/api/owners/${ownerId}/send-optin-sms`, { method: 'POST' })
    return res.ok
  }

  async function sendIntakeSms(ownerId: string, ownerPhone: string | null) {
    if (!ownerPhone) {
      setMessage('This owner does not have a phone number on file.')
      return
    }
    setSendingIntakeSms(true)
    setMessage('')
    try {
      const res = await fetch(`/api/owners/${ownerId}/send-intake-sms`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        if (data.needsConsent) {
          const sent = await sendOptInSms(ownerId)
          if (sent) {
            setMessage(`SMS opt-in request sent to ${ownerPhone}. Once they reply YES, you can text them forms.`)
          } else {
            setMessage('Failed to send opt-in request.')
          }
        } else {
          setMessage(data.error || 'Failed to send text message.')
        }
      } else {
        setMessage(`Intake form link texted to ${ownerPhone}.`)
      }
    } catch {
      setMessage('Failed to send text message.')
    } finally {
      setSendingIntakeSms(false)
    }
  }

  async function sendIntakeEmail(ownerId: string, ownerEmail: string | null) {
    if (!ownerEmail) {
      setMessage('This owner does not have an email address on file.')
      return
    }
    setSendingIntake(true)
    setMessage('')
    try {
      const res = await fetch(`/api/owners/${ownerId}/send-intake`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || 'Failed to send intake email.')
      } else {
        setMessage(`Intake form link sent to ${ownerEmail}.`)
      }
    } catch {
      setMessage('Failed to send intake email.')
    } finally {
      setSendingIntake(false)
    }
  }

  async function sendConsentEmail(ownerId: string, ownerEmail: string | null) {
    if (!ownerEmail) {
      setMessage('This owner does not have an email address on file.')
      return
    }
    setSendingConsent(true)
    setMessage('')
    try {
      const res = await fetch(`/api/owners/${ownerId}/send-consent`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || 'Failed to send consent email.')
      } else {
        setMessage(`Consent form link sent to ${ownerEmail}.`)
      }
    } catch {
      setMessage('Failed to send consent email.')
    } finally {
      setSendingConsent(false)
    }
  }

  async function sendConsentSms(ownerId: string, ownerPhone: string | null) {
    if (!ownerPhone) {
      setMessage('This owner does not have a phone number on file.')
      return
    }
    setSendingConsentSms(true)
    setMessage('')
    try {
      const res = await fetch(`/api/owners/${ownerId}/send-consent-sms`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        if (data.needsConsent) {
          const sent = await sendOptInSms(ownerId)
          if (sent) {
            setMessage(`SMS opt-in request sent to ${ownerPhone}. Once they reply YES, you can text them forms.`)
          } else {
            setMessage('Failed to send opt-in request.')
          }
        } else {
          setMessage(data.error || 'Failed to send consent text message.')
        }
      } else {
        setMessage(`Consent form link texted to ${ownerPhone}.`)
      }
    } catch {
      setMessage('Failed to send consent text message.')
    } finally {
      setSendingConsentSms(false)
    }
  }

  const filteredOwners = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return owners
    return owners.filter((owner) => {
      return (
        owner.full_name.toLowerCase().includes(query) ||
        (owner.phone || '').toLowerCase().includes(query) ||
        (owner.email || '').toLowerCase().includes(query) ||
        (owner.address || '').toLowerCase().includes(query)
      )
    })
  }, [owners, searchTerm])

  // Patients matching the search term (shown as a second section when typing)
  const filteredPatients = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return []
    return horses.filter((horse) => {
      return (
        horse.name.toLowerCase().includes(query) ||
        (horse.owners?.full_name || '').toLowerCase().includes(query) ||
        (horse.breed || '').toLowerCase().includes(query) ||
        (horse.discipline || '').toLowerCase().includes(query)
      )
    })
  }, [horses, searchTerm])

  // Patients belonging to the selected owner (shown in the right panel)
  const filteredHorses = useMemo(() => {
    if (!selectedOwnerId) return []
    return horses.filter((horse) => horse.owner_id === selectedOwnerId)
  }, [horses, selectedOwnerId])

  const selectedOwner = useMemo(() => {
    if (!selectedOwnerId) return null
    return owners.find((owner) => owner.id === selectedOwnerId) || null
  }, [owners, selectedOwnerId])

  const recentOwners = useMemo(() => {
    return recentOwnerIds
      .map((id) => owners.find((owner) => owner.id === id))
      .filter((owner): owner is Owner => Boolean(owner))
  }, [recentOwnerIds, owners])

  const recentHorses = useMemo(() => {
    return recentHorseIds
      .map((id) => horses.find((horse) => horse.id === id))
      .filter((horse): horse is Horse => Boolean(horse))
  }, [recentHorseIds, horses])

  useEffect(() => {
    async function init() {
      const isLoggedIn = await checkUser()
      if (!isLoggedIn) return

      await loadOwners()
      await loadHorses()
      await loadVisitCount()
      await loadPhotoCount()
      await loadVisitData()
      await loadTodayAppointments()
      await loadFormStatuses()
      loadRecentItems()
    }

    init()
  }, [])

  useEffect(() => {
    if (selectedOwner) {
      setOwnerNameEdit(selectedOwner.full_name || '')
      setOwnerPhoneEdit(selectedOwner.phone || '')
      setOwnerEmailEdit(selectedOwner.email || '')
      setOwnerAddressEdit(selectedOwner.address || '')
      saveRecentOwner(selectedOwner.id)
    }
  }, [selectedOwner])

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-[#0f2040] p-4 md:p-8">
        <div className="mx-auto max-w-7xl rounded-3xl bg-white p-6 shadow-md">
          <p className="text-slate-700">Checking login...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0f2040] p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-3xl bg-white p-4 shadow-md md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 flex-shrink-0 md:h-20 md:w-20">
                <Image
                  src={practitionerLogoUrl || '/logo-gold.png'}
                  alt="Practice logo"
                  fill
                  className="object-contain"
                  unoptimized={!!practitionerLogoUrl}
                />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 md:text-3xl">
                  Client Dashboard
                </h1>
                <p className="hidden text-sm text-slate-600 md:block md:text-base mt-1">
                  Search by owner or horse, then open the full horse record.
                </p>
              </div>
            </div>
            <div className="flex flex-shrink-0 gap-2">
              <button
                onClick={() => setShowAddOwnerModal(true)}
                className="rounded-xl bg-[#0f2040] px-3 py-2 text-sm font-semibold text-white hover:bg-[#162d55] transition md:px-4 md:py-2.5"
              >
                <span className="hidden sm:inline">+ Add Owner</span>
                <span className="sm:hidden">+ Owner</span>
              </button>
              <button
                onClick={() => setShowAddPatientModal(true)}
                className="rounded-xl border border-[#0f2040] px-3 py-2 text-sm font-semibold text-[#0f2040] hover:bg-slate-50 transition md:px-4 md:py-2.5"
              >
                <span className="hidden sm:inline">+ Add Patient</span>
                <span className="sm:hidden">+ Patient</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Today's Appointments ── */}
        <div className="mt-5 rounded-3xl bg-white p-4 shadow-md md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900 md:text-2xl">Today&apos;s Appointments</h2>
              <p className="mt-0.5 text-xs text-slate-500 md:text-sm">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <Link
              href="/appointments"
              className="flex-shrink-0 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition md:px-4 md:py-2"
            >
              View All →
            </Link>
          </div>

          <div className="mt-4">
            {todayAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
                <p className="text-2xl">📅</p>
                <p className="mt-2 text-sm font-medium text-slate-500">No appointments scheduled for today</p>
                <button
                  onClick={openBookModal}
                  className="mt-3 rounded-xl bg-[#0f2040] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162d55] transition"
                >
                  + Book Appointment
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {todayAppointments.map((appt) => {
                  const statusColors: Record<string, string> = {
                    scheduled: 'bg-blue-100 text-blue-700',
                    confirmed: 'bg-emerald-100 text-emerald-700',
                    completed: 'bg-slate-100 text-slate-500',
                  }
                  const fmtTime = (t: string | null) => {
                    if (!t) return 'Time TBD'
                    const [h, min] = t.split(':').map(Number)
                    const ampm = h >= 12 ? 'PM' : 'AM'
                    return `${h % 12 || 12}:${String(min).padStart(2, '0')} ${ampm}`
                  }

                  // Owner name — direct join takes priority over horse→owner
                  const ownerName =
                    appt.owners?.full_name ||
                    appt.horses?.owners?.full_name ||
                    '—'
                  const ownerPhone =
                    appt.owners?.phone ||
                    appt.horses?.owners?.phone ||
                    null

                  // Animal count from duration (15 min each)
                  const numAnimals = appt.duration_minutes
                    ? Math.max(1, Math.round(appt.duration_minutes / 15))
                    : 1

                  // Link to the owner's page if we have an owner_id, otherwise
                  // fall back to the horse record or the appointments page.
                  const cardHref =
                    appt.owner_id
                      ? `/owners/${appt.owner_id}`
                      : appt.horses?.id
                      ? `/horses/${appt.horses.id}`
                      : '/appointments'

                  return (
                    <Link
                      key={appt.id}
                      href={cardHref}
                      className={`group relative flex flex-col rounded-2xl border-l-4 bg-slate-50 p-4 transition hover:bg-white hover:shadow-md ${
                        appt.status === 'confirmed' ? 'border-emerald-400' :
                        appt.status === 'completed' ? 'border-slate-300' :
                        'border-blue-400'
                      }`}
                    >
                      {/* Time + status */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-lg font-bold text-slate-900">{fmtTime(appt.appointment_time)}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusColors[appt.status] || 'bg-slate-100 text-slate-500'}`}>
                          {appt.status}
                        </span>
                      </div>

                      {/* Owner name — primary identity */}
                      <p className="mt-2 font-semibold text-slate-900 leading-tight">{ownerName}</p>

                      {/* Animal count */}
                      <p className="mt-0.5 text-sm text-slate-500">
                        {numAnimals} animal{numAnimals > 1 ? 's' : ''}
                        {appt.duration_minutes ? ` · ${appt.duration_minutes} min` : ''}
                      </p>

                      {/* Phone */}
                      {ownerPhone && (
                        <p className="text-xs text-slate-400">{ownerPhone}</p>
                      )}

                      {/* Reason + location tags */}
                      {(appt.reason || appt.location) && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {appt.reason && (
                            <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600">{appt.reason}</span>
                          )}
                          {appt.location && (
                            <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600">📍 {appt.location}</span>
                          )}
                        </div>
                      )}

                      {/* Start Visit button */}
                      {appt.status !== 'completed' && appt.horses?.id && (
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            router.push(`/horses/${appt.horses!.id}/spine?newVisit=true&species=${appt.horses!.species || 'equine'}`)
                          }}
                          className="mt-3 w-full rounded-xl bg-[#0f2040] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#162d55]"
                        >
                          Start Visit
                        </button>
                      )}

                      {/* "View" hint on hover */}
                      <span className="mt-2 text-xs font-medium text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">
                        {appt.owner_id ? 'View owner & animals →' : 'View record →'}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div ref={findRecordsRef} className="mt-5 rounded-3xl bg-white p-5 shadow-md md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
                Find Records
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Search owners or patients by name, phone, breed, and more.
              </p>
            </div>

            <div className="xl:min-w-[560px]">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Search
              </label>
              <input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setSelectedOwnerId(null)
                  setEditingOwner(false)
                }}
                className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                placeholder="Search owner name, patient name, phone, breed..."
              />
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[340px_1fr]">
            <div className="rounded-3xl bg-[#edf2f7] p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900">Results</h3>
                <span className="text-xs text-slate-500">
                  {filteredOwners.length} owner{filteredOwners.length === 1 ? '' : 's'}
                  {filteredPatients.length > 0 ? `, ${filteredPatients.length} patient${filteredPatients.length === 1 ? '' : 's'}` : ''}
                </span>
              </div>

              <div className="mt-4 h-[520px] overflow-y-scroll pr-2">
                <div className="space-y-3">
                  {/* Owners section */}
                  {searchTerm.trim() && filteredPatients.length > 0 && (
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Owners</p>
                  )}
                  {filteredOwners.length === 0 ? (
                    <p className="text-sm text-slate-500">No owners found.</p>
                  ) : (
                    filteredOwners.map((owner) => {
                      const isSelected = selectedOwnerId === owner.id
                      return (
                        <button
                          key={owner.id}
                          onClick={() => {
                            setSelectedOwnerId(owner.id)
                            setEditingOwner(false)
                            setShowInlineAddPatient(false)
                          }}
                          onDoubleClick={() => router.push(`/owners/${owner.id}`)}
                          className={`w-full rounded-2xl border p-4 text-left transition ${
                            isSelected
                              ? 'border-[#0f2040] bg-[#0f2040] text-white'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                          }`}
                        >
                          <p className="font-semibold">{owner.full_name}</p>
                          <p className={`mt-1 text-sm ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                            {formatPhone(owner.phone)}
                          </p>
                          <p className={`text-sm ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                            {owner.email || 'No email'}
                          </p>
                        </button>
                      )
                    })
                  )}

                  {/* Patients section — only appears when search term matches patients */}
                  {filteredPatients.length > 0 && (
                    <>
                      <p className="pt-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Patients</p>
                      {filteredPatients.map((horse) => (
                        <Link
                          key={horse.id}
                          href={`/horses/${horse.id}`}
                          className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                        >
                          <p className="font-semibold text-slate-900">{horse.name}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {horse.owners?.full_name || '—'}
                          </p>
                          {horse.breed && (
                            <p className="text-sm text-slate-400">{horse.breed}</p>
                          )}
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6">
              {!selectedOwner ? (
                <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-300">
                  <p className="text-slate-500">Select an owner to view their patients.</p>
                </div>
              ) : (
                <div>
                  <div className="rounded-2xl bg-slate-100 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-xl font-semibold text-slate-900">
                            {selectedOwner.full_name}
                          </h3>
                          <p className="mt-1 text-sm text-slate-600">
                            Phone: {selectedOwner.phone ? formatPhone(selectedOwner.phone) : '—'}
                          </p>
                          <p className="text-sm text-slate-600">
                            Email: {selectedOwner.email || '—'}
                          </p>
                          <p className="text-sm text-slate-600">
                            Address: {selectedOwner.address || '—'}
                          </p>

                          {/* Intake / Consent status badges */}
                          <div className="mt-3 flex items-center gap-2">
                            {ownerIntakeStatus[selectedOwner.id] ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                ✓ Intake on file
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-600">
                                ✗ No intake on file
                              </span>
                            )}
                            {ownerConsentStatus[selectedOwner.id] ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                ✓ Consent on file
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-600">
                                ✗ No consent on file
                              </span>
                            )}
                          </div>
                        </div>

                        {!editingOwner ? (
                          <div className="flex flex-col gap-2 min-w-[220px]">
                            {/* Intake row */}
                            <div className="flex items-center gap-1.5">
                              <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Intake</span>
                              <a
                                href={`/intake/${selectedOwner.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                              >
                                📋 Open
                              </a>
                              <button
                                onClick={() => sendIntakeEmail(selectedOwner.id, selectedOwner.email)}
                                disabled={sendingIntake}
                                className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition disabled:opacity-50"
                              >
                                {sendingIntake ? '…' : '📧 Email'}
                              </button>
                              <button
                                onClick={() => sendIntakeSms(selectedOwner.id, selectedOwner.phone)}
                                disabled={sendingIntakeSms}
                                className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition disabled:opacity-50"
                              >
                                {sendingIntakeSms ? '…' : '📱 Text'}
                              </button>
                            </div>

                            {/* Consent row */}
                            <div className="flex items-center gap-1.5">
                              <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Consent</span>
                              <a
                                href={`/consent/${selectedOwner.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                              >
                                📝 Open
                              </a>
                              <button
                                onClick={() => sendConsentEmail(selectedOwner.id, selectedOwner.email)}
                                disabled={sendingConsent}
                                className="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 transition disabled:opacity-50"
                              >
                                {sendingConsent ? '…' : '📧 Email'}
                              </button>
                              <button
                                onClick={() => sendConsentSms(selectedOwner.id, selectedOwner.phone)}
                                disabled={sendingConsentSms}
                                className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 transition disabled:opacity-50"
                              >
                                {sendingConsentSms ? '…' : '📱 Text'}
                              </button>
                            </div>

                            {/* Edit / Profile row */}
                            <div className="flex items-center gap-1.5">
                              <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-slate-400"></span>
                              <Link
                                href={`/owners/${selectedOwner.id}`}
                                className="rounded-lg border border-[#0f2040] bg-[#0f2040] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#162d55] transition"
                              >
                                📁 Records & Profile
                              </Link>
                              <button
                                onClick={() => startOwnerEdit(selectedOwner)}
                                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                              >
                                ✏️ Edit Owner
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {editingOwner ? (
                        <div className="mt-4 grid gap-4">
                          <Field label="Owner Name">
                            <input
                              value={ownerNameEdit}
                              onChange={(e) => setOwnerNameEdit(e.target.value)}
                              className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                              placeholder="Owner name"
                            />
                          </Field>

                          <Field label="Phone">
                            <input
                              value={ownerPhoneEdit}
                              onChange={(e) => setOwnerPhoneEdit(e.target.value)}
                              className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                              placeholder="Phone"
                            />
                          </Field>

                          <Field label="Email">
                            <input
                              value={ownerEmailEdit}
                              onChange={(e) => setOwnerEmailEdit(e.target.value)}
                              className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                              placeholder="Email"
                            />
                          </Field>

                          <Field label="Address">
                            <div className="relative">
                              <input
                                type="text"
                                value={ownerAddressEdit}
                                onChange={(e) => handleEditAddressChange(e.target.value)}
                                onBlur={() => setTimeout(() => setShowEditAddressSuggestions(false), 150)}
                                onFocus={() => ownerAddressEdit.length >= 2 && editAddressSuggestions.length > 0 && setShowEditAddressSuggestions(true)}
                                autoComplete="off"
                                className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                                placeholder="Start typing an address…"
                              />
                              {showEditAddressSuggestions && editAddressSuggestions.length > 0 && (
                                <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                                  {editAddressSuggestions.map((s, i) => (
                                    <button
                                      key={s.place_id}
                                      type="button"
                                      onMouseDown={() => { setOwnerAddressEdit(s.description); setEditAddressSuggestions([]); setShowEditAddressSuggestions(false) }}
                                      className={`flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50 ${i < editAddressSuggestions.length - 1 ? 'border-b border-slate-100' : ''}`}
                                    >
                                      <span className="mt-0.5 shrink-0 text-slate-400">📍</span>
                                      <span className="text-slate-700">{s.description}</span>
                                    </button>
                                  ))}
                                  <div className="flex items-center justify-end gap-1 border-t border-slate-100 px-4 py-1.5">
                                    <span className="text-[10px] text-slate-400">Powered by</span>
                                    <span className="text-[10px] font-medium text-slate-500">Google</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </Field>

                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={saveOwnerInfo}
                              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white"
                            >
                              Save Owner Info
                            </button>
                            <button
                              onClick={cancelOwnerEdit}
                              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={archiveOwner}
                              className="rounded-2xl border border-amber-300 bg-white px-4 py-3 text-sm text-amber-700"
                            >
                              Archive Owner
                            </button>
                            <button
                              onClick={deleteOwner}
                              className="rounded-2xl border border-red-300 bg-white px-4 py-3 text-sm text-red-700"
                            >
                              Delete Owner
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-5">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-lg font-semibold text-slate-900">Patients</h4>
                        <button
                          onClick={() => {
                            setShowInlineAddPatient(v => !v)
                            setInlineHorseName('')
                            setInlineHorseBreed('')
                            setInlineHorseDiscipline('')
                            setInlineHorseAge('')
                            setInlineHorseGender('')
                            setInlineSpecies('equine')
                          }}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                        >
                          {showInlineAddPatient ? '✕ Cancel' : '+ Add Patient'}
                        </button>
                      </div>

                      {/* Inline add patient form */}
                      {showInlineAddPatient && (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-600">Species</label>
                              <select
                                value={inlineSpecies}
                                onChange={e => { setInlineSpecies(e.target.value as 'equine' | 'canine'); setInlineHorseGender('') }}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                              >
                                <option value="equine">🐴 Equine</option>
                                <option value="canine">🐕 Canine</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-600">Patient Name *</label>
                              <input
                                value={inlineHorseName}
                                onChange={e => setInlineHorseName(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400"
                                placeholder={inlineSpecies === 'canine' ? 'Dog name' : 'Horse name'}
                                autoFocus
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-600">Breed</label>
                              <input
                                value={inlineHorseBreed}
                                onChange={e => setInlineHorseBreed(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400"
                                placeholder="Breed"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-600">{inlineSpecies === 'canine' ? 'Activity / Sport' : 'Discipline'}</label>
                              <input
                                value={inlineHorseDiscipline}
                                onChange={e => setInlineHorseDiscipline(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400"
                                placeholder={inlineSpecies === 'canine' ? 'Agility, sport…' : 'Barrel, dressage…'}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-600">Age</label>
                              <input
                                value={inlineHorseAge}
                                onChange={e => setInlineHorseAge(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400"
                                placeholder="e.g. 5 years"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-slate-600">Gender</label>
                              <select
                                value={inlineHorseGender}
                                onChange={e => setInlineHorseGender(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                              >
                                <option value="">Select gender</option>
                                {inlineSpecies === 'equine' ? (
                                  <>
                                    <option value="Mare">Mare</option>
                                    <option value="Stallion">Stallion</option>
                                    <option value="Gelding">Gelding</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="Female">Female</option>
                                    <option value="Male">Male</option>
                                    <option value="Female (Spayed)">Female (Spayed)</option>
                                    <option value="Male (Neutered)">Male (Neutered)</option>
                                  </>
                                )}
                              </select>
                            </div>
                          </div>

                          <button
                            onClick={addInlineHorse}
                            className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition"
                          >
                            Save Patient
                          </button>
                        </div>
                      )}

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {filteredHorses.length === 0 ? (
                          <p className="text-sm text-slate-500">
                            No patients for this owner yet.
                          </p>
                        ) : (
                          filteredHorses.map((horse) => (
                            <Link
                              key={horse.id}
                              href={`/horses/${horse.id}`}
                              className="rounded-3xl border border-slate-200 p-5 transition hover:border-slate-400 hover:bg-slate-50"
                            >
                              <div className="flex items-start gap-3">
                                {/* Squared profile photo */}
                                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                                  {horsePhotoUrls[horse.id] ? (
                                    <img
                                      src={horsePhotoUrls[horse.id]}
                                      alt={horse.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-2xl">
                                      {horse.species === 'canine' ? '🐕' : '🐴'}
                                    </div>
                                  )}
                                </div>

                                <div className="flex flex-1 items-start justify-between gap-3">
                                  <div>
                                    <p className="text-xl font-semibold text-slate-900">
                                      {horse.name}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-600">
                                      Breed: {horse.breed || '—'}
                                    </p>
                                  </div>

                                  <div className="flex flex-col items-end gap-1">
                                    {horse.discipline ? (
                                      <span className="rounded-2xl bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                                        {horse.discipline}
                                      </span>
                                    ) : null}
                                    <span className="rounded-2xl bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                                      {visitCountsByHorse[horse.id] || 0} visit{(visitCountsByHorse[horse.id] || 0) === 1 ? '' : 's'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 text-sm text-slate-600">
                                <p>Barn: {horse.barn_location || '—'}</p>
                              </div>
                            </Link>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
              )}
            </div>
          </div>
        </div>

        {message ? (
          <div className="mt-5 rounded-3xl bg-white p-4 text-sm text-slate-700 shadow-sm">
            {message}
          </div>
        ) : null}
      </div>

      {/* ── Add Owner Modal ── */}
      {showAddOwnerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddOwnerModal(false) }}
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Add Owner</h2>
              <button
                onClick={() => setShowAddOwnerModal(false)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50 transition"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid gap-4">
              <Field label="Full Name">
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                  placeholder="Owner full name"
                  autoFocus
                />
              </Field>

              <Field label="Phone">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                  placeholder="Phone number"
                />
              </Field>

              <Field label="Email">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                  placeholder="Email address"
                />
              </Field>

              <Field label="Address">
                <div className="relative">
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => handleAddAddressChange(e.target.value)}
                    onBlur={() => setTimeout(() => setShowAddAddressSuggestions(false), 150)}
                    onFocus={() => address.length >= 2 && addAddressSuggestions.length > 0 && setShowAddAddressSuggestions(true)}
                    autoComplete="off"
                    className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                    placeholder="Start typing an address…"
                  />
                  {showAddAddressSuggestions && addAddressSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                      {addAddressSuggestions.map((s, i) => (
                        <button
                          key={s.place_id}
                          type="button"
                          onMouseDown={() => { setAddress(s.description); setAddAddressSuggestions([]); setShowAddAddressSuggestions(false) }}
                          className={`flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50 ${i < addAddressSuggestions.length - 1 ? 'border-b border-slate-100' : ''}`}
                        >
                          <span className="mt-0.5 shrink-0 text-slate-400">📍</span>
                          <span className="text-slate-700">{s.description}</span>
                        </button>
                      ))}
                      <div className="flex items-center justify-end gap-1 border-t border-slate-100 px-4 py-1.5">
                        <span className="text-[10px] text-slate-400">Powered by</span>
                        <span className="text-[10px] font-medium text-slate-500">Google</span>
                      </div>
                    </div>
                  )}
                </div>
              </Field>

              <button
                onClick={addOwner}
                className="min-h-[48px] rounded-2xl bg-[#0f2040] px-5 py-3 text-base font-semibold text-white hover:bg-[#162d55] transition"
              >
                Save Owner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Patient Modal ── */}
      {/* ── Book Appointment Modal ── */}
      {showBookModal && (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" onClick={() => setShowBookModal(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative z-50 w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900">New Appointment</h2>
              <button onClick={() => setShowBookModal(false)} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">✕</button>
            </div>

            <div className="space-y-4">
              {/* Owner */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Owner <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input
                    type="text"
                    value={bookOwnerSearch}
                    onChange={e => {
                      setBookOwnerSearch(e.target.value)
                      setBookForm(f => ({ ...f, owner_id: '' }))
                      setSelectedPatientIds([])
                      setShowBookOwnerSuggestions(true)
                    }}
                    onFocus={() => setShowBookOwnerSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowBookOwnerSuggestions(false), 150)}
                    placeholder="Type to search owner…"
                    autoComplete="off"
                    className={`w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                      bookForm.owner_id ? 'border-emerald-300' : 'border-slate-200'
                    }`}
                  />
                  {bookForm.owner_id && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 text-base pointer-events-none">✓</span>
                  )}
                  {showBookOwnerSuggestions && filteredBookOwners.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                      {filteredBookOwners.map((o, i) => (
                        <button
                          key={o.id}
                          type="button"
                          onMouseDown={() => {
                            setBookOwnerSearch(o.full_name)
                            setBookForm(f => ({ ...f, owner_id: o.id }))
                            setSelectedPatientIds([])
                            setShowBookOwnerSuggestions(false)
                          }}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50 ${
                            i < filteredBookOwners.length - 1 ? 'border-b border-slate-100' : ''
                          } ${bookForm.owner_id === o.id ? 'bg-slate-50' : ''}`}
                        >
                          <span className="font-medium text-slate-800">{o.full_name}</span>
                          {o.phone && <span className="ml-auto shrink-0 text-xs text-slate-400">{o.phone}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {showBookOwnerSuggestions && bookOwnerSearch.trim().length > 0 && filteredBookOwners.length === 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl">
                      <p className="text-sm text-slate-400">No owners found for &ldquo;{bookOwnerSearch}&rdquo;</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Patients (multi-select) */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Patients <span className="text-red-400">*</span>
                  {selectedPatientIds.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-slate-400">({selectedPatientIds.length} selected)</span>
                  )}
                </label>
                {!bookForm.owner_id ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400 text-center">
                    Select an owner first to see their patients
                  </div>
                ) : ownerPatients.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 text-center">
                    No patients found for this owner
                  </div>
                ) : (
                  <div className="max-h-44 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50">
                    {ownerPatients.map((patient, i) => {
                      const isSelected = selectedPatientIds.includes(patient.id)
                      return (
                        <button
                          key={patient.id}
                          type="button"
                          onClick={() => togglePatient(patient.id)}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-100 ${
                            i < ownerPatients.length - 1 ? 'border-b border-slate-200' : ''
                          } ${isSelected ? 'bg-emerald-50' : ''}`}
                        >
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs transition ${
                            isSelected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && '✓'}
                          </span>
                          <span className="text-base">{patient.species === 'canine' ? '🐕' : '🐴'}</span>
                          <span className="font-medium text-slate-800">{patient.name}</span>
                          {patient.breed && <span className="ml-auto text-xs text-slate-400">{patient.breed}</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Duration auto-display */}
              {selectedPatientIds.length > 0 && (
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <span>⏱</span>
                  <span>Total duration: <strong className="text-slate-900">{bookDuration} min</strong> ({selectedPatientIds.length} patient{selectedPatientIds.length > 1 ? 's' : ''} × 15 min each)</span>
                </div>
              )}

              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date <span className="text-red-400">*</span></label>
                  <input
                    type="date"
                    value={bookForm.appointment_date}
                    onChange={e => setBookForm(f => ({ ...f, appointment_date: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Time</label>
                  <input
                    type="time"
                    value={bookForm.appointment_time}
                    onChange={e => setBookForm(f => ({ ...f, appointment_time: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Reason</label>
                <input
                  type="text"
                  value={bookForm.reason}
                  onChange={e => setBookForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Routine adjustment, Post-competition"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Location */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Location</label>
                <div className="relative">
                  <input
                    type="text"
                    value={bookForm.location}
                    onChange={e => handleBookLocationChange(e.target.value)}
                    onBlur={() => setTimeout(() => setShowBookLocationSuggestions(false), 150)}
                    onFocus={() => bookForm.location.length >= 2 && bookLocationSuggestions.length > 0 && setShowBookLocationSuggestions(true)}
                    placeholder="Start typing an address or barn name…"
                    autoComplete="off"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  {showBookLocationSuggestions && bookLocationSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                      {bookLocationSuggestions.map((s, i) => (
                        <button
                          key={s.place_id}
                          type="button"
                          onMouseDown={() => {
                            setBookForm(f => ({ ...f, location: s.description }))
                            setBookLocationSuggestions([])
                            setShowBookLocationSuggestions(false)
                          }}
                          className={`flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50 ${i < bookLocationSuggestions.length - 1 ? 'border-b border-slate-100' : ''}`}
                        >
                          <span className="mt-0.5 shrink-0 text-slate-400">📍</span>
                          <span className="text-slate-700">{s.description}</span>
                        </button>
                      ))}
                      <div className="flex items-center justify-end gap-1 border-t border-slate-100 px-4 py-1.5">
                        <span className="text-[10px] text-slate-400">Powered by</span>
                        <span className="text-[10px] font-medium text-slate-500">Google</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Notes</label>
                <textarea
                  value={bookForm.notes}
                  onChange={e => setBookForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Any prep notes or special instructions…"
                  className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {bookFormMsg && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{bookFormMsg}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={saveBooking}
                  disabled={bookSaving}
                  className="flex-1 rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40 transition"
                >
                  {bookSaving ? 'Saving…' : 'Book Appointment'}
                </button>
                <button
                  onClick={() => setShowBookModal(false)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddPatientModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddPatientModal(false) }}
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Add Patient</h2>
              <button
                onClick={() => setShowAddPatientModal(false)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50 transition"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid gap-4">
              <Field label="Owner">
                <select
                  value={selectedOwnerIdForAdd}
                  onChange={(e) => setSelectedOwnerIdForAdd(e.target.value)}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                >
                  <option value="">Select an owner</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.full_name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Species">
                <select
                  value={addSpecies}
                  onChange={(e) => setAddSpecies(e.target.value as 'equine' | 'canine')}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                >
                  <option value="equine">🐴 Equine (Horse)</option>
                  <option value="canine">🐕 Canine (Dog)</option>
                </select>
              </Field>

              <Field label="Patient Name">
                <input
                  value={horseName}
                  onChange={(e) => setHorseName(e.target.value)}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                  placeholder={addSpecies === 'canine' ? 'Dog name' : 'Horse name'}
                  autoFocus
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Breed">
                  <input
                    value={horseBreed}
                    onChange={(e) => setHorseBreed(e.target.value)}
                    className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                    placeholder="Breed"
                  />
                </Field>

                <Field label={addSpecies === 'canine' ? 'Activity / Sport' : 'Discipline'}>
                  <input
                    value={horseDiscipline}
                    onChange={(e) => setHorseDiscipline(e.target.value)}
                    className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                    placeholder={addSpecies === 'canine' ? 'Agility, hunting, sport…' : 'Barrel, ranch, dressage…'}
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Age">
                  <input
                    value={horseAge}
                    onChange={(e) => setHorseAge(e.target.value)}
                    className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                    placeholder="e.g. 5 years"
                  />
                </Field>

                <Field label="Gender">
                  <select
                    value={horseGender}
                    onChange={(e) => setHorseGender(e.target.value)}
                    className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                  >
                    <option value="">Select gender</option>
                    {addSpecies === 'equine' ? (
                      <>
                        <option value="Mare">Mare</option>
                        <option value="Stallion">Stallion</option>
                        <option value="Gelding">Gelding</option>
                      </>
                    ) : (
                      <>
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                        <option value="Female (Spayed)">Female (Spayed)</option>
                        <option value="Male (Neutered)">Male (Neutered)</option>
                      </>
                    )}
                  </select>
                </Field>
              </div>

              <button
                onClick={addHorse}
                className="min-h-[48px] rounded-2xl bg-[#0f2040] px-5 py-3 text-base font-semibold text-white hover:bg-[#162d55] transition"
              >
                Save Patient
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function StatCard({
  label,
  value,
  onClick,
}: {
  label: string
  value: number
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-3xl bg-white p-4 shadow-md md:p-5 border-l-4 border-[#0f2040] ${
        onClick
          ? 'cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.99]'
          : ''
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-[#0f2040] md:text-4xl">
        {value}
      </p>
    </div>
  )
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'No date'
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
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