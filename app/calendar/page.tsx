'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

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

// ── Constants ─────────────────────────────────────────────────────────────────

// Grid starts at 7:00 AM, ends at 7:00 PM
const GRID_START_HOUR = 7
const GRID_END_HOUR = 19
const GRID_TOTAL_MINS = (GRID_END_HOUR - GRID_START_HOUR) * 60 // 720

// Pixels per minute — drives all positioning
const PX_PER_MIN = 1.6
const GRID_HEIGHT = GRID_TOTAL_MINS * PX_PER_MIN // 1152px

const HOUR_LABELS: string[] = []
for (let h = GRID_START_HOUR; h <= GRID_END_HOUR; h++) {
  const ampm = h < 12 ? 'AM' : 'PM'
  const display = h === 12 ? 12 : h > 12 ? h - 12 : h
  HOUR_LABELS.push(`${display}:00 ${ampm}`)
}

const STATUS_BG: Record<string, string> = {
  scheduled:  'bg-blue-500',
  confirmed:  'bg-emerald-500',
  completed:  'bg-slate-400',
  cancelled:  'bg-red-400',
}

const STATUS_BORDER: Record<string, string> = {
  scheduled:  'border-blue-700',
  confirmed:  'border-emerald-700',
  completed:  'border-slate-600',
  cancelled:  'border-red-600',
}

const STATUS_LABEL: Record<string, string> = {
  scheduled:  'Scheduled',
  confirmed:  'Confirmed',
  completed:  'Completed',
  cancelled:  'Cancelled',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_FULL  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the Monday of the week containing `date` */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day // shift to Monday
  d.setDate(d.getDate() + diff)
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

/** Convert "HH:MM:SS" → minutes from midnight */
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

// ── Mini Calendar ─────────────────────────────────────────────────────────────

function MiniCalendar({
  selected,
  onSelect,
}: {
  selected: Date
  onSelect: (d: Date) => void
}) {
  const [view, setView] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1))

  const year  = view.getFullYear()
  const month = view.getMonth()
  const firstDay = new Date(year, month, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const today = new Date()

  return (
    <div className="rounded-xl border border-[#1a3358] bg-[#0d1b30] p-3 select-none">
      {/* Month nav */}
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => setView(new Date(year, month - 1, 1))}
          className="rounded p-1 text-blue-300 hover:bg-white/10"
        >◀</button>
        <span className="text-xs font-semibold text-white">
          {view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button
          onClick={() => setView(new Date(year, month + 1, 1))}
          className="rounded p-1 text-blue-300 hover:bg-white/10"
        >▶</button>
      </div>
      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7 text-center">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-[10px] font-bold text-blue-400">{d}</div>
        ))}
      </div>
      {/* Day grid */}
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

// ── Appointment Popup ─────────────────────────────────────────────────────────

