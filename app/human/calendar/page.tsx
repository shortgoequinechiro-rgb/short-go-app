'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

type Appointment = {
  id: string
  patient_id: string | null
  appointment_date: string
  appointment_time: string | null
  duration_minutes: number | null
  location: string | null
  reason: string | null
  status: string
  patient_name: string | null
  patient_phone: string | null
  patient_email: string | null
  human_patients?: { first_name: string; last_name: string } | null
}

type Patient = {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
}

function fmtTime(t: string | null): string {
  if (!t) return ''
  const [h, min] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(min).padStart(2, '0')} ${ampm}`
}

function getWeekDates(baseDate: Date): Date[] {
  const start = new Date(baseDate)
  start.setDate(start.getDate() - start.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const inputClass = 'w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227] transition'
const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5'

export default function HumanCalendarPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patients, setPatients] = useState<Patient[]>([])

  // Book modal
  const [showBookModal, setShowBookModal] = useState(false)
  const [bookForm, setBookForm] = useState({
    patient_id: '',
    appointment_date: toISO(new Date()),
    appointment_time: '09:00',
    duration_minutes: 30,
    location: '',
    reason: '',
    patient_name: '',
    patient_phone: '',
    patient_email: '',
  })
  const [bookSaving, setBookSaving] = useState(false)
  const [bookMsg, setBookMsg] = useState('')

  const baseDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + weekOffset * 7)
    return d
  }, [weekOffset])

  const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate])
  const today = toISO(new Date())

  useEffect(() => {
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)
    await loadData(user.id)
    setLoading(false)
  }

  async function loadData(uid: string) {
    const { data: pts } = await supabase
      .from('human_patients')
      .select('id, first_name, last_name, phone, email')
      .eq('practitioner_id', uid)
      .eq('archived', false)
      .order('last_name')
    if (pts) setPatients(pts)

    const { data: appts } = await supabase
      .from('human_appointments')
      .select('*, human_patients(first_name, last_name)')
      .eq('practitioner_id', uid)
      .order('appointment_date')
      .order('appointment_time')
    if (appts) setAppointments(appts as unknown as Appointment[])
  }

  function getApptsForDate(date: string) {
    return appointments.filter(a => a.appointment_date === date && a.status !== 'cancelled')
  }

  function getPatientName(a: Appointment): string {
    const hp = a.human_patients as any
    if (hp) {
      const p = Array.isArray(hp) ? hp[0] : hp
      if (p) return `${p.first_name} ${p.last_name}`
    }
    return a.patient_name || 'Walk-in'
  }

  async function handleBook() {
    if (!bookForm.appointment_date) { setBookMsg('Date is required.'); return }
    setBookSaving(true); setBookMsg('')

    const selectedPatient = patients.find(p => p.id === bookForm.patient_id)

    const { error } = await supabase
      .from('human_appointments')
      .insert({
        practitioner_id: userId,
        patient_id: bookForm.patient_id || null,
        appointment_date: bookForm.appointment_date,
        appointment_time: bookForm.appointment_time || null,
        duration_minutes: bookForm.duration_minutes || 30,
        location: bookForm.location.trim() || null,
        reason: bookForm.reason.trim() || null,
        patient_name: selectedPatient
          ? `${selectedPatient.first_name} ${selectedPatient.last_name}`
          : bookForm.patient_name.trim() || null,
        patient_phone: selectedPatient?.phone || bookForm.patient_phone.trim() || null,
        patient_email: selectedPatient?.email || bookForm.patient_email.trim() || null,
      })

    setBookSaving(false)
    if (error) { setBookMsg('Failed to book appointment.'); return }
    setShowBookModal(false)
    setBookForm({
      patient_id: '', appointment_date: toISO(new Date()), appointment_time: '09:00',
      duration_minutes: 30, location: '', reason: '', patient_name: '', patient_phone: '', patient_email: '',
    })
    await loadData(userId)
  }

  const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    confirmed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    completed: 'bg-white/10 text-white/50 border-white/20',
    cancelled: 'bg-red-500/20 text-red-300 border-red-500/40',
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081120]">
        <p className="text-white/60 text-sm animate-pulse">Loading scheduler...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#081120] text-white">
      {/* Header */}
      <div className="border-b border-[#1a3358] bg-[#0d1b30] px-4 py-5 md:px-8">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">Scheduler</h1>
            <p className="text-sm text-blue-300/70 mt-0.5">Human Appointments</p>
          </div>
          <div className="flex gap-3">
            <Link href="/human/dashboard"
              className="rounded-xl border border-white/20 px-3 py-2 text-sm text-white/70 hover:bg-white/10 transition">
              Dashboard
            </Link>
            <button onClick={() => setShowBookModal(true)}
              className="rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition">
              + Book Appointment
            </button>
          </div>
        </div>
      </div>

      {/* Week navigation */}
      <div className="border-b border-[#1a3358] bg-[#0d1b30]/50 px-4 md:px-8">
        <div className="mx-auto max-w-7xl flex items-center justify-between py-3">
          <button onClick={() => setWeekOffset(w => w - 1)}
            className="rounded-lg px-3 py-1.5 text-sm text-white/70 hover:bg-white/10 transition">&larr; Prev</button>
          <button onClick={() => setWeekOffset(0)}
            className="text-sm font-medium text-[#c9a227] hover:text-[#b89020] transition">Today</button>
          <button onClick={() => setWeekOffset(w => w + 1)}
            className="rounded-lg px-3 py-1.5 text-sm text-white/70 hover:bg-white/10 transition">Next &rarr;</button>
        </div>
      </div>

      {/* Week grid */}
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map(date => {
            const iso = toISO(date)
            const isToday = iso === today
            const dayAppts = getApptsForDate(iso)
            return (
              <div key={iso} className={`rounded-xl border p-3 min-h-[160px] transition
                ${isToday ? 'border-[#c9a227]/50 bg-[#c9a227]/5' : 'border-[#1a3358] bg-[#0d1b30]'}`}>
                <div className="mb-2">
                  <p className={`text-[10px] uppercase tracking-wider ${isToday ? 'text-[#c9a227]' : 'text-blue-400/60'}`}>
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <p className={`text-lg font-bold ${isToday ? 'text-[#c9a227]' : 'text-white'}`}>
                    {date.getDate()}
                  </p>
                </div>
                <div className="space-y-1">
                  {dayAppts.map(a => (
                    <div key={a.id}
                      className={`rounded-lg border px-2 py-1.5 text-[11px] leading-tight ${statusColors[a.status] || 'bg-white/5 text-white/60 border-white/10'}`}>
                      {a.appointment_time && <p className="font-semibold">{fmtTime(a.appointment_time)}</p>}
                      <p className="truncate">{getPatientName(a)}</p>
                      {a.reason && <p className="truncate opacity-70">{a.reason}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Book Appointment Modal */}
      {showBookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Book Appointment</h2>
              <button onClick={() => setShowBookModal(false)} className="text-white/40 hover:text-white text-xl">&times;</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelClass}>Patient</label>
                <select value={bookForm.patient_id}
                  onChange={e => setBookForm(prev => ({ ...prev, patient_id: e.target.value }))}
                  className={inputClass}>
                  <option value="">Walk-in / New patient</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>
                  ))}
                </select>
              </div>

              {!bookForm.patient_id && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Patient Name</label>
                    <input type="text" value={bookForm.patient_name}
                      onChange={e => setBookForm(prev => ({ ...prev, patient_name: e.target.value }))}
                      className={inputClass} placeholder="John Doe" />
                  </div>
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input type="tel" value={bookForm.patient_phone}
                      onChange={e => setBookForm(prev => ({ ...prev, patient_phone: e.target.value }))}
                      className={inputClass} placeholder="(555) 123-4567" />
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>Date</label>
                  <input type="date" value={bookForm.appointment_date}
                    onChange={e => setBookForm(prev => ({ ...prev, appointment_date: e.target.value }))}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Time</label>
                  <input type="time" value={bookForm.appointment_time}
                    onChange={e => setBookForm(prev => ({ ...prev, appointment_time: e.target.value }))}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Duration (min)</label>
                  <select value={bookForm.duration_minutes}
                    onChange={e => setBookForm(prev => ({ ...prev, duration_minutes: Number(e.target.value) }))}
                    className={inputClass}>
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Location</label>
                <input type="text" value={bookForm.location}
                  onChange={e => setBookForm(prev => ({ ...prev, location: e.target.value }))}
                  className={inputClass} placeholder="Office, Room 2..." />
              </div>

              <div>
                <label className={labelClass}>Reason</label>
                <input type="text" value={bookForm.reason}
                  onChange={e => setBookForm(prev => ({ ...prev, reason: e.target.value }))}
                  className={inputClass} placeholder="Initial consultation, follow-up, adjustment..." />
              </div>

              {bookMsg && <p className="text-sm text-red-400">{bookMsg}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowBookModal(false)}
                  className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition">
                  Cancel
                </button>
                <button onClick={handleBook} disabled={bookSaving}
                  className="rounded-xl bg-[#c9a227] px-5 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] disabled:opacity-50 transition">
                  {bookSaving ? 'Booking...' : 'Book Appointment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
