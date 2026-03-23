'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import { getCachedHorseById, getCachedVisitsByHorse } from '../../../lib/offlineDb'

// ── Equine spine sections & segments ──────────────────────────────────────
const EQUINE_SPINE_SECTIONS = [
  {
    key: 'cranial',
    label: 'Cranial / Cervical',
    segments: [
      { key: 'tmj',  label: 'TMJ' },
      { key: 'poll', label: 'Poll' },
      { key: 'c1',   label: 'C1  (Atlas)' },
      { key: 'c2',   label: 'C2  (Axis)' },
      { key: 'c3',   label: 'C3' },
      { key: 'c4',   label: 'C4' },
      { key: 'c5',   label: 'C5' },
      { key: 'c6',   label: 'C6' },
      { key: 'c7',   label: 'C7' },
    ],
  },
  {
    key: 'thoracic',
    label: 'Thoracic',
    segments: Array.from({ length: 18 }, (_, i) => ({
      key: `t${i + 1}`,
      label: `T${i + 1}`,
    })),
  },
  {
    key: 'lumbar',
    label: 'Lumbar',
    segments: Array.from({ length: 6 }, (_, i) => ({
      key: `l${i + 1}`,
      label: `L${i + 1}`,
    })),
  },
  {
    key: 'sacral',
    label: 'Sacral / Pelvic',
    segments: [
      { key: 'sacrum',    label: 'Sacrum' },
      { key: 'si_joint',  label: 'SI Joint' },
      { key: 'coccygeal', label: 'Coccygeal' },
    ],
  },
]

// ── Canine spine sections & segments ──────────────────────────────────────
const CANINE_SPINE_SECTIONS = [
  {
    key: 'cranial',
    label: 'Cranial / Cervical',
    segments: [
      { key: 'occiput', label: 'Occiput' },
      { key: 'c1',      label: 'C1  (Atlas)' },
      { key: 'c2',      label: 'C2  (Axis)' },
      { key: 'c3',      label: 'C3' },
      { key: 'c4',      label: 'C4' },
      { key: 'c5',      label: 'C5' },
      { key: 'c6',      label: 'C6' },
      { key: 'c7',      label: 'C7' },
    ],
  },
  {
    key: 'thoracic',
    label: 'Thoracic',
    segments: Array.from({ length: 13 }, (_, i) => ({
      key: `t${i + 1}`,
      label: `T${i + 1}`,
    })),
  },
  {
    key: 'lumbar',
    label: 'Lumbar',
    segments: Array.from({ length: 7 }, (_, i) => ({
      key: `l${i + 1}`,
      label: `L${i + 1}`,
    })),
  },
  {
    key: 'sacral',
    label: 'Sacral / Pelvic',
    segments: [
      { key: 'sacrum',    label: 'Sacrum' },
      { key: 'si_joint',  label: 'SI Joint' },
      { key: 'coccygeal', label: 'Coccygeal' },
    ],
  },
]

type SegmentFinding = { left: boolean; right: boolean }
type Findings = Record<string, SegmentFinding>

const SQL_SETUP = `CREATE TABLE spine_assessments (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  horse_id    uuid REFERENCES horses(id) ON DELETE CASCADE NOT NULL,
  visit_id    uuid REFERENCES visits(id) ON DELETE SET NULL,
  assessed_at timestamptz DEFAULT now(),
  findings    jsonb NOT NULL DEFAULT '{}',
  notes       text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX ON spine_assessments (horse_id, assessed_at DESC);`

type Visit = { id: string; visit_date: string | null; reason_for_visit: string | null }