function ApptPopup({
  appt,
  onClose,
  style,
  onNotesSaved,
}: {
  appt: Appointment
  onClose: () => void
  style: React.CSSProperties
  onNotesSaved: (id: string, notes: string) => void
}) {
  const ownerName   = appt.owners?.full_name ?? appt.horses?.owners?.full_name ?? 'Unknown Owner'
  const patientName = appt.horses?.name ?? 'No patient'
  const species     = appt.horses?.species ?? null

  const [notes, setNotes]   = useState(appt.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [err, setErr]       = useState<string | null>(null)

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

  return (
    <div
      className="fixed z-50 w-72 rounded-xl border border-[#1a3358] bg-[#0d1b30] shadow-2xl"
      style={style}
      onClick={e => e.stopPropagation()}
    >
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
          <div className="flex gap-2">
            <span className="text-blue-400 shrink-0">Location:</span>
            <span>{appt.location}</span>
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
      </div>

      {/* Notes section */}
      <div className="px-4 pt-3 pb-1">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
            Notes
          </label>
          {saved && (
            <span className="text-[10px] text-emerald-400 font-semibold">✓ Saved</span>
          )}
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
            ${isDirty
              ? 'bg-[#c9a227] text-[#0f2040] hover:bg-[#b89020]'
              : 'bg-white/5 text-white/30 cursor-not-allowed'}`}
        >
          {saving ? 'Saving…' : 'Save Notes'}
        </button>
      </div>

      {/* Footer links */}
      <div className="flex gap-2 p-4 pt-2">
        {appt.owner_id && (
          <Link
            href={`/owners/${appt.owner_id}`}
            className="flex-1 rounded-lg bg-[#c9a227] px-3 py-1.5 text-center text-xs font-semibold text-[#0f2040] transition hover:bg-[#b89020]"
          >
            View Owner
          </Link>
        )}
        <Link
          href={`/appointments?highlight=${appt.id}`}
          className="flex-1 rounded-lg border border-white/20 px-3 py-1.5 text-center text-xs font-medium text-white transition hover:bg-white/10"
        >
          Edit Appt
        </Link>
      </div>
    </div>
  )
}

// ── Main Calendar Page ────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter()
  const [checkingAuth, setCheckingAuth] = useState(true)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(today))
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({})
  const [miniCalDate, setMiniCalDate] = useState<Date>(today)

  const gridRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/login')
      else setCheckingAuth(false)
    })
  }, [router])

  // Auto-scroll to 8 AM on mount
  useEffect(() => {
    if (scrollRef.current) {
      const offset = (8 - GRID_START_HOUR) * 60 * PX_PER_MIN - 20
      scrollRef.current.scrollTop = Math.max(0, offset)
    }
  }, [])

  // Load appointments for the visible week
  useEffect(() => {
    if (checkingAuth) return
    loadWeek()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, checkingAuth])

  async function loadWeek() {
    setLoading(true)
    const weekEnd = addDays(weekStart, 6)
    const { data, error } = await supabase
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
      .order('appointment_time', { ascending: true })

    if (!error && data) setAppointments(data as unknown as Appointment[])
    setLoading(false)
  }

  function goToToday() {
    const newWeek = getWeekStart(today)
    setWeekStart(newWeek)
    setMiniCalDate(today)
  }

  function prevWeek() {
    setWeekStart(w => addDays(w, -7))
  }

  function nextWeek() {
    setWeekStart(w => addDays(w, 7))
  }

  function handleMiniCalSelect(d: Date) {
    setMiniCalDate(d)
    setWeekStart(getWeekStart(d))
  }

  // Build 7-day columns: Mon → Sun
  const days: Date[] = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Group appointments by ISO date string
  const apptsByDay: Record<string, Appointment[]> = {}
  for (const appt of appointments) {
    if (!apptsByDay[appt.appointment_date]) apptsByDay[appt.appointment_date] = []
    apptsByDay[appt.appointment_date].push(appt)
  }

  // Stats
  const counts = {
    scheduled: appointments.filter(a => a.status === 'scheduled').length,
    confirmed:  appointments.filter(a => a.status === 'confirmed').length,
    completed:  appointments.filter(a => a.status === 'completed').length,
    cancelled:  appointments.filter(a => a.status === 'cancelled').length,
  }

  function handleApptClick(appt: Appointment, e: React.MouseEvent) {
    e.stopPropagation()
    if (selectedAppt?.id === appt.id) {
      setSelectedAppt(null)
      return
    }

    // Position popup: try to keep it on screen
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const popupW = 256
    let left = rect.right + 8
    if (left + popupW > window.innerWidth) left = rect.left - popupW - 8
    const top = Math.min(rect.top, window.innerHeight - 300)

    setPopupStyle({ position: 'fixed', top, left, zIndex: 9999 })
    setSelectedAppt(appt)
  }

  if (checkingAuth) return null

  const isCurrentWeek = toISO(weekStart) === toISO(getWeekStart(today))

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#081120] text-white">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-56 flex-shrink-0 flex-col gap-4 border-r border-[#1a3358] bg-[#0a1628] p-4 overflow-y-auto">
        {/* Mini calendar */}
        <MiniCalendar selected={miniCalDate} onSelect={handleMiniCalSelect} />

        {/* Week stats */}
        <div className="rounded-xl border border-[#1a3358] bg-[#0d1b30] p-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-400">
            This Week
          </div>
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

        {/* Quick links */}
        <div className="rounded-xl border border-[#1a3358] bg-[#0d1b30] p-3 space-y-1">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-400">Quick Links</div>
          <Link href="/appointments" className="block rounded-lg px-2 py-1.5 text-xs text-blue-200 hover:bg-white/10 transition">
            + New Appointment
          </Link>
          <Link href="/dashboard" className="block rounded-lg px-2 py-1.5 text-xs text-blue-200 hover:bg-white/10 transition">
            Dashboard
          </Link>
          <Link href="/dashboard" className="block rounded-lg px-2 py-1.5 text-xs text-blue-200 hover:bg-white/10 transition">
            Owners &amp; Patients
          </Link>
        </div>

        {/* Legend */}
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

      {/* ── Main calendar area ──────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* ── Toolbar ─────────────────────────────────────────────────── */}
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-[#1a3358] bg-[#0a1628] px-4 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={prevWeek}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10 transition"
            >◀</button>
            <button
              onClick={nextWeek}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10 transition"
            >▶</button>
            <button
              onClick={goToToday}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition
                ${isCurrentWeek
                  ? 'border-[#c9a227] bg-[#c9a227] text-[#0f2040]'
                  : 'border-white/20 text-white hover:bg-white/10'}`}
            >
              Today
            </button>
          </div>

          {/* Week label */}
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

          <Link
            href="/appointments"
            className="rounded-lg bg-[#c9a227] px-4 py-1.5 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition"
          >
            + New Appointment
          </Link>
        </div>

        {/* ── Day headers ─────────────────────────────────────────────── */}
        <div className="flex flex-shrink-0 border-b border-[#1a3358] bg-[#0d1b30]">
          {/* Spacer for time column */}
          <div className="w-14 flex-shrink-0 border-r border-[#1a3358]" />
          {days.map((day, i) => {
            const iso = toISO(day)
            const isToday = iso === toISO(today)
            const count = apptsByDay[iso]?.length ?? 0
            return (
              <div
                key={i}
                className={`flex flex-1 flex-col items-center justify-center py-2 border-r border-[#1a3358] last:border-r-0
                  ${isToday ? 'bg-[#c9a227]/10' : ''}`}
              >
                <div className={`text-xs font-bold uppercase tracking-wider
                  ${isToday ? 'text-[#c9a227]' : 'text-blue-400'}`}>
                  {DAY_NAMES[day.getDay()]}
                </div>
                <div className={`text-xl font-bold leading-tight
                  ${isToday
                    ? 'flex h-8 w-8 items-center justify-center rounded-full bg-[#c9a227] text-[#0f2040]'
                    : 'text-white'}`}>
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

        {/* ── Grid body (scrollable) ───────────────────────────────────── */}
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

          {/* Time labels column */}
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
          {days.map((day, colIdx) => {
            const iso = toISO(day)
            const isToday = iso === toISO(today)
            const dayAppts = apptsByDay[iso] ?? []
            const nowMins = today.getHours() * 60 + today.getMinutes()

            return (
              <div
                key={colIdx}
                className={`relative flex-1 border-r border-[#1a3358] last:border-r-0
                  ${isToday ? 'bg-[#c9a227]/5' : ''}`}
                style={{ height: GRID_HEIGHT, minWidth: 90 }}
              >
                {/* Hour lines */}
                {HOUR_LABELS.map((_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-[#1a3358]/60"
                    style={{ top: i * 60 * PX_PER_MIN }}
                  />
                ))}
                {/* 30-min lines (lighter) */}
                {HOUR_LABELS.map((_, i) => (
                  <div
                    key={`half-${i}`}
                    className="absolute left-0 right-0 border-t border-[#1a3358]/25"
                    style={{ top: i * 60 * PX_PER_MIN + 30 * PX_PER_MIN }}
                  />
                ))}

                {/* "Now" indicator — only on today's column */}
                {isToday && nowMins >= GRID_START_HOUR * 60 && nowMins <= GRID_END_HOUR * 60 && (
                  <div
                    className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
                    style={{ top: (nowMins - GRID_START_HOUR * 60) * PX_PER_MIN }}
                  >
                    <div className="h-2 w-2 rounded-full bg-red-400 ml-0.5 flex-shrink-0" />
                    <div className="flex-1 h-px bg-red-400/70" />
                  </div>
                )}

                {/* Appointments */}
                {dayAppts.map(appt => {
                  const startMins = timeToMins(appt.appointment_time)
                  if (startMins < GRID_START_HOUR * 60 || startMins > GRID_END_HOUR * 60) return null
                  const relMins = startMins - GRID_START_HOUR * 60
                  const dur = appt.duration_minutes ?? 30
                  const top = relMins * PX_PER_MIN
                  const height = Math.max(dur * PX_PER_MIN, 22)

                  const ownerName = appt.owners?.full_name ?? appt.horses?.owners?.full_name ?? ''
                  const patientName = appt.horses?.name ?? ''
                  const species = appt.horses?.species

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

        {/* ── Bottom status bar ────────────────────────────────────────── */}
        <div className="flex flex-shrink-0 flex-wrap gap-x-4 gap-y-1 border-t border-[#1a3358] bg-[#0a1628] px-4 py-1.5 text-xs text-blue-200">
          <span>📅 <strong className="text-white">{appointments.length}</strong> appointments this week</span>
          <span>✅ Scheduled: <strong className="text-blue-300">{counts.scheduled}</strong></span>
          <span>🟢 Confirmed: <strong className="text-emerald-300">{counts.confirmed}</strong></span>
          <span>✔ Completed: <strong className="text-slate-300">{counts.completed}</strong></span>
          <span>✗ Cancelled: <strong className="text-red-300">{counts.cancelled}</strong></span>
        </div>
      </div>

      {/* ── Floating appointment popup ───────────────────────────────────── */}
      {selectedAppt && (
        <ApptPopup
          appt={selectedAppt}
          onClose={() => setSelectedAppt(null)}
          style={popupStyle}
          onNotesSaved={(id, newNotes) => {
            setAppointments(prev =>
              prev.map(a => a.id === id ? { ...a, notes: newNotes } : a)
            )
            setSelectedAppt(prev => prev && prev.id === id ? { ...prev, notes: newNotes } : prev)
          }}
        />
      )}
    </div>
  )
}
