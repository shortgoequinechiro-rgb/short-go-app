'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'

interface DiagnosisCode { code: string; description: string }
interface ProcedureCode { code: string; description: string; units: number; fee: number }

interface Superbill {
  id: string
  patient_name: string
  date_of_service: string
  status: string
  total_fee: number
  amount_paid: number
  balance_due: number
}

interface Patient {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  phone: string | null
  email: string | null
  address: string | null
  insurance_provider: string | null
  insurance_id: string | null
}

interface Visit {
  id: string
  visit_date: string
  reason_for_visit: string | null
}

const DIAGNOSIS_CODES = [
  { code: 'M54.5', description: 'Low back pain' },
  { code: 'M54.2', description: 'Cervicalgia' },
  { code: 'M54.6', description: 'Thoracic spine pain' },
  { code: 'M99.01', description: 'Segmental dysfunction - cervical' },
  { code: 'M99.02', description: 'Segmental dysfunction - thoracic' },
  { code: 'M99.03', description: 'Segmental dysfunction - lumbar' },
  { code: 'M99.04', description: 'Segmental dysfunction - sacral' },
  { code: 'M54.9', description: 'Dorsalgia' },
  { code: 'M62.830', description: 'Muscle spasm of back' },
  { code: 'G89.29', description: 'Other chronic pain' },
]

const PROCEDURE_CODES = [
  { code: '98940', description: 'CMT 1-2 regions', defaultFee: 45 },
  { code: '98941', description: 'CMT 3-4 regions', defaultFee: 60 },
  { code: '98942', description: 'CMT 5 regions', defaultFee: 75 },
  { code: '99202', description: 'New patient E/M Level 2', defaultFee: 50 },
  { code: '99203', description: 'New patient E/M Level 3', defaultFee: 70 },
  { code: '99212', description: 'Established E/M Level 2', defaultFee: 40 },
  { code: '99213', description: 'Established E/M Level 3', defaultFee: 55 },
  { code: '97140', description: 'Manual therapy', defaultFee: 50 },
  { code: '97110', description: 'Therapeutic exercises', defaultFee: 40 },
  { code: '97012', description: 'Mechanical traction', defaultFee: 30 },
]

const inputClass = 'w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227] transition'
const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5'

