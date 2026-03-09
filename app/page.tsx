'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'

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
  species: 'equine' | 'canine' | null
  archived: boolean
  created_at: string
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
  appointment_time: string | null
  duration_minutes: number | null
  reason: string | null
  status: string
  location: string | null
  notes: string | null
  horses?: {
    id: string
    name: string
    species?: 'equine' | 'canine' | null
    owners?: { full_name: string; phone: string | null } | null
  } | null
}

type SearchMode = 'owner' | 'horse' | 'visit'

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
  const [message, setMessage] = useState('')

  const [owners, setOwners] = useState<Owner[]>([])
  const [horses, setHorses] = useState<Horse[]>([])
  const [visitCount, setVisitCount] = useState(0)
  const [photoCount, setPhotoCount] = useState(0)
  const [visitCountsByHorse, setVisitCountsByHorse] = useState<Record<string, number>>({})
  const [recentVisits, setRecentVisits] = useState<Visit[]>([])
  const [todayAppointments, setTodayAppointments] = useState<TodayAppointment[]>([])

  const findRecordsRef = useRef<HTMLDivElement>(null)

  function handleStatCardClick(mode: SearchMode) {
    setSearchMode(mode)
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
  const [barnLocation, setBarnLocation] = useState('')
  const [addSpecies, setAddSpecies] = useState<'equine' | 'canine'>('equine')

  const [searchMode, setSearchMode] = useState<SearchMode>('owner')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null)

  const [editingOwner, setEditingOwner] = useState(false)
  const [ownerNameEdit, setOwnerNameEdit] = useState('')
  const [ownerPhoneEdit, setOwnerPhoneEdit] = useState('')
  const [ownerEmailEdit, setOwnerEmailEdit] = useState('')
  const [ownerAddressEdit, setOwnerAddressEdit] = useState('')

  const [recentOwnerIds, setRecentOwnerIds] = useState<string[]>([])
  const [recentHorseIds, setRecentHorseIds] = useState<string[]>([])

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

    setHorses((data || []) as Horse[])
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
        appointment_time,
        duration_minutes,
        reason,
        status,
        location,
        notes,
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
        barn_location: barnLocation || null,
        species: addSpecies,
        archived: false,
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
    setBarnLocation('')
    setAddSpecies('equine')
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

  const filteredOwners = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    if (searchMode !== 'owner') return []
    if (!query) return owners

    return owners.filter((owner) => {
      return (
        owner.full_name.toLowerCase().includes(query) ||
        (owner.phone || '').toLowerCase().includes(query) ||
        (owner.email || '').toLowerCase().includes(query) ||
        (owner.address || '').toLowerCase().includes(query)
      )
    })
  }, [owners, searchTerm, searchMode])

  const filteredHorses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    if (searchMode === 'horse') {
      if (!query) return []

      return horses.filter((horse) => {
        return (
          horse.name.toLowerCase().includes(query) ||
          (horse.owners?.full_name || '').toLowerCase().includes(query) ||
          (horse.breed || '').toLowerCase().includes(query) ||
          (horse.discipline || '').toLowerCase().includes(query) ||
          (horse.barn_location || '').toLowerCase().includes(query)
        )
      })
    }

    if (!selectedOwnerId) return []

    return horses.filter((horse) => horse.owner_id === selectedOwnerId)
  }, [horses, searchTerm, searchMode, selectedOwnerId])

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

  const filteredVisits = useMemo(() => {
    if (searchMode !== 'visit') return []
    const query = searchTerm.trim().toLowerCase()
    if (!query) return recentVisits
    return recentVisits.filter((visit) => {
      return (
        (visit.reason_for_visit || '').toLowerCase().includes(query) ||
        (visit.visit_date || '').includes(query) ||
        (visit.horses?.name || '').toLowerCase().includes(query) ||
        (visit.horses?.owners?.full_name || '').toLowerCase().includes(query)
      )
    })
  }, [recentVisits, searchTerm, searchMode])

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
      loadRecentItems()
    }

    init()
  }, [])

  useEffect(() => {
    if (searchMode === 'horse') {
      setSelectedOwnerId(null)
      setEditingOwner(false)
    }
  }, [searchMode])

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
      <main className="min-h-screen bg-[#edf2f7] p-4 md:p-8">
        <div className="mx-auto max-w-7xl rounded-3xl bg-white p-6 shadow-md">
          <p className="text-slate-700">Checking login...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#edf2f7] p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-3xl bg-white p-5 shadow-md md:p-6">
          <div className="flex items-center gap-5">
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl bg-[#edf2f7]">
              <Image
                src="/logo.png"
                alt="Short-Go logo"
                fill
                className="object-contain p-1"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
                Client Dashboard
              </h1>
              <p className="mt-1 text-sm text-slate-600 md:text-base">
                Search by owner or horse, then open the full horse record.
              </p>
            </div>
          </div>
        </div>

        {/* ── Today's Appointments ── */}
        <div className="mt-5 rounded-3xl bg-white p-5 shadow-md md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">Today's Appointments</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <Link
              href="/appointments"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              View All →
            </Link>
          </div>

          <div className="mt-4">
            {todayAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
                <p className="text-2xl">📅</p>
                <p className="mt-2 text-sm font-medium text-slate-500">No appointments scheduled for today</p>
                <Link
                  href="/appointments"
                  className="mt-3 rounded-xl bg-[#0f2040] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162d55] transition"
                >
                  + Book Appointment
                </Link>
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
                  const species = appt.horses?.species
                  const emoji = species === 'canine' ? '🐕' : '🐴'

                  return (
                    <div
                      key={appt.id}
                      className={`relative rounded-2xl border-l-4 bg-slate-50 p-4 ${
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

                      {/* Patient */}
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-base">{emoji}</span>
                        {appt.horses?.id ? (
                          <Link
                            href={`/horses/${appt.horses.id}`}
                            className="font-semibold text-slate-900 hover:underline"
                          >
                            {appt.horses.name}
                          </Link>
                        ) : (
                          <span className="font-semibold text-slate-900">—</span>
                        )}
                      </div>

                      {/* Owner */}
                      {appt.horses?.owners?.full_name && (
                        <p className="mt-0.5 text-sm text-slate-500">{appt.horses.owners.full_name}</p>
                      )}
                      {appt.horses?.owners?.phone && (
                        <p className="text-xs text-slate-400">{appt.horses.owners.phone}</p>
                      )}

                      {/* Reason + location */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {appt.reason && (
                          <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600">{appt.reason}</span>
                        )}
                        {appt.location && (
                          <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600">📍 {appt.location}</span>
                        )}
                        {appt.duration_minutes && (
                          <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-xs text-slate-400">{appt.duration_minutes} min</span>
                        )}
                      </div>

                      {appt.notes && (
                        <p className="mt-2 text-xs italic text-slate-400">{appt.notes}</p>
                      )}
                    </div>
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
                Owner results are scrollable. Horse results appear through search.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-[180px_1fr] xl:min-w-[560px]">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Search By
                </label>
                <select
                  value={searchMode}
                  onChange={(e) => setSearchMode(e.target.value as SearchMode)}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                >
                  <option value="owner">Owner</option>
                  <option value="horse">Patient</option>
                  <option value="visit">Visit</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Search
                </label>
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                  placeholder={
                    searchMode === 'owner'
                      ? 'Search owner name, phone, email, or address...'
                      : searchMode === 'horse'
                      ? 'Search patient, owner, breed, discipline, location...'
                      : 'Search visit by horse, owner, date (2026-03-07), or reason...'
                  }
                />
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[340px_1fr]">
            <div className="rounded-3xl bg-[#edf2f7] p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900">
                  {searchMode === 'owner' ? 'Owner Results' : searchMode === 'horse' ? 'All Patients' : 'Visit Results'}
                </h3>
                <span className="text-xs text-slate-500">
                  {searchMode === 'owner'
                    ? `${filteredOwners.length} result${filteredOwners.length === 1 ? '' : 's'}`
                    : searchMode === 'horse'
                    ? `${horses.length} patient${horses.length === 1 ? '' : 's'}`
                    : `${filteredVisits.length} result${filteredVisits.length === 1 ? '' : 's'}`}
                </span>
              </div>

              <div className="mt-4 h-[520px] overflow-y-scroll pr-2">
                <div className="space-y-3">
                  {searchMode === 'owner' ? (
                    filteredOwners.length === 0 ? (
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
                            }}
                            className={`w-full rounded-2xl border p-4 text-left transition ${
                              isSelected
                                ? 'border-[#0f2040] bg-[#0f2040] text-white'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                            }`}
                          >
                            <p className="font-semibold">{owner.full_name}</p>
                            <p
                              className={`mt-1 text-sm ${
                                isSelected ? 'text-slate-300' : 'text-slate-500'
                              }`}
                            >
                              {formatPhone(owner.phone)}
                            </p>
                            <p
                              className={`text-sm ${
                                isSelected ? 'text-slate-300' : 'text-slate-500'
                              }`}
                            >
                              {owner.email || 'No email'}
                            </p>
                            <p
                              className={`mt-1 text-sm ${
                                isSelected ? 'text-slate-300' : 'text-slate-500'
                              }`}
                            >
                              {owner.address || 'No address'}
                            </p>
                          </button>
                        )
                      })
                    )
                  ) : searchMode === 'horse' ? (
                    horses.length === 0 ? (
                      <p className="text-sm text-slate-500">No horses on file yet.</p>
                    ) : (
                      [...horses].sort((a, b) => a.name.localeCompare(b.name)).map((horse) => (
                        <Link
                          key={horse.id}
                          href={`/horses/${horse.id}`}
                          className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
                        >
                          <p className="font-semibold text-slate-900">{horse.name}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            Owner: {horse.owners?.full_name || '—'}
                          </p>
                          <p className="text-sm text-slate-500">
                            {horse.discipline || 'No discipline'}
                          </p>
                        </Link>
                      ))
                    )
                  ) : filteredVisits.length === 0 ? (
                    <p className="text-sm text-slate-500">No visits found.</p>
                  ) : (
                    filteredVisits.map((visit) => (
                      <Link
                        key={visit.id}
                        href={`/horses/${visit.horse_id}`}
                        className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
                      >
                        <p className="font-semibold text-slate-900">
                          {visit.horses?.name || '—'}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDate(visit.visit_date)}
                        </p>
                        <p className="text-sm text-slate-500">
                          {visit.reason_for_visit || 'No reason noted'}
                        </p>
                        <p className="text-sm text-slate-400">
                          {visit.horses?.owners?.full_name || '—'}
                        </p>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6">
              {searchMode === 'visit' ? (
                <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-300">
                  <p className="text-center text-slate-500">
                    Click any visit to open the horse record.
                  </p>
                </div>
              ) : searchMode === 'owner' ? (
                !selectedOwner ? (
                  <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-300">
                    <p className="text-slate-500">Select an owner to view horses.</p>
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
                        </div>

                        {!editingOwner ? (
                          <div className="flex flex-wrap gap-2">
                            <a
                              href={`/intake/${selectedOwner.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 hover:bg-slate-50 transition"
                            >
                              📋 Intake Form
                            </a>
                            <button
                              onClick={() => startOwnerEdit(selectedOwner)}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                            >
                              Edit Owner
                            </button>
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
                      <h4 className="text-lg font-semibold text-slate-900">
                        Patients
                      </h4>

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
                              <div className="flex items-start justify-between gap-3">
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

                              <div className="mt-4 text-sm text-slate-600">
                                <p>Barn: {horse.barn_location || '—'}</p>
                              </div>
                            </Link>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    Matching Patients
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Click a patient to open info, visits, and pictures.
                  </p>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {filteredHorses.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        {searchTerm.trim() ? 'No patients match your search.' : 'Type above to search patients.'}
                      </p>
                    ) : (
                      filteredHorses.map((horse) => (
                        <Link
                          key={horse.id}
                          href={`/horses/${horse.id}`}
                          className="rounded-3xl border border-slate-200 p-5 transition hover:border-slate-400 hover:bg-slate-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xl font-semibold text-slate-900">
                                {horse.name}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                Owner: {horse.owners?.full_name || '—'}
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

                          <div className="mt-4 grid gap-1 text-sm text-slate-600">
                            <p>Breed: {horse.breed || '—'}</p>
                            <p>Barn: {horse.barn_location || '—'}</p>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <div className="rounded-3xl bg-white p-5 shadow-md md:p-6">
            <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
              Quick Add Owner
            </h2>

            <div className="mt-4 grid gap-4">
              <Field label="Full Name">
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                  placeholder="Owner full name"
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
                className="min-h-[48px] rounded-2xl bg-slate-900 px-5 py-3 text-base font-medium text-white"
              >
                Save Owner
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-md md:p-6">
            <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
              Quick Add Patient
            </h2>

            <div className="mt-4 grid gap-4">
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
                  <option value="equine">Equine (Horse)</option>
                  <option value="canine">Canine (Dog)</option>
                </select>
              </Field>

              <Field label="Patient Name">
                <input
                  value={horseName}
                  onChange={(e) => setHorseName(e.target.value)}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                  placeholder={addSpecies === 'canine' ? 'Dog name' : 'Horse name'}
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
                    placeholder={addSpecies === 'canine' ? 'Agility, hunting, sport, etc.' : 'Barrel, ranch, dressage, etc.'}
                  />
                </Field>
              </div>

              <Field label="Location">
                <input
                  value={barnLocation}
                  onChange={(e) => setBarnLocation(e.target.value)}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                  placeholder={addSpecies === 'canine' ? 'City, kennel, or home' : 'Barn or ranch name'}
                />
              </Field>

              <button
                onClick={addHorse}
                className="min-h-[48px] rounded-2xl bg-slate-900 px-5 py-3 text-base font-medium text-white"
              >
                Save Patient
              </button>
            </div>
          </div>
        </div>

        {message ? (
          <div className="mt-5 rounded-3xl bg-white p-4 text-sm text-slate-700 shadow-sm">
            {message}
          </div>
        ) : null}
      </div>
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