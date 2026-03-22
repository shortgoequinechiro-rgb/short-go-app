'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Appointment = {
  id: string
  patient_id: string
  patient_name: string
  appointment_date: string
  start_time: string
  appointment_type: string | null
  human_patients?: { first_name: string; last_name: string; date_of_birth: string | null } | null
}

type KioskState = 'search' | 'confirm' | 'done'

export default function KioskPage() {
  const [practitionerId, setPractitionerId] = useState('')
  const [practiceName, setPracticeName] = useState('')
  const [welcomeMsg, setWelcomeMsg] = useState('Welcome! Please check in for your appointment.')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [state, setState] = useState<KioskState>('search')
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [autoLogoutTimer, setAutoLogoutTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function init() {
    // Get practitioner from URL params or first available kiosk
    const url = new URL(window.location.href)
    let pracId = url.searchParams.get('practitioner')

    if (!pracId) {
      // Try to find the first practitioner with kiosk enabled
      const { data } = await supabase.from('kiosk_settings').select('practitioner_id').eq('enabled', true).limit(1).single()
      if (data) pracId = data.practitioner_id
    }

    if (!pracId) {
      setLoading(false)
      return
    }

    setPractitionerId(pracId)

    // Get practitioner name
    const { data: prac } = await supabase.from('practitioners').select('practice_name, full_name').eq('id', pracId).single()
    if (prac) setPracticeName(prac.practice_name || prac.full_name || '')

    // Get kiosk settings
    const { data: ks } = await supabase.from('kiosk_settings').select('*').eq('practitioner_id', pracId).single()
    if (ks?.welcome_message) setWelcomeMsg(ks.welcome_message)

    // Get today's appointments
    const today = new Date().toISOString().split('T')[0]
    const { data: appts } = await supabase
      .from('human_appointments')
      .select('id, patient_id, patient_name, appointment_date, start_time, appointment_type, human_patients(first_name, last_name, date_of_birth)')
      .eq('practitioner_id', pracId)
      .eq('appointment_date', today)
      .order('start_time', { ascending: true })

    if (appts) setAppointments(appts as unknown as Appointment[])
    setLoading(false)
  }

  function selectAppointment(appt: Appointment) {
    setSelectedAppt(appt)
    setState('confirm')
  }

  async function confirmCheckin() {
    if (!selectedAppt) return

    await supabase.from('kiosk_checkins').insert({
      practitioner_id: practitionerId,
      patient_id: selectedAppt.patient_id,
      appointment_id: selectedAppt.id,
    })

    // Update appointment status
    await supabase.from('human_appointments').update({ status: 'checked_in' }).eq('id', selectedAppt.id)

    setState('done')

    // Auto-reset after 8 seconds
    const timer = setTimeout(() => {
      resetKiosk()
    }, 8000)
    setAutoLogoutTimer(timer)
  }

  function resetKiosk() {
    if (autoLogoutTimer) clearTimeout(autoLogoutTimer)
    setState('search')
    setSelectedAppt(null)
    setSearchTerm('')
  }

  const filtered = searchTerm.trim()
    ? appointments.filter(a => {
        const name = a.human_patients
          ? `${a.human_patients.first_name} ${a.human_patients.last_name}`
          : a.patient_name
        return name.toLowerCase().includes(searchTerm.toLowerCase())
      })
    : appointments

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081120]">
        <p className="text-white/60 text-2xl animate-pulse">Loading...</p>
      </div>
    )
  }

  if (!practitionerId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081120]">
        <div className="text-center">
          <p className="text-white/60 text-xl mb-2">Kiosk not configured.</p>
          <p className="text-white/40 text-sm">Enable kiosk mode in your dashboard settings.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#081120] text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-[#1a3358] bg-[#0d1b30] px-6 py-8 text-center">
        {practiceName && <p className="text-lg text-[#c9a227] font-semibold mb-1">{practiceName}</p>}
        <h1 className="text-3xl font-bold">{welcomeMsg}</h1>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        {state === 'search' && (
          <div className="w-full max-w-2xl space-y-6">
            <div className="text-center">
              <p className="text-xl text-white/70 mb-4">Tap your name below to check in</p>
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full max-w-md mx-auto rounded-2xl border border-[#1a3358] bg-[#0d1b30] px-6 py-4 text-lg text-white placeholder-white/30 outline-none focus:border-[#c9a227] text-center"
                placeholder="Search by name..."
                autoFocus
              />
            </div>

            {filtered.length === 0 ? (
              <p className="text-center text-white/40 text-lg">No appointments found for today.</p>
            ) : (
              <div className="grid gap-3 max-h-[50vh] overflow-y-auto">
                {filtered.map(appt => {
                  const name = appt.human_patients
                    ? `${appt.human_patients.first_name} ${appt.human_patients.last_name}`
                    : appt.patient_name
                  return (
                    <button
                      key={appt.id}
                      onClick={() => selectAppointment(appt)}
                      className="w-full rounded-2xl border border-[#1a3358] bg-[#0d1b30] px-6 py-5 text-left hover:border-[#c9a227] hover:bg-[#c9a227]/5 transition"
                    >
                      <p className="text-xl font-semibold">{name}</p>
                      <p className="text-sm text-white/50 mt-1">
                        {appt.start_time} {appt.appointment_type ? `· ${appt.appointment_type}` : ''}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {state === 'confirm' && selectedAppt && (
          <div className="text-center space-y-8">
            <div>
              <p className="text-2xl text-white/70 mb-2">Checking in as:</p>
              <p className="text-4xl font-bold text-[#c9a227]">
                {selectedAppt.human_patients
                  ? `${selectedAppt.human_patients.first_name} ${selectedAppt.human_patients.last_name}`
                  : selectedAppt.patient_name}
              </p>
              <p className="text-lg text-white/50 mt-2">{selectedAppt.start_time} {selectedAppt.appointment_type ? `· ${selectedAppt.appointment_type}` : ''}</p>
            </div>
            <div className="flex justify-center gap-6">
              <button
                onClick={resetKiosk}
                className="rounded-2xl border border-white/20 px-8 py-4 text-lg text-white/70 hover:bg-white/10 transition"
              >
                That&apos;s not me
              </button>
              <button
                onClick={confirmCheckin}
                className="rounded-2xl bg-[#c9a227] px-12 py-4 text-lg font-bold text-[#0f2040] hover:bg-[#b89020] transition"
              >
                Yes, check me in!
              </button>
            </div>
          </div>
        )}

        {state === 'done' && (
          <div className="text-center space-y-6">
            <div className="text-6xl">✓</div>
            <p className="text-3xl font-bold text-green-400">You&apos;re checked in!</p>
            <p className="text-xl text-white/60">Please have a seat. We&apos;ll be with you shortly.</p>
            <button
              onClick={resetKiosk}
              className="rounded-2xl border border-white/20 px-6 py-3 text-sm text-white/50 hover:bg-white/10 transition mt-8"
            >
              Next patient
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-[#1a3358] px-4 py-3 text-center">
        <p className="text-xs text-white/20">Powered by Stride</p>
      </div>
    </div>
  )
}
