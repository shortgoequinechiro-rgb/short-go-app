'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'

type Patient = { id: string; first_name: string; last_name: string }

type Questionnaire = {
  id: string
  name: string
  type: string
  questions: { text: string; max_score: number }[]
  is_active: boolean
}

type OutcomeResponse = {
  id: string
  patient_id: string
  questionnaire_id: string
  total_score: number
  max_score: number
  percentage: number
  interpretation: string | null
  completed_at: string
  human_patients?: { first_name: string; last_name: string } | null
  outcome_questionnaires?: { name: string; type: string } | null
}

const STANDARD_QUESTIONNAIRES = [
  {
    name: 'Visual Analog Scale (VAS)',
    type: 'VAS' as const,
    questions: [{ text: 'Rate your current pain level (0 = no pain, 10 = worst possible pain)', max_score: 10 }],
    scoring_guide: { ranges: [{ min: 0, max: 3, label: 'Mild pain' }, { min: 4, max: 6, label: 'Moderate pain' }, { min: 7, max: 10, label: 'Severe pain' }] },
  },
  {
    name: 'Neck Disability Index (NDI)',
    type: 'NDI' as const,
    questions: [
      { text: 'Pain Intensity', max_score: 5 },
      { text: 'Personal Care (washing, dressing)', max_score: 5 },
      { text: 'Lifting', max_score: 5 },
      { text: 'Reading', max_score: 5 },
      { text: 'Headaches', max_score: 5 },
      { text: 'Concentration', max_score: 5 },
      { text: 'Work', max_score: 5 },
      { text: 'Driving', max_score: 5 },
      { text: 'Sleeping', max_score: 5 },
      { text: 'Recreation', max_score: 5 },
    ],
    scoring_guide: { ranges: [{ min: 0, max: 4, label: 'No disability' }, { min: 5, max: 14, label: 'Mild disability' }, { min: 15, max: 24, label: 'Moderate disability' }, { min: 25, max: 34, label: 'Severe disability' }, { min: 35, max: 50, label: 'Complete disability' }] },
  },
  {
    name: 'Oswestry Disability Index (ODI)',
    type: 'ODI' as const,
    questions: [
      { text: 'Pain Intensity', max_score: 5 },
      { text: 'Personal Care', max_score: 5 },
      { text: 'Lifting', max_score: 5 },
      { text: 'Walking', max_score: 5 },
      { text: 'Sitting', max_score: 5 },
      { text: 'Standing', max_score: 5 },
      { text: 'Sleeping', max_score: 5 },
      { text: 'Social Life', max_score: 5 },
      { text: 'Traveling', max_score: 5 },
      { text: 'Employment/Homemaking', max_score: 5 },
    ],
    scoring_guide: { ranges: [{ min: 0, max: 20, label: 'Minimal disability' }, { min: 21, max: 40, label: 'Moderate disability' }, { min: 41, max: 60, label: 'Severe disability' }, { min: 61, max: 80, label: 'Crippling' }, { min: 81, max: 100, label: 'Bed-bound' }] },
  },
  {
    name: 'DASH (Disabilities of Arm, Shoulder, Hand)',
    type: 'DASH' as const,
    questions: [
      { text: 'Open a tight jar', max_score: 5 },
      { text: 'Write', max_score: 5 },
      { text: 'Turn a key', max_score: 5 },
      { text: 'Prepare a meal', max_score: 5 },
      { text: 'Push open a heavy door', max_score: 5 },
      { text: 'Place object on shelf above head', max_score: 5 },
      { text: 'Do heavy household chores', max_score: 5 },
      { text: 'Garden or do yard work', max_score: 5 },
      { text: 'Make a bed', max_score: 5 },
      { text: 'Carry a heavy object (>10 lbs)', max_score: 5 },
    ],
    scoring_guide: { ranges: [{ min: 0, max: 25, label: 'Minimal disability' }, { min: 26, max: 50, label: 'Moderate disability' }, { min: 51, max: 75, label: 'Severe disability' }, { min: 76, max: 100, label: 'Very severe disability' }] },
  },
]

const inputClass = 'w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227]/40 transition'
const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5'

