'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { supabase } from '../lib/supabase'
import {
  offlineDb,
  cacheAppointments,
  getCachedAppointments,
  getCachedHorses,
  getCachedOwners,
} from '../lib/offlineDb'

// ── Types ─────────────────────────────────────────────────────────────────────

type Appointment = {
  id: string
  horse_id: string | null
  owner_id: string | null
  appointment_date: string
  appointment_time: string | null
  duration_minutes: number | null
  location: string | null
  reason: string | null
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
  provider_name: string | null
  notes: string | null
  reminder_sent: boolean
  confirmation_sent: boolean
  visit_id: string | null
  horses?: { name: string; owners?: { full_name: string; email: string | null } | null } | null
  owners?: { full_name: string; email: string | null } | null
}

type Horse = {
  id: string
  name: string
  owner_id: string | null
  species?: 'equine' | 'canine' | null
  owners?: { full_name: string } | null
}

type Owner = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
}

const SQL_SETUP = `
CREATE TABLE appointments (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  horse_id             uuid REFERENCES horses(id) ON DELETE CASCADE,
  owner_id             uuid REFERENCES owners(id) ON DELETE SET NULL,
  appointment_date     date NOT NULL,
  appointment_time     time,
  duration_minutes     integer DEFAULT 60,
  location             text,
  reason               text,
  status               text DEFAULT 'scheduled'
                         CHECK (status IN ('scheduled','confirmed','completed','cancelled')),
  provider_name        text,
  notes                text,
  reminder_sent        boolean DEFAULT false,
  confirmation_sent    boolean DEFAULT false,
  visit_id             uuid REFERENCES visits(id) ON DELETE SET NULL,
  created_at           timestamptz DEFAULT now()
);
CREATE INDEX ON appointments (appointment_date);
CREATE INDEX ON appointments (horse_id);
CREATE INDEX ON appointments (owner_id);
`.trim()

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  scheduled:  'bg-blue-100 text-blue-700',
  confirmed:  'bg-emerald-100 text-emerald-700',
  completed:  'bg-slate-100 text-slate-600',
  cancelled:  'bg-red-100 text-red-500',
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtTime(t: string | null) {
  if (!t) return ''
  const [h, min] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(min).padStart(2, '0')} ${ampm}`
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ── ICS / Apple Calendar helpers ──────────────────────────────────────────────

function generateIcs(appt: Appointment): string {
  const uid = `appt-${appt.id}@shortgo.equine`
  const [y, m, d] = appt.appointment_date.split('-').map(Number)
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateOnly = `${y}${pad(m)}${pad(d)}`

  const now = new Date()
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`

  let dtStart: string
  let dtEnd: string

  if (appt.appointment_time) {
    const [h, min] = appt.appointment_time.split(':').map(Number)
    const duration = appt.duration_minutes || 60
    const start = new Date(y, m - 1, d, h, min, 0)
    const end   = new Date(start.getTime() + duration * 60_000)
    const fmtLocal = (dt: Date) =>
      `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`
    dtStart = `DTSTART:${fmtLocal(start)}`
    dtEnd   = `DTEND:${fmtLocal(end)}`
  } else {
    const nextDay = new Date(y, m - 1, d + 1)
    const nextDateOnly = `${nextDay.getFullYear()}${pad(nextDay.getMonth() + 1)}${pad(nextDay.getDate())}`
    dtStart = `DTSTART;VALUE=DATE:${dateOnly}`
    dtEnd   = `DTEND;VALUE=DATE:${nextDateOnly}`
  }

  const horseName = appt.horses?.name || 'Horse'
  const ownerName = appt.horses?.owners?.full_name
  const summary   = appt.reason
    ? `${appt.reason} — ${horseName}`
    : `Equine Chiropractic — ${horseName}`
  const descParts = [
    ownerName && `Owner: ${ownerName}`,
    appt.reason && `Reason: ${appt.reason}`,
    appt.duration_minutes && `Duration: ${appt.duration_minutes} min`,
    appt.notes,
  ].filter(Boolean)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Stride//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    dtStart,
    dtEnd,
    `SUMMARY:${summary}`,
    descParts.length ? `DESCRIPTION:${descParts.join('\\n')}` : '',
    appt.location ? `LOCATION:${appt.location}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)

  return lines.join('\r\n')
}

function downloadIcs(appt: Appointment) {
  const ics  = generateIcs(appt)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${(appt.horses?.name || 'appointment').replace(/\s+/g, '-')}-${appt.appointment_date}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Empty appointment form state ──────────────────────────────────────────────

type FormState = {
  owner_id: string
  num_animals: number
  appointment_date: string
  appointment_time: string
  duration_minutes: number
  location: string
  reason: string
  status: Appointment['status']
  provider_name: string
  notes: string
}

function emptyForm(date = ''): FormState {
  return {
    owner_id: '',
    num_animals: 1,
    appointment_date: date,
    appointment_time: '09:00',
    duration_minutes: 15,
    location: '',
    reason: '',
    status: 'scheduled',
    provider_name: '',
    notes: '',
  }
}

// ── Inner content ─────────────────────────────────────────────────────────────

function AppointmentsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedHorseId = searchParams.get('horseId') || ''

  const today = todayISO()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userId, setUserId] = useState('')
  const [practitionerName, setPractitionerName] = useState('')
  const [noTable, setNoTable] = useState(false)

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [horses, setHorses] = useState<Horse[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)

  // Calendar state
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth()) // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [view, setView] = useState<'calendar' | 'list'>('calendar')

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [formMsg, setFormMsg] = useState('')

  // Email state
  const [emailingId, setEmailingId] = useState<string | null>(null)
  const [emailMsg, setEmailMsg] = useState<Record<string, string>>({})

  // Status update state
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)

  // ── Owner combobox ───────────────────────────────────────────────────────────
  const [ownerSearch, setOwnerSearch] = useState('')
  const [showOwnerSuggestions, setShowOwnerSuggestions] = useState(false)

  const filteredOwners = useMemo(() => {
    const q = ownerSearch.trim().toLowerCase()
    if (!q) return owners
    return owners.filter(o => o.full_name.toLowerCase().includes(q))
  }, [owners, ownerSearch])

  // ── Location autocomplete ────────────────────────────────────────────────────
  const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [locationSuggestions, setLocationSuggestions] = useState<{ description: string; place_id: string }[]>([])
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)

  // ── Auth ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setUserId(session.user.id)
          setCheckingAuth(false)
          return
        }
        router.push('/login')
        return
      }
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
    }).catch(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUserId(session.user.id)
        setCheckingAuth(false)
      } else {
        router.push('/login')
      }
    })
  }, [router])

  function handleLocationChange(value: string) {
    setForm(f => ({ ...f, location: value }))

    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current)

    if (value.trim().length < 2) {
      setLocationSuggestions([])
      setShowLocationSuggestions(false)
      return
    }

    locationDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?input=${encodeURIComponent(value)}`)
        const data = await res.json()
        if (data.predictions?.length > 0) {
          setLocationSuggestions(data.predictions)
          setShowLocationSuggestions(true)
        } else {
          setLocationSuggestions([])
          setShowLocationSuggestions(false)
        }
      } catch {
        setLocationSuggestions([])
        setShowLocationSuggestions(false)
      }
    }, 300)
  }

  function selectLocation(description: string) {
    setForm(f => ({ ...f, location: description }))
    setLocationSuggestions([])
    setShowLocationSuggestions(false)
  }

  // ── Load data ───────────────────────────────────────────────────────────────

  async function loadAppointments() {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        horses (
          name,
          owners ( full_name, email )
        ),
        owners ( full_name, email )
      `)
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true })

    if (error) {
      if (error.code === '42P01') { setNoTable(true); return }
      // Offline fallback
      if (userId) {
        try {
          const cached = await getCachedAppointments(userId)
          setAppointments(cached.map(a => ({
            ...a, horses: null, owners: null, reminder_sent: false,
            confirmation_sent: false, visit_id: null,
          })) as unknown as Appointment[])
        } catch { /* ignore */ }
      }
      return
    }

    setAppointments((data || []) as unknown as Appointment[])

    // Cache for offline
    if (data) {
      try {
        await cacheAppointments(data.map((a: Record<string, unknown>) => ({
          id: a.id as string, horse_id: (a.horse_id as string) || null,
          owner_id: (a.owner_id as string) || null,
          appointment_date: a.appointment_date as string,
          appointment_time: (a.appointment_time as string) || null,
          duration_minutes: (a.duration_minutes as number) || null,
          location: (a.location as string) || null,
          reason: (a.reason as string) || null, status: a.status as string,
          provider_name: (a.provider_name as string) || null,
          notes: (a.notes as string) || null,
          practitioner_id: userId, cachedAt: Date.now(),
        })))
      } catch { /* ignore */ }
    }
  }

  async function loadHorses() {
    const { data } = await supabase
      .from('horses')
      .select('id, name, owner_id, species, owners(full_name)')
      .eq('archived', false)
      .order('name')
    if (data) {
      setHorses(data as unknown as Horse[])
    } else if (userId) {
      try {
        const cached = await getCachedHorses(userId)
        setHorses(cached.map(h => ({ ...h, owners: null })) as unknown as Horse[])
      } catch { /* ignore */ }
    }
  }

  async function loadOwners() {
    const { data } = await supabase
      .from('owners')
      .select('id, full_name, email, phone')
      .eq('archived', false)
      .order('full_name')
    if (data) {
      setOwners(data as Owner[])
    } else if (userId) {
      try {
        const cached = await getCachedOwners(userId)
        setOwners(cached.map(o => ({ ...o })) as unknown as Owner[])
      } catch { /* ignore */ }
    }
  }

  useEffect(() => {
    if (checkingAuth) return
    async function init() {
      setLoading(true)
      await Promise.all([loadAppointments(), loadHorses(), loadOwners()])
      setLoading(false)
    }
    init()
  }, [checkingAuth])

  // Pre-fill horse from URL
  useEffect(() => {
    if (preselectedHorseId && !showForm) {
      setForm(f => ({ ...f, horse_id: preselectedHorseId, appointment_date: today }))
      setShowForm(true)
    }
  }, [preselectedHorseId])

  // ── Calendar grid ───────────────────────────────────────────────────────────

  const calDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay()
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const cells: Array<number | null> = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [calYear, calMonth])

  const apptsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {}
    for (const a of appointments) {
      if (!map[a.appointment_date]) map[a.appointment_date] = []
      map[a.appointment_date].push(a)
    }
    return map
  }, [appointments])

  function calDateISO(day: number) {
    return `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  // ── Appointments for selected date or upcoming ──────────────────────────────

  const displayedAppointments = useMemo(() => {
    if (view === 'list') {
      return appointments.filter(a => a.appointment_date >= today && a.status !== 'cancelled')
    }
    if (selectedDate) {
      return apptsByDate[selectedDate] || []
    }
    // Default: show today + upcoming 7 days
    const week = new Date()
    week.setDate(week.getDate() + 7)
    const weekISO = week.toISOString().split('T')[0]
    return appointments.filter(a => a.appointment_date >= today && a.appointment_date <= weekISO)
  }, [view, selectedDate, appointments, apptsByDate, today])

  // ── Conflict detection ───────────────────────────────────────────────────────

  const conflictWarning = useMemo(() => {
    if (!form.appointment_date || !showForm) return ''

    // Helper: "HH:MM" → minutes since midnight
    function toMin(t: string) {
      const [h, m] = t.split(':').map(Number)
      return h * 60 + m
    }

    const sameDay = appointments.filter(a =>
      a.appointment_date === form.appointment_date &&
      a.id !== editingId &&
      a.status !== 'cancelled'
    )

    if (sameDay.length === 0) return ''

    // If no time on the new appointment, just flag the count
    if (!form.appointment_time) {
      const n = sameDay.length
      return `There ${n === 1 ? 'is' : 'are'} already ${n} appointment${n > 1 ? 's' : ''} on this day.`
    }

    const newStart = toMin(form.appointment_time)
    const newEnd   = newStart + (form.duration_minutes || 15)

    const overlaps = sameDay.filter(a => {
      if (!a.appointment_time) return true // no time = unknown overlap, flag it
      const exStart = toMin(a.appointment_time)
      const exEnd   = exStart + (a.duration_minutes || 15)
      return newStart < exEnd && newEnd > exStart
    })

    if (overlaps.length === 0) return ''

    const names = overlaps
      .map(a => a.owners?.full_name || a.horses?.owners?.full_name || 'Unknown owner')
      .join(', ')
    return `Scheduling conflict: overlaps with ${overlaps.length} existing appointment${overlaps.length > 1 ? 's' : ''} — ${names}.`
  }, [form.appointment_date, form.appointment_time, form.duration_minutes, appointments, editingId, showForm])

  // ── Form handlers ───────────────────────────────────────────────────────────

  function openNewForm(date?: string) {
    setEditingId(null)
    const newForm = emptyForm(date || today)
    newForm.provider_name = practitionerName
    setForm(newForm)
    setOwnerSearch('')
    setShowOwnerSuggestions(false)
    setFormMsg('')
    setShowForm(true)
  }

  function openEditForm(appt: Appointment) {
    setEditingId(appt.id)
    const dur = appt.duration_minutes || 15
    const numAnimals = Math.max(1, Math.round(dur / 15))
    // Populate owner search box with the owner's name
    const ownerObj = owners.find(o => o.id === appt.owner_id)
    setOwnerSearch(ownerObj?.full_name || appt.owners?.full_name || '')
    setShowOwnerSuggestions(false)
    setForm({
      owner_id: appt.owner_id || '',
      num_animals: numAnimals,
      appointment_date: appt.appointment_date,
      appointment_time: appt.appointment_time || '09:00',
      duration_minutes: numAnimals * 15,
      location: appt.location || '',
      reason: appt.reason || '',
      status: appt.status,
      provider_name: appt.provider_name || practitionerName || '',
      notes: appt.notes || '',
    })
    setFormMsg('')
    setShowForm(true)
  }

  async function saveForm() {
    if (!form.owner_id || !form.appointment_date) {
      setFormMsg('Owner and date are required.')
      return
    }
    setSaving(true)
    setFormMsg('')

    const payload = {
      horse_id: null,
      owner_id: form.owner_id,
      appointment_date: form.appointment_date,
      appointment_time: form.appointment_time || null,
      duration_minutes: form.duration_minutes,
      location: form.location || null,
      reason: form.reason || null,
      status: form.status,
      provider_name: form.provider_name || null,
      notes: form.notes || null,
      practitioner_id: userId,
    }

    if (!navigator.onLine && !editingId) {
      // Queue new appointment offline
      try {
        await offlineDb.pendingAppointments.add({
          localId: crypto.randomUUID(),
          horseId: null,
          ownerId: form.owner_id,
          appointmentDate: form.appointment_date,
          appointmentTime: form.appointment_time || null,
          durationMinutes: form.duration_minutes,
          location: form.location || null,
          reason: form.reason || null,
          status: form.status,
          providerName: form.provider_name || null,
          notes: form.notes || null,
          createdAt: new Date().toISOString(),
        })
        setSaving(false)
        setFormMsg('Saved offline — will sync when back online.')
        setTimeout(() => { setShowForm(false); setEditingId(null) }, 1500)
      } catch {
        setSaving(false)
        setFormMsg('Failed to save offline.')
      }
      return
    }

    let error
    if (editingId) {
      const res = await supabase.from('appointments').update(payload).eq('id', editingId)
      error = res.error
    } else {
      const res = await supabase.from('appointments').insert(payload)
      error = res.error
    }

    setSaving(false)
    if (error) { setFormMsg(`Error: ${error.message}`); return }

    await loadAppointments()
    setShowForm(false)
    setEditingId(null)
  }

  async function deleteAppt(id: string) {
    if (!navigator.onLine) { setFormMsg('Cannot delete while offline.'); return }
    if (!confirm('Delete this appointment?')) return
    await supabase.from('appointments').delete().eq('id', id)
    await loadAppointments()
  }

  async function updateStatus(id: string, status: Appointment['status']) {
    if (!navigator.onLine) return
    setUpdatingStatus(id)
    await supabase.from('appointments').update({ status }).eq('id', id)
    await loadAppointments()
    setUpdatingStatus(null)
  }

  // ── Email handlers ──────────────────────────────────────────────────────────

  async function sendEmail(apptId: string, type: 'confirmation' | 'reminder') {
    if (!navigator.onLine) { setEmailMsg(prev => ({ ...prev, [apptId]: 'Cannot send emails while offline.' })); return }
    setEmailingId(apptId)
    setEmailMsg(prev => ({ ...prev, [apptId]: '' }))
    try {
      const res = await fetch(`/api/appointments/${apptId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const json = await res.json()
      if (!res.ok) {
        setEmailMsg(prev => ({ ...prev, [apptId]: json.error || 'Email failed.' }))
      } else {
        setEmailMsg(prev => ({ ...prev, [apptId]: `${type === 'confirmation' ? 'Confirmation' : 'Reminder'} sent!` }))
        await loadAppointments()
      }
    } catch {
      setEmailMsg(prev => ({ ...prev, [apptId]: 'Network error.' }))
    }
    setEmailingId(null)
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  if (checkingAuth) return null

  return (
    <div className="min-h-screen bg-slate-50 pb-20">

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4">
          {/* Row 1: back + title */}
          <div className="flex items-center gap-3 py-3">
            <Link href="/dashboard" className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 flex-shrink-0">
              <span className="sm:hidden">←</span>
              <span className="hidden sm:inline">← Dashboard</span>
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-slate-900 leading-tight sm:text-lg">Appointments</h1>
              <p className="hidden text-xs text-slate-500 sm:block">Schedule &amp; manage visits</p>
            </div>
            {/* Mobile: + New button inline */}
            <button
              onClick={() => openNewForm()}
              className="ml-auto rounded-xl bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 transition sm:hidden flex-shrink-0"
            >
              + New
            </button>
          </div>
          {/* Row 2: toggle + desktop new button */}
          <div className="flex items-center gap-2 pb-2">
            <div className="flex rounded-xl border border-slate-200 overflow-hidden">
              <button onClick={() => setView('calendar')} className={`px-3 py-1.5 text-sm font-medium transition ${view === 'calendar' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Calendar</button>
              <button onClick={() => setView('list')} className={`px-3 py-1.5 text-sm font-medium transition ${view === 'list' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>List</button>
            </div>
            <button
              onClick={() => openNewForm()}
              className="hidden rounded-xl bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 transition sm:block"
            >
              + New Appointment
            </button>
          </div>
        </div>
      </div>

      {/* ── SQL Setup ── */}
      {noTable && (
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="font-semibold text-amber-900">One-time setup needed</h2>
            <p className="mt-1 text-sm text-amber-800">Run this SQL in your Supabase dashboard, then refresh.</p>
            <pre className="mt-4 overflow-x-auto rounded-2xl border border-amber-200 bg-white p-4 text-xs text-slate-700 leading-relaxed">{SQL_SETUP}</pre>
          </div>
        </div>
      )}

      {!noTable && (
        <div className="mx-auto max-w-6xl px-4 py-6">
          {view === 'calendar' ? (
            <div className="grid gap-5 xl:grid-cols-[380px_1fr]">

              {/* ── Calendar ── */}
              <div className="rounded-3xl bg-white p-5 shadow-sm">
                {/* Month nav */}
                <div className="flex items-center justify-between mb-4">
                  <button onClick={prevMonth} className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50 text-slate-600">‹</button>
                  <h2 className="text-base font-semibold text-slate-900">{MONTHS[calMonth]} {calYear}</h2>
                  <button onClick={nextMonth} className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50 text-slate-600">›</button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 mb-1">
                  {DAYS.map(d => (
                    <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-0.5">
                  {calDays.map((day, idx) => {
                    if (!day) return <div key={idx} />
                    const iso = calDateISO(day)
                    const dayAppts = apptsByDate[iso] || []
                    const isToday = iso === today
                    const isSelected = iso === selectedDate
                    const hasActive = dayAppts.some(a => a.status !== 'cancelled')

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedDate(iso === selectedDate ? null : iso)
                        }}
                        className={[
                          'relative flex flex-col items-center rounded-xl py-2 transition',
                          isSelected ? 'bg-slate-900 text-white' : isToday ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700',
                        ].join(' ')}
                      >
                        <span className="text-sm font-medium">{day}</span>
                        {hasActive && (
                          <div className="flex gap-0.5 mt-0.5">
                            {dayAppts.slice(0, 3).filter(a => a.status !== 'cancelled').map((a, i) => (
                              <span key={i} className={`h-1.5 w-1.5 rounded-full ${
                                isSelected ? 'bg-white' :
                                a.status === 'confirmed' ? 'bg-emerald-500' :
                                a.status === 'completed' ? 'bg-slate-400' :
                                'bg-blue-400'
                              }`} />
                            ))}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Add for selected date */}
                {selectedDate && (
                  <button
                    onClick={() => openNewForm(selectedDate)}
                    className="mt-4 w-full rounded-2xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 hover:border-slate-400 hover:bg-slate-50 transition"
                  >
                    + Add appointment on {fmtDate(selectedDate)}
                  </button>
                )}

                {/* Legend */}
                <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400" />Scheduled</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Confirmed</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" />Completed</span>
                </div>
              </div>

              {/* ── Appointment list panel ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-600">
                    {selectedDate ? fmtDate(selectedDate) : 'Next 7 days'}
                  </h3>
                  {selectedDate && (
                    <button onClick={() => setSelectedDate(null)} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
                  )}
                </div>

                {loading ? (
                  <p className="text-sm text-slate-400">Loading…</p>
                ) : displayedAppointments.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
                    <p className="text-sm text-slate-400">No appointments {selectedDate ? 'on this day' : 'in the next 7 days'}.</p>
                    <button onClick={() => openNewForm(selectedDate || undefined)} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">
                      + Book one
                    </button>
                  </div>
                ) : (
                  displayedAppointments.map(a => (
                    <AppointmentCard
                      key={a.id}
                      appt={a}
                      onEdit={() => openEditForm(a)}
                      onDelete={() => deleteAppt(a.id)}
                      onStatusChange={(s) => updateStatus(a.id, s)}
                      onEmail={(type) => sendEmail(a.id, type)}
                      updatingStatus={updatingStatus === a.id}
                      emailing={emailingId === a.id}
                      emailMsg={emailMsg[a.id] || ''}
                    />
                  ))
                )}
              </div>
            </div>

          ) : (
            // ── List view ──
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-600">Upcoming appointments</h3>
              </div>

              {loading ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : displayedAppointments.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
                  <p className="text-slate-400 text-sm">No upcoming appointments.</p>
                  <button onClick={() => openNewForm()} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">
                    + Book one
                  </button>
                </div>
              ) : (
                displayedAppointments.map(a => (
                  <AppointmentCard
                    key={a.id}
                    appt={a}
                    onEdit={() => openEditForm(a)}
                    onDelete={() => deleteAppt(a.id)}
                    onStatusChange={(s) => updateStatus(a.id, s)}
                    onEmail={(type) => sendEmail(a.id, type)}
                    updatingStatus={updatingStatus === a.id}
                    emailing={emailingId === a.id}
                    emailMsg={emailMsg[a.id] || ''}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Create / Edit Form Drawer ── */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative z-50 w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900">{editingId ? 'Edit Appointment' : 'New Appointment'}</h2>
              <button onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">✕</button>
            </div>

            <div className="space-y-4">
              {/* Owner — type-ahead combobox */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Owner <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input
                    type="text"
                    value={ownerSearch}
                    onChange={e => {
                      setOwnerSearch(e.target.value)
                      // Clear the selected id so validation doesn't pass on a stale id
                      setForm(f => ({ ...f, owner_id: '' }))
                      setShowOwnerSuggestions(true)
                    }}
                    onFocus={() => setShowOwnerSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowOwnerSuggestions(false), 150)}
                    placeholder="Type to search owner…"
                    autoComplete="off"
                    className={`w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                      form.owner_id ? 'border-emerald-300' : 'border-slate-200'
                    }`}
                  />
                  {/* Checkmark when a valid owner is selected */}
                  {form.owner_id && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 text-base pointer-events-none">✓</span>
                  )}
                  {/* Suggestions dropdown */}
                  {showOwnerSuggestions && filteredOwners.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                      {filteredOwners.map((o, i) => (
                        <button
                          key={o.id}
                          type="button"
                          onMouseDown={() => {
                            setOwnerSearch(o.full_name)
                            setForm(f => ({ ...f, owner_id: o.id }))
                            setShowOwnerSuggestions(false)
                          }}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50 ${
                            i < filteredOwners.length - 1 ? 'border-b border-slate-100' : ''
                          } ${form.owner_id === o.id ? 'bg-slate-50' : ''}`}
                        >
                          <span className="font-medium text-slate-800">{o.full_name}</span>
                          {o.phone && <span className="ml-auto shrink-0 text-xs text-slate-400">{o.phone}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* No results hint */}
                  {showOwnerSuggestions && ownerSearch.trim().length > 0 && filteredOwners.length === 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl">
                      <p className="text-sm text-slate-400">No owners found for &ldquo;{ownerSearch}&rdquo;</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Number of animals */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Number of Animals</label>
                <select
                  value={form.num_animals}
                  onChange={e => {
                    const n = Number(e.target.value)
                    setForm(f => ({ ...f, num_animals: n, duration_minutes: n * 15 }))
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <option key={n} value={n}>{n} animal{n > 1 ? 's' : ''} — {n * 15} min</option>
                  ))}
                </select>
              </div>

              {/* Duration auto-display */}
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <span>⏱</span>
                <span>Total duration: <strong className="text-slate-900">{form.duration_minutes} min</strong> ({form.num_animals} animal{form.num_animals > 1 ? 's' : ''} × 15 min each)</span>
              </div>

              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Date <span className="text-red-400">*</span></label>
                  <input
                    type="date"
                    value={form.appointment_date}
                    onChange={e => setForm(f => ({ ...f, appointment_date: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Time</label>
                  <input
                    type="time"
                    value={form.appointment_time}
                    onChange={e => setForm(f => ({ ...f, appointment_time: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Conflict warning */}
              {conflictWarning && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <span className="mt-0.5 shrink-0">⚠️</span>
                  <span>{conflictWarning} You can still book, but check the schedule first.</span>
                </div>
              )}

              {/* Status */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Status</label>
                <select
                  value={form.status}
                  onChange={e => { const s = e.target.value as Appointment['status']; setForm(f => ({ ...f, status: s })) }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Reason */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Reason</label>
                <input
                  type="text"
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Routine adjustment, Post-competition"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Location with Google Places autocomplete */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Location</label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.location}
                    onChange={e => handleLocationChange(e.target.value)}
                    onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 150)}
                    onFocus={() => form.location.length >= 2 && locationSuggestions.length > 0 && setShowLocationSuggestions(true)}
                    placeholder="Start typing an address or barn name…"
                    autoComplete="off"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  {/* Suggestions dropdown */}
                  {showLocationSuggestions && locationSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                      {locationSuggestions.map((s, i) => (
                        <button
                          key={s.place_id}
                          type="button"
                          onMouseDown={() => selectLocation(s.description)}
                          className={`flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50 ${i < locationSuggestions.length - 1 ? 'border-b border-slate-100' : ''}`}
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
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Any prep notes or special instructions…"
                  className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {formMsg && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formMsg}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={saveForm}
                  disabled={saving}
                  className="flex-1 rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40 transition"
                >
                  {saving ? 'Saving…' : editingId ? 'Update Appointment' : 'Book Appointment'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Appointment Card ───────────────────────────────────────────────────────────

function AppointmentCard({
  appt,
  onEdit,
  onDelete,
  onStatusChange,
  onEmail,
  updatingStatus,
  emailing,
  emailMsg,
}: {
  appt: Appointment
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (s: Appointment['status']) => void
  onEmail: (type: 'confirmation' | 'reminder') => void
  updatingStatus: boolean
  emailing: boolean
  emailMsg: string
}) {
  // Support both owner-based (new) and horse-based (legacy) appointments
  const horseName = appt.horses?.name || null
  const ownerName = appt.owners?.full_name || appt.horses?.owners?.full_name || '—'
  const ownerEmail = appt.owners?.email || appt.horses?.owners?.email
  const numAnimals = appt.duration_minutes ? Math.max(1, Math.round(appt.duration_minutes / 15)) : null
  const canEmail = !!ownerEmail && appt.status !== 'cancelled'

  return (
    <div className={`rounded-3xl bg-white p-5 shadow-sm border-l-4 ${
      appt.status === 'confirmed' ? 'border-emerald-400' :
      appt.status === 'completed' ? 'border-slate-300' :
      appt.status === 'cancelled' ? 'border-red-300' :
      'border-blue-400'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-slate-900 truncate">{ownerName}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[appt.status]}`}>
              {STATUS_LABELS[appt.status]}
            </span>
          </div>
          {horseName && (
            <p className="text-sm text-slate-500 mt-0.5">
              {appt.horse_id
                ? <Link href={`/horses/${appt.horse_id}`} className="hover:underline">{horseName}</Link>
                : horseName}
            </p>
          )}
          {numAnimals && !horseName && (
            <p className="text-sm text-slate-500 mt-0.5">{numAnimals} animal{numAnimals > 1 ? 's' : ''}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold text-slate-800">{fmtDate(appt.appointment_date)}</p>
          {appt.appointment_time && <p className="text-xs text-slate-500">{fmtTime(appt.appointment_time)} · {appt.duration_minutes || 15} min</p>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        {appt.reason && <span className="rounded-full bg-slate-100 px-2.5 py-1">{appt.reason}</span>}
        {appt.location && <span className="rounded-full bg-slate-100 px-2.5 py-1">📍 {appt.location}</span>}
        {appt.notes && <span className="rounded-full bg-slate-100 px-2.5 py-1 italic">{appt.notes}</span>}
      </div>

      {/* Actions row */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">

        {/* Status changer */}
        {appt.status !== 'completed' && appt.status !== 'cancelled' && (
          <>
            {appt.status === 'scheduled' && (
              <button onClick={() => onStatusChange('confirmed')} disabled={updatingStatus} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-40">
                Mark Confirmed
              </button>
            )}
            {appt.status === 'confirmed' && (
              <button onClick={() => onStatusChange('completed')} disabled={updatingStatus} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition disabled:opacity-40">
                Mark Completed
              </button>
            )}
            <button onClick={() => onStatusChange('cancelled')} disabled={updatingStatus} className="rounded-xl border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-100 transition disabled:opacity-40">
              Cancel
            </button>
          </>
        )}

        {/* Email button — reminder includes confirm link */}
        {canEmail && (appt.status === 'scheduled' || appt.status === 'confirmed') && (
          <button onClick={() => onEmail('reminder')} disabled={emailing} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition disabled:opacity-40">
            {emailing ? '…' : appt.reminder_sent ? '✓ Resend Reminder' : 'Send Reminder'}
          </button>
        )}
        {!ownerEmail && appt.status !== 'cancelled' && (
          <span className="text-xs text-amber-500">No owner email on file</span>
        )}

        <div className="ml-auto flex gap-2">
          {appt.status !== 'cancelled' && (
            <button
              onClick={() => downloadIcs(appt)}
              title="Add to Calendar"
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              <span className="hidden sm:inline">📅 Add to Calendar</span>
              <span className="sm:hidden">📅</span>
            </button>
          )}
          <button onClick={onEdit} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">Edit</button>
          <button onClick={onDelete} className="rounded-xl border border-red-100 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-50 transition">Delete</button>
        </div>
      </div>

      {emailMsg && (
        <p className={`mt-2 text-xs font-medium ${emailMsg.includes('sent') ? 'text-emerald-600' : 'text-red-500'}`}>{emailMsg}</p>
      )}
    </div>
  )
}

// ── Page wrapper ──────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading…</div>}>
      <AppointmentsContent />
    </Suspense>
  )
}
