'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'

type ReferralSource = {
  id: string
  name: string
  category: string
  is_active: boolean
  patient_count: number
}

type PatientReferral = {
  id: string
  first_name: string
  last_name: string
  referral_source: string | null
  referral_details: string | null
  created_at: string
}

const CATEGORIES = [
  { value: 'google', label: 'Google' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'referral', label: 'Patient Referral' },
  { value: 'insurance_directory', label: 'Insurance Directory' },
  { value: 'walk_in', label: 'Walk-In' },
  { value: 'website', label: 'Website' },
  { value: 'event', label: 'Event / Community' },
  { value: 'other', label: 'Other' },
]

const categoryLabel = (c: string) => CATEGORIES.find(x => x.value === c)?.label || c

const catColors: Record<string, string> = {
  google: '#4285f4',
  social_media: '#e1306c',
  referral: '#c9a227',
  insurance_directory: '#34a853',
  walk_in: '#ff9800',
  website: '#00bcd4',
  event: '#9c27b0',
  other: '#607d8b',
}

const inputClass = 'w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227] transition'
const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5'

export default function ReferralSourcesPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [sources, setSources] = useState<ReferralSource[]>([])
  const [patients, setPatients] = useState<PatientReferral[]>([])

  // Add source modal
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addCategory, setAddCategory] = useState('other')
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

    const [sRes, pRes] = await Promise.all([
      supabase.from('referral_sources').select('*').eq('practitioner_id', user.id).order('patient_count', { ascending: false }),
      supabase.from('human_patients').select('id, first_name, last_name, referral_source, referral_details, created_at').eq('practitioner_id', user.id).eq('archived', false).order('created_at', { ascending: false }),
    ])

    if (sRes.data) setSources(sRes.data)
    if (pRes.data) setPatients(pRes.data)

    // Compute actual counts from patients
    if (sRes.data && pRes.data) {
      const counts = new Map<string, number>()
      for (const p of pRes.data) {
        if (p.referral_source) {
          counts.set(p.referral_source, (counts.get(p.referral_source) || 0) + 1)
        }
      }
      // Update source counts if they differ
      for (const s of sRes.data) {
        const actual = counts.get(s.name) || 0
        if (actual !== s.patient_count) {
          await supabase.from('referral_sources').update({ patient_count: actual }).eq('id', s.id)
        }
      }
    }

    setLoading(false)
  }

  async function handleAddSource() {
    if (!addName.trim()) { setMsg('Name required.'); return }
    setSaving(true)
    const { data, error } = await supabase.from('referral_sources').insert({
      practitioner_id: userId,
      name: addName.trim(),
      category: addCategory,
    }).select().single()

    setSaving(false)
    if (error) { setMsg('Failed to add.'); return }
    if (data) {
      setSources(prev => [...prev, data])
      logAudit({ action: 'create', resourceType: 'human_patient', resourceId: data.id, details: { type: 'referral_source' } })
    }
    setShowAdd(false)
    setAddName('')
  }

  async function deleteSource(id: string) {
    if (!confirm('Delete this referral source?')) return
    await supabase.from('referral_sources').delete().eq('id', id)
    setSources(prev => prev.filter(s => s.id !== id))
  }

  // Build chart data
  const totalWithSource = patients.filter(p => p.referral_source).length
  const sourceCounts = new Map<string, number>()
  for (const p of patients) {
    if (p.referral_source) {
      sourceCounts.set(p.referral_source, (sourceCounts.get(p.referral_source) || 0) + 1)
    }
  }
  const chartData = Array.from(sourceCounts.entries())
    .map(([name, count]) => ({ name, count, pct: totalWithSource > 0 ? Math.round((count / totalWithSource) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081120]">
        <p className="text-white/60 text-sm animate-pulse">Loading referral data...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#081120] text-white">
      <div className="border-b border-[#1a3358] bg-[#0d1b30] px-4 py-6 md:px-8">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">Referral Sources</h1>
            <p className="text-sm text-blue-300/70 mt-0.5">
              {totalWithSource} of {patients.length} patients have a referral source tracked
            </p>
          </div>
          <Link href="/human/dashboard" className="rounded-xl border border-white/20 px-3 py-2 text-sm text-white/70 hover:bg-white/10 transition">Dashboard</Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 space-y-6">
        <button onClick={() => setShowAdd(true)} className="rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition">+ Add Source</button>

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6">
            <h2 className="text-lg font-semibold mb-4">Where Your Patients Come From</h2>
            <div className="space-y-3">
              {chartData.map(d => {
                const source = sources.find(s => s.name === d.name)
                const color = source ? catColors[source.category] || '#607d8b' : '#607d8b'
                return (
                  <div key={d.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white/80">{d.name}</span>
                      <span className="text-sm font-bold">{d.count} ({d.pct}%)</span>
                    </div>
                    <div className="w-full h-4 bg-[#081120] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${d.pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Sources List */}
        <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6">
          <h2 className="text-lg font-semibold mb-3">Configured Sources</h2>
          {sources.length === 0 ? (
            <p className="text-white/50 text-sm">No referral sources configured. Add some to start tracking.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {sources.map(s => (
                <div key={s.id} className="flex items-center justify-between rounded-xl bg-[#081120] border border-[#1a3358] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: catColors[s.category] || '#607d8b' }} />
                    <div>
                      <span className="text-sm font-medium">{s.name}</span>
                      <span className="text-xs text-white/40 ml-2">{categoryLabel(s.category)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-[#c9a227]">{s.patient_count}</span>
                    <button onClick={() => deleteSource(s.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent patients with referral */}
        {patients.filter(p => p.referral_source).length > 0 && (
          <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6">
            <h2 className="text-lg font-semibold mb-3">Recent Patients by Referral</h2>
            <div className="space-y-2">
              {patients.filter(p => p.referral_source).slice(0, 15).map(p => (
                <div key={p.id} className="flex items-center justify-between rounded-xl bg-[#081120] border border-[#1a3358] px-4 py-2">
                  <div>
                    <span className="text-sm">{p.first_name} {p.last_name}</span>
                    <span className="text-xs text-white/40 ml-2">{new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-xs text-[#c9a227]">{p.referral_source}</span>
                    {p.referral_details && <span className="text-xs text-white/30 ml-1">({p.referral_details})</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Source Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6 space-y-4">
            <h2 className="text-lg font-bold">Add Referral Source</h2>
            <div>
              <label className={labelClass}>Name</label>
              <input value={addName} onChange={e => setAddName(e.target.value)} className={inputClass} placeholder="e.g., Google Ads, Dr. Smith Referral" />
            </div>
            <div>
              <label className={labelClass}>Category</label>
              <select value={addCategory} onChange={e => setAddCategory(e.target.value)} className={inputClass}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            {msg && <p className="text-sm text-red-400">{msg}</p>}
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10">Cancel</button>
              <button onClick={handleAddSource} disabled={saving} className="rounded-xl bg-[#c9a227] px-6 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] disabled:opacity-50">
                {saving ? 'Adding...' : 'Add Source'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
