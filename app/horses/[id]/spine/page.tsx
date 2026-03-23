'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import { getCachedHorseById, getCachedVisitsByHorse, offlineDb } from '../../../lib/offlineDb'
import {
  SUBJECTIVE_CHIPS, OBJECTIVE_CHIPS, ASSESSMENT_CHIPS, PLAN_CHIPS,
  buildSubjectiveSentence, buildObjectiveSentence, buildAssessmentSentence, buildPlanSentence,
  QuickAddChipsSection,
} from '../../../components/QuickAddChips'

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

// ── Feline spine sections & segments ──────────────────────────────────────
const FELINE_SPINE_SECTIONS = [
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

// ── Bovine spine sections & segments ──────────────────────────────────────
const BOVINE_SPINE_SECTIONS = [
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

// ── Porcine spine sections & segments ──────────────────────────────────────
const PORCINE_SPINE_SECTIONS = [
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
    segments: Array.from({ length: 15 }, (_, i) => ({
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

// ── Exotic / Generic spine sections ──────────────────────────────────────
const EXOTIC_SPINE_SECTIONS = CANINE_SPINE_SECTIONS // Use canine as generic template

type SegmentFinding = { left: boolean; right: boolean }
type Findings = Record<string, SegmentFinding>

type Visit = { id: string; visit_date: string | null; reason_for_visit: string | null }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  )
}

// ── Inner component (needs useSearchParams) ───────────────────────────────
function SpineVisitInner() {
  const { id: horseId } = useParams<{ id: string }>()
  const searchParams     = useSearchParams()
  const router           = useRouter()
  const urlVisitId       = searchParams.get('visitId') ?? null
  const urlSpecies       = searchParams.get('species') ?? 'equine'
  const isNewVisitFlow   = searchParams.get('newVisit') === 'true'
  const appointmentId    = searchParams.get('appointmentId')

  function getSpineSections(species: string) {
    switch (species) {
      case 'canine': return CANINE_SPINE_SECTIONS
      case 'feline': return FELINE_SPINE_SECTIONS
      case 'bovine': return BOVINE_SPINE_SECTIONS
      case 'porcine': return PORCINE_SPINE_SECTIONS
      case 'exotic': return EXOTIC_SPINE_SECTIONS
      default: return EQUINE_SPINE_SECTIONS
    }
  }

  function getSpeciesLabel(species: string): string {
    switch (species) {
      case 'canine': return 'Canine'
      case 'feline': return 'Feline'
      case 'bovine': return 'Bovine'
      case 'porcine': return 'Porcine'
      case 'exotic': return 'Exotic'
      default: return 'Equine'
    }
  }

  const SPINE_SECTIONS = getSpineSections(urlSpecies)
  const speciesLabel = getSpeciesLabel(urlSpecies)

  // ── Spine assessment state ──
  const [horseName,       setHorseName]       = useState('')
  const [horseData,       setHorseData]       = useState<{ name: string; species: string | null; discipline: string | null; owner_id: string | null } | null>(null)
  const [visits,          setVisits]          = useState<Visit[]>([])
  const [selectedVisitId, setSelectedVisitId] = useState<string>(urlVisitId ?? '')
  const [findings,        setFindings]        = useState<Findings>({})
  const [spineNotes,      setSpineNotes]      = useState('')
  const [saving,          setSaving]          = useState(false)
  const [saveMsg,         setSaveMsg]         = useState('')
  const [lastSaved,       setLastSaved]       = useState<string | null>(null)
  const [noTable,         setNoTable]         = useState(false)
  const [loading,         setLoading]         = useState(true)
  const [userId,          setUserId]          = useState('')

  // ── Visit form state ──
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10))
  const [visitLocation, setVisitLocation] = useState('')
  const [providerName, setProviderName] = useState('')
  const [visitType, setVisitType] = useState('initial')
  const [reasonForVisit, setReasonForVisit] = useState('Chiropractic Adjustment')
  const [quickNotes, setQuickNotes] = useState('')
  const [subjective, setSubjective] = useState('')
  const [objective, setObjective] = useState('')
  const [assessment, setAssessment] = useState('')
  const [plan, setPlan] = useState('')
  const [treatedAreas, setTreatedAreas] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [generatingSoap, setGeneratingSoap] = useState(false)
  const [autoEmailAfterSave, setAutoEmailAfterSave] = useState(false)
  const [message, setMessage] = useState('')

  // ── Quick Add chip selections ──
  const [subjectiveChips, setSubjectiveChips] = useState<Set<string>>(new Set())
  const [objectiveChips, setObjectiveChips] = useState<Set<string>>(new Set())
  const [assessmentChips, setAssessmentChips] = useState<Set<string>>(new Set())
  const [planChips, setPlanChips] = useState<Set<string>>(new Set())

  // ── Collapsible spine sections ──
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  function toggleChip(setter: React.Dispatch<React.SetStateAction<Set<string>>>, chipId: string) {
    setter(prev => {
      const next = new Set(prev)
      if (next.has(chipId)) next.delete(chipId)
      else next.add(chipId)
      return next
    })
  }

  function toggleSpineSection(sectionKey: string) {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionKey)) next.delete(sectionKey)
      else next.add(sectionKey)
      return next
    })
  }

  // Build spine region summary for sentence builder (e.g. "cervical, thoracic, and pelvic regions")
  function getSpineRegionSummary(): string {
    const regionMap: Record<string, string> = {}
    for (const section of SPINE_SECTIONS) {
      for (const seg of section.segments) {
        const f = findings[seg.key]
        if (f?.left || f?.right) {
          regionMap[section.key] = section.label.split('/')[0].trim().toLowerCase()
        }
      }
    }
    const regions = Object.values(regionMap)
    if (regions.length === 0) return ''
    if (regions.length === 1) return `${regions[0]} region`
    if (regions.length === 2) return `${regions[0]} and ${regions[1]} regions`
    return regions.slice(0, -1).join(', ') + ', and ' + regions[regions.length - 1] + ' regions'
  }

  // Generate all SOAP fields from chip selections (rule-based, no AI)
  function generateFromSelections() {
    const spineRegions = getSpineRegionSummary()
    const sub = buildSubjectiveSentence(subjectiveChips)
    const obj = buildObjectiveSentence(objectiveChips, spineRegions)
    const asx = buildAssessmentSentence(assessmentChips)
    const pln = buildPlanSentence(planChips)

    if (sub) setSubjective(sub)
    if (obj) setObjective(obj)
    if (asx) setAssessment(asx)
    if (pln) setPlan(pln)

    // Auto-fill follow up from plan chips
    const followUpChips = ['plan_2wk', 'plan_3wk', 'plan_monthly', 'plan_prn']
    const selectedFollowUp = PLAN_CHIPS
      .flatMap(c => c.chips)
      .filter(c => planChips.has(c.id) && followUpChips.includes(c.id))
    if (selectedFollowUp.length > 0) {
      setFollowUp(selectedFollowUp.map(c => c.label).join(', '))
    }

    setMessage('SOAP fields populated from selections.')
  }

  // ── Clone Previous Visit ──
  const [cloningVisit, setCloningVisit] = useState(false)

  async function clonePreviousVisit() {
    setCloningVisit(true)
    setMessage('')
    try {
      // 1. Fetch most recent visit
      const { data: prevVisits } = await supabase
        .from('visits')
        .select('id, subjective, objective, assessment, plan, reason_for_visit, treated_areas, recommendations, follow_up, location, provider_name, quick_notes')
        .eq('horse_id', horseId)
        .order('visit_date', { ascending: false })
        .limit(1)

      if (!prevVisits || prevVisits.length === 0) {
        setMessage('No previous visits found for this patient.')
        setCloningVisit(false)
        return
      }

      const prev = prevVisits[0]
      let clonedCount = 0

      // Clone all non-null fields
      if (prev.subjective) { setSubjective(prev.subjective); clonedCount++ }
      if (prev.objective) { setObjective(prev.objective); clonedCount++ }
      if (prev.assessment) { setAssessment(prev.assessment); clonedCount++ }
      if (prev.plan) { setPlan(prev.plan); clonedCount++ }
      if (prev.reason_for_visit) { setReasonForVisit(prev.reason_for_visit); clonedCount++ }
      if (prev.treated_areas) { setTreatedAreas(prev.treated_areas); clonedCount++ }
      if (prev.recommendations) { setRecommendations(prev.recommendations); clonedCount++ }
      if (prev.follow_up) { setFollowUp(prev.follow_up); clonedCount++ }
      if (prev.location) { setVisitLocation(prev.location); clonedCount++ }
      if (prev.provider_name) { setProviderName(prev.provider_name); clonedCount++ }
      if (prev.quick_notes) { setQuickNotes(prev.quick_notes); clonedCount++ }

      // 2. Also clone spine findings from the previous visit
      if (prev.id) {
        const { data: spineData } = await supabase
          .from('spine_assessments')
          .select('findings, notes')
          .eq('visit_id', prev.id)
          .order('assessed_at', { ascending: false })
          .limit(1)

        if (spineData && spineData.length > 0) {
          const spine = spineData[0]
          if (spine.findings && typeof spine.findings === 'object') {
            setFindings(spine.findings as Findings)
            // Also update quick notes & treated areas from spine
            const spineSummary = buildQuickNotesFromFindings(spine.findings as Findings)
            if (spineSummary) {
              setQuickNotes(prev_qn => {
                const lines = (prev_qn || '').split('\n').filter(l => !l.startsWith('Spine assessment:'))
                return [spineSummary, ...lines.filter(l => l.trim())].join('\n')
              })
            }
            // Build treated areas
            const flagged: string[] = []
            for (const [key, val] of Object.entries(spine.findings as Findings)) {
              if (!val.left && !val.right) continue
              const sides: string[] = []
              if (val.left) sides.push('L')
              if (val.right) sides.push('R')
              const label = key.toUpperCase().replace('_', ' ')
              flagged.push(`${label} (${sides.join('/')})`)
            }
            if (flagged.length > 0) {
              setTreatedAreas(flagged.join(', '))
              clonedCount++
            }
          }
          if (spine.notes) { setSpineNotes(spine.notes); clonedCount++ }
        }
      }

      if (clonedCount === 0) {
        setMessage('Previous visit found but all fields were empty. Try filling in manually.')
      } else {
        setMessage(`Cloned ${clonedCount} field${clonedCount !== 1 ? 's' : ''} from previous visit. Adjust any changes and save.`)
      }
    } catch {
      setMessage('Failed to clone previous visit.')
    } finally {
      setCloningVisit(false)
    }
  }

  // ── Build quick notes summary from findings ──
  const buildQuickNotesFromFindings = useCallback((f: Findings) => {
    const flagged: string[] = []
    for (const [key, val] of Object.entries(f)) {
      if (!val.left && !val.right) continue
      const sides: string[] = []
      if (val.left) sides.push('L')
      if (val.right) sides.push('R')
      const label = key.toUpperCase().replace('_', ' ')
      flagged.push(`${label} (${sides.join('/')})`)
    }
    return flagged.length > 0
      ? `Spine assessment: ${flagged.length} segment${flagged.length === 1 ? '' : 's'} flagged — ${flagged.join(', ')}`
      : ''
  }, [])

  // ── Load horse data + auth ──
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)

      // Load practitioner name for provider field
      if (user) {
        const { data: prac } = await supabase
          .from('practitioners')
          .select('full_name')
          .eq('id', user.id)
          .single()
        if (prac?.full_name) setProviderName(prac.full_name)
      }

      const { data: horse } = await supabase
        .from('horses')
        .select('name, species, discipline, owner_id')
        .eq('id', horseId)
        .single()
      if (horse) {
        setHorseName(horse.name)
        setHorseData(horse)
      } else {
        try {
          const cached = await getCachedHorseById(horseId)
          if (cached) {
            setHorseName(cached.name)
            setHorseData({ name: cached.name, species: cached.species || null, discipline: cached.discipline || null, owner_id: cached.owner_id || null })
          }
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
    init()
  }, [horseId])

  // ── Load existing assessment when selectedVisitId changes ────────────────
  useEffect(() => {
    async function loadAssessment() {
      setLoading(true)
      setFindings({})
      setSpineNotes('')
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
        setSpineNotes(data.notes ?? '')
        setLastSaved(data.assessed_at)
      }

      setLoading(false)
    }
    loadAssessment()
  }, [horseId, selectedVisitId])

  // ── Toggle a spine segment and auto-update quick notes ──
  function toggle(segKey: string, side: 'left' | 'right') {
    setFindings(prev => {
      const updated = {
        ...prev,
        [segKey]: {
          left:  prev[segKey]?.left  ?? false,
          right: prev[segKey]?.right ?? false,
          [side]: !(prev[segKey]?.[side] ?? false),
        },
      }
      // Auto-populate quick notes with spine summary
      const spineSummary = buildQuickNotesFromFindings(updated)
      setQuickNotes(prev => {
        // Replace existing spine assessment line or prepend
        const lines = prev.split('\n').filter(l => !l.startsWith('Spine assessment:'))
        if (spineSummary) {
          return [spineSummary, ...lines.filter(l => l.trim())].join('\n')
        }
        return lines.filter(l => l.trim()).join('\n')
      })
      // Also update treated areas and objective
      const flagged: string[] = []
      for (const [key, val] of Object.entries(updated)) {
        if (!val.left && !val.right) continue
        const sides: string[] = []
        if (val.left) sides.push('L')
        if (val.right) sides.push('R')
        const label = key.toUpperCase().replace('_', ' ')
        flagged.push(`${label} (${sides.join('/')})`)
      }
      setTreatedAreas(flagged.join(', '))
      return updated
    })
  }

  // ── Generate SOAP ──
  async function generateSoap() {
    setMessage('')
    if (!quickNotes.trim()) {
      setMessage('Add quick notes first.')
      return
    }
    try {
      setGeneratingSoap(true)
      const response = await fetch('/api/generate-soap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quickNotes,
          horseName: horseData?.name || '',
          species: horseData?.species || 'equine',
          discipline: horseData?.discipline || '',
          anatomyContext: '',
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setMessage(data.error || 'Failed to generate SOAP.')
        return
      }
      setSubjective(data.subjective || '')
      setObjective(data.objective || '')
      setAssessment(data.assessment || '')
      setPlan(data.plan || '')
      setMessage('SOAP draft generated from spine assessment.')
    } catch {
      setMessage('Failed to generate SOAP.')
    } finally {
      setGeneratingSoap(false)
    }
  }

  // ── Save everything (spine + visit) ──
  async function saveAll() {
    setSaving(true)
    setSaveMsg('')
    setMessage('')

    // Validate
    if (!visitDate) {
      setMessage('Visit date is required.')
      setSaving(false)
      return
    }

    // ── OFFLINE PATH ──
    if (!navigator.onLine) {
      try {
        const localVisitId = crypto.randomUUID()

        // Save spine assessment to localStorage (same as saveSpineOnly offline)
        const pendingSpines = JSON.parse(localStorage.getItem('pendingSpineAssessments') || '[]')
        pendingSpines.push({
          localId: crypto.randomUUID(),
          horse_id: horseId,
          visit_id: null, // will link on sync
          findings,
          notes: spineNotes,
          assessed_at: new Date().toISOString(),
        })
        localStorage.setItem('pendingSpineAssessments', JSON.stringify(pendingSpines))

        // Save visit to IndexedDB pending queue
        await offlineDb.pendingVisits.add({
          localId: localVisitId,
          horseId: horseId,
          visitDate: visitDate,
          reasonForVisit: reasonForVisit || null,
          subjective: subjective || null,
          objective: objective || null,
          assessment: assessment || null,
          plan: plan || null,
          quickNotes: null,
          createdAt: new Date().toISOString(),
        })

        // Also save to cached visits so it shows immediately
        await offlineDb.cachedVisits.put({
          id: localVisitId,
          horse_id: horseId,
          visit_date: visitDate,
          reason_for_visit: reasonForVisit || null,
          subjective: subjective || null,
          objective: objective || null,
          assessment: assessment || null,
          plan: plan || null,
          quick_notes: null,
          practitioner_id: userId || '',
          cachedAt: Date.now(),
        })

        setSaving(false)
        setSaveMsg('Saved offline — will sync when back online.')
        setMessage('Visit & spine saved offline. Data will sync automatically when you reconnect.')
        setTimeout(() => {
          router.push(`/horses/${horseId}?tab=visits`)
        }, 2000)
      } catch {
        setSaving(false)
        setSaveMsg('Failed to save offline.')
        setMessage('Could not save offline. Please try again.')
      }
      return
    }

    // ── ONLINE PATH ──
    // 1. Save spine assessment
    const { data: spineData, error: spineError } = await supabase
      .from('spine_assessments')
      .insert({
        horse_id: horseId,
        visit_id: null, // will link after visit is created
        findings,
        notes: spineNotes,
        assessed_at: new Date().toISOString(),
        practitioner_id: userId,
      })
      .select('id')
      .single()

    if (spineError) {
      setSaveMsg('Error saving spine: ' + spineError.message)
      setSaving(false)
      return
    }

    // 2. Save visit
    const visitPayload = {
      horse_id: horseId,
      owner_id: horseData?.owner_id || null,
      visit_date: visitDate,
      location: visitLocation || null,
      provider_name: providerName || null,
      visit_type: visitType || null,
      reason_for_visit: reasonForVisit || null,
      subjective: subjective || null,
      objective: objective || null,
      assessment: assessment || null,
      plan: plan || null,
      treated_areas: treatedAreas || null,
      recommendations: recommendations || null,
      follow_up: followUp || null,
      practitioner_id: userId,
    }

    const { data: visitResult, error: visitError } = await supabase
      .from('visits')
      .insert([visitPayload])
      .select('id')
      .single()

    if (visitError) {
      setSaveMsg('Spine saved but error saving visit: ' + visitError.message)
      setSaving(false)
      return
    }

    const savedVisitId = visitResult.id

    // 3. Link spine assessment to visit
    if (spineData?.id) {
      await supabase
        .from('spine_assessments')
        .update({ visit_id: savedVisitId })
        .eq('id', spineData.id)
    }

    // 4. Link appointment if we came from one
    if (appointmentId) {
      await supabase
        .from('appointments')
        .update({ visit_id: savedVisitId, status: 'completed' })
        .eq('id', appointmentId)
    }

    // 5. Auto-email if checked
    if (autoEmailAfterSave && savedVisitId) {
      try {
        setMessage('Visit saved. Sending PDF to owner...')
        const response = await fetch(`/api/visits/${savedVisitId}/email`, { method: 'POST' })
        if (!response.ok) {
          const data = await response.json().catch(() => null)
          throw new Error(data?.error || 'Failed to email PDF.')
        }
        setMessage('Visit saved and PDF emailed.')
      } catch (err: any) {
        setMessage(`Visit saved, but email failed: ${err?.message || 'Unknown error'}`)
      }
    }

    setSaving(false)
    // Navigate back to patient page
    router.push(`/horses/${horseId}?tab=visits`)
  }

  // ── Save spine only (non-new-visit flow) ──
  async function saveSpineOnly() {
    setSaving(true)
    setSaveMsg('')

    if (!navigator.onLine) {
      try {
        const pending = JSON.parse(localStorage.getItem('pendingSpineAssessments') || '[]')
        pending.push({
          localId: crypto.randomUUID(),
          horse_id: horseId,
          visit_id: selectedVisitId || null,
          findings,
          notes: spineNotes,
          assessed_at: new Date().toISOString(),
        })
        localStorage.setItem('pendingSpineAssessments', JSON.stringify(pending))
        setSaving(false)
        setLastSaved(new Date().toISOString())
        setSaveMsg('Saved offline — will sync when back online.')
        setTimeout(() => setSaveMsg(''), 4000)
      } catch {
        setSaving(false)
        setSaveMsg('Failed to save offline.')
      }
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('spine_assessments').insert({
      horse_id: horseId,
      visit_id: selectedVisitId || null,
      findings,
      notes: spineNotes,
      assessed_at: new Date().toISOString(),
      practitioner_id: user?.id,
    })

    setSaving(false)
    if (error) {
      setSaveMsg('Error: ' + error.message)
    } else {
      setLastSaved(new Date().toISOString())
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
          <div className="flex items-center gap-3">
            <Link
              href={`/horses/${horseId}`}
              className="flex-shrink-0 flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              ← Back
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-slate-900 leading-tight">
                {isNewVisitFlow ? 'New Visit' : `${urlSpecies !== 'equine' ? speciesLabel + ' ' : ''}Spine Assessment`}
              </h1>
              <p className="text-xs text-slate-500 truncate">
                {horseName && `${horseName} · `}
                {isNewVisitFlow ? 'Spine assessment + visit notes' : selectedVisitId ? 'Linked to visit' : 'No visit selected'}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={isNewVisitFlow ? saveAll : saveSpineOnly}
              disabled={saving || noTable || loading}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
            >
              {saving ? 'Saving…' : isNewVisitFlow ? 'Save Visit' : 'Save Assessment'}
            </button>
            {isNewVisitFlow && (
              <button
                onClick={clonePreviousVisit}
                disabled={cloningVisit}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition disabled:opacity-40"
              >
                {cloningVisit ? 'Cloning…' : 'Clone Previous Visit'}
              </button>
            )}
            {flaggedCount > 0 && (
              <button
                onClick={() => {
                  setFindings({})
                  setQuickNotes(prev => prev.split('\n').filter(l => !l.startsWith('Spine assessment:')).join('\n').trim())
                  setTreatedAreas('')
                }}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-2xl px-4 pb-2">
          {saveMsg ? (
            <span className="text-sm font-medium text-emerald-600">{saveMsg}</span>
          ) : message ? (
            <span className={`text-sm font-medium ${message.toLowerCase().includes('error') || message.toLowerCase().includes('failed') ? 'text-red-600' : 'text-emerald-600'}`}>{message}</span>
          ) : lastSaved ? (
            <span className="text-xs text-slate-400">Last saved {formatDate(lastSaved)}</span>
          ) : null}
        </div>
      </div>

      {noTable ? (
        <div className="mx-auto max-w-2xl px-4 py-8">
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="font-semibold text-amber-900">One-time setup needed</h2>
            <p className="mt-1 text-sm text-amber-800">
              Run the spine_assessments table SQL in your Supabase dashboard, then refresh.
            </p>
          </div>
        </div>

      ) : loading ? (
        <div className="mx-auto max-w-2xl px-4 py-12 text-center text-slate-400">Loading…</div>

      ) : (
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-5">

          {/* Visit selector — only when NOT in new visit flow (standalone spine assessment) */}
          {!isNewVisitFlow && (
            <>
              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">
                  {`${urlSpecies !== 'equine' ? speciesLabel + ' ' : ''}Spine Assessment`}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Check boxes to flag subluxations.
                </p>
              </div>
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
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* NEW VISIT FLOW — ordered fields with inline spine       */}
          {/* ══════════════════════════════════════════════════════════ */}

          {isNewVisitFlow && (
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <div className="grid gap-4 md:grid-cols-2">

                {/* 1. Visit Date */}
                <Field label="Visit Date">
                  <input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  />
                </Field>

                {/* 2. Location */}
                <Field label="Location">
                  <input
                    value={visitLocation}
                    onChange={(e) => setVisitLocation(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    placeholder="Barn / ranch location"
                  />
                </Field>

                {/* 3. Provider Name */}
                <Field label="Provider Name">
                  <input
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    placeholder="Provider"
                  />
                </Field>

                {/* 4. Visit Type */}
                <Field label="Visit Type">
                  <select
                    value={visitType}
                    onChange={(e) => setVisitType(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white"
                  >
                    <option value="initial">Initial</option>
                    <option value="follow_up">Follow Up</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </Field>

                {/* 5. Reason for Visit */}
                <div className="md:col-span-2">
                  <Field label="Reason for Visit">
                    <input
                      value={reasonForVisit}
                      onChange={(e) => setReasonForVisit(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Performance maintenance, stiffness, etc."
                    />
                  </Field>
                </div>

                {/* 6. Subjective */}
                <div className="md:col-span-2">
                  <Field label="Subjective">
                    <textarea
                      value={subjective}
                      onChange={(e) => setSubjective(e.target.value)}
                      className="min-h-28 w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="What the owner reports — history, complaints, concerns"
                    />
                    <QuickAddChipsSection
                      categories={SUBJECTIVE_CHIPS}
                      selectedIds={subjectiveChips}
                      onToggle={(id) => toggleChip(setSubjectiveChips, id)}
                      onClearSection={() => setSubjectiveChips(new Set())}
                      generatedText={buildSubjectiveSentence(subjectiveChips)}
                      onFill={() => setSubjective(buildSubjectiveSentence(subjectiveChips))}
                      sectionLabel="Subjective"
                    />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* 7. SPINE ASSESSMENT (shown in both flows)               */}
          {/* ══════════════════════════════════════════════════════════ */}

          {isNewVisitFlow && (
            <div className="rounded-3xl bg-white p-5 shadow-sm border-t-4 border-slate-900">
              <h2 className="text-lg font-semibold text-slate-900">
                {`${urlSpecies !== 'equine' ? speciesLabel + ' ' : ''}Spine Assessment`}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Check boxes to flag subluxations. Findings auto-populate into treated areas.
              </p>
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

          {/* Flagged summary with segment labels */}
          {flaggedCount > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-amber-700">
                  {flaggedCount} segment{flaggedCount !== 1 ? 's' : ''} flagged
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {Object.entries(findings)
                  .filter(([, f]) => f.left || f.right)
                  .map(([key, f]) => {
                    const sides: string[] = []
                    if (f.left) sides.push('L')
                    if (f.right) sides.push('R')
                    return (
                      <span
                        key={key}
                        className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                      >
                        {key.toUpperCase().replace('_', ' ')} ({sides.join('/')})
                      </span>
                    )
                  })}
              </div>
            </div>
          )}

          {/* ── Spine Sections (collapsible) ── */}
          {SPINE_SECTIONS.map(section => {
            const isCollapsed = collapsedSections.has(section.key)
            const sectionFlagged = section.segments.filter(seg => {
              const f = findings[seg.key]
              return f?.left || f?.right
            })
            const sectionFlaggedLabels = sectionFlagged.map(seg => {
              const f = findings[seg.key]
              const sides: string[] = []
              if (f?.left) sides.push('L')
              if (f?.right) sides.push('R')
              return `${seg.label} (${sides.join('/')})`
            })

            return (
              <div key={section.key} className="overflow-hidden rounded-3xl bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleSpineSection(section.key)}
                  className="flex w-full items-center justify-between bg-slate-900 px-5 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{isCollapsed ? '▶' : '▼'}</span>
                    <h2 className="text-sm font-semibold text-white">{section.label}</h2>
                    {sectionFlagged.length > 0 && (
                      <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-900">
                        {sectionFlagged.length}
                      </span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-wide text-slate-400">
                      <span>L</span>
                      <span>R</span>
                    </div>
                  )}
                </button>

                {/* Collapsed summary of flagged segments */}
                {isCollapsed && sectionFlaggedLabels.length > 0 && (
                  <div className="bg-amber-50 px-5 py-2 text-xs text-amber-700 font-medium">
                    Flagged: {sectionFlaggedLabels.join(', ')}
                  </div>
                )}

                {!isCollapsed && (
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
                )}
              </div>
            )
          })}

          {/* Spine clinical notes */}
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Clinical Notes</h2>
            <textarea
              value={spineNotes}
              onChange={e => setSpineNotes(e.target.value)}
              rows={3}
              placeholder="Additional observations, treatment notes…"
              className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* 8–12. REMAINING VISIT FIELDS (after spine)              */}
          {/* ══════════════════════════════════════════════════════════ */}

          {isNewVisitFlow && (
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <div className="grid gap-4 md:grid-cols-2">

                {/* 8. Objective */}
                <div className="md:col-span-2">
                  <Field label="Objective">
                    <textarea
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      className="min-h-28 w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Observed findings, palpation results"
                    />
                    <QuickAddChipsSection
                      categories={OBJECTIVE_CHIPS}
                      selectedIds={objectiveChips}
                      onToggle={(id) => toggleChip(setObjectiveChips, id)}
                      onClearSection={() => setObjectiveChips(new Set())}
                      generatedText={buildObjectiveSentence(objectiveChips, getSpineRegionSummary())}
                      onFill={() => setObjective(buildObjectiveSentence(objectiveChips, getSpineRegionSummary()))}
                      sectionLabel="Objective"
                    />
                  </Field>
                </div>

                {/* 9. Assessment */}
                <div className="md:col-span-2">
                  <Field label="Assessment">
                    <textarea
                      value={assessment}
                      onChange={(e) => setAssessment(e.target.value)}
                      className="min-h-28 w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Clinical impression"
                    />
                    <QuickAddChipsSection
                      categories={ASSESSMENT_CHIPS}
                      selectedIds={assessmentChips}
                      onToggle={(id) => toggleChip(setAssessmentChips, id)}
                      onClearSection={() => setAssessmentChips(new Set())}
                      generatedText={buildAssessmentSentence(assessmentChips)}
                      onFill={() => setAssessment(buildAssessmentSentence(assessmentChips))}
                      sectionLabel="Assessment"
                    />
                  </Field>
                </div>

                {/* 10. Plan */}
                <div className="md:col-span-2">
                  <Field label="Plan">
                    <textarea
                      value={plan}
                      onChange={(e) => setPlan(e.target.value)}
                      className="min-h-28 w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Treatment plan / next steps"
                    />
                    <QuickAddChipsSection
                      categories={PLAN_CHIPS}
                      selectedIds={planChips}
                      onToggle={(id) => toggleChip(setPlanChips, id)}
                      onClearSection={() => setPlanChips(new Set())}
                      generatedText={buildPlanSentence(planChips)}
                      onFill={() => {
                        setPlan(buildPlanSentence(planChips))
                        // Auto-fill follow up from plan chips
                        const followUpChipIds = ['plan_2wk', 'plan_3wk', 'plan_monthly', 'plan_prn']
                        const selFU = PLAN_CHIPS.flatMap(c => c.chips).filter(c => planChips.has(c.id) && followUpChipIds.includes(c.id))
                        if (selFU.length > 0) setFollowUp(selFU.map(c => c.label).join(', '))
                      }}
                      sectionLabel="Plan"
                    />
                  </Field>
                </div>

                {/* 11. Follow Up */}
                <Field label="Follow Up">
                  <input
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                    placeholder="2 weeks, PRN, monthly, etc."
                  />
                </Field>

                {/* 12. Recommendations */}
                <div className="md:col-span-2">
                  <Field label="Recommendations">
                    <textarea
                      value={recommendations}
                      onChange={(e) => setRecommendations(e.target.value)}
                      className="min-h-28 w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Rest, stretches, light work, etc."
                    />
                  </Field>
                </div>

                {/* Quick Notes + AI SOAP */}
                <div className="md:col-span-2">
                  <Field label="Quick Notes for AI SOAP Draft">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {[
                        { label: 'Post-competition', text: 'Post-competition soreness. Reduced range of motion through back and hindquarters. Mild tension through poll and withers. Responded well to adjustment.' },
                        { label: 'Routine adjustment', text: 'Routine maintenance adjustment. Owner reports normal performance and behavior. Minor restrictions found at thoracolumbar junction. Full adjustment performed.' },
                        { label: 'Poll tension', text: 'Poll tension and head tilt noted on arrival. Restricted cervical range of motion. Owner reports difficulty bending left. Atlas and C2 adjusted. Good response.' },
                        { label: 'Hind-end asymmetry', text: 'Hind-end asymmetry and reduced impulsion reported by owner. SI joint restriction noted bilaterally, left more pronounced. Adjusted lumbar and sacral regions. Follow up in 2 weeks.' },
                        { label: 'Back soreness', text: 'Back soreness after heavy work week. Reactive mid-thoracic region on palpation. Adjusted T8–T12. Recommended 2 light days and stretching.' },
                        { label: 'New client', text: 'Initial assessment. Owner reports history of stiffness and reluctance to pick up right lead. Full spine evaluated. Multiple restrictions found. Comprehensive adjustment performed. Recommendations discussed.' },
                      ].map((t) => (
                        <button
                          key={t.label}
                          type="button"
                          onClick={() => setQuickNotes(prev => prev ? prev + '\n' + t.text : t.text)}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-slate-900 hover:bg-slate-900 hover:text-white transition"
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={quickNotes}
                      onChange={(e) => setQuickNotes(e.target.value)}
                      className="min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3"
                      placeholder="Spine findings auto-populate here. Add more notes or tap a template…"
                    />
                  </Field>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {/* Generate from chip selections (rule-based) */}
                    {(subjectiveChips.size > 0 || objectiveChips.size > 0 || assessmentChips.size > 0 || planChips.size > 0) && (
                      <button
                        type="button"
                        onClick={generateFromSelections}
                        className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition shadow-sm"
                      >
                        Generate SOAP from Selections
                      </button>
                    )}
                    {/* Generate with AI (from quick notes) */}
                    <button
                      onClick={generateSoap}
                      disabled={generatingSoap}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 disabled:opacity-50"
                    >
                      {generatingSoap ? 'Generating SOAP...' : 'Generate SOAP with AI'}
                    </button>
                    {quickNotes && (
                      <button
                        type="button"
                        onClick={() => setQuickNotes('')}
                        className="rounded-xl border border-slate-200 px-3 py-3 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Auto-email toggle */}
                <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={autoEmailAfterSave}
                      onChange={(e) => setAutoEmailAfterSave(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        Auto-email PDF to owner after saving visit
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Uses the owner email saved on this horse record.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── Bottom save button ── */}
          <div className="flex gap-3">
            <button
              onClick={isNewVisitFlow ? saveAll : saveSpineOnly}
              disabled={saving || noTable}
              className="flex-1 rounded-2xl bg-slate-900 py-4 text-base font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
            >
              {saving ? 'Saving…' : isNewVisitFlow ? 'Save Visit' : 'Save Assessment'}
            </button>
            {flaggedCount > 0 && (
              <button
                onClick={() => {
                  setFindings({})
                  setQuickNotes(prev => prev.split('\n').filter(l => !l.startsWith('Spine assessment:')).join('\n').trim())
                  setTreatedAreas('')
                }}
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
      <SpineVisitInner />
    </Suspense>
  )
}
