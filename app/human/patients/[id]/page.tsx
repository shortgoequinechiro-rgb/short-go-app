'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'

type Patient = {
  id: string
  practitioner_id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  phone: string | null
  email: string | null
  address: string | null
  emergency_contact: string | null
  emergency_phone: string | null
  insurance_provider: string | null
  insurance_id: string | null
  chief_complaint: string | null
  medical_history: string | null
  medications: string | null
  allergies: string | null
  notes: string | null
}

type Visit = {
  id: string
  visit_date: string
  reason_for_visit: string | null
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  treated_areas: string | null
  recommendations: string | null
  follow_up: string | null
  notes: string | null
  created_at: string
}

type Tab = 'info' | 'visits' | 'history'

function getAge(dob: string | null): string {
  if (!dob) return ''
  const birth = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return `${age}`
}

function formatPhone(phone: string | null): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  return phone
}

const inputClass = 'w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227]/40 transition'
const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5'

export default function PatientRecordPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#081120]">
        <p className="text-white/60 text-sm animate-pulse">Loading patient...</p>
      </div>
    }>
      <PatientRecordPage />
    </Suspense>
  )
}

function PatientRecordPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const patientId = params.id as string

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [patient, setPatient] = useState<Patient | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get('tab')
    return (t === 'visits' || t === 'history') ? t : 'info'
  })

  // Patient edit state
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Patient>>({})
  const [saveMsg, setSaveMsg] = useState('')
  const [saving, setSaving] = useState(false)

  // New visit form
  const [showNewVisit, setShowNewVisit] = useState(searchParams.get('new') === '1')
  const [visitForm, setVisitForm] = useState({
    visit_date: new Date().toISOString().split('T')[0],
    reason_for_visit: '',
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    treated_areas: '',
    recommendations: '',
    follow_up: '',
    notes: '',
  })
  const [visitSaving, setVisitSaving] = useState(false)
  const [visitMsg, setVisitMsg] = useState('')

  // AI SOAP generation
  const [aiQuickNotes, setAiQuickNotes] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('')

  // Expanded visit detail
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null)

  useEffect(() => {
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const { data: pt } = await supabase
      .from('human_patients')
      .select('*')
      .eq('id', patientId)
      .single()

    if (!pt) { router.push('/human/dashboard'); return }
    setPatient(pt)
    setEditForm(pt)
    await loadVisits()
    setLoading(false)
  }

  async function loadVisits() {
    const { data } = await supabase
      .from('human_visits')
      .select('*')
      .eq('patient_id', patientId)
      .order('visit_date', { ascending: false })
    if (data) setVisits(data)
  }

  async function handleSavePatient() {
    if (!patient) return
    setSaving(true); setSaveMsg('')
    const { error } = await supabase
      .from('human_patients')
      .update({
        first_name: editForm.first_name?.trim() || patient.first_name,
        last_name: editForm.last_name?.trim() || patient.last_name,
        date_of_birth: editForm.date_of_birth || null,
        phone: editForm.phone?.trim() || null,
        email: editForm.email?.trim() || null,
        address: editForm.address?.trim() || null,
        emergency_contact: editForm.emergency_contact?.trim() || null,
        emergency_phone: editForm.emergency_phone?.trim() || null,
        insurance_provider: editForm.insurance_provider?.trim() || null,
        insurance_id: editForm.insurance_id?.trim() || null,
        chief_complaint: editForm.chief_complaint?.trim() || null,
        medical_history: editForm.medical_history?.trim() || null,
        medications: editForm.medications?.trim() || null,
        allergies: editForm.allergies?.trim() || null,
        notes: editForm.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', patient.id)
    setSaving(false)
    if (error) { setSaveMsg('Failed to save.'); return }
    setSaveMsg('Saved!')
    setPatient({ ...patient, ...editForm } as Patient)
    setEditing(false)
    setTimeout(() => setSaveMsg(''), 2000)
  }

  async function handleSaveVisit() {
    if (!patient) return
    setVisitSaving(true); setVisitMsg('')
    const { data, error } = await supabase
      .from('human_visits')
      .insert({
        patient_id: patient.id,
        practitioner_id: userId,
        visit_date: visitForm.visit_date,
        reason_for_visit: visitForm.reason_for_visit.trim() || null,
        subjective: visitForm.subjective.trim() || null,
        objective: visitForm.objective.trim() || null,
        assessment: visitForm.assessment.trim() || null,
        plan: visitForm.plan.trim() || null,
        treated_areas: visitForm.treated_areas.trim() || null,
        recommendations: visitForm.recommendations.trim() || null,
        follow_up: visitForm.follow_up.trim() || null,
        notes: visitForm.notes.trim() || null,
      })
      .select()
      .single()
    setVisitSaving(false)
    if (error) { setVisitMsg('Failed to save visit.'); return }
    if (data) {
      setVisits(prev => [data, ...prev])
      setShowNewVisit(false)
      setVisitForm({
        visit_date: new Date().toISOString().split('T')[0],
        reason_for_visit: '', subjective: '', objective: '', assessment: '',
        plan: '', treated_areas: '', recommendations: '', follow_up: '', notes: '',
      })
    }
  }

  async function handleAiGenerate() {
    if (!aiQuickNotes.trim() && !selectedTemplate) return
    setAiGenerating(true); setVisitMsg('')
    try {
      const res = await fetch('/api/generate-soap-human', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quickNotes: aiQuickNotes || `Standard ${selectedTemplate} visit`,
          patientName: patient ? `${patient.first_name} ${patient.last_name}` : 'Patient',
          chiefComplaint: patient?.chief_complaint || '',
          treatedAreas: visitForm.treated_areas,
          templateType: selectedTemplate,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setVisitMsg(data.error || 'AI generation failed.'); return }
      setVisitForm(prev => ({
        ...prev,
        subjective: data.subjective || prev.subjective,
        objective: data.objective || prev.objective,
        assessment: data.assessment || prev.assessment,
        plan: data.plan || prev.plan,
        treated_areas: data.treated_areas || prev.treated_areas,
        recommendations: data.recommendations || prev.recommendations,
        follow_up: data.follow_up || prev.follow_up,
      }))
    } catch {
      setVisitMsg('Failed to connect to AI service.')
    }
    setAiGenerating(false)
  }

  const SOAP_TEMPLATES = [
    { value: '', label: 'No template' },
    { value: 'lower-back-pain', label: 'Lower Back Pain' },
    { value: 'neck-pain', label: 'Neck Pain / Cervicalgia' },
    { value: 'headache-migraine', label: 'Headache / Migraine' },
    { value: 'sciatica', label: 'Sciatica' },
    { value: 'thoracic-pain', label: 'Mid-Back / Thoracic Pain' },
    { value: 'shoulder-pain', label: 'Shoulder Pain' },
    { value: 'si-joint', label: 'SI Joint Dysfunction' },
    { value: 'whiplash', label: 'Whiplash / MVA' },
    { value: 'wellness-maintenance', label: 'Wellness / Maintenance' },
    { value: 'prenatal', label: 'Prenatal / Webster Technique' },
    { value: 'pediatric', label: 'Pediatric' },
    { value: 'sports-injury', label: 'Sports Injury' },
    { value: 'postural-correction', label: 'Postural Correction' },
  ]

  if (loading || !patient) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081120]">
        <p className="text-white/60 text-sm animate-pulse">Loading patient...</p>
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'info', label: 'Patient Info' },
    { key: 'visits', label: `Visits (${visits.length})` },
    { key: 'history', label: 'Medical History' },
  ]

  return (
    <div className="min-h-screen bg-[#081120] text-white">
      {/* Header */}
      <div className="border-b border-[#1a3358] bg-[#0d1b30] px-4 py-5 md:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-2 text-sm text-blue-300/60 mb-2">
            <Link href="/human/dashboard" className="hover:text-white transition">Dashboard</Link>
            <span>/</span>
            <span className="text-white font-medium">{patient.first_name} {patient.last_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{patient.first_name} {patient.last_name}</h1>
              <p className="text-sm text-blue-300/60 mt-0.5">
                {patient.date_of_birth && <>Age {getAge(patient.date_of_birth)} &middot; </>}
                {patient.phone && <>{formatPhone(patient.phone)} &middot; </>}
                {patient.email || ''}
              </p>
            </div>
            <button
              onClick={() => { setShowNewVisit(true); setTab('visits') }}
              className="rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition"
            >
              + New Visit
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#1a3358] bg-[#0d1b30]/50 px-4 md:px-8">
        <div className="mx-auto max-w-5xl flex gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-medium transition border-b-2
                ${tab === t.key
                  ? 'border-[#c9a227] text-[#c9a227]'
                  : 'border-transparent text-white/50 hover:text-white/80'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">

        {/* ── Info Tab ── */}
        {tab === 'info' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Patient Information</h2>
              {!editing ? (
                <button onClick={() => setEditing(true)}
                  className="rounded-xl border border-[#c9a227]/40 px-4 py-2 text-sm text-[#c9a227] hover:bg-[#c9a227]/10 transition">
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => { setEditing(false); setEditForm(patient) }}
                    className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition">
                    Cancel
                  </button>
                  <button onClick={handleSavePatient} disabled={saving}
                    className="rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] disabled:opacity-50 transition">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>
            {saveMsg && <p className={`text-sm ${saveMsg.includes('Failed') ? 'text-red-400' : 'text-emerald-400'}`}>{saveMsg}</p>}

            <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>First Name</label>
                  {editing ? (
                    <input type="text" value={editForm.first_name ?? ''} onChange={e => setEditForm(prev => ({ ...prev, first_name: e.target.value }))} className={inputClass} />
                  ) : (
                    <p className="text-sm text-white">{patient.first_name}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Last Name</label>
                  {editing ? (
                    <input type="text" value={editForm.last_name ?? ''} onChange={e => setEditForm(prev => ({ ...prev, last_name: e.target.value }))} className={inputClass} />
                  ) : (
                    <p className="text-sm text-white">{patient.last_name}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Date of Birth</label>
                  {editing ? (
                    <input type="date" value={editForm.date_of_birth ?? ''} onChange={e => setEditForm(prev => ({ ...prev, date_of_birth: e.target.value }))} className={inputClass} />
                  ) : (
                    <p className="text-sm text-white">{patient.date_of_birth || '—'}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Phone</label>
                  {editing ? (
                    <input type="tel" value={editForm.phone ?? ''} onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))} className={inputClass} />
                  ) : (
                    <p className="text-sm text-white">{formatPhone(patient.phone) || '—'}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  {editing ? (
                    <input type="email" value={editForm.email ?? ''} onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))} className={inputClass} />
                  ) : (
                    <p className="text-sm text-white">{patient.email || '—'}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Address</label>
                  {editing ? (
                    <input type="text" value={editForm.address ?? ''} onChange={e => setEditForm(prev => ({ ...prev, address: e.target.value }))} className={inputClass} />
                  ) : (
                    <p className="text-sm text-white">{patient.address || '—'}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Emergency Contact</label>
                  {editing ? (
                    <input type="text" value={editForm.emergency_contact ?? ''} onChange={e => setEditForm(prev => ({ ...prev, emergency_contact: e.target.value }))} className={inputClass} placeholder="Name" />
                  ) : (
                    <p className="text-sm text-white">{patient.emergency_contact || '—'}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Emergency Phone</label>
                  {editing ? (
                    <input type="tel" value={editForm.emergency_phone ?? ''} onChange={e => setEditForm(prev => ({ ...prev, emergency_phone: e.target.value }))} className={inputClass} />
                  ) : (
                    <p className="text-sm text-white">{formatPhone(patient.emergency_phone) || '—'}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Insurance Provider</label>
                  {editing ? (
                    <input type="text" value={editForm.insurance_provider ?? ''} onChange={e => setEditForm(prev => ({ ...prev, insurance_provider: e.target.value }))} className={inputClass} />
                  ) : (
                    <p className="text-sm text-white">{patient.insurance_provider || '—'}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Insurance ID</label>
                  {editing ? (
                    <input type="text" value={editForm.insurance_id ?? ''} onChange={e => setEditForm(prev => ({ ...prev, insurance_id: e.target.value }))} className={inputClass} />
                  ) : (
                    <p className="text-sm text-white">{patient.insurance_id || '—'}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Chief Complaint</label>
                  {editing ? (
                    <textarea value={editForm.chief_complaint ?? ''} onChange={e => setEditForm(prev => ({ ...prev, chief_complaint: e.target.value }))}
                      className={inputClass + ' min-h-[80px]'} />
                  ) : (
                    <p className="text-sm text-white whitespace-pre-wrap">{patient.chief_complaint || '—'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Visits Tab ── */}
        {tab === 'visits' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Visits &amp; SOAP Notes</h2>
              {!showNewVisit && (
                <button onClick={() => setShowNewVisit(true)}
                  className="rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition">
                  + New Visit
                </button>
              )}
            </div>

            {/* New visit form */}
            {showNewVisit && (
              <div className="rounded-2xl border border-[#c9a227]/30 bg-[#0d1b30] p-6 space-y-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#c9a227]">New Visit</h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Visit Date</label>
                    <input type="date" value={visitForm.visit_date}
                      onChange={e => setVisitForm(prev => ({ ...prev, visit_date: e.target.value }))}
                      className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Reason for Visit</label>
                    <input type="text" value={visitForm.reason_for_visit}
                      onChange={e => setVisitForm(prev => ({ ...prev, reason_for_visit: e.target.value }))}
                      className={inputClass} placeholder="e.g., Lower back pain, follow-up" />
                  </div>
                </div>

                {/* AI SOAP Generation */}
                <div className="rounded-xl border border-[#c9a227]/20 bg-[#c9a227]/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#c9a227]">AI SOAP Generator</span>
                    <span className="text-[10px] uppercase tracking-wider text-[#c9a227]/60 bg-[#c9a227]/10 px-2 py-0.5 rounded-full">GPT-4o</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Quick Notes</label>
                      <textarea value={aiQuickNotes}
                        onChange={e => setAiQuickNotes(e.target.value)}
                        className={inputClass + ' min-h-[80px]'}
                        placeholder="Type your quick notes... e.g., Patient reports sharp lower back pain radiating to left leg, worse with sitting. Adjusted L4-L5, SI joint bilateral. Moderate muscle tension in lumbar paraspinals." />
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>Case Template (optional)</label>
                        <select value={selectedTemplate}
                          onChange={e => setSelectedTemplate(e.target.value)}
                          className={inputClass}>
                          {SOAP_TEMPLATES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={handleAiGenerate}
                        disabled={aiGenerating || (!aiQuickNotes.trim() && !selectedTemplate)}
                        className="w-full rounded-xl bg-[#c9a227] py-2.5 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] disabled:opacity-50 transition"
                      >
                        {aiGenerating ? 'Generating SOAP Note...' : 'Generate SOAP Note with AI'}
                      </button>
                      <p className="text-[10px] text-blue-400/50 text-center">AI will populate all fields below. You can edit before saving.</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs font-bold uppercase tracking-wider text-blue-400 mt-2">SOAP Note</p>
                <div className="grid gap-4">
                  <div>
                    <label className={labelClass}>S — Subjective</label>
                    <textarea value={visitForm.subjective}
                      onChange={e => setVisitForm(prev => ({ ...prev, subjective: e.target.value }))}
                      className={inputClass + ' min-h-[80px]'}
                      placeholder="Patient's description of symptoms, pain level, onset, duration..." />
                  </div>
                  <div>
                    <label className={labelClass}>O — Objective</label>
                    <textarea value={visitForm.objective}
                      onChange={e => setVisitForm(prev => ({ ...prev, objective: e.target.value }))}
                      className={inputClass + ' min-h-[80px]'}
                      placeholder="Examination findings, ROM, palpation, posture analysis..." />
                  </div>
                  <div>
                    <label className={labelClass}>A — Assessment</label>
                    <textarea value={visitForm.assessment}
                      onChange={e => setVisitForm(prev => ({ ...prev, assessment: e.target.value }))}
                      className={inputClass + ' min-h-[80px]'}
                      placeholder="Diagnosis, subluxation findings, clinical impression..." />
                  </div>
                  <div>
                    <label className={labelClass}>P — Plan</label>
                    <textarea value={visitForm.plan}
                      onChange={e => setVisitForm(prev => ({ ...prev, plan: e.target.value }))}
                      className={inputClass + ' min-h-[80px]'}
                      placeholder="Treatment performed, adjustments made, exercises prescribed..." />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Areas Treated</label>
                    <input type="text" value={visitForm.treated_areas}
                      onChange={e => setVisitForm(prev => ({ ...prev, treated_areas: e.target.value }))}
                      className={inputClass} placeholder="e.g., C5-C7, L4-L5, SI joint" />
                  </div>
                  <div>
                    <label className={labelClass}>Follow-up</label>
                    <input type="text" value={visitForm.follow_up}
                      onChange={e => setVisitForm(prev => ({ ...prev, follow_up: e.target.value }))}
                      className={inputClass} placeholder="e.g., Return in 1 week" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Recommendations</label>
                    <textarea value={visitForm.recommendations}
                      onChange={e => setVisitForm(prev => ({ ...prev, recommendations: e.target.value }))}
                      className={inputClass + ' min-h-[60px]'}
                      placeholder="Home exercises, ice/heat, ergonomic advice..." />
                  </div>
                </div>

                {visitMsg && <p className="text-sm text-red-400">{visitMsg}</p>}

                <div className="flex justify-end gap-3">
                  <button onClick={() => setShowNewVisit(false)}
                    className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition">
                    Cancel
                  </button>
                  <button onClick={handleSaveVisit} disabled={visitSaving}
                    className="rounded-xl bg-[#c9a227] px-5 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] disabled:opacity-50 transition">
                    {visitSaving ? 'Saving...' : 'Save Visit'}
                  </button>
                </div>
              </div>
            )}

            {/* Visit list */}
            {visits.length === 0 && !showNewVisit ? (
              <p className="text-sm text-white/30 text-center py-8">No visits recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {visits.map(v => (
                  <div key={v.id} className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] overflow-hidden">
                    <button
                      onClick={() => setExpandedVisitId(expandedVisitId === v.id ? null : v.id)}
                      className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/5 transition"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{v.visit_date}</p>
                        <p className="text-xs text-blue-300/60 mt-0.5">{v.reason_for_visit || 'General visit'}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-blue-300/50">
                        {v.treated_areas && <span className="hidden sm:inline">{v.treated_areas}</span>}
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${expandedVisitId === v.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>
                    {expandedVisitId === v.id && (
                      <div className="border-t border-[#1a3358] px-6 py-5 space-y-4">
                        {v.subjective && (
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">Subjective</p>
                            <p className="text-sm text-blue-200/80 whitespace-pre-wrap">{v.subjective}</p>
                          </div>
                        )}
                        {v.objective && (
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">Objective</p>
                            <p className="text-sm text-blue-200/80 whitespace-pre-wrap">{v.objective}</p>
                          </div>
                        )}
                        {v.assessment && (
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">Assessment</p>
                            <p className="text-sm text-blue-200/80 whitespace-pre-wrap">{v.assessment}</p>
                          </div>
                        )}
                        {v.plan && (
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">Plan</p>
                            <p className="text-sm text-blue-200/80 whitespace-pre-wrap">{v.plan}</p>
                          </div>
                        )}
                        {v.treated_areas && (
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">Areas Treated</p>
                            <p className="text-sm text-blue-200/80">{v.treated_areas}</p>
                          </div>
                        )}
                        {v.recommendations && (
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">Recommendations</p>
                            <p className="text-sm text-blue-200/80 whitespace-pre-wrap">{v.recommendations}</p>
                          </div>
                        )}
                        {v.follow_up && (
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">Follow-up</p>
                            <p className="text-sm text-blue-200/80">{v.follow_up}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Medical History Tab ── */}
        {tab === 'history' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Medical History</h2>
              {!editing ? (
                <button onClick={() => setEditing(true)}
                  className="rounded-xl border border-[#c9a227]/40 px-4 py-2 text-sm text-[#c9a227] hover:bg-[#c9a227]/10 transition">
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => { setEditing(false); setEditForm(patient) }}
                    className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition">
                    Cancel
                  </button>
                  <button onClick={handleSavePatient} disabled={saving}
                    className="rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] disabled:opacity-50 transition">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6 space-y-5">
              <div>
                <label className={labelClass}>Medical History</label>
                {editing ? (
                  <textarea value={editForm.medical_history ?? ''} onChange={e => setEditForm(prev => ({ ...prev, medical_history: e.target.value }))}
                    className={inputClass + ' min-h-[100px]'} placeholder="Past surgeries, conditions, injuries..." />
                ) : (
                  <p className="text-sm text-blue-200/80 whitespace-pre-wrap">{patient.medical_history || 'Not recorded'}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Current Medications</label>
                {editing ? (
                  <textarea value={editForm.medications ?? ''} onChange={e => setEditForm(prev => ({ ...prev, medications: e.target.value }))}
                    className={inputClass + ' min-h-[80px]'} placeholder="List current medications and dosages..." />
                ) : (
                  <p className="text-sm text-blue-200/80 whitespace-pre-wrap">{patient.medications || 'None recorded'}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Allergies</label>
                {editing ? (
                  <textarea value={editForm.allergies ?? ''} onChange={e => setEditForm(prev => ({ ...prev, allergies: e.target.value }))}
                    className={inputClass + ' min-h-[80px]'} placeholder="Drug allergies, latex, etc..." />
                ) : (
                  <p className="text-sm text-blue-200/80 whitespace-pre-wrap">{patient.allergies || 'None recorded'}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Additional Notes</label>
                {editing ? (
                  <textarea value={editForm.notes ?? ''} onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                    className={inputClass + ' min-h-[80px]'} placeholder="Any other relevant information..." />
                ) : (
                  <p className="text-sm text-blue-200/80 whitespace-pre-wrap">{patient.notes || 'None'}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
