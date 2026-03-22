'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'

type SoapTemplate = {
  id: string
  name: string
  category: string
  chief_complaint: string | null
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  treated_areas: string | null
  recommendations: string | null
  follow_up: string | null
  is_default: boolean
  sort_order: number
  created_at: string
}

const CATEGORIES = [
  { value: 'initial_exam', label: 'Initial Exam' },
  { value: 're_exam', label: 'Re-Exam' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'specific_complaint', label: 'Specific Complaint' },
  { value: 'general', label: 'General' },
]

const categoryLabel = (cat: string) => CATEGORIES.find(c => c.value === cat)?.label || cat

const inputClass = 'w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227]/40 transition'
const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5'

const DEFAULT_TEMPLATES: Omit<SoapTemplate, 'id' | 'created_at'>[] = [
  {
    name: 'Initial Exam — Low Back Pain',
    category: 'initial_exam',
    chief_complaint: 'Low back pain',
    subjective: 'Patient presents with low back pain rated {pain_score}/10. Pain began {onset}. Described as {quality} in nature. Aggravated by {aggravating}. Relieved by {relieving}. No radiating symptoms / Radiating to {radiation}.',
    objective: 'Posture: {posture_findings}. ROM lumbar spine: flexion {flex}°, extension {ext}°, lateral flexion R/L {lat}°. Palpation: tenderness and hypertonicity at {segments}. Orthopedic tests: {ortho_tests}. Neurological: DTRs {dtrs}, sensation {sensation}, motor {motor}.',
    assessment: 'Subluxation complex at {segments}. {diagnosis}. Patient presents with functional limitations in {limitations}.',
    plan: 'Chiropractic adjustment to {segments} using {technique}. {modalities}. Treatment frequency: {frequency}.',
    treated_areas: 'Lumbar spine, SI joints',
    recommendations: 'Ice 15-20 minutes post-treatment. Core stabilization exercises. Ergonomic workstation assessment. Avoid prolonged sitting > 30 min.',
    follow_up: 'Return in {follow_up_days} days for re-evaluation. {total_visits} visits over {weeks} weeks.',
    is_default: true,
    sort_order: 1,
  },
  {
    name: 'Initial Exam — Cervical/Neck Pain',
    category: 'initial_exam',
    chief_complaint: 'Neck pain / Cervical pain',
    subjective: 'Patient presents with neck pain rated {pain_score}/10. Pain began {onset}. Described as {quality}. Aggravated by {aggravating}. Associated symptoms: {associated} (headaches, arm pain, numbness).',
    objective: 'Cervical ROM: flexion {flex}°, extension {ext}°, rotation R/L {rot}°, lateral flexion R/L {lat}°. Palpation: tenderness at {segments}. Orthopedic: cervical compression {comp}, distraction {dist}, Spurling {spurling}. Upper extremity neuro intact / {neuro_findings}.',
    assessment: 'Cervical subluxation at {segments}. {diagnosis}. Myofascial involvement of {muscles}.',
    plan: 'Cervical adjustment {segments} via {technique}. Soft tissue therapy to {muscles}. {modalities}.',
    treated_areas: 'Cervical spine, upper thoracic',
    recommendations: 'Ice 15 minutes. Cervical stretching exercises. Proper sleep posture with supportive pillow. Limit screen time / adjust monitor height.',
    follow_up: 'Return in {follow_up_days} days. Re-assess in {weeks} weeks.',
    is_default: true,
    sort_order: 2,
  },
  {
    name: 'Re-Exam Template',
    category: 're_exam',
    chief_complaint: null,
    subjective: 'Patient reports {improvement}% improvement since initial visit. Current pain level: {pain_score}/10 (was {initial_pain}/10). {new_complaints}. ADLs: {adl_status}.',
    objective: 'Re-examination findings: ROM {rom_comparison}. Palpation: {palpation}. Orthopedic re-test: {ortho_retest}. Functional outcome measures: {outcome_measures}.',
    assessment: 'Patient is {responding} to care. {progress_notes}. Updated diagnosis: {diagnosis}.',
    plan: '{continue_modify} current treatment plan. Adjust frequency to {new_frequency}. {additional_treatment}.',
    treated_areas: null,
    recommendations: 'Continue home exercises. {new_recommendations}.',
    follow_up: 'Next re-exam in {weeks} weeks or {visits} visits.',
    is_default: true,
    sort_order: 3,
  },
  {
    name: 'Maintenance Visit',
    category: 'maintenance',
    chief_complaint: 'Maintenance/wellness care',
    subjective: 'Patient presents for scheduled maintenance visit. Reports {status} since last visit. No new complaints / New complaint: {new_complaint}. Overall function: {function_level}.',
    objective: 'Spinal screening: {findings}. Palpation: {palpation}. ROM within functional limits / {rom_notes}.',
    assessment: 'Stable presentation. Maintenance care appropriate to prevent recurrence and maintain function. {additional_notes}.',
    plan: 'Adjustment to {segments} via {technique}. {modalities}.',
    treated_areas: null,
    recommendations: 'Continue current exercise program. {recommendations}.',
    follow_up: 'Return in {interval} for next maintenance visit.',
    is_default: true,
    sort_order: 4,
  },
  {
    name: 'Headache/Migraine',
    category: 'specific_complaint',
    chief_complaint: 'Headache / Migraine',
    subjective: 'Patient presents with {type} headaches rated {pain_score}/10. Frequency: {frequency}. Duration: {duration}. Location: {location}. Associated symptoms: {associated} (nausea, photophobia, phonophobia, aura). Triggers: {triggers}.',
    objective: 'Cervical ROM: {rom}. Upper cervical palpation: {uc_palpation}. Suboccipital tenderness: {suboccipital}. Cervicogenic headache provocation: {provocation}. TMJ assessment: {tmj}.',
    assessment: '{headache_type} headache with cervicogenic component. Subluxation at {segments}. Myofascial trigger points in {muscles}.',
    plan: 'Upper cervical adjustment {technique}. Suboccipital release. {modalities}. {additional}.',
    treated_areas: 'Upper cervical (C0-C3), suboccipital muscles',
    recommendations: 'Headache diary. Hydration. Stress management. Ergonomic assessment. {additional_recs}.',
    follow_up: 'Return in {days} days. Monitor headache frequency and intensity.',
    is_default: true,
    sort_order: 5,
  },
]

