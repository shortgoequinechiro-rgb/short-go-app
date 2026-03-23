'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { getCachedHorseById, getCachedVisitsByHorse } from '../../../lib/offlineDb'

type SpeciesType = 'equine' | 'canine' | 'feline' | 'bovine' | 'porcine' | 'exotic'

// ── Types ─────────────────────────────────────────────────────────────────────

type SpineFinding = { left: boolean; right: boolean }

type SpineAssessment = {
  id: string
  assessed_at: string
  visit_id: string | null
  findings: Record<string, SpineFinding>
  notes: string | null
  visits?: { visit_date: string | null; reason_for_visit: string | null } | null
}

type Visit = {
  id: string
  visit_date: string | null
  reason_for_visit: string | null
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
}

// ── Spine maps ────────────────────────────────────────────────────────────────

const EQUINE_SPINE_SECTIONS = [
  {
    key: 'cranial', label: 'Cranial / Cervical',
    segments: [
      { key: 'tmj',  label: 'TMJ' },
      { key: 'poll', label: 'Poll' },
      { key: 'c1',   label: 'C1 (Atlas)' },
      { key: 'c2',   label: 'C2 (Axis)' },
      { key: 'c3',   label: 'C3' },
      { key: 'c4',   label: 'C4' },
      { key: 'c5',   label: 'C5' },
      { key: 'c6',   label: 'C6' },
      { key: 'c7',   label: 'C7' },
    ],
  },
  {
    key: 'thoracic', label: 'Thoracic',
    segments: Array.from({ length: 18 }, (_, i) => ({ key: `t${i+1}`, label: `T${i+1}` })),
  },
  {
    key: 'lumbar', label: 'Lumbar',
    segments: Array.from({ length: 6 }, (_, i) => ({ key: `l${i+1}`, label: `L${i+1}` })),
  },
  {
    key: 'sacral', label: 'Sacral / Pelvic',
    segments: [
      { key: 'sacrum',    label: 'Sacrum' },
      { key: 'si_joint',  label: 'SI Joint' },
      { key: 'coccygeal', label: 'Coccygeal' },
    ],
  },
]

const CANINE_SPINE_SECTIONS = [
  {
    key: 'cranial', label: 'Cranial / Cervical',
    segments: [
      { key: 'occiput', label: 'Occiput' },
      { key: 'c1',      label: 'C1 (Atlas)' },
      { key: 'c2',      label: 'C2 (Axis)' },
      { key: 'c3',      label: 'C3' },
      { key: 'c4',      label: 'C4' },
      { key: 'c5',      label: 'C5' },
      { key: 'c6',      label: 'C6' },
      { key: 'c7',      label: 'C7' },
    ],
  },
  {
    key: 'thoracic', label: 'Thoracic',
    segments: Array.from({ length: 13 }, (_, i) => ({ key: `t${i+1}`, label: `T${i+1}` })),
  },
  {
    key: 'lumbar', label: 'Lumbar',
    segments: Array.from({ length: 7 }, (_, i) => ({ key: `l${i+1}`, label: `L${i+1}` })),
  },
  {
    key: 'sacral', label: 'Sacral / Pelvic',
    segments: [
      { key: 'sacrum',    label: 'Sacrum' },
      { key: 'si_joint',  label: 'SI Joint' },
      { key: 'coccygeal', label: 'Coccygeal' },
    ],
  },
]

// ── Feline spine sections & segments ──────────────────────────────────────
const FELINE_SPINE_SECTIONS = [
  {
    key: 'cranial', label: 'Cranial / Cervical',
    segments: [
      { key: 'occiput', label: 'Occiput' },
      { key: 'c1',      label: 'C1 (Atlas)' },
      { key: 'c2',      label: 'C2 (Axis)' },
      { key: 'c3',      label: 'C3' },
      { key: 'c4',      label: 'C4' },
      { key: 'c5',      label: 'C5' },
      { key: 'c6',      label: 'C6' },
      { key: 'c7',      label: 'C7' },
    ],
  },
  {
    key: 'thoracic', label: 'Thoracic',
    segments: Array.from({ length: 13 }, (_, i) => ({ key: `t${i+1}`, label: `T${i+1}` })),
  },
  {
    key: 'lumbar', label: 'Lumbar',
    segments: Array.from({ length: 7 }, (_, i) => ({ key: `l${i+1}`, label: `L${i+1}` })),
  },
  {
    key: 'sacral', label: 'Sacral / Pelvic',
    segments: [
      { key: 'sacrum',    label: 'Sacrum' },
      { key: 'si_joint',  label: 'SI Joint' },
      { key: 'coccygeal', label: 'Coccygeal' },
    ],
  },
]