// ── Inner component (needs useSearchParams) ───────────────────────────────
function SpineInner() {
  const { id: horseId } = useParams<{ id: string }>()
  const searchParams     = useSearchParams()
  const router           = useRouter()
  const urlVisitId       = searchParams.get('visitId') ?? null
  const urlSpecies       = searchParams.get('species') ?? 'equine'
  const isNewVisitFlow   = searchParams.get('newVisit') === 'true'
  const appointmentId    = searchParams.get('appointmentId')
  const SPINE_SECTIONS   = urlSpecies === 'canine' ? CANINE_SPINE_SECTIONS : EQUINE_SPINE_SECTIONS

  const [horseName,       setHorseName]       = useState('')
  const [visits,          setVisits]          = useState<Visit[]>([])
  const [selectedVisitId, setSelectedVisitId] = useState<string>(urlVisitId ?? '')
  const [findings,        setFindings]        = useState<Findings>({})
  const [notes,           setNotes]           = useState('')
  const [saving,          setSaving]          = useState(false)
  const [saveMsg,         setSaveMsg]         = useState('')
  const [lastSaved,       setLastSaved]       = useState<string | null>(null)
  const [noTable,         setNoTable]         = useState(false)
  const [loading,         setLoading]         = useState(true)

  // ── Load horse name + visits ─────────────────────────────────────────────
  useEffect(() => {
    async function loadMeta() {
      const { data: horse } = await supabase
        .from('horses')
        .select('name')
        .eq('id', horseId)
        .single()
      if (horse) {
        setHorseName(horse.name)
      } else {
        try {
          const cached = await getCachedHorseById(horseId)
          if (cached) setHorseName(cached.name)
        } catch { /* ignore */ }
      }

      const { data: visitData } = await supabase
        .from('visits')
        .select('id, visit_date, reason_for_visit')
        .eq('horse_id', horseId)
        .order('visit_date', { ascending: false })
      if (visitData) {
        setVisits(visitData as Visit[])
      } else {
        try {
          const cached = await getCachedVisitsByHorse(horseId)
          setVisits(cached
            .sort((a, b) => (b.visit_date || '').localeCompare(a.visit_date || ''))
            .map(v => ({ id: v.id, visit_date: v.visit_date, reason_for_visit: v.reason_for_visit })) as Visit[]
          )
        } catch { /* ignore */ }
      }
    }
    loadMeta()
  }, [horseId])

  // ── Load existing assessment when selectedVisitId changes ────────────────
  useEffect(() => {
    async function loadAssessment() {
      setLoading(true)
      setFindings({})
      setNotes('')
      setLastSaved(null)

      let query = supabase
        .from('spine_assessments')
        .select('findings, notes, assessed_at')
        .order('assessed_at', { ascending: false })
        .limit(1)

      if (selectedVisitId) {
        query = query.eq('visit_id', selectedVisitId) as typeof query
      } else {
        query = query.eq('horse_id', horseId) as typeof query
      }

      const { data, error } = await query.maybeSingle()

      if (error) {
        if (error.code === '42P01') setNoTable(true)
      } else if (data) {
        setFindings((data.findings as Findings) ?? {})
        setNotes(data.notes ?? '')
        setLastSaved(data.assessed_at)
      }

      setLoading(false)
    }
    loadAssessment()
  }, [horseId, selectedVisitId])

  // ── Toggle ──────────────────────────────────────────────────────────────
  function toggle(segKey: string, side: 'left' | 'right') {
    setFindings(prev => ({
      ...prev,
      [segKey]: {
        left:  prev[segKey]?.left  ?? false,
        right: prev[segKey]?.right ?? false,
        [side]: !(prev[segKey]?.[side] ?? false),
      },
    }))
  }

  // ── Save ────────────────────────────────────────────────────────────────
  async function save() {
    setSaving(true)
    setSaveMsg('')

    if (!navigator.onLine) {
      // Store spine assessment in localStorage as a pending item
      try {
        const pending = JSON.parse(localStorage.getItem('pendingSpineAssessments') || '[]')
        const localId = crypto.randomUUID()
        pending.push({
          localId,
          horse_id: horseId,
          visit_id: selectedVisitId || null,
          findings,
          notes,
          assessed_at: new Date().toISOString(),
        })
        localStorage.setItem('pendingSpineAssessments', JSON.stringify(pending))
        setSaving(false)
        const ts = new Date().toISOString()
        setLastSaved(ts)
        setSaveMsg('Saved offline — will sync when back online.')
        setTimeout(() => setSaveMsg(''), 4000)
      } catch {
        setSaving(false)
        setSaveMsg('Failed to save offline.')
      }
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('spine_assessments').insert({
      horse_id:       horseId,
      visit_id:       selectedVisitId || null,
      findings,
      notes,
      assessed_at:    new Date().toISOString(),
      practitioner_id: user?.id,
    }).select('id').single()

    setSaving(false)

    if (error) {
      setSaveMsg('Error: ' + error.message)
    } else {
      const ts = new Date().toISOString()
      setLastSaved(ts)

      if (isNewVisitFlow && data?.id) {
        // Redirect back to patient page to pre-fill visit form with spine data
        router.push(`/horses/${horseId}?fromSpine=${data.id}${appointmentId ? `&appointmentId=${appointmentId}` : ''}`)
        return
      }

      setSaveMsg('Saved! This will appear on the visit PDF.')
      setTimeout(() => setSaveMsg(''), 4000)
    }
  }

  const flaggedCount = Object.values(findings).filter(f => f.left || f.right).length

  function formatDate(iso: string) {
    const [y, m, d] = iso.split('T')[0].split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 py-4">
          {/* Top row: Back + title */}
          <div className="flex items-center gap-3">
            <Link
              href={`/horses/${horseId}`}
              className="flex-shrink-0 flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              ← Back
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-slate-900 leading-tight">
                {urlSpecies === 'canine' ? 'Canine Spine Assessment' : 'Spine Assessment'}
              </h1>
              <p className="text-xs text-slate-500 truncate">
                {horseName && `${horseName} · `}
                {isNewVisitFlow ? 'Complete assessment, then continue to visit form' : selectedVisitId ? 'Linked to visit' : 'No visit selected'}
              </p>
            </div>
          </div>

          {/* Action buttons row */}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving || noTable || loading}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
            >
              {saving ? 'Saving…' : isNewVisitFlow ? 'Save & Continue to Visit' : 'Save'}
            </button>
            {flaggedCount > 0 && (
              <button
                onClick={() => setFindings({})}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div className="mx-auto max-w-2xl px-4 pb-2">
          {saveMsg ? (
            <span className="text-sm font-medium text-emerald-600">{saveMsg}</span>
          ) : lastSaved ? (
            <span className="text-xs text-slate-400">Last saved {formatDate(lastSaved)}</span>
          ) : null}
        </div>
      </div>

      {/* ── No-table setup ── */}
      {noTable ? (
        <div className="mx-auto max-w-2xl px-4 py-8">
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="font-semibold text-amber-900">One-time setup needed</h2>
            <p className="mt-1 text-sm text-amber-800">
              Run this SQL in your Supabase dashboard (SQL Editor), then refresh.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-2xl border border-amber-200 bg-white p-4 text-xs text-slate-700 leading-relaxed">
              {SQL_SETUP}
            </pre>
          </div>
        </div>

      ) : loading ? (
        <div className="mx-auto max-w-2xl px-4 py-12 text-center text-slate-400">Loading…</div>

      ) : (
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-5">

          {/* Visit selector */}
          {isNewVisitFlow ? (
            <div className="rounded-3xl bg-emerald-50 border border-emerald-200 px-5 py-4 shadow-sm">
              <p className="text-sm font-semibold text-emerald-800">
                New Visit — {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <p className="mt-1 text-xs text-emerald-600">
                This assessment will be linked to the visit automatically after you save &amp; continue.
              </p>
            </div>
          ) : (
            <div className="rounded-3xl bg-white px-5 py-4 shadow-sm">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Link to Visit
              </label>
              <select
                value={selectedVisitId}
                onChange={e => setSelectedVisitId(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">— No visit (standalone record) —</option>
                {visits.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.visit_date
                      ? new Date(v.visit_date + 'T00:00:00').toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })
                      : 'No date'
                    }
                    {v.reason_for_visit ? ` — ${v.reason_for_visit}` : ''}
                  </option>
                ))}
              </select>
              {selectedVisitId && (
                <p className="mt-1.5 text-xs text-slate-500">
                  This assessment will appear in that visit&apos;s PDF export.
                </p>
              )}
            </div>
          )}

          {/* L / R column header */}
          <div className="flex items-center justify-between rounded-2xl bg-white px-5 py-3 shadow-sm">
            <p className="text-sm text-slate-500">
              Check a box to mark a fixation or subluxation.
            </p>
            <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-wide text-slate-500">
              <span>Left</span>
              <span>Right</span>
            </div>
          </div>

          {/* Flagged summary */}
          {flaggedCount > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3">
              <span className="text-sm font-semibold text-amber-700">
                {flaggedCount} segment{flaggedCount !== 1 ? 's' : ''} flagged
              </span>
            </div>
          )}

          {/* ── Sections ── */}
          {SPINE_SECTIONS.map(section => (
            <div key={section.key} className="overflow-hidden rounded-3xl bg-white shadow-sm">

              <div className="flex items-center justify-between bg-slate-900 px-5 py-3">
                <h2 className="text-sm font-semibold text-white">{section.label}</h2>
                <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-wide text-slate-400">
                  <span>L</span>
                  <span>R</span>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {section.segments.map((seg, idx) => {
                  const f = findings[seg.key]
                  const hasIssue = f?.left || f?.right

                  return (
                    <div
                      key={seg.key}
                      className={[
                        'flex items-center justify-between px-5 py-3 transition',
                        idx % 2 === 1 ? 'bg-slate-50' : 'bg-white',
                        hasIssue ? 'border-l-[3px] border-amber-400' : '',
                      ].join(' ')}
                    >
                      <span className={`text-sm ${hasIssue ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                        {seg.label}
                      </span>

                      <div className="flex items-center gap-6">
                        <label className="flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            checked={f?.left ?? false}
                            onChange={() => toggle(seg.key, 'left')}
                            className="h-5 w-5 cursor-pointer rounded border-slate-300 accent-slate-900"
                          />
                        </label>
                        <label className="flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            checked={f?.right ?? false}
                            onChange={() => toggle(seg.key, 'right')}
                            className="h-5 w-5 cursor-pointer rounded border-slate-300 accent-slate-900"
                          />
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Notes */}
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Clinical Notes</h2>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Additional observations, treatment notes…"
              className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Bottom save */}
          <div className="flex gap-3">
            <button
              onClick={save}
              disabled={saving || noTable}
              className="flex-1 rounded-2xl bg-slate-900 py-4 text-base font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save Assessment'}
            </button>
            {flaggedCount > 0 && (
              <button
                onClick={() => setFindings({})}
                className="rounded-2xl border border-slate-300 px-6 py-4 text-base font-medium text-slate-600 hover:bg-slate-100 transition"
              >
                Clear All
              </button>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

// ── Page wrapper (Suspense required for useSearchParams) ──────────────────
export default function SpineAssessmentPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading…</div>}>
      <SpineInner />
    </Suspense>
  )
}