export default function SoapTemplatesPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<SoapTemplate[]>([])
  const [filterCategory, setFilterCategory] = useState('')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<SoapTemplate | null>(null)
  const [form, setForm] = useState({
    name: '',
    category: 'general',
    chief_complaint: '',
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    treated_areas: '',
    recommendations: '',
    follow_up: '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)
    await loadTemplates(user.id)
    setLoading(false)
  }

  async function loadTemplates(uid: string) {
    const { data } = await supabase
      .from('soap_templates')
      .select('*')
      .eq('practitioner_id', uid)
      .order('sort_order', { ascending: true })
    if (data) setTemplates(data)
  }

  async function seedDefaults() {
    if (!userId) return
    setSaving(true)
    const inserts = DEFAULT_TEMPLATES.map(t => ({
      ...t,
      practitioner_id: userId,
    }))
    const { error } = await supabase.from('soap_templates').insert(inserts)
    if (!error) {
      await loadTemplates(userId)
      setMsg('Default templates added!')
      setTimeout(() => setMsg(''), 2000)
    }
    setSaving(false)
  }

  function openCreate() {
    setEditingTemplate(null)
    setForm({
      name: '', category: 'general', chief_complaint: '', subjective: '', objective: '',
      assessment: '', plan: '', treated_areas: '', recommendations: '', follow_up: '',
    })
    setShowModal(true)
  }

  function openEdit(t: SoapTemplate) {
    setEditingTemplate(t)
    setForm({
      name: t.name,
      category: t.category,
      chief_complaint: t.chief_complaint || '',
      subjective: t.subjective || '',
      objective: t.objective || '',
      assessment: t.assessment || '',
      plan: t.plan || '',
      treated_areas: t.treated_areas || '',
      recommendations: t.recommendations || '',
      follow_up: t.follow_up || '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setMsg('Template name required.'); return }
    setSaving(true); setMsg('')

    if (editingTemplate) {
      const { error } = await supabase
        .from('soap_templates')
        .update({
          name: form.name.trim(),
          category: form.category,
          chief_complaint: form.chief_complaint.trim() || null,
          subjective: form.subjective.trim() || null,
          objective: form.objective.trim() || null,
          assessment: form.assessment.trim() || null,
          plan: form.plan.trim() || null,
          treated_areas: form.treated_areas.trim() || null,
          recommendations: form.recommendations.trim() || null,
          follow_up: form.follow_up.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingTemplate.id)

      if (error) { setMsg('Failed to update.'); setSaving(false); return }
      logAudit({ action: 'update', resourceType: 'soap_template', resourceId: editingTemplate.id })
    } else {
      const { data, error } = await supabase
        .from('soap_templates')
        .insert({
          practitioner_id: userId,
          name: form.name.trim(),
          category: form.category,
          chief_complaint: form.chief_complaint.trim() || null,
          subjective: form.subjective.trim() || null,
          objective: form.objective.trim() || null,
          assessment: form.assessment.trim() || null,
          plan: form.plan.trim() || null,
          treated_areas: form.treated_areas.trim() || null,
          recommendations: form.recommendations.trim() || null,
          follow_up: form.follow_up.trim() || null,
        })
        .select()
        .single()

      if (error) { setMsg('Failed to create.'); setSaving(false); return }
      if (data) logAudit({ action: 'create', resourceType: 'soap_template', resourceId: data.id })
    }

    await loadTemplates(userId)
    setShowModal(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return
    await supabase.from('soap_templates').delete().eq('id', id)
    logAudit({ action: 'delete', resourceType: 'soap_template', resourceId: id })
    await loadTemplates(userId)
  }

  const filtered = filterCategory
    ? templates.filter(t => t.category === filterCategory)
    : templates

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081120]">
        <p className="text-white/60 text-sm animate-pulse">Loading templates...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#081120] text-white">
      <div className="border-b border-[#1a3358] bg-[#0d1b30] px-4 py-6 md:px-8">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">SOAP Note Templates</h1>
            <p className="text-sm text-blue-300/70 mt-0.5">
              {templates.length} template{templates.length !== 1 ? 's' : ''} — One-click fill for visits
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/human/dashboard"
              className="rounded-xl border border-white/20 px-3 py-2 text-sm text-white/70 hover:bg-white/10 transition"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 space-y-6">
        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={openCreate}
            className="rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition"
          >
            + New Template
          </button>
          {templates.length === 0 && (
            <button
              onClick={seedDefaults}
              disabled={saving}
              className="rounded-xl border border-[#c9a227] px-4 py-2 text-sm font-semibold text-[#c9a227] hover:bg-[#c9a227]/10 transition disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Load Default Templates'}
            </button>
          )}
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="rounded-xl border border-[#1a3358] bg-[#081120] px-3 py-2 text-sm text-white outline-none"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {msg && <p className="text-sm text-green-400">{msg}</p>}

        {/* Template List */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-8 text-center">
            <p className="text-white/50">No templates yet. Create one or load defaults to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map(t => (
              <div key={t.id} className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-5 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-white">{t.name}</h3>
                    <span className="text-xs text-blue-300/70 uppercase">{categoryLabel(t.category)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(t)} className="text-xs text-[#c9a227] hover:underline">Edit</button>
                    <button onClick={() => handleDelete(t.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                  </div>
                </div>
                {t.chief_complaint && (
                  <p className="text-xs text-white/50">Chief Complaint: {t.chief_complaint}</p>
                )}
                {t.subjective && (
                  <p className="text-xs text-white/40 line-clamp-2">{t.subjective}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6 space-y-4">
            <h2 className="text-lg font-bold">{editingTemplate ? 'Edit Template' : 'New Template'}</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Template Name</label>
                <input className={inputClass} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Initial Exam — Low Back" />
              </div>
              <div>
                <label className={labelClass}>Category</label>
                <select className={inputClass} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Chief Complaint</label>
              <input className={inputClass} value={form.chief_complaint} onChange={e => setForm(f => ({ ...f, chief_complaint: e.target.value }))} placeholder="e.g., Low back pain" />
            </div>

            {(['subjective', 'objective', 'assessment', 'plan'] as const).map(field => (
              <div key={field}>
                <label className={labelClass}>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                <textarea
                  className={inputClass + ' min-h-[80px]'}
                  value={form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  placeholder={`Template text for ${field}. Use {placeholders} for variable fields.`}
                />
              </div>
            ))}

            <div>
              <label className={labelClass}>Treated Areas</label>
              <input className={inputClass} value={form.treated_areas} onChange={e => setForm(f => ({ ...f, treated_areas: e.target.value }))} placeholder="e.g., Cervical spine, thoracic spine" />
            </div>

            <div>
              <label className={labelClass}>Recommendations</label>
              <textarea className={inputClass + ' min-h-[60px]'} value={form.recommendations} onChange={e => setForm(f => ({ ...f, recommendations: e.target.value }))} placeholder="Home care instructions, exercises, etc." />
            </div>

            <div>
              <label className={labelClass}>Follow-up</label>
              <input className={inputClass} value={form.follow_up} onChange={e => setForm(f => ({ ...f, follow_up: e.target.value }))} placeholder="e.g., Return in 3 days" />
            </div>

            {msg && <p className="text-sm text-red-400">{msg}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-[#c9a227] px-6 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