// ── Bovine spine sections & segments ──────────────────────────────────────
const BOVINE_SPINE_SECTIONS = [
  {
    key: 'cranial', label: 'Cranial / Cervical',
    segments: [
      { key: 'occiput', label: 'Occiput' },
      { key: 'c1',      label: 'C1 (Atlas)' },
      { key: 'c2',      label: 'C2 (Axis)' },
      { key: 'c3',      label: 'C3' },
      { key: 'c4',      label: 'C4' },
      { key: 'c5',      label: 'C5' },
      { key: 'c6',      label: 'C6' },
      { key: 'c7',      label: 'C7' },
    ],
  },
  {
    key: 'thoracic', label: 'Thoracic',
    segments: Array.from({ length: 13 }, (_, i) => ({ key: `t${i+1}`, label: `T${i+1}` })),
  },
  {
    key: 'lumbar', label: 'Lumbar',
    segments: Array.from({ length: 6 }, (_, i) => ({ key: `l${i+1}`, label: `L${i+1}` })),
  },
  {
    key: 'sacral', label: 'Sacral / Pelvic',
    segments: [
      { key: 'sacrum',    label: 'Sacrum' },
      { key: 'si_joint',  label: 'SI Joint' },
      { key: 'coccygeal', label: 'Coccygeal' },
    ],
  },
]

// ── Porcine spine sections & segments ──────────────────────────────────────
const PORCINE_SPINE_SECTIONS = [
  {
    key: 'cranial', label: 'Cranial / Cervical',
    segments: [
      { key: 'occiput', label: 'Occiput' },
      { key: 'c1',      label: 'C1 (Atlas)' },
      { key: 'c2',      label: 'C2 (Axis)' },
      { key: 'c3',      label: 'C3' },
      { key: 'c4',      label: 'C4' },
      { key: 'c5',      label: 'C5' },
      { key: 'c6',      label: 'C6' },
      { key: 'c7',      label: 'C7' },
    ],
  },
  {
    key: 'thoracic', label: 'Thoracic',
    segments: Array.from({ length: 15 }, (_, i) => ({ key: `t${i+1}`, label: `T${i+1}` })),
  },
  {
    key: 'lumbar', label: 'Lumbar',
    segments: Array.from({ length: 7 }, (_, i) => ({ key: `l${i+1}`, label: `L${i+1}` })),
  },
  {
    key: 'sacral', label: 'Sacral / Pelvic',
    segments: [
      { key: 'sacrum',    label: 'Sacrum' },
      { key: 'si_joint',  label: 'SI Joint' },
      { key: 'coccygeal', label: 'Coccygeal' },
    ],
  },
]