export default function OutcomeMeasuresPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)

  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([])
  const [responses, setResponses] = useState<OutcomeResponse[]>([])
  const [patients, setPatients] = useState<Patient[]>([])

  // Admin modal
  const [showSeedBtn, setShowSeedBtn] = useState(false)
  const [seeding, setSeeding] = useState(false)

  // Record outcome modal
  const [showRecord, setShowRecord] = useState(false)
  const [recPatient, setRecPatient] = useState('')
  const [recQuestionnaire, setRecQuestionnaire] = useState('')
  const [recAnswers, setRecAnswers] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // Progress view
  const [viewPatientId, setViewPatientId] = useState('')
  const [patientHistory, setPatientHistory] = useState<OutcomeResponse[]>([])

  useEffect(() => {
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const [qRes, rRes, pRes] = await Promise.all([
      supabase.from('outcome_questionnaires').select('*').eq('practitioner_id', user.id).order('created_at'),
      supabase.from('outcome_responses').select('*, human_patients(first_name, last_name), outcome_questionnaires(name, type)').eq('practitioner_id', user.id).order('completed_at', { ascending: false }).limit(30),
      supabase.from('human_patients').select('id, first_name, last_name').eq('practitioner_id', user.id).eq('archived', false).order('last_name'),
    ])

    if (qRes.data) { setQuestionnaires(qRes.data); setShowSeedBtn(qRes.data.length === 0) }
    if (rRes.data) setResponses(rRes.data as unknown as OutcomeResponse[])
    if (pRes.data) setPatients(pRes.data)
    setLoading(false)
  }

  async function seedStandard() {
    setSeeding(true)
    const inserts = STANDARD_QUESTIONNAIRES.map(q => ({ ...q, practitioner_id: userId }))
    await supabase.from('outcome_questionnaires').insert(inserts)
    const { data } = await supabase.from('outcome_questionnaires').select('*').eq('practitioner_id', userId)
    if (data) { setQuestionnaires(data); setShowSeedBtn(false) }
    setSeeding(false)
  }

  function openRecord() {
    setRecPatient('')
    setRecQuestionnaire('')
    setRecAnswers([])
    setMsg('')
    setShowRecord(true)
  }

  function selectQuestionnaire(qId: string) {
    setRecQuestionnaire(qId)
    const q = questionnaires.find(x => x.id === qId)
    if (q) setRecAnswers(new Array(q.questions.length).fill(0))
  }

  async function handleSaveResponse() {
    if (!recPatient || !recQuestionnaire) { setMsg('Select patient and questionnaire.'); return }
    setSaving(true); setMsg('')

    const q = questionnaires.find(x => x.id === recQuestionnaire)
    if (!q) { setSaving(false); return }

    const totalScore = recAnswers.reduce((a, b) => a + b, 0)
    const maxScore = q.questions.reduce((a, b) => a + b.max_score, 0)
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0

    let interpretation = ''
    if (q.type === 'VAS') {
      if (totalScore <= 3) interpretation = 'Mild pain'
      else if (totalScore <= 6) interpretation = 'Moderate pain'
      else interpretation = 'Severe pain'
    } else if (q.type === 'ODI') {
      if (percentage <= 20) interpretation = 'Minimal disability'
      else if (percentage <= 40) interpretation = 'Moderate disability'
      else if (percentage <= 60) interpretation = 'Severe disability'
      else interpretation = 'Crippling back pain'
    } else if (q.type === 'NDI') {
      const ndiScore = totalScore
      if (ndiScore <= 4) interpretation = 'No disability'
      else if (ndiScore <= 14) interpretation = 'Mild disability'
      else if (ndiScore <= 24) interpretation = 'Moderate disability'
      else if (ndiScore <= 34) interpretation = 'Severe disability'
      else interpretation = 'Complete disability'
    } else {
      if (percentage <= 25) interpretation = 'Minimal disability'
      else if (percentage <= 50) interpretation = 'Moderate disability'
      else if (percentage <= 75) interpretation = 'Severe disability'
      else interpretation = 'Very severe disability'
    }

    const { data, error } = await supabase.from('outcome_responses').insert({
      practitioner_id: userId,
      patient_id: recPatient,
      questionnaire_id: recQuestionnaire,
      responses: recAnswers.map((val, i) => ({ question: q.questions[i].text, score: val, max: q.questions[i].max_score })),
      total_score: totalScore,
      max_score: maxScore,
      percentage,
      interpretation,
    }).select('*, human_patients(first_name, last_name), outcome_questionnaires(name, type)').single()

    setSaving(false)
    if (error) { setMsg('Failed to save.'); return }
    if (data) {
      setResponses(prev => [data as unknown as OutcomeResponse, ...prev])
      logAudit({ action: 'create', resourceType: 'human_visit', resourceId: data.id, details: { type: 'outcome_measure' } })
    }
    setShowRecord(false)
  }

  async function loadPatientHistory(patientId: string) {
    setViewPatientId(patientId)
    const { data } = await supabase
      .from('outcome_responses')
      .select('*, outcome_questionnaires(name, type)')
      .eq('practitioner_id', userId)
      .eq('patient_id', patientId)
      .order('completed_at', { ascending: true })
    if (data) setPatientHistory(data as unknown as OutcomeResponse[])
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081120]">
        <p className="text-white/60 text-sm animate-pulse">Loading outcome measures...</p>
      </div>
    )
  }

  const selectedQ = questionnaires.find(q => q.id === recQuestionnaire)
  const viewPatient = patients.find(p => p.id === viewPatientId)

  return (
    <div className="min-h-screen bg-[#081120] text-white">
      <div className="border-b border-[#1a3358] bg-[#0d1b30] px-4 py-6 md:px-8">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">Outcome Measures</h1>
            <p className="text-sm text-blue-300/70 mt-0.5">NDI, ODI, VAS, DASH — Track patient progress over time</p>
          </div>
          <Link href="/human/dashboard" className="rounded-xl border border-white/20 px-3 py-2 text-sm text-white/70 hover:bg-white/10 transition">Dashboard</Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 space-y-6">
        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={openRecord} className="rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition">
            + Record Outcome
          </button>
          {showSeedBtn && (
            <button onClick={seedStandard} disabled={seeding} className="rounded-xl border border-[#c9a227] px-4 py-2 text-sm font-semibold text-[#c9a227] hover:bg-[#c9a227]/10 transition disabled:opacity-50">
              {seeding ? 'Adding...' : 'Load Standard Questionnaires (NDI, ODI, VAS, DASH)'}
            </button>
          )}
        </div>

        {/* Patient Progress Viewer */}
        <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6">
          <h2 className="text-lg font-semibold mb-3">Patient Progress</h2>
          <select value={viewPatientId} onChange={e => loadPatientHistory(e.target.value)} className={inputClass + ' max-w-md'}>
            <option value="">-- Select patient to view progress --</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>)}
          </select>

          {viewPatient && patientHistory.length > 0 && (
            <div className="mt-4 space-y-4">
              <h3 className="text-sm font-semibold text-white/80">{viewPatient.first_name} {viewPatient.last_name} — {patientHistory.length} assessment{patientHistory.length !== 1 ? 's' : ''}</h3>

              {/* SVG Progress Chart */}
              <div className="rounded-xl bg-[#081120] border border-[#1a3358] p-4">
                <svg viewBox="0 0 600 200" className="w-full h-40">
                  {/* Grid lines */}
                  {[0, 25, 50, 75, 100].map(y => (
                    <g key={y}>
                      <line x1="40" y1={180 - y * 1.6} x2="580" y2={180 - y * 1.6} stroke="#1a3358" strokeWidth="0.5" />
                      <text x="35" y={184 - y * 1.6} fill="#ffffff50" fontSize="9" textAnchor="end">{y}%</text>
                    </g>
                  ))}
                  {/* Data points */}
                  {patientHistory.map((r, i) => {
                    const x = patientHistory.length === 1 ? 310 : 50 + (i * (530 / Math.max(patientHistory.length - 1, 1)))
                    const y = 180 - (r.percentage * 1.6)
                    return (
                      <g key={r.id}>
                        {i > 0 && (
                          <line
                            x1={50 + ((i - 1) * (530 / Math.max(patientHistory.length - 1, 1)))}
                            y1={180 - (patientHistory[i - 1].percentage * 1.6)}
                            x2={x} y2={y}
                            stroke="#c9a227" strokeWidth="2"
                          />
                        )}
                        <circle cx={x} cy={y} r="4" fill="#c9a227" />
                        <text x={x} y={y - 10} fill="#ffffff80" fontSize="8" textAnchor="middle">
                          {r.percentage}%
                        </text>
                      </g>
                    )
                  })}
                </svg>
                <div className="flex justify-between text-[10px] text-white/40 mt-1 px-10">
                  {patientHistory.map(r => (
                    <span key={r.id}>{new Date(r.completed_at).toLocaleDateString()}</span>
                  ))}
                </div>
              </div>

              {/* History table */}
              <div className="space-y-2">
                {patientHistory.slice().reverse().map(r => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl bg-[#081120] border border-[#1a3358] px-4 py-3">
                    <div>
                      <span className="text-sm font-medium">{r.outcome_questionnaires?.name || 'Assessment'}</span>
                      <span className="text-xs text-white/40 ml-2">{new Date(r.completed_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold">{r.total_score}/{r.max_score}</span>
                      <span className={`text-xs font-semibold ${r.percentage <= 25 ? 'text-green-400' : r.percentage <= 50 ? 'text-yellow-400' : r.percentage <= 75 ? 'text-orange-400' : 'text-red-400'}`}>
                        {r.percentage}%
                      </span>
                      {r.interpretation && <span className="text-xs text-white/50">{r.interpretation}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {viewPatient && patientHistory.length === 0 && (
            <p className="mt-3 text-sm text-white/40">No outcome measures recorded for this patient yet.</p>
          )}
        </div>

        {/* Recent Responses */}
        {responses.length > 0 && (
          <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6">
            <h2 className="text-lg font-semibold mb-3">Recent Assessments</h2>
            <div className="space-y-2">
              {responses.slice(0, 15).map(r => (
                <div key={r.id} className="flex items-center justify-between rounded-xl bg-[#081120] border border-[#1a3358] px-4 py-3">
                  <div>
                    <span className="text-sm font-medium">
                      {r.human_patients ? `${r.human_patients.first_name} ${r.human_patients.last_name}` : 'Unknown'}
                    </span>
                    <span className="text-xs text-blue-300/50 ml-2">{r.outcome_questionnaires?.name}</span>
                    <span className="text-xs text-white/40 ml-2">{new Date(r.completed_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${r.percentage <= 25 ? 'text-green-400' : r.percentage <= 50 ? 'text-yellow-400' : 'text-orange-400'}`}>
                      {r.percentage}%
                    </span>
                    {r.interpretation && <span className="text-xs text-white/50">{r.interpretation}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Record Outcome Modal */}
      {showRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6 space-y-4">
            <h2 className="text-lg font-bold">Record Outcome Measure</h2>

            <div>
              <label className={labelClass}>Patient</label>
              <select value={recPatient} onChange={e => setRecPatient(e.target.value)} className={inputClass}>
                <option value="">-- Select patient --</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>)}
              </select>
            </div>

            <div>
              <label className={labelClass}>Questionnaire</label>
              <select value={recQuestionnaire} onChange={e => selectQuestionnaire(e.target.value)} className={inputClass}>
                <option value="">-- Select questionnaire --</option>
                {questionnaires.filter(q => q.is_active).map(q => <option key={q.id} value={q.id}>{q.name} ({q.type})</option>)}
              </select>
            </div>

            {selectedQ && (
              <div className="space-y-3">
                <p className="text-xs text-blue-400 uppercase tracking-wider font-semibold">Score each item (0 = best, {selectedQ.questions[0]?.max_score} = worst)</p>
                {selectedQ.questions.map((q, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white/80 flex-1">{q.text}</span>
                    <input
                      type="number"
                      min={0}
                      max={q.max_score}
                      value={recAnswers[i] ?? 0}
                      onChange={e => {
                        const val = Math.min(Math.max(0, parseInt(e.target.value) || 0), q.max_score)
                        setRecAnswers(prev => { const copy = [...prev]; copy[i] = val; return copy })
                      }}
                      className="w-16 rounded-xl border border-[#1a3358] bg-[#081120] px-2 py-1.5 text-sm text-white text-center outline-none focus:border-[#c9a227]"
                    />
                    <span className="text-xs text-white/30 w-8">/ {q.max_score}</span>
                  </div>
                ))}
                <div className="text-right text-sm text-[#c9a227] font-semibold">
                  Total: {recAnswers.reduce((a, b) => a + b, 0)} / {selectedQ.questions.reduce((a, b) => a + b.max_score, 0)}
                </div>
              </div>
            )}

            {msg && <p className="text-sm text-red-400">{msg}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowRecord(false)} className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10">Cancel</button>
              <button onClick={handleSaveResponse} disabled={saving} className="rounded-xl bg-[#c9a227] px-6 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Outcome'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
