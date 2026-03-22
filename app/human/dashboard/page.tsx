'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'

type Patient = {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  phone: string | null
  email: string | null
  chief_complaint: string | null
  archived: boolean
  created_at: string
}

type Visit = {
  id: string
  patient_id: string
  visit_date: string | null
  reason_for_visit: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  human_patients?: any
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return 'No phone'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

function getAge(dob: string | null): string {
  if (!dob) return ''
  const birth = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return `${age}y`
}

export default function HumanDashboard() {
  const router = useRouter()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userId, setUserId] = useState('')
  const [practitionerName, setPractitionerName] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  const [patients, setPatients] = useState<Patient[]>([])
  const [recentVisits, setRecentVisits] = useState<Visit[]>([])
  const [visitCount, setVisitCount] = useState(0)

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)

  // Add patient modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dob, setDob] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    checkUser()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/login'); return }
      setUserId(session.user.id)
    } else {
      setUserId(user.id)
    }
    setCheckingAuth(false)
  }

  useEffect(() => {
    if (!userId) return
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function loadData() {
    // Practitioner info
    const { data: prac } = await supabase
      .from('practitioners')
      .select('full_name, logo_url, practice_name')
      .eq('id', userId)
      .single()
    if (prac) {
      setPractitionerName(prac.full_name || prac.practice_name || '')
      setLogoUrl(prac.logo_url)
    }

    // Patients
    const { data: pts } = await supabase
      .from('human_patients')
      .select('*')
      .eq('practitioner_id', userId)
      .eq('archived', false)
      .order('last_name', { ascending: true })
    if (pts) setPatients(pts)

    // Visit count
    const { count } = await supabase
      .from('human_visits')
      .select('*', { count: 'exact', head: true })
      .eq('practitioner_id', userId)
    setVisitCount(count ?? 0)

    // Recent visits
    const { data: rv } = await supabase
      .from('human_visits')
      .select('id, patient_id, visit_date, reason_for_visit, human_patients(first_name, last_name)')
      .eq('practitioner_id', userId)
      .order('visit_date', { ascending: false })
      .limit(10)
    if (rv) setRecentVisits(rv as unknown as Visit[])
  }

  const filteredPatients = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return patients
    return patients.filter(p =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      p.phone?.includes(q) ||
      p.email?.toLowerCase().includes(q)
    )
  }, [patients, searchTerm])

  const selectedPatient = useMemo(() =>
    patients.find(p => p.id === selectedPatientId) ?? null
  , [patients, selectedPatientId])

  async function handleAddPatient() {
    if (!firstName.trim() || !lastName.trim()) { setMessage('First and last name required.'); return }
    setSaving(true); setMessage('')

    const { data, error } = await supabase
      .from('human_patients')
      .insert({
        practitioner_id: userId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: dob || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        chief_complaint: chiefComplaint.trim() || null,
      })
      .select()
      .single()

    setSaving(false)
    if (error) { setMessage('Failed to add patient.'); return }
    if (data) {
      setPatients(prev => [...prev, data].sort((a, b) => a.last_name.localeCompare(b.last_name)))
      setFirstName(''); setLastName(''); setDob(''); setPhone(''); setEmail(''); setAddress(''); setChiefComplaint('')
      setShowAddModal(false)
      setSelectedPatientId(data.id)
      logAudit({ action: 'create', resourceType: 'human_patient', resourceId: data.id })
    }
  }

  async function handleSendIntake(patientId: string) {
    const pt = patients.find(p => p.id === patientId)
    if (!pt) return

    // Create an intake form record
    const { data: form, error } = await supabase
      .from('human_intake_forms')
      .insert({
        patient_id: patientId,
        practitioner_id: userId,
        first_name: pt.first_name,
        last_name: pt.last_name,
        phone: pt.phone,
        email: pt.email,
        status: 'pending',
      })
      .select('id')
      .single()

    if (error || !form) {
      setMessage('Failed to create intake form.')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    const url = `${window.location.origin}/human/intake/${form.id}`
    await navigator.clipboard.writeText(url)
    setMessage('Intake form link copied! Share it with the patient.')
    setTimeout(() => setMessage(''), 4000)
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081120]">
        <p className="text-white/60 text-sm animate-pulse">Checking login...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#081120] text-white">
      {/* Header area */}
      <div className="border-b border-[#1a3358] bg-[#0d1b30] px-4 py-6 md:px-8">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">Human Patients</h1>
            <p className="text-sm text-blue-300/70 mt-0.5">
              {practitionerName && <>{practitionerName} &middot; </>}
              {patients.length} patient{patients.length !== 1 ? 's' : ''} &middot; {visitCount} visit{visitCount !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/human/analytics"
              className="rounded-xl border border-white/20 px-3 py-2 text-sm text-white/70 hover:bg-white/10 transition"
            >
              Analytics
            </Link>
            <Link
              href="/human/superbills"
              className="rounded-xl border border-white/20 px-3 py-2 text-sm text-white/70 hover:bg-white/10 transition"
            >
              Superbills
            </Link>
            <Link
              href="/human/booking-settings"
              className="rounded-xl border border-white/20 px-3 py-2 text-sm text-white/70 hover:bg-white/10 transition"
            >
              Online Booking
            </Link>
            <Link
              href="/select-mode"
              className="rounded-xl border border-white/20 px-3 py-2 text-sm text-white/70 hover:bg-white/10 transition"
            >
              Switch Mode
            </Link>
            <button
              onClick={() => setShowAddModal(true)}
              className="rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition"
            >
              + New Patient
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">

          {/* Left: Patient list */}
          <div className="space-y-3">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search patients..."
              className="w-full rounded-xl border border-[#1a3358] bg-[#0d1b30] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227] transition"
            />
            <div className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {filteredPatients.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/30">
                  {patients.length === 0 ? 'No patients yet — add your first one!' : 'No matches found'}
                </p>
              ) : (
                filteredPatients.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatientId(p.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition
                      ${p.id === selectedPatientId
                        ? 'border-[#c9a227]/50 bg-[#c9a227]/10'
                        : 'border-[#1a3358] bg-[#0d1b30] hover:border-[#c9a227]/30 hover:bg-[#0d1b30]/80'}`}
                  >
                    <p className="text-sm font-semibold text-white">
                      {p.last_name}, {p.first_name}
                      {p.date_of_birth && (
                        <span className="ml-2 text-xs font-normal text-blue-300/60">{getAge(p.date_of_birth)}</span>
                      )}
                    </p>
                    <p className="text-xs text-blue-300/60 mt-0.5 truncate">
                      {p.chief_complaint || formatPhone(p.phone)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: Selected patient detail or recent visits */}
          <div>
            {selectedPatient ? (
              <div className="space-y-6">
                {/* Patient header */}
                <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {selectedPatient.first_name} {selectedPatient.last_name}
                      </h2>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-blue-300/70">
                        {selectedPatient.date_of_birth && (
                          <span>DOB: {selectedPatient.date_of_birth} ({getAge(selectedPatient.date_of_birth)})</span>
                        )}
                        {selectedPatient.phone && <span>{formatPhone(selectedPatient.phone)}</span>}
                        {selectedPatient.email && <span>{selectedPatient.email}</span>}
                      </div>
                      {selectedPatient.chief_complaint && (
                        <p className="mt-3 text-sm text-blue-200/80">
                          <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Chief Complaint:</span>{' '}
                          {selectedPatient.chief_complaint}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/human/patients/${selectedPatient.id}`}
                      className="shrink-0 rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition"
                    >
                      Full Record
                    </Link>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/human/patients/${selectedPatient.id}?tab=visits&new=1`}
                    className="rounded-xl border border-[#c9a227]/40 bg-[#c9a227]/10 px-4 py-2.5 text-sm font-medium text-[#c9a227] hover:bg-[#c9a227]/20 transition"
                  >
                    + New Visit / SOAP Note
                  </Link>
                  <Link
                    href={`/human/patients/${selectedPatient.id}?tab=history`}
                    className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 transition"
                  >
                    View History
                  </Link>
                  <button
                    onClick={() => handleSendIntake(selectedPatient.id)}
                    className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 transition"
                  >
                    Send Intake Form
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const { data: { session } } = await supabase.auth.getSession()
                        if (!session) { setMessage('Please log in again.'); return }
                        const res = await fetch('/api/portal/generate-token', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`,
                          },
                          body: JSON.stringify({ patientId: selectedPatient.id }),
                        })
                        const data = await res.json()
                        if (!res.ok) { setMessage(data.error || 'Failed to generate link.'); return }
                        const url = `${window.location.origin}/human/portal/${selectedPatient.id}?token=${data.token}`
                        await navigator.clipboard.writeText(url)
                        setMessage('Secure portal link copied! Expires in 30 days.')
                        setTimeout(() => setMessage(''), 4000)
                      } catch {
                        setMessage('Failed to generate portal link.')
                        setTimeout(() => setMessage(''), 3000)
                      }
                    }}
                    className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 transition"
                  >
                    Copy Portal Link
                  </button>
                </div>
                {message && <p className="text-sm text-emerald-400 mt-2">{message}</p>}
              </div>
            ) : (
              /* Recent visits when no patient selected */
              <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-blue-400 mb-4">Recent Visits</h3>
                {recentVisits.length === 0 ? (
                  <p className="text-sm text-white/30 py-4 text-center">No visits recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {recentVisits.map(v => (
                      <Link
                        key={v.id}
                        href={`/human/patients/${v.patient_id}?tab=visits`}
                        className="flex items-center justify-between rounded-xl border border-[#1a3358] px-4 py-3 hover:border-[#c9a227]/30 hover:bg-[#0d1b30]/80 transition"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">
                            {v.human_patients
                              ? `${Array.isArray(v.human_patients) ? v.human_patients[0]?.first_name : v.human_patients.first_name} ${Array.isArray(v.human_patients) ? v.human_patients[0]?.last_name : v.human_patients.last_name}`
                              : 'Patient'}
                          </p>
                          <p className="text-xs text-blue-300/60 mt-0.5">{v.reason_for_visit || 'General visit'}</p>
                        </div>
                        <span className="text-xs text-blue-300/50 shrink-0">{v.visit_date}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">New Patient</h2>
              <button onClick={() => setShowAddModal(false)} className="text-white/40 hover:text-white text-xl">&times;</button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">First Name *</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                  className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227] transition"
                  placeholder="John" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">Last Name *</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                  className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227] transition"
                  placeholder="Doe" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">Date of Birth</label>
                <input type="date" value={dob} onChange={e => setDob(e.target.value)}
                  className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white outline-none focus:border-[#c9a227] transition" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">Phone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227] transition"
                  placeholder="(555) 123-4567" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227] transition"
                  placeholder="john@example.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">Address</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227] transition"
                  placeholder="123 Main St" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">Chief Complaint</label>
                <input type="text" value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)}
                  className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227] transition"
                  placeholder="Lower back pain, neck stiffness..." />
              </div>
            </div>

            {message && <p className="mt-3 text-sm text-red-400">{message}</p>}

            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowAddModal(false)}
                className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition">
                Cancel
              </button>
              <button onClick={handleAddPatient} disabled={saving}
                className="rounded-xl bg-[#c9a227] px-5 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] disabled:opacity-50 transition">
                {saving ? 'Adding...' : 'Add Patient'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
