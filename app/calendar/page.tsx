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
  style,
  isMobile,
  onNotesSaved,
  patientCount,
}: {
  appt: Appointment
  onClose: () => void
  style: React.CSSProperties
  isMobile: boolean
  onNotesSaved: (id: string, notes: string) => void
  patientCount: number
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
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appt.location)}`}
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
        <Link
          href={`/appointments?highlight=${appt.id}`}
          className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-center text-xs font-medium text-white transition hover:bg-white/10"
        >
          Edit Appt
        </Link>
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
    <div
      className="fixed z-50 w-72 rounded-xl border border-[#1a3358] bg-[#0d1b30] shadow-2xl"
      style={style}
    >
      {inner}
    </div>
  )
}

// ── Main Calendar Page ────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [checkingAuth, setCheckingAuth] = useState(true)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [weekStart, setWeekStart]   = useState<Date>(() => startOfDay(today))
  const [mobileDay, setMobileDay]   = useState<Date>(() => startOfDay(today))
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading]       = useState(true)
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({})
  const [miniCalDate, setMiniCalDate] = useState<Date>(today)

  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([])
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [blockForm, setBlockForm] = useState({ date: toISO(today), startTime: '08:00', endTime: '09:00', label: '' })
  const [savingBlock, setSavingBlock] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push('/login')
      else setCheckingAuth(false)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, checkingAuth])

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

    if (!apptResult.error && apptResult.data) setAppointments(apptResult.data as unknown as Appointment[])
    if (!blockResult.error && blockResult.data) setBlockedTimes(blockResult.data as BlockedTime[])
    setLoading(false)
  }

  async function saveBlockedTime() {
    if (!blockForm.date || !blockForm.startTime || !blockForm.endTime) return
    if (blockForm.endTime <= blockForm.startTime) {
      alert('End time must be after start time.')
      return
    }
    setSavingBlock(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('blocked_times').insert({
      block_date: blockForm.date,
      start_time: blockForm.startTime,
      end_time: blockForm.endTime,
      label: blockForm.label || null,
      practitioner_id: user?.id,
    })
    setSavingBlock(false)
    if (!error) {
      setShowBlockModal(false)
      setBlockForm({ date: toISO(today), startTime: '08:00', endTime: '09:00', label: '' })
      await loadWeek()
    }
  }

  async function deleteBlockedTime(id: string) {
    if (!confirm('Remove this blocked time?')) return
    await supabase.from('blocked_times').delete().eq('id', id)
    setBlockedTimes(prev => prev.filter(b => b.id !== id))
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
    if (selectedAppt?.id === appt.id) {
      setSelectedAppt(null)
      return
    }
    if (!isMobile) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const popupW = 256
      let left = rect.right + 8
      if (left + popupW > window.innerWidth) left = rect.left - popupW - 8
      const top = Math.min(rect.top, window.innerHeight - 300)
      setPopupStyle({ position: 'fixed', top, left, zIndex: 9999 })
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
            onClick={() => { setBlockForm(f => ({ ...f, date: toISO(mobileDay) })); setShowBlockModal(true) }}
            className="rounded-xl border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10 transition"
          >
            🚫 Block
          </button>
          <Link
            href="/appointments"
            className="rounded-xl bg-[#c9a227] px-3 py-1.5 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition"
          >
            + New
          </Link>
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
              <button onClick={() => deleteBlockedTime(block.id)} className="text-red-400 hover:text-red-200 text-lg leading-none">×</button>
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
                const patientName = appt.horses?.name ?? 'No patient'
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
            appt={selectedAppt}
            onClose={() => setSelectedAppt(null)}
            style={popupStyle}
            isMobile={true}
            patientCount={appointments.filter(a =>
              a.appointment_date === selectedAppt.appointment_date &&
              (selectedAppt.location ? a.location === selectedAppt.location : true)
            ).length}
            onNotesSaved={(id, newNotes) => {
              setAppointments(prev => prev.map(a => a.id === id ? { ...a, notes: newNotes } : a))
              setSelectedAppt(prev => prev?.id === id ? { ...prev, notes: newNotes } : prev)
            }}
          />
        )}

        {/* Block Time Modal (mobile) */}
        {showBlockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowBlockModal(false)}>
            <div className="w-full max-w-sm rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold text-white">🚫 Block Out Time</h3>
                <button onClick={() => setShowBlockModal(false)} className="text-white/50 hover:text-white text-xl leading-none">×</button>
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
                <button onClick={saveBlockedTime} disabled={savingBlock} className="mt-2 w-full rounded-lg bg-red-700 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50">
                  {savingBlock ? 'Saving…' : '🚫 Block This Time'}
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
          <Link href="/appointments" className="block rounded-lg px-2 py-1.5 text-xs text-blue-200 hover:bg-white/10 transition">+ New Appointment</Link>
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
              onClick={() => { setBlockForm(f => ({ ...f, date: toISO(weekStart) })); setShowBlockModal(true) }}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10 transition"
              title="Block out unavailable time"
            >
              🚫 Block Time
            </button>
            <Link
              href="/appointments"
              className="rounded-lg bg-[#c9a227] px-4 py-1.5 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition"
            >
              + New Appointment
            </Link>
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
              >
                {HOUR_LABELS.map((_, i) => (
                  <div key={i} className="absolute left-0 right-0 border-t border-[#1a3358]/60" style={{ top: i * 60 * PX_PER_MIN }} />
                ))}
                {HOUR_LABELS.map((_, i) => (
                  <div key={`half-${i}`} className="absolute left-0 right-0 border-t border-[#1a3358]/25" style={{ top: i * 60 * PX_PER_MIN + 30 * PX_PER_MIN }} />
                ))}

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
                      title={`Blocked: ${block.label || 'Unavailable'} — click to remove`}
                      onClick={e => { e.stopPropagation(); deleteBlockedTime(block.id) }}
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
          appt={selectedAppt}
          onClose={() => setSelectedAppt(null)}
          style={popupStyle}
          isMobile={false}
          patientCount={appointments.filter(a =>
            a.appointment_date === selectedAppt.appointment_date &&
            (selectedAppt.location ? a.location === selectedAppt.location : true)
          ).length}
          onNotesSaved={(id, newNotes) => {
            setAppointments(prev => prev.map(a => a.id === id ? { ...a, notes: newNotes } : a))
            setSelectedAppt(prev => prev?.id === id ? { ...prev, notes: newNotes } : prev)
          }}
        />
      )}

      {/* Block Time Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowBlockModal(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-white">🚫 Block Out Time</h3>
              <button onClick={() => setShowBlockModal(false)} className="text-white/50 hover:text-white text-xl leading-none">×</button>
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
              <button
                onClick={saveBlockedTime}
                disabled={savingBlock}
                className="mt-2 w-full rounded-lg bg-red-700 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {savingBlock ? 'Saving…' : '🚫 Block This Time'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