export default function SuperbillsPage() {
  const router = useRouter()
  const [superbills, setSuperbills] = useState<Superbill[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientVisits, setPatientVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'draft' | 'finalized' | 'submitted'>('all')

  const [showNewModal, setShowNewModal] = useState(false)
  const [formStep, setFormStep] = useState<'patient' | 'details'>('patient')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [form, setForm] = useState({
    patient_id: '',
    visit_id: '',
    provider_name: '',
    provider_npi: '',
    provider_tax_id: '',
    practice_name: '',
    practice_address: '',
    practice_phone: '',
    patient_name: '',
    patient_dob: '',
    patient_address: '',
    patient_phone: '',
    insurance_provider: '',
    insurance_id: '',
    insurance_group: '',
    date_of_service: new Date().toISOString().split('T')[0],
    place_of_service: '11',
    diagnosis_codes: [] as DiagnosisCode[],
    procedure_codes: [] as ProcedureCode[],
    amount_paid: 0,
    payment_method: 'cash',
    notes: '',
  })

  useEffect(() => {
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)
    await fetchData(user.id)
    setLoading(false)
  }

  async function fetchData(uid?: string) {
    const id = uid || userId
    const { data: bills } = await supabase
      .from('superbills')
      .select('id, patient_name, date_of_service, status, total_fee, amount_paid, balance_due')
      .eq('practitioner_id', id)
      .order('date_of_service', { ascending: false })
    if (bills) setSuperbills(bills)

    const { data: pts } = await supabase
      .from('human_patients')
      .select('id, first_name, last_name, date_of_birth, phone, email, address, insurance_provider, insurance_id')
      .eq('practitioner_id', id)
      .eq('archived', false)
      .order('last_name')
    if (pts) setPatients(pts)

    // Pre-fill provider info from most recent superbill
    if (bills && bills.length > 0) {
      const { data: latest } = await supabase
        .from('superbills')
        .select('provider_name, provider_npi, provider_tax_id, practice_name, practice_address, practice_phone')
        .eq('practitioner_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (latest) {
        setForm(f => ({
          ...f,
          provider_name: latest.provider_name || '',
          provider_npi: latest.provider_npi || '',
          provider_tax_id: latest.provider_tax_id || '',
          practice_name: latest.practice_name || '',
          practice_address: latest.practice_address || '',
          practice_phone: latest.practice_phone || '',
        }))
      }
    }
  }

  async function selectPatient(patientId: string) {
    const pt = patients.find(p => p.id === patientId)
    if (!pt) return
    setForm(f => ({
      ...f,
      patient_id: patientId,
      patient_name: `${pt.first_name} ${pt.last_name}`,
      patient_dob: pt.date_of_birth || '',
      patient_address: pt.address || '',
      patient_phone: pt.phone || '',
      insurance_provider: pt.insurance_provider || '',
      insurance_id: pt.insurance_id || '',
    }))

    const { data: visits } = await supabase
      .from('human_visits')
      .select('id, visit_date, reason_for_visit')
      .eq('patient_id', patientId)
      .order('visit_date', { ascending: false })
      .limit(20)
    setPatientVisits(visits || [])
    setFormStep('details')
  }

  function addDx(code: string, desc: string) {
    if (form.diagnosis_codes.find(d => d.code === code)) return
    setForm(f => ({ ...f, diagnosis_codes: [...f.diagnosis_codes, { code, description: desc }] }))
  }

  function removeDx(code: string) {
    setForm(f => ({ ...f, diagnosis_codes: f.diagnosis_codes.filter(d => d.code !== code) }))
  }

  function addCpt(code: string, desc: string, fee: number) {
    if (form.procedure_codes.find(p => p.code === code)) return
    setForm(f => ({ ...f, procedure_codes: [...f.procedure_codes, { code, description: desc, units: 1, fee }] }))
  }

  function removeCpt(code: string) {
    setForm(f => ({ ...f, procedure_codes: f.procedure_codes.filter(p => p.code !== code) }))
  }

  function updateCpt(code: string, updates: Partial<ProcedureCode>) {
    setForm(f => ({ ...f, procedure_codes: f.procedure_codes.map(p => p.code === code ? { ...p, ...updates } : p) }))
  }

  const totalFee = form.procedure_codes.reduce((sum, p) => sum + p.fee * p.units, 0)
  const balanceDue = totalFee - form.amount_paid

  async function handleSave(status: 'draft' | 'finalized') {
    if (!form.patient_name) { setMessage('Select a patient first.'); return }
    setSaving(true); setMessage('')

    const { data, error } = await supabase.from('superbills').insert({
      patient_id: form.patient_id,
      visit_id: form.visit_id || null,
      practitioner_id: userId,
      provider_name: form.provider_name || null,
      provider_npi: form.provider_npi || null,
      provider_tax_id: form.provider_tax_id || null,
      practice_name: form.practice_name || null,
      practice_address: form.practice_address || null,
      practice_phone: form.practice_phone || null,
      patient_name: form.patient_name,
      patient_dob: form.patient_dob || null,
      patient_address: form.patient_address || null,
      patient_phone: form.patient_phone || null,
      insurance_provider: form.insurance_provider || null,
      insurance_id: form.insurance_id || null,
      insurance_group: form.insurance_group || null,
      date_of_service: form.date_of_service,
      place_of_service: form.place_of_service,
      diagnosis_codes: form.diagnosis_codes,
      procedure_codes: form.procedure_codes,
      total_fee: totalFee,
      amount_paid: form.amount_paid,
      balance_due: balanceDue,
      payment_method: form.payment_method || null,
      status,
      notes: form.notes || null,
    }).select().single()

    setSaving(false)
    if (error) { setMessage('Failed to save superbill.'); return }
    if (data) {
      logAudit({ action: 'create', resourceType: 'superbill', resourceId: data.id })
      setShowNewModal(false)
      resetForm()
      await fetchData()
    }
  }

  async function handleFinalize(id: string) {
    await supabase.from('superbills').update({ status: 'finalized' }).eq('id', id)
    logAudit({ action: 'update', resourceType: 'superbill', resourceId: id, details: { status: 'finalized' } })
    await fetchData()
  }

  function resetForm() {
    setForm(f => ({
      ...f,
      patient_id: '', visit_id: '', patient_name: '', patient_dob: '', patient_address: '', patient_phone: '',
      insurance_provider: '', insurance_id: '', insurance_group: '',
      date_of_service: new Date().toISOString().split('T')[0],
      diagnosis_codes: [], procedure_codes: [], amount_paid: 0, payment_method: 'cash', notes: '',
    }))
    setFormStep('patient')
    setPatientVisits([])
    setMessage('')
  }

  const filtered = activeTab === 'all' ? superbills : superbills.filter(s => s.status === activeTab)
  const statusColors: Record<string, string> = {
    draft: 'bg-white/10 text-white/50 border-white/20',
    finalized: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    submitted: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081120]">
        <p className="text-white/60 text-sm animate-pulse">Loading superbills...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#081120] text-white">
      {/* Header */}
      <div className="border-b border-[#1a3358] bg-[#0d1b30] px-4 py-5 md:px-8">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-blue-300/60 mb-1">
              <Link href="/human/dashboard" className="hover:text-white transition">Dashboard</Link>
              <span>/</span>
              <span className="text-white font-medium">Superbills</span>
            </div>
            <h1 className="text-xl font-bold">Superbills & Billing</h1>
          </div>
          <button onClick={() => setShowNewModal(true)}
            className="rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition">
            + New Superbill
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#1a3358] bg-[#0d1b30]/50 px-4 md:px-8">
        <div className="mx-auto max-w-6xl flex gap-1">
          {(['all', 'draft', 'finalized', 'submitted'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium transition border-b-2 capitalize
                ${activeTab === tab ? 'border-[#c9a227] text-[#c9a227]' : 'border-transparent text-white/50 hover:text-white/80'}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-12 text-center">
            <p className="text-white/30">No superbills found. Create one to get started.</p>
          </div>
        ) : (
          filtered.map(bill => (
            <div key={bill.id} className="rounded-xl border border-[#1a3358] bg-[#0d1b30] px-5 py-4 flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{bill.patient_name}</p>
                <p className="text-xs text-blue-300/60 mt-0.5">{bill.date_of_service}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColors[bill.status] || ''}`}>
                  {bill.status}
                </span>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">${Number(bill.total_fee).toFixed(2)}</p>
                  {Number(bill.balance_due) > 0 && (
                    <p className="text-[10px] text-[#c9a227]">Due: ${Number(bill.balance_due).toFixed(2)}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <a href={`/api/superbills/${bill.id}/pdf`} target="_blank" rel="noopener noreferrer"
                    className="rounded-lg bg-[#c9a227]/10 border border-[#c9a227]/40 px-3 py-1.5 text-xs font-medium text-[#c9a227] hover:bg-[#c9a227]/20 transition">
                    PDF
                  </a>
                  {bill.status === 'draft' && (
                    <button onClick={() => handleFinalize(bill.id)}
                      className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 transition">
                      Finalize
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Superbill Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">{formStep === 'patient' ? 'Select Patient' : 'Create Superbill'}</h2>
              <button onClick={() => { setShowNewModal(false); resetForm() }} className="text-white/40 hover:text-white text-xl">&times;</button>
            </div>

            {formStep === 'patient' ? (
              <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                {patients.map(pt => (
                  <button key={pt.id} onClick={() => selectPatient(pt.id)}
                    className="w-full text-left rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-3 hover:border-[#c9a227]/30 transition">
                    <p className="text-sm font-medium text-white">{pt.last_name}, {pt.first_name}</p>
                    <p className="text-xs text-blue-300/60">{pt.insurance_provider || 'No insurance on file'}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-5">
                {message && <p className="text-sm text-red-400">{message}</p>}

                {/* Provider Info */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-3">Provider Information</h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div><label className={labelClass}>Name</label><input type="text" value={form.provider_name} onChange={e => setForm(f => ({ ...f, provider_name: e.target.value }))} className={inputClass} /></div>
                    <div><label className={labelClass}>NPI</label><input type="text" value={form.provider_npi} onChange={e => setForm(f => ({ ...f, provider_npi: e.target.value }))} className={inputClass} /></div>
                    <div><label className={labelClass}>Tax ID</label><input type="text" value={form.provider_tax_id} onChange={e => setForm(f => ({ ...f, provider_tax_id: e.target.value }))} className={inputClass} /></div>
                  </div>
                </div>

                {/* Visit selection */}
                {patientVisits.length > 0 && (
                  <div>
                    <label className={labelClass}>Link to Visit (optional)</label>
                    <select value={form.visit_id} onChange={e => setForm(f => ({ ...f, visit_id: e.target.value }))} className={inputClass}>
                      <option value="">No visit selected</option>
                      {patientVisits.map(v => <option key={v.id} value={v.id}>{v.visit_date}{v.reason_for_visit ? ` — ${v.reason_for_visit}` : ''}</option>)}
                    </select>
                  </div>
                )}

                {/* Date */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className={labelClass}>Date of Service</label><input type="date" value={form.date_of_service} onChange={e => setForm(f => ({ ...f, date_of_service: e.target.value }))} className={inputClass} /></div>
                  <div><label className={labelClass}>Place of Service</label><input type="text" value={form.place_of_service} onChange={e => setForm(f => ({ ...f, place_of_service: e.target.value }))} className={inputClass} placeholder="11 = Office" /></div>
                </div>

                {/* Diagnosis Codes */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-2">Diagnosis Codes (ICD-10)</h3>
                  {form.diagnosis_codes.length > 0 && (
                    <div className="space-y-1 mb-3">
                      {form.diagnosis_codes.map(d => (
                        <div key={d.code} className="flex items-center justify-between rounded-lg border border-[#1a3358] bg-[#081120] px-3 py-2">
                          <span className="text-xs text-white"><span className="font-semibold text-[#c9a227]">{d.code}</span> — {d.description}</span>
                          <button onClick={() => removeDx(d.code)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {DIAGNOSIS_CODES.map(d => (
                      <button key={d.code} onClick={() => addDx(d.code, d.description)}
                        disabled={!!form.diagnosis_codes.find(x => x.code === d.code)}
                        className="rounded-lg border border-[#1a3358] bg-[#081120] px-2 py-1 text-[10px] text-blue-300/70 hover:text-white hover:border-[#c9a227]/30 disabled:opacity-30 transition">
                        + {d.code}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Procedure Codes */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-2">Procedure Codes (CPT)</h3>
                  {form.procedure_codes.length > 0 && (
                    <div className="space-y-1 mb-3">
                      {form.procedure_codes.map(p => (
                        <div key={p.code} className="flex items-center gap-3 rounded-lg border border-[#1a3358] bg-[#081120] px-3 py-2">
                          <div className="flex-1">
                            <span className="text-xs text-white"><span className="font-semibold text-[#c9a227]">{p.code}</span> — {p.description}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input type="number" min={1} value={p.units} onChange={e => updateCpt(p.code, { units: parseInt(e.target.value) || 1 })}
                              className="w-14 rounded border border-[#1a3358] bg-[#081120] px-2 py-1 text-xs text-white text-center" />
                            <span className="text-xs text-white/50">×</span>
                            <input type="number" step="0.01" value={p.fee} onChange={e => updateCpt(p.code, { fee: parseFloat(e.target.value) || 0 })}
                              className="w-20 rounded border border-[#1a3358] bg-[#081120] px-2 py-1 text-xs text-white text-center" />
                            <span className="text-xs text-white font-medium w-16 text-right">${(p.fee * p.units).toFixed(2)}</span>
                            <button onClick={() => removeCpt(p.code)} className="text-xs text-red-400 hover:text-red-300">×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {PROCEDURE_CODES.map(c => (
                      <button key={c.code} onClick={() => addCpt(c.code, c.description, c.defaultFee)}
                        disabled={!!form.procedure_codes.find(x => x.code === c.code)}
                        className="rounded-lg border border-[#1a3358] bg-[#081120] px-2 py-1 text-[10px] text-blue-300/70 hover:text-white hover:border-[#c9a227]/30 disabled:opacity-30 transition">
                        + {c.code}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment */}
                <div className="rounded-xl border border-[#1a3358] bg-[#081120] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Total Fee</span>
                    <span className="text-lg font-bold text-white">${totalFee.toFixed(2)}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div><label className={labelClass}>Amount Paid</label><input type="number" step="0.01" value={form.amount_paid} onChange={e => setForm(f => ({ ...f, amount_paid: parseFloat(e.target.value) || 0 }))} className={inputClass} /></div>
                    <div><label className={labelClass}>Payment Method</label>
                      <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} className={inputClass}>
                        <option value="cash">Cash</option><option value="check">Check</option><option value="credit_card">Credit Card</option><option value="eft">EFT</option>
                      </select>
                    </div>
                    <div><label className={labelClass}>Balance Due</label><p className="text-lg font-bold text-[#c9a227]">${balanceDue.toFixed(2)}</p></div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inputClass + ' min-h-[60px]'} placeholder="Additional notes..." />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => { setShowNewModal(false); resetForm() }}
                    className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition">Cancel</button>
                  <button onClick={() => handleSave('draft')} disabled={saving}
                    className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Draft'}
                  </button>
                  <button onClick={() => handleSave('finalized')} disabled={saving}
                    className="rounded-xl bg-[#c9a227] px-5 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] disabled:opacity-50 transition">
                    {saving ? 'Saving...' : 'Save & Finalize'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
