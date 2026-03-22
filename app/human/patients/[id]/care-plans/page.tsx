'use client'

import { Suspense, useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabase'
import { logAudit } from '../../../../lib/audit'

interface CarePlan {
  id: string
  name: string
  diagnosis: string
  icd10_codes: string[]
  goals: string
  frequency: string
  total_visits: number
  completed_visits: number
  start_date: string
  target_end_date: string
  status: 'active' | 'paused' | 'completed' | 'cancelled'
  notes: string
}

interface CarePlanVisit {
  id: string
  visit_id: string
  visit_number: number
  pain_score: number
  functional_score: number
  notes: string
}

interface Visit {
  id: string
  visit_date: string
  reason_for_visit: string | null
}

const inputClass = 'w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227] transition'
const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5'

function CarePlansContent() {
  const params = useParams()
  const router = useRouter()
  const patientId = params.id as string

  const [carePlans, setCarePlans] = useState<CarePlan[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null)
  const [planVisits, setPlanVisits] = useState<Record<string, CarePlanVisit[]>>({})
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [patientName, setPatientName] = useState('')

  const [showNewPlanModal, setShowNewPlanModal] = useState(false)
  const [showLinkVisitModal, setShowLinkVisitModal] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [planForm, setPlanForm] = useState({
    name: 'Treatment Plan',
    diagnosis: '',
    icd10_codes: '',
    goals: '',
    frequency: '',
    total_visits: '12',
    start_date: new Date().toISOString().split('T')[0],
    target_end_date: '',
    notes: '',
  })

  const [linkForm, setLinkForm] = useState({
    visit_id: '',
    pain_score: 5,
    functional_score: 50,
  })

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
      .select('first_name, last_name')
      .eq('id', patientId)
      .single()
    if (pt) setPatientName(`${pt.first_name} ${pt.last_name}`)

    await fetchData()
    setLoading(false)
    logAudit({ action: 'view', resourceType: 'care_plan', resourceId: patientId })
  }

  async function fetchData() {
    const { data: plans } = await supabase
      .from('care_plans')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
    if (plans) {
      setCarePlans(plans as CarePlan[])
      const allPlanVisits: Record<string, CarePlanVisit[]> = {}
      for (const plan of plans) {
        const { data: pvs } = await supabase
          .from('care_plan_visits')
          .select('*')
          .eq('care_plan_id', plan.id)
          .order('visit_number', { ascending: true })
        if (pvs) allPlanVisits[plan.id] = pvs as CarePlanVisit[]
      }
      setPlanVisits(allPlanVisits)
    }

    const { data: vsts } = await supabase
      .from('human_visits')
      .select('id, visit_date, reason_for_visit')
      .eq('patient_id', patientId)
      .order('visit_date', { ascending: false })
    if (vsts) setVisits(vsts as Visit[])
  }

  async function handleCreatePlan() {
    if (!planForm.name.trim()) { setMessage('Plan name is required.'); return }
    setSaving(true); setMessage('')

    const icd10Array = planForm.icd10_codes
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0)

    const { data, error } = await supabase.from('care_plans').insert({
      patient_id: patientId,
      practitioner_id: userId,
      name: planForm.name.trim(),
      diagnosis: planForm.diagnosis.trim() || null,
      icd10_codes: icd10Array.length > 0 ? icd10Array : null,
      goals: planForm.goals.trim() || null,
      frequency: planForm.frequency.trim() || null,
      total_visits: parseInt(planForm.total_visits) || 12,
      start_date: planForm.start_date,
      target_end_date: planForm.target_end_date || null,
      notes: planForm.notes.trim() || null,
    }).select().single()

    setSaving(false)
    if (error) { setMessage('Failed to create care plan.'); return }
    if (data) {
      logAudit({ action: 'create', resourceType: 'care_plan', resourceId: data.id })
      setShowNewPlanModal(false)
      setPlanForm({ name: 'Treatment Plan', diagnosis: '', icd10_codes: '', goals: '', frequency: '', total_visits: '12', start_date: new Date().toISOString().split('T')[0], target_end_date: '', notes: '' })
      await fetchData()
    }
  }

  async function handleLinkVisit() {
    if (!selectedPlanId || !linkForm.visit_id) { setMessage('Select a visit.'); return }
    setSaving(true); setMessage('')

    const existing = planVisits[selectedPlanId] || []
    const visitNumber = existing.length + 1

    const { data, error } = await supabase.from('care_plan_visits').insert({
      care_plan_id: selectedPlanId,
      visit_id: linkForm.visit_id,
      visit_number: visitNumber,
      pain_score: linkForm.pain_score,
      functional_score: linkForm.functional_score,
    }).select().single()

    if (!error && data) {
      const plan = carePlans.find(p => p.id === selectedPlanId)
      if (plan) {
        const newCompleted = Math.min(visitNumber, plan.total_visits)
        await supabase.from('care_plans').update({
          completed_visits: newCompleted,
          status: newCompleted >= plan.total_visits ? 'completed' : plan.status,
        }).eq('id', selectedPlanId)
      }
      logAudit({ action: 'create', resourceType: 'care_plan_visit', resourceId: data.id })
      setShowLinkVisitModal(false)
      setLinkForm({ visit_id: '', pain_score: 5, functional_score: 50 })
      await fetchData()
    } else {
      setMessage('Failed to link visit.')
    }
    setSaving(false)
  }

  async function handleUpdateStatus(planId: string, newStatus: string) {
    await supabase.from('care_plans').update({ status: newStatus }).eq('id', planId)
    logAudit({ action: 'update', resourceType: 'care_plan', resourceId: planId, details: { newStatus } })
    await fetchData()
  }

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    paused: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    completed: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    cancelled: 'bg-red-500/20 text-red-300 border-red-500/40',
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081120]">
        <p className="text-white/60 text-sm animate-pulse">Loading care plans...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#081120] text-white">
      {/* Header */}
      <div className="border-b border-[#1a3358] bg-[#0d1b30] px-4 py-5 md:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-2 text-sm text-blue-300/60 mb-2">
            <Link href="/human/dashboard" className="hover:text-white transition">Dashboard</Link>
            <span>/</span>
            <Link href={`/human/patients/${patientId}`} className="hover:text-white transition">{patientName}</Link>
            <span>/</span>
            <span className="text-white font-medium">Care Plans</span>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Care Plans</h1>
            <button
              onClick={() => setShowNewPlanModal(true)}
              className="rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition"
            >
              + New Care Plan
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 space-y-4">
        {message && <p className="text-sm text-red-400">{message}</p>}

        {carePlans.length === 0 ? (
          <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-12 text-center">
            <p className="text-white/30">No care plans yet. Create one to track treatment progress.</p>
          </div>
        ) : (
          carePlans.map(plan => {
            const pvs = planVisits[plan.id] || []
            const isExpanded = expandedPlanId === plan.id
            const progress = plan.total_visits > 0 ? (plan.completed_visits / plan.total_visits) * 100 : 0

            return (
              <div key={plan.id} className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] overflow-hidden">
                <button
                  onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                  className="w-full text-left px-6 py-5 hover:bg-white/[0.02] transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-base font-semibold text-white">{plan.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColors[plan.status] || 'bg-white/10 text-white/50'}`}>
                          {plan.status}
                        </span>
                      </div>
                      {plan.diagnosis && <p className="text-sm text-blue-300/60">{plan.diagnosis}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-blue-300/50">
                        {plan.frequency && <span>Frequency: {plan.frequency}</span>}
                        <span>{plan.start_date}{plan.target_end_date ? ` → ${plan.target_end_date}` : ''}</span>
                      </div>
                    </div>
                    <span className="text-white/30 ml-4 text-lg">{isExpanded ? '▾' : '▸'}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] text-blue-300/50 mb-1">
                      <span>Progress</span>
                      <span>{plan.completed_visits} / {plan.total_visits} visits</span>
                    </div>
                    <div className="h-1.5 bg-[#081120] rounded-full overflow-hidden">
                      <div className="h-full bg-[#c9a227] rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-[#1a3358] px-6 py-5 space-y-4">
                    {plan.goals && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1">Goals</p>
                        <p className="text-sm text-blue-200/80">{plan.goals}</p>
                      </div>
                    )}

                    {plan.icd10_codes && plan.icd10_codes.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1">ICD-10 Codes</p>
                        <div className="flex flex-wrap gap-1.5">
                          {plan.icd10_codes.map(code => (
                            <span key={code} className="px-2 py-0.5 rounded border border-[#1a3358] bg-[#081120] text-xs text-blue-300/70">{code}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {plan.notes && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1">Notes</p>
                        <p className="text-sm text-blue-200/80">{plan.notes}</p>
                      </div>
                    )}

                    {/* Linked Visits */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-2">Linked Visits ({pvs.length})</p>
                      {pvs.length > 0 ? (
                        <div className="space-y-2">
                          {pvs.map(pv => (
                            <div key={pv.id} className="rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-3 flex items-center justify-between">
                              <div>
                                <span className="text-xs font-medium text-white">Visit #{pv.visit_number}</span>
                              </div>
                              <div className="flex items-center gap-4 text-xs">
                                <span className="text-blue-300/60">Pain: <span className="text-[#c9a227] font-semibold">{pv.pain_score}/10</span></span>
                                <span className="text-blue-300/60">Function: <span className="text-emerald-400 font-semibold">{pv.functional_score}/100</span></span>
                              </div>
                            </div>
                          ))}

                          {/* Sparkline chart */}
                          {pvs.length > 1 && (
                            <div className="mt-3 rounded-xl border border-[#1a3358] bg-[#081120] p-3">
                              <p className="text-[10px] uppercase tracking-wider text-blue-400 mb-2">Pain Score Trend</p>
                              <svg width="100%" height="50" viewBox="0 0 200 50" preserveAspectRatio="none">
                                <polyline
                                  points={pvs.map((pv, i) => {
                                    const x = pvs.length === 1 ? 100 : (i / (pvs.length - 1)) * 200
                                    const y = 50 - (pv.pain_score / 10) * 45 - 2.5
                                    return `${x},${y}`
                                  }).join(' ')}
                                  fill="none"
                                  stroke="#c9a227"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                {pvs.map((pv, i) => {
                                  const x = pvs.length === 1 ? 100 : (i / (pvs.length - 1)) * 200
                                  const y = 50 - (pv.pain_score / 10) * 45 - 2.5
                                  return <circle key={i} cx={x} cy={y} r="3" fill="#c9a227" />
                                })}
                              </svg>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-white/30">No visits linked yet.</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        onClick={() => { setSelectedPlanId(plan.id); setShowLinkVisitModal(true) }}
                        className="rounded-xl border border-[#c9a227]/40 bg-[#c9a227]/10 px-3 py-2 text-xs font-medium text-[#c9a227] hover:bg-[#c9a227]/20 transition"
                      >
                        + Link Visit
                      </button>
                      {plan.status === 'active' && (
                        <button onClick={() => handleUpdateStatus(plan.id, 'paused')}
                          className="rounded-xl border border-white/20 px-3 py-2 text-xs text-white/70 hover:bg-white/10 transition">
                          Pause
                        </button>
                      )}
                      {plan.status === 'paused' && (
                        <button onClick={() => handleUpdateStatus(plan.id, 'active')}
                          className="rounded-xl border border-white/20 px-3 py-2 text-xs text-white/70 hover:bg-white/10 transition">
                          Resume
                        </button>
                      )}
                      {plan.status !== 'completed' && (
                        <button onClick={() => handleUpdateStatus(plan.id, 'completed')}
                          className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-500/20 transition">
                          Mark Complete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* New Care Plan Modal */}
      {showNewPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">New Care Plan</h2>
              <button onClick={() => setShowNewPlanModal(false)} className="text-white/40 hover:text-white text-xl">&times;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Plan Name *</label>
                <input type="text" value={planForm.name} onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))} className={inputClass} placeholder="Treatment Plan" />
              </div>
              <div>
                <label className={labelClass}>Diagnosis</label>
                <input type="text" value={planForm.diagnosis} onChange={e => setPlanForm(p => ({ ...p, diagnosis: e.target.value }))} className={inputClass} placeholder="Low back pain, cervicalgia..." />
              </div>
              <div>
                <label className={labelClass}>ICD-10 Codes (comma separated)</label>
                <input type="text" value={planForm.icd10_codes} onChange={e => setPlanForm(p => ({ ...p, icd10_codes: e.target.value }))} className={inputClass} placeholder="M54.5, M54.2, M99.03" />
              </div>
              <div>
                <label className={labelClass}>Goals</label>
                <textarea value={planForm.goals} onChange={e => setPlanForm(p => ({ ...p, goals: e.target.value }))} className={inputClass + ' min-h-[60px]'} placeholder="Reduce pain, improve ROM, return to normal activities..." />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Frequency</label>
                  <input type="text" value={planForm.frequency} onChange={e => setPlanForm(p => ({ ...p, frequency: e.target.value }))} className={inputClass} placeholder="3x/week for 4 weeks" />
                </div>
                <div>
                  <label className={labelClass}>Total Visits</label>
                  <input type="number" value={planForm.total_visits} onChange={e => setPlanForm(p => ({ ...p, total_visits: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Start Date</label>
                  <input type="date" value={planForm.start_date} onChange={e => setPlanForm(p => ({ ...p, start_date: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Target End Date</label>
                  <input type="date" value={planForm.target_end_date} onChange={e => setPlanForm(p => ({ ...p, target_end_date: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <textarea value={planForm.notes} onChange={e => setPlanForm(p => ({ ...p, notes: e.target.value }))} className={inputClass + ' min-h-[60px]'} placeholder="Additional notes..." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowNewPlanModal(false)} className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition">Cancel</button>
                <button onClick={handleCreatePlan} disabled={saving} className="rounded-xl bg-[#c9a227] px-5 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] disabled:opacity-50 transition">
                  {saving ? 'Creating...' : 'Create Plan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link Visit Modal */}
      {showLinkVisitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Link Visit to Plan</h2>
              <button onClick={() => setShowLinkVisitModal(false)} className="text-white/40 hover:text-white text-xl">&times;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Select Visit</label>
                <select value={linkForm.visit_id} onChange={e => setLinkForm(f => ({ ...f, visit_id: e.target.value }))} className={inputClass}>
                  <option value="">Choose a visit...</option>
                  {visits.map(v => (
                    <option key={v.id} value={v.id}>{v.visit_date}{v.reason_for_visit ? ` — ${v.reason_for_visit}` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Pain Score: {linkForm.pain_score}/10</label>
                <input type="range" min="0" max="10" value={linkForm.pain_score} onChange={e => setLinkForm(f => ({ ...f, pain_score: parseInt(e.target.value) }))} className="w-full accent-[#c9a227]" />
                <div className="flex justify-between text-[10px] text-blue-300/40"><span>No pain</span><span>Worst pain</span></div>
              </div>
              <div>
                <label className={labelClass}>Functional Score: {linkForm.functional_score}/100</label>
                <input type="range" min="0" max="100" value={linkForm.functional_score} onChange={e => setLinkForm(f => ({ ...f, functional_score: parseInt(e.target.value) }))} className="w-full accent-emerald-500" />
                <div className="flex justify-between text-[10px] text-blue-300/40"><span>Unable</span><span>Full function</span></div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowLinkVisitModal(false)} className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10 transition">Cancel</button>
                <button onClick={handleLinkVisit} disabled={saving} className="rounded-xl bg-[#c9a227] px-5 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] disabled:opacity-50 transition">
                  {saving ? 'Linking...' : 'Link Visit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CarePlansPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#081120]">
        <p className="text-white/60 text-sm animate-pulse">Loading care plans...</p>
      </div>
    }>
      <CarePlansContent />
    </Suspense>
  )
}