// ── Exotic / Generic spine sections ──────────────────────────────────────
const EXOTIC_SPINE_SECTIONS = CANINE_SPINE_SECTIONS // Use canine as generic template

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function heatColor(count: number, max: number): string {
  if (count === 0) return 'bg-slate-100 text-slate-400'
  const intensity = count / Math.max(max, 1)
  if (intensity >= 0.75) return 'bg-red-500 text-white'
  if (intensity >= 0.5)  return 'bg-orange-400 text-white'
  if (intensity >= 0.25) return 'bg-amber-300 text-slate-800'
  return 'bg-amber-100 text-amber-800'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const { id: horseId } = useParams<{ id: string }>()

  const [horseName, setHorseName] = useState('')
  const [horseSpecies, setHorseSpecies] = useState<SpeciesType>('equine')
  const [assessments, setAssessments] = useState<SpineAssessment[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [noTable, setNoTable] = useState(false)
  const [activeView, setActiveView] = useState<'heatmap' | 'timeline' | 'visits'>('heatmap')

  function getSpineSections(species: SpeciesType) {
    switch (species) {
      case 'canine': return CANINE_SPINE_SECTIONS
      case 'feline': return FELINE_SPINE_SECTIONS
      case 'bovine': return BOVINE_SPINE_SECTIONS
      case 'porcine': return PORCINE_SPINE_SECTIONS
      case 'exotic': return EXOTIC_SPINE_SECTIONS
      default: return EQUINE_SPINE_SECTIONS
    }
  }

  const SPINE_SECTIONS = getSpineSections(horseSpecies)
  const ALL_SEGMENTS = SPINE_SECTIONS.flatMap(s => s.segments)

  useEffect(() => {
    async function load() {
      setLoading(true)

      const { data: horse } = await supabase.from('horses').select('name, species').eq('id', horseId).single()
      if (horse) {
        setHorseName(horse.name)
        setHorseSpecies((horse.species as SpeciesType) || 'equine')
      } else {
        // Offline fallback for horse metadata
        try {
          const cached = await getCachedHorseById(horseId)
          if (cached) {
            setHorseName(cached.name)
            setHorseSpecies((cached.species as 'equine' | 'canine') || 'equine')
          }
        } catch { /* ignore */ }
      }

      // Spine assessments
      const { data: spineData, error: spineError } = await supabase
        .from('spine_assessments')
        .select('id, assessed_at, visit_id, findings, notes, visits(visit_date, reason_for_visit)')
        .eq('horse_id', horseId)
        .order('assessed_at', { ascending: true })

      if (spineError) {
        if (spineError.code === '42P01') setNoTable(true)
        // Spine assessments aren't cached in Dexie (specialized data) — accept empty state offline
        setLoading(false)
        return
      }

      setAssessments((spineData || []) as unknown as SpineAssessment[])

      // Visits
      const { data: visitData } = await supabase
        .from('visits')
        .select('id, visit_date, reason_for_visit, subjective, objective, assessment, plan')
        .eq('horse_id', horseId)
        .order('visit_date', { ascending: false })

      if (visitData) {
        setVisits(visitData as Visit[])
      } else {
        // Offline fallback for visits
        try {
          const cached = await getCachedVisitsByHorse(horseId)
          setVisits(cached
            .sort((a, b) => (b.visit_date || '').localeCompare(a.visit_date || ''))
            .map(v => ({ id: v.id, visit_date: v.visit_date, reason_for_visit: v.reason_for_visit, subjective: v.subjective, objective: v.objective, assessment: v.assessment, plan: v.plan })) as Visit[]
          )
        } catch { /* ignore */ }
      }

      setLoading(false)
    }
    load()
  }, [horseId])

  // ── Heatmap data: how many times each segment was flagged ─────────────────

  const heatmap = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const seg of ALL_SEGMENTS) counts[seg.key] = 0
    for (const a of assessments) {
      for (const [key, f] of Object.entries(a.findings)) {
        if (f.left || f.right) counts[key] = (counts[key] || 0) + 1
      }
    }
    return counts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessments, horseSpecies])

  const maxCount = useMemo(() => Math.max(...Object.values(heatmap), 1), [heatmap])

  // ── Timeline: total flagged segments per assessment ───────────────────────

  const timeline = useMemo(() => {
    return assessments.map(a => {
      const total = Object.values(a.findings).filter(f => f.left || f.right).length
      const date = a.visits?.visit_date || a.assessed_at
      return { date, total, a }
    })
  }, [assessments])

  const maxTimeline = useMemo(() => Math.max(...timeline.map(t => t.total), 1), [timeline])

  // ── Most improved / most persistent ──────────────────────────────────────

  const sortedByFrequency = useMemo(() =>
    ALL_SEGMENTS
      .map(s => ({ ...s, count: heatmap[s.key] || 0 }))
      .filter(s => s.count > 0)
      .sort((a, b) => b.count - a.count),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [heatmap, horseSpecies])

  const mostPersistent = sortedByFrequency.slice(0, 5)

  // Segments flagged in early assessments but NOT recent ones = improved
  const improved = useMemo(() => {
    if (assessments.length < 2) return []
    const earlyHalf = assessments.slice(0, Math.ceil(assessments.length / 2))
    const recentHalf = assessments.slice(Math.ceil(assessments.length / 2))
    const earlyFlags = new Set<string>()
    const recentFlags = new Set<string>()
    earlyHalf.forEach(a => { Object.entries(a.findings).forEach(([k, f]) => { if (f.left || f.right) earlyFlags.add(k) }) })
    recentHalf.forEach(a => { Object.entries(a.findings).forEach(([k, f]) => { if (f.left || f.right) recentFlags.add(k) }) })
    return ALL_SEGMENTS.filter(s => earlyFlags.has(s.key) && !recentFlags.has(s.key))
  }, [assessments])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 pb-20">

      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href={`/horses/${horseId}`} className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
              ← Back
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 leading-tight">Progress Tracker</h1>
              {horseName && <p className="text-xs text-slate-500">{horseName} · {assessments.length} assessment{assessments.length !== 1 ? 's' : ''}</p>}
            </div>
          </div>
          <div className="flex rounded-xl border border-slate-200 overflow-hidden">
            {(['heatmap', 'timeline', 'visits'] as const).map(v => (
              <button key={v} onClick={() => setActiveView(v)} className={`px-3 py-2 text-sm font-medium capitalize transition ${activeView === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <div className="mx-auto max-w-4xl px-4 py-12 text-center text-slate-400">Loading…</div>}

      {noTable && !loading && (
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <p className="font-semibold text-amber-900">Spine assessments table not found.</p>
            <p className="mt-1 text-sm text-amber-700">Complete at least one Spine Assessment for this horse to start tracking progress.</p>
            <Link href={`/horses/${horseId}/spine`} className="mt-4 inline-block rounded-2xl bg-amber-700 px-4 py-2 text-sm font-medium text-white">
              Open Spine Assessment →
            </Link>
          </div>
        </div>
      )}

      {!loading && !noTable && assessments.length === 0 && (
        <div className="mx-auto max-w-4xl px-4 py-12 text-center">
          <p className="text-slate-500">No spine assessments recorded yet for {horseName}.</p>
          <Link href={`/horses/${horseId}/spine`} className="mt-4 inline-block rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
            Start First Assessment →
          </Link>
        </div>
      )}

      {!loading && !noTable && assessments.length > 0 && (
        <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">

          {/* ── Summary cards ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-3xl bg-white px-4 py-4 shadow-sm text-center">
              <p className="text-2xl font-bold text-slate-900">{assessments.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Assessments</p>
            </div>
            <div className="rounded-3xl bg-white px-4 py-4 shadow-sm text-center">
              <p className="text-2xl font-bold text-slate-900">{sortedByFrequency.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Segments flagged</p>
            </div>
            <div className="rounded-3xl bg-white px-4 py-4 shadow-sm text-center">
              <p className="text-2xl font-bold text-emerald-600">{improved.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Improved</p>
            </div>
            <div className="rounded-3xl bg-white px-4 py-4 shadow-sm text-center">
              <p className="text-2xl font-bold text-amber-600">{mostPersistent.filter(s => s.count >= assessments.length * 0.6).length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Persistent (&gt;60%)</p>
            </div>
          </div>

          {/* ── HEATMAP VIEW ── */}
          {activeView === 'heatmap' && (
            <div className="space-y-4">
              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900 mb-1">Spine Heatmap</h2>
                <p className="text-xs text-slate-500 mb-4">Colour intensity = how often each segment was flagged across all {assessments.length} assessment{assessments.length !== 1 ? 's' : ''}.</p>

                <div className="flex items-center gap-3 mb-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-100" />Never</span>
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-100" />Rare</span>
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-300" />Occasional</span>
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-orange-400" />Frequent</span>
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-500" />Persistent</span>
                </div>

                {SPINE_SECTIONS.map(section => (
                  <div key={section.key} className="mb-4">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{section.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {section.segments.map(seg => {
                        const count = heatmap[seg.key] || 0
                        return (
                          <div
                            key={seg.key}
                            title={`${seg.label}: flagged ${count}/${assessments.length} times`}
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-default ${heatColor(count, maxCount)}`}
                          >
                            {seg.label}
                            {count > 0 && <span className="ml-1 opacity-70">×{count}</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Most persistent + Improved */}
              <div className="grid gap-4 sm:grid-cols-2">
                {mostPersistent.length > 0 && (
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">Most Persistent Areas</h3>
                    <div className="space-y-2">
                      {mostPersistent.map(s => (
                        <div key={s.key} className="flex items-center justify-between">
                          <span className="text-sm text-slate-700">{s.label}</span>
                          <div className="flex items-center gap-2">
                            <div className="h-2 rounded-full bg-slate-100 w-24 overflow-hidden">
                              <div className="h-full rounded-full bg-amber-400" style={{ width: `${(s.count / assessments.length) * 100}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-slate-500 w-10 text-right">{Math.round((s.count / assessments.length) * 100)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {improved.length > 0 && (
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">Areas That Have Improved</h3>
                    <p className="text-xs text-slate-400 mb-3">Flagged early, clear in recent assessments</p>
                    <div className="flex flex-wrap gap-1.5">
                      {improved.map(s => (
                        <span key={s.key} className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">✓ {s.label}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TIMELINE VIEW ── */}
          {activeView === 'timeline' && (
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900 mb-1">Flagged Segments Over Time</h2>
              <p className="text-xs text-slate-500 mb-5">Each bar = total number of segments flagged in that assessment. Lower is better.</p>

              <div className="space-y-3">
                {timeline.map(({ date, total, a }, idx) => {
                  const barWidth = `${(total / maxTimeline) * 100}%`
                  const visitDate = a.visits?.visit_date ? fmtDate(a.visits.visit_date) : fmtDate(a.assessed_at)
                  const reason = a.visits?.reason_for_visit

                  return (
                    <div key={a.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <span className="text-sm font-medium text-slate-800">{visitDate}</span>
                          {reason && <span className="ml-2 text-xs text-slate-400">{reason}</span>}
                          {idx === 0 && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">First</span>}
                          {idx === timeline.length - 1 && timeline.length > 1 && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-600">Latest</span>}
                        </div>
                        <span className={`text-sm font-bold ${total === 0 ? 'text-emerald-600' : total <= 3 ? 'text-amber-600' : 'text-red-500'}`}>{total}</span>
                      </div>
                      <div className="h-5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${total === 0 ? 'bg-emerald-400' : total <= 3 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: total === 0 ? '2px' : barWidth }}
                        />
                      </div>
                      {a.notes && <p className="mt-1 text-xs text-slate-400 italic">{a.notes}</p>}
                    </div>
                  )
                })}
              </div>

              {timeline.length >= 2 && (() => {
                const first = timeline[0].total
                const last = timeline[timeline.length - 1].total
                const diff = first - last
                return (
                  <div className={`mt-6 rounded-2xl px-4 py-3 text-sm font-medium ${diff > 0 ? 'bg-emerald-50 text-emerald-700' : diff < 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600'}`}>
                    {diff > 0
                      ? `↓ Improved by ${diff} flagged segment${diff !== 1 ? 's' : ''} from first to latest assessment`
                      : diff < 0
                      ? `↑ ${Math.abs(diff)} more segment${Math.abs(diff) !== 1 ? 's' : ''} flagged vs. first assessment`
                      : 'No change in total flagged segments since first assessment'}
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── VISITS VIEW ── */}
          {activeView === 'visits' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 px-1">All recorded visits for {horseName}, most recent first.</p>
              {visits.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
                  <p className="text-slate-400 text-sm">No visits recorded yet.</p>
                  <Link href={`/horses/${horseId}`} className="mt-3 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">
                    Log a visit →
                  </Link>
                </div>
              ) : (
                visits.map((v, idx) => (
                  <div key={v.id} className="rounded-3xl bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{fmtDate(v.visit_date)}</span>
                          {idx === 0 && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-600">Latest</span>}
                        </div>
                        {v.reason_for_visit && <p className="text-xs text-slate-500 mt-0.5">{v.reason_for_visit}</p>}
                      </div>
                      <Link href={`/horses/${horseId}?visit=${v.id}`} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition shrink-0">
                        Open →
                      </Link>
                    </div>
                    {(v.assessment || v.plan) && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs text-slate-600">
                        {v.assessment && (
                          <div className="rounded-2xl bg-slate-50 px-3 py-2">
                            <p className="font-semibold text-slate-400 mb-1 uppercase tracking-wide text-[10px]">Assessment</p>
                            <p className="line-clamp-3">{v.assessment}</p>
                          </div>
                        )}
                        {v.plan && (
                          <div className="rounded-2xl bg-slate-50 px-3 py-2">
                            <p className="font-semibold text-slate-400 mb-1 uppercase tracking-wide text-[10px]">Plan</p>
                            <p className="line-clamp-3">{v.plan}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
