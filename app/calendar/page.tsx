'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import {
  offlineDb,
  cacheAppointments,
  getCachedAppointments,
  getCachedOwners,
  getCachedHorses,
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
  horses?: { name: string; species?: 'equine' | 'canine' | null; owners?: { full_name: string } | null } | null
  owners?: { full_name: string } | null
}

type BlockedTime = {
  id: string
  block_date: string
  start_time: string
  end_time: string
  label: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GRID_START_HOUR = 7
const GRID_END_HOUR = 19
const GRID_TOTAL_MINS = (GRID_END_HOUR - GRID_START_HOUR) * 60

const PX_PER_MIN = 1.6
const GRID_HEIGHT = GRID_TOTAL_MINS * PX_PER_MIN

const HOUR_LABELS: string[] = []
for (let h = GRID_START_HOUR; h <= GRID_END_HOUR; h++) {
  const ampm = h < 12 ? 'AM' : 'PM'
  const display = h === 12 ? 12 : h > 12 ? h - 12 : h
  HOUR_LABELS.push(`${display}:00 ${ampm}`)
}

const STATUS_BG: Record<string, string> = {
  scheduled: 'bg-blue-500',
  confirmed:  'bg-emerald-500',
  completed:  'bg-slate-400',
  cancelled:  'bg-red-400',
}

const STATUS_BORDER: Record<string, string> = {
  scheduled: 'border-blue-700',
  confirmed:  'border-emerald-700',
  completed:  'border-slate-600',
  cancelled:  'border-red-600',
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  confirmed:  'Confirmed',
  completed:  'Completed',
  cancelled:  'Cancelled',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatDayNum(date: Date): number {
  return date.getDate()
}

function timeToMins(t: string | null): number {
  if (!t) return -1
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function formatTime12(t: string | null): string {
  if (!t) return ''
  const mins = timeToMins(t)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const ampm = h < 12 ? 'AM' : 'PM'
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`
}

// ── Mobile detection ──────────────────────────────────────────────────────────

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

// ── Mini Calendar ─────────────────────────────────────────────────────────────

function MiniCalendar({
  selected,
  onSelect,
}: {
  selected: Date
  onSelect: (d: Date) => void
}) {
  const [view, setView] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1))

  const year      = view.getFullYear()
  const month     = view.getMonth()
  const firstDay  = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const today = new Date()

  return (
    <div className="rounded-xl border border-[#1a3358] bg-[#0d1b30] p-3 select-none">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => setView(new Date(year, month - 1, 1))} className="rounded p-1 text-blue-300 hover:bg-white/10">◀</button>
        <span className="text-xs font-semibold text-white">
          {view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={() => setView(new Date(year, month + 1, 1))} className="rounded p-1 text-blue-300 hover:bg-white/10">▶</button>
      </div>
      <div className="mb-1 grid grid-cols-7 text-center">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-[10px] font-bold text-blue-400">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px text-center">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const thisDate = new Date(year, month, day)
          const isToday  = toISO(thisDate) === toISO(today)
          const isSel    = toISO(thisDate) === toISO(selected)
          return (
            <button
              key={i}
              onClick={() => onSelect(thisDate)}
              className={`rounded text-xs py-0.5 leading-5 transition
                ${isSel  ? 'bg-[#c9a227] font-bold text-[#0f2040]' :
                  isToday ? 'bg-blue-600 text-white font-semibold' :
                  'text-blue-100 hover:bg-white/10'}`}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Appointment Popup (desktop: positioned card | mobile: bottom sheet) ────────

function ApptPopup({
  appt,
  onClose,
  isMobile,
  onNotesSaved,
  patientCount,
  onEditAppt,
  onCancelAppt,
  onDeleteAppt,
}: {
  appt: Appointment
  onClose: () => void
  isMobile: boolean
  onNotesSaved: (id: string, notes: string) => void
  patientCount: number
  onEditAppt: (appt: Appointment) => void
  onCancelAppt: (id: string) => void
  onDeleteAppt: (id: string) => void
}) {
  const ownerName   = appt.owners?.full_name ?? appt.horses?.owners?.full_name ?? 'Unknown Owner'
  const patientName = appt.horses?.name ?? ''
  const species     = appt.horses?.species ?? null

  const [notes, setNotes]       = useState(appt.notes ?? '')
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [err, setErr]           = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!window.confirm('Permanently delete this appointment? This cannot be undone.')) return
    setDeleting(true)
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', appt.id)
    setDeleting(false)
    if (error) {
      setErr('Failed to delete. Please try again.')
    } else {
      onDeleteAppt(appt.id)
      onClose()
    }
  }

  async function handleCancel() {
    if (!window.confirm('Cancel this appointment?')) return
    setCancelling(true)
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appt.id)
    setCancelling(false)
    if (error) {
      setErr('Failed to cancel. Please try again.')
    } else {
      onCancelAppt(appt.id)
      onClose()
    }
  }

  const isDirty = notes !== (appt.notes ?? '')

  async function handleSave() {
    setSaving(true)
    setErr(null)
    const { error } = await supabase
      .from('appointments')
      .update({ notes })
      .eq('id', appt.id)
    setSaving(false)
    if (error) {
      setErr('Failed to save. Please try again.')
    } else {
      setSaved(true)
      onNotesSaved(appt.id, notes)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const inner = (
    <div onClick={e => e.stopPropagation()}>
      {/* Handle bar (mobile only) */}
      {isMobile && (
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{species === 'canine' ? '🐕' : '🐴'}</span>
          <div>
            <div className="font-semibold text-white text-sm">{patientName}</div>
            <div className="text-xs text-blue-300">{ownerName}</div>
          </div>
        </div>
        <button onClick={onClose} className="text-white/50 hover:text-white text-lg leading-none">×</button>
      </div>

      {/* Details */}
      <div className="px-4 space-y-1 text-xs text-blue-200">
        <div className="flex gap-2">
          <span className="text-blue-400 shrink-0">Time:</span>
          <span>{formatTime12(appt.appointment_time)}</span>
          {appt.duration_minutes && <span className="text-white/50">({appt.duration_minutes} min)</span>}
        </div>
        {appt.reason && (
          <div className="flex gap-2">
            <span className="text-blue-400 shrink-0">Reason:</span>
            <span>{appt.reason}</span>
          </div>
        )}
        {appt.location && (
          <div className="flex gap-2 items-center">
            <span className="text-blue-400 shrink-0">Location:</span>
            <span className="flex-1">{appt.location}</span>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(appt.location)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in Google Maps"
              className="text-base leading-none hover:scale-110 transition-transform"
              onClick={e => e.stopPropagation()}
            >
              🗺️
            </a>
          </div>
        )}
        {appt.provider_name && (
          <div className="flex gap-2">
            <span className="text-blue-400 shrink-0">Provider:</span>
            <span>{appt.provider_name}</span>
          </div>
        )}
        <div className="flex gap-2 items-center">
          <span className="text-blue-400 shrink-0">Status:</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${STATUS_BG[appt.status]}`}>
            {STATUS_LABEL[appt.status]}
          </span>
        </div>
        <div className="flex gap-2 items-center pt-0.5 border-t border-white/10 mt-1">
          <span className="text-blue-400 shrink-0">Patients at this stop:</span>
          <span className="font-semibold text-white">{patientCount}</span>
        </div>
      </div>

      {/* Notes */}
      <div className="px-4 pt-3 pb-1">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[11px] font-bold uppercase tracking-wider text-blue-400">Notes</label>
          {saved && <span className="text-[10px] text-emerald-400 font-semibold">✓ Saved</span>}
        </div>
        <textarea
          value={notes}
          onChange={e => { setNotes(e.target.value); setSaved(false) }}
          rows={4}
          placeholder="Add appointment notes…"
          className="w-full resize-none rounded-lg border border-[#1a3358] bg-[#081120] px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227]/40 transition"
        />
        {err && <p className="mt-1 text-[10px] text-red-400">{err}</p>}
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className={`mt-2 w-full rounded-lg py-1.5 text-xs font-semibold transition
            ${isDirty ? 'bg-[#c9a227] text-[#0f2040] hover:bg-[#b89020]' : 'bg-white/5 text-white/30 cursor-not-allowed'}`}
        >
          {saving ? 'Saving…' : 'Save Notes'}
        </button>
      </div>

      {/* Footer links */}
      <div className="flex gap-2 p-4 pt-2">
        {appt.owner_id && (
          <Link
            href={`/owners/${appt.owner_id}`}
            className="flex-1 rounded-lg bg-[#c9a227] px-3 py-2 text-center text-xs font-semibold text-[#0f2040] transition hover:bg-[#b89020]"
          >
            View Owner
          </Link>
        )}
        <button
          onClick={() => { onClose(); onEditAppt(appt) }}
          className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-center text-xs font-medium text-white transition hover:bg-white/10"
        >
          Edit
        </button>
        {appt.status !== 'cancelled' && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="flex-1 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-center text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
          >
            {cancelling ? '…' : 'Cancel'}
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex-1 rounded-lg border border-red-500/40 bg-red-600/20 px-3 py-2 text-center text-xs font-semibold text-red-300 transition hover:bg-red-600/40 disabled:opacity-50"
        >
          {deleting ? '…' : '🗑 Delete'}
        </button>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={onClose}
        />
        {/* Bottom sheet */}
        <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-[#1a3358] bg-[#0d1b30] shadow-2xl">
          {inner}
        </div>
      </>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />
      {/* Centered popup */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className="pointer-events-auto w-72 max-h-[85vh] overflow-y-auto rounded-xl border border-[#1a3358] bg-[#0d1b30] shadow-2xl"
        >
          {inner}
        </div>
      </div>
    </>
  )
}

// ── Quick-Book Modal ──────────────────────────────────────────────────────────

type HorseOption = {
  id: string
  name: string
  species: 'equine' | 'canine' | null
  owner_id: string | null
  owners?: { full_name: string } | null
}

function QuickBookModal({
  date,
  time,
  horses,
  owners,
  locationSuggestions,
  practitionerName,
  onClose,
  onSaved,
}: {
  date: string
  time: string
  horses: HorseOption[]
  owners: { id: string; full_name: string }[]
  locationSuggestions: string[]
  practitionerName: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    date,
    time,
    reason: '',
    location: '',
    notes: '',
  })

  // ── Owner selection ──
  const [ownerSearch, setOwnerSearch] = useState('')
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false)
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null)

  // ── Patient multi-select ──
  const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([])
  const [showPatientDropdown, setShowPatientDropdown] = useState(false)

  // ── Other ──
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showLocSuggestions, setShowLocSuggestions] = useState(false)

  // Click-outside ref for patient dropdown
  const patientDropdownRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showPatientDropdown) return
    function handleOutsideClick(e: MouseEvent) {
      if (patientDropdownRef.current && !patientDropdownRef.current.contains(e.target as Node)) {
        setShowPatientDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showPatientDropdown])

  // Map owners into a consistent shape for display
  const ownerList = owners.map(o => ({ id: o.id, name: o.full_name }))

  const filteredOwners = ownerSearch.length > 0
    ? ownerList.filter(o => o.name.toLowerCase().includes(ownerSearch.toLowerCase()))
    : ownerList

  const selectedOwner = ownerList.find(o => o.id === selectedOwnerId) ?? null

  // Patients that belong to the selected owner
  const ownerPatients = selectedOwnerId
    ? horses.filter(h => h.owner_id === selectedOwnerId)
    : []

  // Duration auto-calculated: 15 min per patient (default 15 if no patients selected)
  const totalDuration = selectedPatientIds.length > 0 ? selectedPatientIds.length * 15 : 15

  const filteredLocations = form.location.length > 0
    ? locationSuggestions.filter(l =>
        l.toLowerCase().includes(form.location.toLowerCase()) &&
        l.toLowerCase() !== form.location.toLowerCase()
      )
    : []

  function togglePatient(id: string) {
    setSelectedPatientIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    if (!form.date || !form.time) { setErr('Date and time are required.'); return }
    if (!selectedOwnerId) { setErr('Select an owner.'); return }
    setSaving(true)
    setErr(null)
    const { data: { user } } = await supabase.auth.getUser()

    let records: Record<string, unknown>[]

    if (selectedPatientIds.length > 0) {
      // Create one 15-min appointment per patient, staggered by 15 min each
      const [startH, startM] = form.time.split(':').map(Number)
      records = selectedPatientIds.map((horseId, i) => {
        const totalMins = startH * 60 + startM + i * 15
        const h = Math.floor(totalMins / 60) % 24
        const m = totalMins % 60
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        return {
          horse_id:         horseId,
          owner_id:         selectedOwnerId,
          appointment_date: form.date,
          appointment_time: timeStr,
          duration_minutes: 15,
          reason:           form.reason || null,
          location:         form.location || null,
          notes:            form.notes || null,
          status:           'scheduled',
          provider_name:    practitionerName || null,
          practitioner_id:  user?.id,
        }
      })
    } else {
      // No patients selected — book for owner only (animal TBD)
      records = [{
        horse_id:         null,
        owner_id:         selectedOwnerId,
        appointment_date: form.date,
        appointment_time: form.time,
        duration_minutes: 15,
        reason:           form.reason || null,
        location:         form.location || null,
        notes:            form.notes || null,
        status:           'scheduled',
        provider_name:    practitionerName || null,
        practitioner_id:  user?.id,
      }]
    }

    if (!navigator.onLine) {
      // Queue all records to Dexie
      try {
        for (const rec of records) {
          await offlineDb.pendingAppointments.add({
            localId: crypto.randomUUID(),
            horseId: (rec.horse_id as string) || null,
            ownerId: rec.owner_id as string,
            appointmentDate: rec.appointment_date as string,
            appointmentTime: (rec.appointment_time as string) || null,
            durationMinutes: rec.duration_minutes as number,
            location: (rec.location as string) || null,
            reason: (rec.reason as string) || null,
            status: 'scheduled',
            providerName: (rec.provider_name as string) || null,
            notes: (rec.notes as string) || null,
            createdAt: new Date().toISOString(),
          })
        }
        setSaving(false)
        onSaved()
        onClose()
      } catch {
        setSaving(false)
        setErr('Failed to save offline.')
      }
      return
    }

    const { error } = await supabase.from('appointments').insert(records)
    setSaving(false)
    if (error) { setErr(error.message); return }
    onSaved()
    onClose()
  }

  const inputCls = 'w-full rounded-lg border border-[#1a3358] bg-[#081120] px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227]/30 transition'

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 p-0 md:p-4" onClick={onClose}>
      <div
        className="w-full md:max-w-md rounded-t-2xl md:rounded-2xl border border-[#1a3358] bg-[#0d1b30] shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a3358]">
          <div>
            <h3 className="font-bold text-white text-base">New Appointment</h3>
            <p className="text-xs text-blue-300 mt-0.5">
              {new Date(form.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              {' · '}{formatTime12(form.time)}
              <span className="ml-1 text-[#c9a227]">· {totalDuration} min{selectedPatientIds.length > 1 ? ' total' : ''}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">

          {/* Date + Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">Time</label>
              <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className={inputCls} />
            </div>
          </div>

          {/* Owner search */}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">Owner</label>
            {selectedOwner ? (
              <div className="flex items-center justify-between rounded-lg border border-[#c9a227] bg-[#081120] px-3 py-2">
                <span className="text-sm font-medium text-white">{selectedOwner.name}</span>
                <button
                  onClick={() => {
                    setSelectedOwnerId(null)
                    setOwnerSearch('')
                    setSelectedPatientIds([])
                  }}
                  className="text-white/40 hover:text-white text-sm ml-2"
                >✕</button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={ownerSearch}
                  onChange={e => { setOwnerSearch(e.target.value); setShowOwnerDropdown(true) }}
                  onFocus={() => setShowOwnerDropdown(true)}
                  onBlur={() => setTimeout(() => setShowOwnerDropdown(false), 150)}
                  placeholder="Search or choose an owner…"
                  className={inputCls}
                  autoComplete="off"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 text-xs">▾</span>
                {showOwnerDropdown && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-lg border border-[#1a3358] bg-[#081120] shadow-xl">
                    {filteredOwners.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-blue-300">No owners found</div>
                    ) : filteredOwners.map(o => (
                      <button
                        key={o.id}
                        type="button"
                        onMouseDown={() => {
                          setSelectedOwnerId(o.id)
                          setOwnerSearch('')
                          setShowOwnerDropdown(false)
                          setSelectedPatientIds([])
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white hover:bg-white/10 transition"
                      >
                        <span className="text-blue-300">👤</span>
                        <span className="font-medium">{o.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Patient multi-select — only shown after owner is selected */}
          {selectedOwnerId && (
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">
                Patients <span className="normal-case font-normal text-blue-400/60">(optional)</span>
                {selectedPatientIds.length > 0 && (
                  <span className="ml-2 normal-case font-normal text-[#c9a227]">
                    {selectedPatientIds.length} selected · {totalDuration} min
                  </span>
                )}
              </label>

              {/* Selected patient chips */}
              {selectedPatientIds.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {selectedPatientIds.map(id => {
                    const h = horses.find(h => h.id === id)!
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full border border-[#c9a227]/50 bg-[#c9a227]/10 px-2.5 py-0.5 text-xs text-[#c9a227]"
                      >
                        {h.species === 'canine' ? '🐕' : '🐴'} {h.name}
                        <button
                          type="button"
                          onClick={() => togglePatient(id)}
                          className="ml-0.5 text-[#c9a227]/60 hover:text-[#c9a227]"
                        >✕</button>
                      </span>
                    )
                  })}
                </div>
              )}

              {ownerPatients.length === 0 ? (
                <p className="text-xs text-blue-300 italic">No patients on file yet — you can still book without one.</p>
              ) : (
                <div className="relative" ref={patientDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowPatientDropdown(v => !v)}
                    className={`${inputCls} flex items-center justify-between text-left`}
                  >
                    <span className={selectedPatientIds.length === 0 ? 'text-white/30' : 'text-white'}>
                      {selectedPatientIds.length === 0
                        ? 'Select patients…'
                        : `${selectedPatientIds.length} patient${selectedPatientIds.length > 1 ? 's' : ''} selected`}
                    </span>
                    <span className="text-blue-400 text-xs">▾</span>
                  </button>
                  {showPatientDropdown && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-lg border border-[#1a3358] bg-[#081120] shadow-xl">
                      {ownerPatients.map(h => {
                        const checked = selectedPatientIds.includes(h.id)
                        return (
                          <button
                            key={h.id}
                            type="button"
                            onMouseDown={e => { e.preventDefault(); togglePatient(h.id) }}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10 transition"
                          >
                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold transition ${
                              checked ? 'border-[#c9a227] bg-[#c9a227] text-[#0f2040]' : 'border-white/30 bg-transparent text-transparent'
                            }`}>✓</span>
                            <span>{h.species === 'canine' ? '🐕' : '🐴'}</span>
                            <span className="font-medium">{h.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">Reason</label>
            <input type="text" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Routine adjustment" className={inputCls} />
          </div>

          {/* Location */}
          <div className="relative">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={e => { setForm(f => ({ ...f, location: e.target.value })); setShowLocSuggestions(true) }}
              onFocus={() => setShowLocSuggestions(true)}
              onBlur={() => setTimeout(() => setShowLocSuggestions(false), 150)}
              placeholder="Barn / address"
              className={inputCls}
              autoComplete="off"
            />
            {showLocSuggestions && filteredLocations.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-lg border border-[#1a3358] bg-[#081120] shadow-lg">
                {filteredLocations.map((loc, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={() => { setForm(f => ({ ...f, location: loc })); setShowLocSuggestions(false) }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white hover:bg-white/10 transition"
                  >
                    <span className="text-blue-400">📍</span>
                    <span>{loc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {err && <p className="text-xs text-red-400">{err}</p>}

          <button
            onClick={handleSave}
            disabled={saving || !selectedOwnerId}
            className="w-full rounded-xl bg-[#c9a227] py-3 text-sm font-bold text-[#0f2040] transition hover:bg-[#b89020] disabled:opacity-40"
          >
            {saving
              ? 'Saving…'
              : selectedPatientIds.length === 0
              ? `✓ Schedule Appointment (${totalDuration} min)`
              : `✓ Schedule ${selectedPatientIds.length} Appointment${selectedPatientIds.length > 1 ? 's' : ''} (${totalDuration} min)`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Appointment Modal ────────────────────────────────────────────────────

function EditApptModal({
  appt,
  horses,
  locationSuggestions,
  onClose,
  onSaved,
}: {
  appt: Appointment
  horses: HorseOption[]
  locationSuggestions: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    date: appt.appointment_date,
    time: appt.appointment_time ?? '',
    duration: String(appt.duration_minutes ?? 60),
    horseId: appt.horse_id ?? '',
    reason: appt.reason ?? '',
    location: appt.location ?? '',
    status: appt.status,
    notes: appt.notes ?? '',
  })
  const [search, setSearch] = useState('')
  const [showPatientDropdown, setShowPatientDropdown] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showLocSuggestions, setShowLocSuggestions] = useState(false)

  const filteredLocations = form.location.length > 0
    ? locationSuggestions.filter(l =>
        l.toLowerCase().includes(form.location.toLowerCase()) &&
        l.toLowerCase() !== form.location.toLowerCase()
      )
    : []

  const filtered = search.length > 0
    ? horses.filter(h =>
        h.name.toLowerCase().includes(search.toLowerCase()) ||
        (h.owners?.full_name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : horses

  const selectedHorse = horses.find(h => h.id === form.horseId) ?? null

  async function handleSave() {
    if (!form.date || !form.time) { setErr('Date and time are required.'); return }
    setSaving(true)
    setErr(null)
    const { error } = await supabase
      .from('appointments')
      .update({
        appointment_date: form.date,
        appointment_time: form.time,
        duration_minutes: parseInt(form.duration) || 60,
        horse_id:         form.horseId || null,
        owner_id:         selectedHorse?.owner_id ?? appt.owner_id,
        reason:           form.reason || null,
        location:         form.location || null,
        status:           form.status,
        notes:            form.notes || null,
      })
      .eq('id', appt.id)
    setSaving(false)
    if (error) { setErr(error.message); return }
    onSaved()
    onClose()
  }

  const inputCls = 'w-full rounded-lg border border-[#1a3358] bg-[#081120] px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227]/30 transition'

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 p-0 md:p-4" onClick={onClose}>
      <div
        className="w-full md:max-w-md rounded-t-2xl md:rounded-2xl border border-[#1a3358] bg-[#0d1b30] shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a3358]">
          <div>
            <h3 className="font-bold text-white text-base">✏️ Edit Appointment</h3>
            <p className="text-xs text-blue-300 mt-0.5">
              {appt.horses?.name
                ? <>{appt.horses.name} · {appt.owners?.full_name ?? appt.horses?.owners?.full_name ?? ''}</>
                : appt.owners?.full_name ?? 'Appointment'
              }
            </p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">

          {/* Date + Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">Time</label>
              <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className={inputCls} />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">Duration</label>
            <select value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} className={inputCls}>
              {['15','30','45','60','75','90','120'].map(d => (
                <option key={d} value={d}>{d} min</option>
              ))}
            </select>
          </div>

          {/* Patient */}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">Patient</label>
            {form.horseId ? (
              <div className="flex items-center justify-between rounded-lg border border-[#c9a227] bg-[#081120] px-3 py-2">
                <span className="text-sm text-white">
                  {selectedHorse?.species === 'canine' ? '🐕 ' : '🐴 '}
                  {selectedHorse?.name}
                  <span className="ml-1 text-xs text-blue-300">— {selectedHorse?.owners?.full_name ?? ''}</span>
                </span>
                <button
                  onClick={() => { setForm(f => ({ ...f, horseId: '' })); setSearch(''); setShowPatientDropdown(false) }}
                  className="text-white/40 hover:text-white text-sm"
                >✕</button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShowPatientDropdown(true) }}
                  onFocus={() => setShowPatientDropdown(true)}
                  onBlur={() => setTimeout(() => setShowPatientDropdown(false), 150)}
                  placeholder="Search or choose a patient…"
                  className={inputCls}
                  autoComplete="off"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 text-xs">▾</span>
                {showPatientDropdown && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-lg border border-[#1a3358] bg-[#081120] shadow-xl">
                    {filtered.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-blue-300">No patients found</div>
                    ) : filtered.slice(0, 20).map(h => (
                      <button
                        key={h.id}
                        type="button"
                        onMouseDown={() => { setForm(f => ({ ...f, horseId: h.id })); setSearch(''); setShowPatientDropdown(false) }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white hover:bg-white/10 transition"
                      >
                        <span>{h.species === 'canine' ? '🐕' : '🐴'}</span>
                        <span className="font-medium">{h.name}</span>
                        {h.owners?.full_name && <span className="text-xs text-blue-300 ml-auto">{h.owners.full_name}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Appointment['status'] }))} className={inputCls}>
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Reason */}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">Reason</label>
            <input type="text" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Routine adjustment" className={inputCls} />
          </div>

          {/* Location */}
          <div className="relative">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={e => { setForm(f => ({ ...f, location: e.target.value })); setShowLocSuggestions(true) }}
              onFocus={() => setShowLocSuggestions(true)}
              onBlur={() => setTimeout(() => setShowLocSuggestions(false), 150)}
              placeholder="Barn / address"
              className={inputCls}
              autoComplete="off"
            />
            {showLocSuggestions && filteredLocations.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-lg border border-[#1a3358] bg-[#081120] shadow-lg">
                {filteredLocations.map((loc, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={() => { setForm(f => ({ ...f, location: loc })); setShowLocSuggestions(false) }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white hover:bg-white/10 transition"
                  >
                    <span className="text-blue-400">📍</span>
                    <span>{loc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Add appointment notes…"
              className={inputCls + ' resize-none'}
            />
          </div>

          {err && <p className="text-xs text-red-400">{err}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-xl bg-[#c9a227] py-3 text-sm font-bold text-[#0f2040] transition hover:bg-[#b89020] disabled:opacity-50"
          >
            {saving ? 'Saving…' : '✓ Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Calendar Page ────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [currentUserId, setCurrentUserId] = useState('')
  const [practitionerName, setPractitionerName] = useState('')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [weekStart, setWeekStart]   = useState<Date>(() => startOfDay(today))
  const [mobileDay, setMobileDay]   = useState<Date>(() => startOfDay(today))
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading]       = useState(true)
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null)
  const [miniCalDate, setMiniCalDate] = useState<Date>(today)

  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([])
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [blockForm, setBlockForm] = useState({ date: toISO(today), startTime: '08:00', endTime: '09:00', label: '' })
  const [savingBlock, setSavingBlock] = useState(false)
  const [blockSaveErr, setBlockSaveErr] = useState<string | null>(null)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<{ block: BlockedTime; x: number; y: number } | null>(null)

  const [horses, setHorses] = useState<HorseOption[]>([])
  const [allOwners, setAllOwners] = useState<{ id: string; full_name: string }[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [quickBook, setQuickBook] = useState<{ date: string; time: string } | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [hoveredSlot, setHoveredSlot] = useState<{ colIdx: number; mins: number } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push('/login'); return }
      setCurrentUserId(data.session.user.id)
      // Fetch practitioner name (skip when offline)
      if (navigator.onLine) {
        const { data: practitioner } = await supabase
          .from('practitioners')
          .select('full_name')
          .eq('id', data.session.user.id)
          .single()
        if (practitioner?.full_name) {
          setPractitionerName(practitioner.full_name)
        }
      }
      setCheckingAuth(false)
    })
  }, [router])

  useEffect(() => {
    if (scrollRef.current) {
      const offset = (8 - GRID_START_HOUR) * 60 * PX_PER_MIN - 20
      scrollRef.current.scrollTop = Math.max(0, offset)
    }
  }, [])

  // Ensure weekStart covers mobileDay when on mobile
  useEffect(() => {
    if (!isMobile) return
    const mobileDayISO = toISO(mobileDay)
    const weekEndISO   = toISO(addDays(weekStart, 6))
    const weekStartISO = toISO(weekStart)
    if (mobileDayISO < weekStartISO || mobileDayISO > weekEndISO) {
      setWeekStart(startOfDay(mobileDay))
    }
  }, [mobileDay, isMobile, weekStart])

  useEffect(() => {
    if (checkingAuth) return
    loadWeek()
    loadHorses()
    loadOwners()
    loadLocations()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, checkingAuth])

  async function loadHorses() {
    const { data } = await supabase
      .from('horses')
      .select('id, name, species, owner_id, owners(full_name)')
      .eq('archived', false)
      .order('name', { ascending: true })
    if (data) {
      setHorses(data as unknown as HorseOption[])
    } else if (currentUserId) {
      try {
        const cached = await getCachedHorses(currentUserId)
        setHorses(cached.map(h => ({ ...h, owners: null })) as unknown as HorseOption[])
      } catch { /* ignore */ }
    }
  }

  async function loadOwners() {
    const { data } = await supabase
      .from('owners')
      .select('id, full_name')
      .order('full_name', { ascending: true })
    if (data) {
      setAllOwners(data)
    } else if (currentUserId) {
      try {
        const cached = await getCachedOwners(currentUserId)
        setAllOwners(cached.map(o => ({ id: o.id, full_name: o.full_name })))
      } catch { /* ignore */ }
    }
  }

  async function loadLocations() {
    const { data } = await supabase
      .from('appointments')
      .select('location')
      .not('location', 'is', null)
    if (data) {
      const unique = Array.from(new Set(
        data.map((r: { location: string | null }) => r.location).filter(Boolean) as string[]
      )).sort()
      setLocations(unique)
    }
  }

  async function loadWeek() {
    setLoading(true)
    const weekEnd = addDays(weekStart, 6)

    const [apptResult, blockResult] = await Promise.all([
      supabase
        .from('appointments')
        .select(`
          id, horse_id, owner_id,
          appointment_date, appointment_time,
          duration_minutes, location, reason, status,
          provider_name, notes,
          horses ( name, species, owners ( full_name ) ),
          owners ( full_name )
        `)
        .gte('appointment_date', toISO(weekStart))
        .lte('appointment_date', toISO(weekEnd))
        .order('appointment_time', { ascending: true }),
      supabase
        .from('blocked_times')
        .select('id, block_date, start_time, end_time, label')
        .gte('block_date', toISO(weekStart))
        .lte('block_date', toISO(weekEnd))
        .order('start_time', { ascending: true }),
    ])

    if (!apptResult.error && apptResult.data) {
      setAppointments(apptResult.data as unknown as Appointment[])
      // Cache for offline
      try {
        await cacheAppointments(apptResult.data.map((a: Record<string, unknown>) => ({
          id: a.id as string, horse_id: (a.horse_id as string) || null,
          owner_id: (a.owner_id as string) || null,
          appointment_date: a.appointment_date as string,
          appointment_time: (a.appointment_time as string) || null,
          duration_minutes: (a.duration_minutes as number) || null,
          location: (a.location as string) || null,
          reason: (a.reason as string) || null, status: a.status as string,
          provider_name: (a.provider_name as string) || null,
          notes: (a.notes as string) || null,
          practitioner_id: currentUserId, cachedAt: Date.now(),
        })))
      } catch { /* ignore */ }
    } else if (currentUserId) {
      // Offline fallback for appointments
      try {
        const cached = await getCachedAppointments(currentUserId)
        const weekStartISO = toISO(weekStart)
        const weekEndISO = toISO(weekEnd)
        const filtered = cached
          .filter(a => a.appointment_date >= weekStartISO && a.appointment_date <= weekEndISO)
          .map(a => ({ ...a, horses: null, owners: null })) as unknown as Appointment[]
        setAppointments(filtered)
      } catch { /* ignore */ }
    }

    if (!blockResult.error && blockResult.data) setBlockedTimes(blockResult.data as BlockedTime[])
    setLoading(false)
  }

  async function saveBlockedTime() {
    if (!blockForm.date || !blockForm.startTime || !blockForm.endTime) return
    if (blockForm.endTime <= blockForm.startTime) {
      setBlockSaveErr('End time must be after start time.')
      return
    }
    setSavingBlock(true)
    setBlockSaveErr(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('blocked_times').insert({
      block_date: blockForm.date,
      start_time: blockForm.startTime,
      end_time: blockForm.endTime,
      label: blockForm.label || null,
      practitioner_id: user?.id,
    })
    setSavingBlock(false)
    if (error) {
      if (error.message?.includes('relation') || error.message?.includes('does not exist') || error.code === '42P01') {
        setBlockSaveErr('The blocked_times table is missing. Run migration 007_add_blocked_times.sql in your Supabase SQL editor first.')
      } else {
        setBlockSaveErr(error.message ?? 'Failed to save. Please try again.')
      }
    } else {
      setShowBlockModal(false)
      setEditingBlockId(null)
      setBlockSaveErr(null)
      setBlockForm({ date: toISO(today), startTime: '08:00', endTime: '09:00', label: '' })
      await loadWeek()
    }
  }

  async function deleteBlockedTime(id: string) {
    if (!confirm('Remove this blocked time?')) return
    await supabase.from('blocked_times').delete().eq('id', id)
    setBlockedTimes(prev => prev.filter(b => b.id !== id))
    setSelectedBlock(null)
  }

  async function updateBlockedTime() {
    if (!editingBlockId || !blockForm.date || !blockForm.startTime || !blockForm.endTime) return
    if (blockForm.endTime <= blockForm.startTime) {
      setBlockSaveErr('End time must be after start time.')
      return
    }
    setSavingBlock(true)
    setBlockSaveErr(null)
    const { error } = await supabase.from('blocked_times').update({
      block_date: blockForm.date,
      start_time: blockForm.startTime,
      end_time: blockForm.endTime,
      label: blockForm.label || null,
    }).eq('id', editingBlockId)
    setSavingBlock(false)
    if (error) {
      setBlockSaveErr(error.message ?? 'Failed to update. Please try again.')
    } else {
      setShowBlockModal(false)
      setEditingBlockId(null)
      setBlockSaveErr(null)
      setBlockForm({ date: toISO(today), startTime: '08:00', endTime: '09:00', label: '' })
      await loadWeek()
    }
  }

  function openEditBlock(block: BlockedTime) {
    setSelectedBlock(null)
    setEditingBlockId(block.id)
    setBlockForm({
      date: block.block_date,
      startTime: block.start_time,
      endTime: block.end_time,
      label: block.label || '',
    })
    setBlockSaveErr(null)
    setShowBlockModal(true)
  }

  function openNewApptModal(date?: string) {
    // Default to the viewed date; snap time to next 30-min slot
    const now = new Date()
    const mins = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30
    const hh = Math.min(Math.floor(mins / 60), 18)
    const mm = mins % 60
    const time = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
    setSelectedAppt(null)
    setQuickBook({ date: date ?? toISO(today), time })
  }

  function goToToday() {
    setWeekStart(startOfDay(today))
    setMobileDay(startOfDay(today))
    setMiniCalDate(today)
  }

  function prevWeek() { setWeekStart(w => addDays(w, -7)) }
  function nextWeek() { setWeekStart(w => addDays(w, 7)) }

  function prevDay() {
    const next = addDays(mobileDay, -1)
    setMobileDay(next)
  }
  function nextDay() {
    const next = addDays(mobileDay, 1)
    setMobileDay(next)
  }

  function handleMiniCalSelect(d: Date) {
    setMiniCalDate(d)
    if (isMobile) {
      setMobileDay(startOfDay(d))
    } else {
      setWeekStart(startOfDay(d))
    }
  }

  // On desktop: 7-day columns. On mobile: just the single selected day.
  const desktopDays: Date[] = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const displayDays: Date[] = isMobile ? [mobileDay] : desktopDays

  const apptsByDay: Record<string, Appointment[]> = {}
  for (const appt of appointments) {
    if (!apptsByDay[appt.appointment_date]) apptsByDay[appt.appointment_date] = []
    apptsByDay[appt.appointment_date].push(appt)
  }

  const blockedByDay: Record<string, BlockedTime[]> = {}
  for (const b of blockedTimes) {
    if (!blockedByDay[b.block_date]) blockedByDay[b.block_date] = []
    blockedByDay[b.block_date].push(b)
  }

  // For mobile, also look up appointments in loaded range that match mobileDay
  const mobileDayAppts = apptsByDay[toISO(mobileDay)] ?? []

  const counts = {
    scheduled: appointments.filter(a => a.status === 'scheduled').length,
    confirmed:  appointments.filter(a => a.status === 'confirmed').length,
    completed:  appointments.filter(a => a.status === 'completed').length,
    cancelled:  appointments.filter(a => a.status === 'cancelled').length,
  }

  function handleApptClick(appt: Appointment, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedBlock(null)
    if (selectedAppt?.id === appt.id) {
      setSelectedAppt(null)
      return
    }
    setSelectedAppt(appt)
  }

  if (checkingAuth) return null

  const isCurrentWeek = toISO(weekStart) === toISO(startOfDay(today))
  const isTodayMobile = toISO(mobileDay) === toISO(today)

  // ── Mobile layout: day-list view ─────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-[#081120] text-white">

        {/* Mobile toolbar */}
        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-[#1a3358] bg-[#0a1628] px-3 py-2">
          <button
            onClick={prevDay}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 text-white hover:bg-white/10 transition"
          >◀</button>

          <div className="flex flex-col items-center">
            <div className={`text-sm font-bold ${isTodayMobile ? 'text-[#c9a227]' : 'text-white'}`}>
              {DAY_NAMES[mobileDay.getDay()]} · {mobileDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <div className="text-[10px] text-blue-300">
              {mobileDayAppts.length} appointment{mobileDayAppts.length !== 1 ? 's' : ''}
            </div>
          </div>

          <button
            onClick={nextDay}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 text-white hover:bg-white/10 transition"
          >▶</button>
        </div>

        {/* Today + New Appointment row */}
        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-[#1a3358] bg-[#0d1b30] px-3 py-2">
          <button
            onClick={goToToday}
            className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition
              ${isTodayMobile ? 'border-[#c9a227] bg-[#c9a227] text-[#0f2040]' : 'border-white/20 text-white hover:bg-white/10'}`}
          >
            Today
          </button>
          <button
            onClick={() => { setBlockSaveErr(null); setEditingBlockId(null); setBlockForm(f => ({ ...f, date: toISO(mobileDay) })); setShowBlockModal(true) }}
            className="rounded-xl border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10 transition"
          >
            🚫 Block
          </button>
          <button
            onClick={() => openNewApptModal(toISO(mobileDay))}
            className="rounded-xl bg-[#c9a227] px-3 py-1.5 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition"
          >
            + New
          </button>
        </div>

        {/* Day appointments: card list on mobile (easier than pixel grid) */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {/* Blocked time banners on mobile */}
          {(blockedByDay[toISO(mobileDay)] ?? []).map(block => (
            <div key={block.id} className="mb-2 flex items-center justify-between rounded-xl border border-red-800 bg-red-900/30 px-3 py-2">
              <div>
                <span className="text-xs font-semibold text-red-300">🚫 {block.label || 'Blocked'}</span>
                <div className="text-[10px] text-red-400">{formatTime12(block.start_time)} – {formatTime12(block.end_time)}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEditBlock(block)} className="text-blue-300 hover:text-blue-100 text-xs font-medium">Edit</button>
                <button onClick={() => deleteBlockedTime(block.id)} className="text-red-400 hover:text-red-200 text-lg leading-none">×</button>
              </div>
            </div>
          ))}
          {loading ? (
            <div className="flex h-32 items-center justify-center text-blue-300 text-sm">Loading…</div>
          ) : mobileDayAppts.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#1a3358] text-center">
              <span className="text-3xl">📭</span>
              <p className="text-sm text-blue-300">No appointments this day</p>
              <Link
                href="/appointments"
                className="rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition"
              >
                + Schedule One
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {mobileDayAppts.map(appt => {
                const ownerName   = appt.owners?.full_name ?? appt.horses?.owners?.full_name ?? 'Unknown Owner'
                const patientName = appt.horses?.name ?? ''
                const species     = appt.horses?.species
                return (
                  <button
                    key={appt.id}
                    onClick={e => handleApptClick(appt, e)}
                    className={`w-full rounded-2xl border-l-4 bg-[#0d1b30] p-4 text-left transition hover:brightness-110 active:scale-[0.99] ${STATUS_BORDER[appt.status]}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl flex-shrink-0">{species === 'canine' ? '🐕' : '🐴'}</span>
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate">{patientName}</div>
                          <div className="text-xs text-blue-300 truncate">{ownerName}</div>
                        </div>
                      </div>
                      <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white ${STATUS_BG[appt.status]}`}>
                        {STATUS_LABEL[appt.status]}
                      </span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-2 text-xs text-blue-300">
                      {appt.appointment_time && (
                        <span className="flex items-center gap-1">
                          🕐 {formatTime12(appt.appointment_time)}
                          {appt.duration_minutes && ` · ${appt.duration_minutes} min`}
                        </span>
                      )}
                      {appt.location && (
                        <span className="flex items-center gap-1">📍 {appt.location}</span>
                      )}
                      {appt.reason && (
                        <span className="flex items-center gap-1 italic opacity-80">{appt.reason}</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Popup (bottom sheet on mobile) */}
        {selectedAppt && (
          <ApptPopup
            key={selectedAppt.id}
            appt={selectedAppt}
            onClose={() => setSelectedAppt(null)}

            isMobile={true}
            patientCount={appointments.filter(a =>
              a.appointment_date === selectedAppt.appointment_date &&
              (selectedAppt.location ? a.location === selectedAppt.location : true)
            ).length}
            onNotesSaved={(id, newNotes) => {
              setAppointments(prev => prev.map(a => a.id === id ? { ...a, notes: newNotes } : a))
              setSelectedAppt(prev => prev?.id === id ? { ...prev, notes: newNotes } : prev)
            }}
            onEditAppt={appt => { setSelectedAppt(null); setEditingAppt(appt) }}
            onCancelAppt={id => {
              setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a))
              setSelectedAppt(null)
            }}
            onDeleteAppt={id => {
              setAppointments(prev => prev.filter(a => a.id !== id))
              setSelectedAppt(null)
            }}
          />
        )}

        {/* Quick-Book Modal (mobile) */}
        {quickBook && (
          <QuickBookModal
            date={quickBook.date}
            time={quickBook.time}
            horses={horses}
            owners={allOwners}
            locationSuggestions={locations}
            practitionerName={practitionerName}
            onClose={() => setQuickBook(null)}
            onSaved={() => { loadWeek(); loadHorses(); loadOwners(); loadLocations() }}
          />
        )}

        {/* Edit Appointment Modal (mobile) */}
        {editingAppt && (
          <EditApptModal
            appt={editingAppt}
            horses={horses}
            locationSuggestions={locations}
            onClose={() => setEditingAppt(null)}
            onSaved={() => { loadWeek(); loadLocations() }}
          />
        )}

        {/* Block Time Modal (mobile - create + edit) */}
        {showBlockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => { setShowBlockModal(false); setEditingBlockId(null) }}>
            <div className="w-full max-w-sm rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold text-white">{editingBlockId ? '✏️ Edit Blocked Time' : '🚫 Block Out Time'}</h3>
                <button onClick={() => { setShowBlockModal(false); setEditingBlockId(null) }} className="text-white/50 hover:text-white text-xl leading-none">×</button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">Date</label>
                  <input type="date" value={blockForm.date} onChange={e => setBlockForm(f => ({ ...f, date: e.target.value }))} className="w-full rounded-lg border border-[#1a3358] bg-[#081120] px-3 py-2 text-sm text-white outline-none focus:border-[#c9a227]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">Start</label>
                    <input type="time" value={blockForm.startTime} onChange={e => setBlockForm(f => ({ ...f, startTime: e.target.value }))} className="w-full rounded-lg border border-[#1a3358] bg-[#081120] px-3 py-2 text-sm text-white outline-none focus:border-[#c9a227]" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">End</label>
                    <input type="time" value={blockForm.endTime} onChange={e => setBlockForm(f => ({ ...f, endTime: e.target.value }))} className="w-full rounded-lg border border-[#1a3358] bg-[#081120] px-3 py-2 text-sm text-white outline-none focus:border-[#c9a227]" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">Label (optional)</label>
                  <input type="text" value={blockForm.label} onChange={e => setBlockForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Lunch, Travel, Personal" className="w-full rounded-lg border border-[#1a3358] bg-[#081120] px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227]" />
                </div>
                {blockSaveErr && (
                  <p className="rounded-lg border border-red-700 bg-red-900/30 px-3 py-2 text-xs text-red-300">{blockSaveErr}</p>
                )}
                <button onClick={editingBlockId ? updateBlockedTime : saveBlockedTime} disabled={savingBlock} className="mt-2 w-full rounded-lg bg-red-700 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50">
                  {savingBlock ? 'Saving…' : editingBlockId ? '✏️ Update Block' : '🚫 Block This Time'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Desktop layout: week grid ─────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#081120] text-white">

      {/* Sidebar */}
      <aside className="hidden lg:flex w-56 flex-shrink-0 flex-col gap-4 border-r border-[#1a3358] bg-[#0a1628] p-4 overflow-y-auto">
        <MiniCalendar selected={miniCalDate} onSelect={handleMiniCalSelect} />

        <div className="rounded-xl border border-[#1a3358] bg-[#0d1b30] p-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-400">This Week</div>
          <div className="space-y-1.5">
            {([
              ['scheduled', 'Scheduled',  'text-blue-300'],
              ['confirmed', 'Confirmed',  'text-emerald-300'],
              ['completed', 'Completed',  'text-slate-300'],
              ['cancelled', 'Cancelled',  'text-red-300'],
            ] as const).map(([key, label, color]) => (
              <div key={key} className="flex justify-between text-xs">
                <span className={color}>{label}</span>
                <span className="font-semibold text-white">{counts[key]}</span>
              </div>
            ))}
            <div className="mt-2 border-t border-white/10 pt-1.5 flex justify-between text-xs">
              <span className="text-white/60">Total</span>
              <span className="font-bold text-white">{appointments.length}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#1a3358] bg-[#0d1b30] p-3 space-y-1">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-400">Quick Links</div>
          <button onClick={() => openNewApptModal(toISO(miniCalDate))} className="block w-full text-left rounded-lg px-2 py-1.5 text-xs text-blue-200 hover:bg-white/10 transition">+ New Appointment</button>
          <Link href="/dashboard"    className="block rounded-lg px-2 py-1.5 text-xs text-blue-200 hover:bg-white/10 transition">Dashboard</Link>
          <Link href="/dashboard"    className="block rounded-lg px-2 py-1.5 text-xs text-blue-200 hover:bg-white/10 transition">Owners &amp; Patients</Link>
        </div>

        <div className="rounded-xl border border-[#1a3358] bg-[#0d1b30] p-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-400">Legend</div>
          <div className="space-y-1.5">
            {(['scheduled','confirmed','completed','cancelled'] as const).map(s => (
              <div key={s} className="flex items-center gap-2 text-xs">
                <div className={`h-3 w-3 rounded-sm ${STATUS_BG[s]}`} />
                <span className="text-blue-200">{STATUS_LABEL[s]}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-[#1a3358] bg-[#0a1628] px-4 py-2">
          <div className="flex items-center gap-2">
            <button onClick={prevWeek} className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10 transition">◀</button>
            <button onClick={nextWeek} className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10 transition">▶</button>
            <button
              onClick={goToToday}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition
                ${isCurrentWeek ? 'border-[#c9a227] bg-[#c9a227] text-[#0f2040]' : 'border-white/20 text-white hover:bg-white/10'}`}
            >
              Today
            </button>
          </div>

          <div className="text-center">
            <div className="text-base font-bold text-white">
              {formatMonthYear(weekStart)}
              {weekStart.getMonth() !== addDays(weekStart, 6).getMonth() &&
                ` – ${formatMonthYear(addDays(weekStart, 6))}`}
            </div>
            <div className="text-xs text-blue-300">
              {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' – '}
              {addDays(weekStart, 6).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setBlockSaveErr(null); setEditingBlockId(null); setBlockForm(f => ({ ...f, date: toISO(weekStart) })); setShowBlockModal(true) }}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10 transition"
              title="Block out unavailable time"
            >
              🚫 Block Time
            </button>
            <button
              onClick={() => openNewApptModal(toISO(miniCalDate))}
              className="rounded-lg bg-[#c9a227] px-4 py-1.5 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition"
            >
              + New Appointment
            </button>
          </div>
        </div>

        {/* Day headers */}
        <div className="flex flex-shrink-0 border-b border-[#1a3358] bg-[#0d1b30]">
          <div className="w-14 flex-shrink-0 border-r border-[#1a3358]" />
          {displayDays.map((day, i) => {
            const iso     = toISO(day)
            const isToday = iso === toISO(today)
            const count   = apptsByDay[iso]?.length ?? 0
            return (
              <div
                key={i}
                className={`flex flex-1 flex-col items-center justify-center py-2 border-r border-[#1a3358] last:border-r-0
                  ${isToday ? 'bg-[#c9a227]/10' : ''}`}
              >
                <div className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-[#c9a227]' : 'text-blue-400'}`}>
                  {DAY_NAMES[day.getDay()]}
                </div>
                <div className={`text-xl font-bold leading-tight
                  ${isToday ? 'flex h-8 w-8 items-center justify-center rounded-full bg-[#c9a227] text-[#0f2040]' : 'text-white'}`}>
                  {formatDayNum(day)}
                </div>
                {count > 0 && (
                  <div className="mt-0.5 rounded-full bg-blue-500/30 px-1.5 text-[10px] text-blue-200">
                    {count} appt{count !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Grid body */}
        <div
          ref={scrollRef}
          className="flex flex-1 overflow-auto"
          onClick={() => setSelectedAppt(null)}
        >
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
              <div className="text-blue-200 text-sm">Loading…</div>
            </div>
          )}

          {/* Time labels */}
          <div className="relative w-14 flex-shrink-0 border-r border-[#1a3358]" style={{ height: GRID_HEIGHT }}>
            {HOUR_LABELS.map((label, i) => (
              <div
                key={i}
                className="absolute right-2 -translate-y-2 text-[10px] text-blue-400/70 whitespace-nowrap select-none"
                style={{ top: i * 60 * PX_PER_MIN }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {displayDays.map((day, colIdx) => {
            const iso       = toISO(day)
            const isToday   = iso === toISO(today)
            const dayAppts  = apptsByDay[iso] ?? []
            const dayBlocks = blockedByDay[iso] ?? []
            const nowMins   = today.getHours() * 60 + today.getMinutes()

            return (
              <div
                key={colIdx}
                className={`relative flex-1 border-r border-[#1a3358] last:border-r-0 ${isToday ? 'bg-[#c9a227]/5' : ''}`}
                style={{ height: GRID_HEIGHT, minWidth: 90 }}
                onMouseMove={e => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  const relY = e.clientY - rect.top
                  const mins = Math.floor((relY / PX_PER_MIN + GRID_START_HOUR * 60) / 15) * 15
                  if (mins >= GRID_START_HOUR * 60 && mins < GRID_END_HOUR * 60) {
                    setHoveredSlot({ colIdx, mins })
                  }
                }}
                onMouseLeave={() => setHoveredSlot(null)}
                onClick={e => {
                  // Only open quick-book when clicking empty grid space (not on an appt/block)
                  if ((e.target as HTMLElement).closest('button, a')) return
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  const relY = e.clientY - rect.top
                  const totalMins = Math.round((relY / PX_PER_MIN + GRID_START_HOUR * 60) / 15) * 15
                  const hh = Math.floor(totalMins / 60)
                  const mm = totalMins % 60
                  if (hh < GRID_START_HOUR || hh >= GRID_END_HOUR) return
                  const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
                  setSelectedAppt(null)
                  setQuickBook({ date: iso, time: timeStr })
                }}
              >
                {HOUR_LABELS.map((_, i) => (
                  <div key={i} className="absolute left-0 right-0 border-t border-[#1a3358]/60" style={{ top: i * 60 * PX_PER_MIN }} />
                ))}
                {HOUR_LABELS.map((_, i) => (
                  <div key={`half-${i}`} className="absolute left-0 right-0 border-t border-[#1a3358]/25" style={{ top: i * 60 * PX_PER_MIN + 30 * PX_PER_MIN }} />
                ))}

                {/* 15-min hover highlight */}
                {hoveredSlot?.colIdx === colIdx && (
                  <div
                    className="absolute left-0 right-0 pointer-events-none z-[5] bg-white/[0.06] border-t border-b border-white/20"
                    style={{
                      top: (hoveredSlot.mins - GRID_START_HOUR * 60) * PX_PER_MIN,
                      height: 15 * PX_PER_MIN,
                    }}
                  >
                    <span className="absolute right-1 top-0 text-[9px] text-white/40 leading-none pt-0.5 select-none">
                      {formatTime12(`${String(Math.floor(hoveredSlot.mins / 60)).padStart(2,'0')}:${String(hoveredSlot.mins % 60).padStart(2,'0')}`)}
                    </span>
                  </div>
                )}

                {isToday && nowMins >= GRID_START_HOUR * 60 && nowMins <= GRID_END_HOUR * 60 && (
                  <div
                    className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
                    style={{ top: (nowMins - GRID_START_HOUR * 60) * PX_PER_MIN }}
                  >
                    <div className="h-2 w-2 rounded-full bg-red-400 ml-0.5 flex-shrink-0" />
                    <div className="flex-1 h-px bg-red-400/70" />
                  </div>
                )}

                {dayBlocks.map(block => {
                  const startMins = timeToMins(block.start_time)
                  const endMins   = timeToMins(block.end_time)
                  if (endMins <= GRID_START_HOUR * 60 || startMins >= GRID_END_HOUR * 60) return null
                  const relStart = Math.max(startMins, GRID_START_HOUR * 60) - GRID_START_HOUR * 60
                  const relEnd   = Math.min(endMins, GRID_END_HOUR * 60) - GRID_START_HOUR * 60
                  const top      = relStart * PX_PER_MIN
                  const height   = Math.max((relEnd - relStart) * PX_PER_MIN, 16)
                  return (
                    <button
                      key={block.id}
                      title={`Blocked: ${block.label || 'Unavailable'} — click to edit or delete`}
                      onClick={e => {
                        e.stopPropagation()
                        setSelectedAppt(null)
                        const popupX = Math.min(e.clientX + 8, window.innerWidth - 240)
                        const popupY = Math.min(e.clientY + 8, window.innerHeight - 180)
                        setSelectedBlock({ block, x: popupX, y: popupY })
                      }}
                      className="absolute left-0 right-0 z-10 cursor-pointer overflow-hidden border-l-2 border-red-700 bg-red-900/30 text-left transition hover:bg-red-900/50"
                      style={{
                        top,
                        height,
                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,0,0,0.07) 4px, rgba(255,0,0,0.07) 8px)',
                      }}
                    >
                      <div className="px-1 py-0.5">
                        <div className="text-[9px] font-semibold text-red-300 truncate">
                          🚫 {block.label || 'Blocked'}
                        </div>
                        {height > 24 && (
                          <div className="text-[8px] text-red-400/80">
                            {formatTime12(block.start_time)} – {formatTime12(block.end_time)}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}

                {dayAppts.map(appt => {
                  const startMins = timeToMins(appt.appointment_time)
                  if (startMins < GRID_START_HOUR * 60 || startMins > GRID_END_HOUR * 60) return null
                  const relMins    = startMins - GRID_START_HOUR * 60
                  const dur        = appt.duration_minutes ?? 30
                  const top        = relMins * PX_PER_MIN
                  const height     = Math.max(dur * PX_PER_MIN, 22)
                  const ownerName  = appt.owners?.full_name ?? appt.horses?.owners?.full_name ?? ''
                  const patientName = appt.horses?.name ?? ''
                  const species    = appt.horses?.species

                  return (
                    <button
                      key={appt.id}
                      className={`absolute left-0.5 right-0.5 overflow-hidden rounded border-l-2 text-left transition hover:brightness-110 hover:shadow-lg hover:z-20
                        ${STATUS_BG[appt.status]} ${STATUS_BORDER[appt.status]}`}
                      style={{ top, height }}
                      onClick={e => handleApptClick(appt, e)}
                    >
                      <div className="px-1 py-0.5 leading-tight">
                        <div className="text-[10px] font-bold text-white truncate">
                          {species === 'canine' ? '🐕 ' : species === 'equine' ? '🐴 ' : ''}
                          {patientName || ownerName || 'Appointment'}
                        </div>
                        {height > 30 && ownerName && patientName && (
                          <div className="text-[9px] text-white/80 truncate">{ownerName}</div>
                        )}
                        {height > 44 && appt.reason && (
                          <div className="text-[9px] text-white/70 truncate italic">{appt.reason}</div>
                        )}
                        {height > 56 && (
                          <div className="text-[9px] text-white/60">
                            {formatTime12(appt.appointment_time)} · {dur} min
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Status bar */}
        <div className="flex flex-shrink-0 flex-wrap gap-x-4 gap-y-1 border-t border-[#1a3358] bg-[#0a1628] px-4 py-1.5 text-xs text-blue-200">
          <span>📅 <strong className="text-white">{appointments.length}</strong> appointments this week</span>
          <span>✅ Scheduled: <strong className="text-blue-300">{counts.scheduled}</strong></span>
          <span>🟢 Confirmed: <strong className="text-emerald-300">{counts.confirmed}</strong></span>
          <span>✔ Completed: <strong className="text-slate-300">{counts.completed}</strong></span>
          <span>✗ Cancelled: <strong className="text-red-300">{counts.cancelled}</strong></span>
        </div>
      </div>

      {/* Desktop popup */}
      {selectedAppt && (
        <ApptPopup
          key={selectedAppt.id}
          appt={selectedAppt}
          onClose={() => setSelectedAppt(null)}
          isMobile={false}
          patientCount={appointments.filter(a =>
            a.appointment_date === selectedAppt.appointment_date &&
            (selectedAppt.location ? a.location === selectedAppt.location : true)
          ).length}
          onNotesSaved={(id, newNotes) => {
            setAppointments(prev => prev.map(a => a.id === id ? { ...a, notes: newNotes } : a))
            setSelectedAppt(prev => prev?.id === id ? { ...prev, notes: newNotes } : prev)
          }}
          onEditAppt={appt => { setSelectedAppt(null); setEditingAppt(appt) }}
          onCancelAppt={id => {
            setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a))
            setSelectedAppt(null)
          }}
          onDeleteAppt={id => {
            setAppointments(prev => prev.filter(a => a.id !== id))
            setSelectedAppt(null)
          }}
        />
      )}

      {/* Edit Appointment Modal (desktop) */}
      {editingAppt && (
        <EditApptModal
          appt={editingAppt}
          horses={horses}
          locationSuggestions={locations}
          onClose={() => setEditingAppt(null)}
          onSaved={() => { loadWeek(); loadLocations() }}
        />
      )}

      {/* Quick-Book Modal */}
      {quickBook && (
        <QuickBookModal
          date={quickBook.date}
          time={quickBook.time}
          horses={horses}
          owners={allOwners}
          locationSuggestions={locations}
          practitionerName={practitionerName}
          onClose={() => setQuickBook(null)}
          onSaved={() => { loadWeek(); loadHorses(); loadOwners(); loadLocations() }}
        />
      )}

      {/* Blocked Time Popup (click on a blocked slot) */}
      {selectedBlock && (
        <div
          className="fixed z-50 w-56 rounded-xl border border-[#1a3358] bg-[#0d1b30] shadow-2xl"
          style={{ left: selectedBlock.x, top: selectedBlock.y }}
        >
          <div className="p-3">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-xs font-semibold text-red-300">🚫 {selectedBlock.block.label || 'Blocked'}</div>
                <div className="text-[10px] text-red-400/80 mt-0.5">
                  {formatTime12(selectedBlock.block.start_time)} – {formatTime12(selectedBlock.block.end_time)}
                </div>
              </div>
              <button onClick={() => setSelectedBlock(null)} className="text-white/50 hover:text-white text-lg leading-none">×</button>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => openEditBlock(selectedBlock.block)}
                className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-center text-xs font-medium text-white transition hover:bg-white/10"
              >
                Edit
              </button>
              <button
                onClick={() => deleteBlockedTime(selectedBlock.block.id)}
                className="flex-1 rounded-lg border border-red-500/40 bg-red-600/20 px-3 py-2 text-center text-xs font-semibold text-red-300 transition hover:bg-red-600/40"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Time Modal (create + edit) */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => { setShowBlockModal(false); setEditingBlockId(null) }}>
          <div className="w-full max-w-sm rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-white">{editingBlockId ? '✏️ Edit Blocked Time' : '🚫 Block Out Time'}</h3>
              <button onClick={() => { setShowBlockModal(false); setEditingBlockId(null) }} className="text-white/50 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">Date</label>
                <input
                  type="date"
                  value={blockForm.date}
                  onChange={e => setBlockForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full rounded-lg border border-[#1a3358] bg-[#081120] px-3 py-2 text-sm text-white outline-none focus:border-[#c9a227]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">Start Time</label>
                  <input
                    type="time"
                    value={blockForm.startTime}
                    onChange={e => setBlockForm(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full rounded-lg border border-[#1a3358] bg-[#081120] px-3 py-2 text-sm text-white outline-none focus:border-[#c9a227]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">End Time</label>
                  <input
                    type="time"
                    value={blockForm.endTime}
                    onChange={e => setBlockForm(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full rounded-lg border border-[#1a3358] bg-[#081120] px-3 py-2 text-sm text-white outline-none focus:border-[#c9a227]"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-400">Label (optional)</label>
                <input
                  type="text"
                  value={blockForm.label}
                  onChange={e => setBlockForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Lunch, Travel, Personal"
                  className="w-full rounded-lg border border-[#1a3358] bg-[#081120] px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227]"
                />
              </div>
              {blockSaveErr && (
                <p className="rounded-lg border border-red-700 bg-red-900/30 px-3 py-2 text-xs text-red-300">{blockSaveErr}</p>
              )}
              <button
                onClick={editingBlockId ? updateBlockedTime : saveBlockedTime}
                disabled={savingBlock}
                className="mt-2 w-full rounded-lg bg-red-700 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {savingBlock ? 'Saving…' : editingBlockId ? '✏️ Update Block' : '🚫 Block This Time'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
