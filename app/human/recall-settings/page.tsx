'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'

type RecallSettings = {
  id: string
  recall_enabled: boolean
  inactive_days: number
  reminder_method: string
  message_template: string
  follow_up_days: number[]
}

type RecallMessage = {
  id: string
  patient_id: string
  method: string
  message_text: string | null
  sent_at: string
  status: string
  days_inactive: number | null
  follow_up_number: number
  human_patients?: { first_name: string; last_name: string } | null
}

type InactivePatient = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  last_visit_date: string
  days_inactive: number
}

export default function RecallSettingsPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)

  const [settings, setSettings] = useState<RecallSettings | null>(null)
  const [recentMessages, setRecentMessages] = useState<RecallMessage[]>([])
  const [inactivePatients, setInactivePatients] = useState<InactivePatient[]>([])

  // Settings form
  const [enabled, setEnabled] = useState(true)
  const [inactiveDays, setInactiveDays] = useState(30)
  const [method, setMethod] = useState('email')
  const [messageTemplate, setMessageTemplate] = useState(
    "Hi {first_name}, we noticed it's been a while since your last visit. We'd love to help you stay on track with your care. Call us or book online to schedule your next appointment!"
  )
  const [followUpDays, setFollowUpDays] = useState('7,14,30')

  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    // Load settings
    const { data: s } = await supabase
      .from('recall_settings')
      .select('*')
      .eq('practitioner_id', user.id)
      .single()

    if (s) {
      setSettings(s)
      setEnabled(s.recall_enabled)
      setInactiveDays(s.inactive_days)
      setMethod(s.reminder_method)
      setMessageTemplate(s.message_template || '')
      setFollowUpDays((s.follow_up_days || [7, 14, 30]).join(','))
    }

    // Load recent messages
    const { data: msgs } = await supabase
      .from('recall_messages')
      .select('*, human_patients(first_name, last_name)')
      .eq('practitioner_id', user.id)
      .order('sent_at', { ascending: false })
      .limit(20)
    if (msgs) setRecentMessages(msgs as unknown as RecallMessage[])

    // Find inactive patients
    await findInactivePatients(user.id, s?.inactive_days || 30)
    setLoading(false)
  }

  async function findInactivePatients(uid: string, days: number) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    // Get all patients with their latest visit
    const { data: patients } = await supabase
      .from('human_patients')
      .select('id, first_name, last_name, email, phone')
      .eq('practitioner_id', uid)
      .eq('archived', false)

    if (!patients || patients.length === 0) return

    const { data: visits } = await supabase
      .from('human_visits')
      .select('patient_id, visit_date')
      .eq('practitioner_id', uid)
      .order('visit_date', { ascending: false })

    if (!visits) return

    const latestVisitMap = new Map<string, string>()
    for (const v of visits) {
      if (!latestVisitMap.has(v.patient_id)) {
        latestVisitMap.set(v.patient_id, v.visit_date)
      }
    }

    const inactive: InactivePatient[] = []
    const now = new Date()
    for (const p of patients) {
      const lastVisit = latestVisitMap.get(p.id)
      if (!lastVisit) continue // no visits at all — could also be considered inactive
      const visitDate = new Date(lastVisit)
      const daysSince = Math.floor((now.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24))
      if (daysSince >= days) {
        inactive.push({
          ...p,
          last_visit_date: lastVisit,
          days_inactive: daysSince,
        })
      }
    }

    inactive.sort((a, b) => b.days_inactive - a.days_inactive)
    setInactivePatients(inactive)
  }

  async function handleSaveSettings() {
    setSaving(true); setMsg('')

    const parsed = followUpDays.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d) && d > 0)

    const payload = {
      practitioner_id: userId,
      recall_enabled: enabled,
      inactive_days: inactiveDays,
      reminder_method: method,
      message_template: messageTemplate,
      follow_up_days: parsed,
      updated_at: new Date().toISOString(),
    }

    if (settings) {
      const { error } = await supabase
        .from('recall_settings')
        .update(payload)
        .eq('id', settings.id)
      if (error) { setMsg('Failed to save.'); setSaving(false); return }
    } else {
      const { data, error } = await supabase
        .from('recall_settings')
        .insert(payload)
        .select()
        .single()
      if (error) { setMsg('Failed to save.'); setSaving(false); return }
      if (data) setSettings(data)
    }

    setMsg('Settings saved!')
    setSaving(false)
    setTimeout(() => setMsg(''), 2000)
  }

  async function triggerRecallNow() {
    if (inactivePatients.length === 0) return
    setSending(true)

    try {
      const res = await fetch('/api/recall/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practitionerId: userId }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg(`Recall sent to ${data.sent || 0} patient(s)!`)
        // Reload messages
        const { data: msgs } = await supabase
          .from('recall_messages')
          .select('*, human_patients(first_name, last_name)')
          .eq('practitioner_id', userId)
          .order('sent_at', { ascending: false })
          .limit(20)
        if (msgs) setRecentMessages(msgs as unknown as RecallMessage[])
      } else {
        setMsg(data.error || 'Failed to send')
      }
    } catch {
      setMsg('Network error')
    }

    setSending(false)
    setTimeout(() => setMsg(''), 3000)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081120]">
        <p className="text-white/60 text-sm animate-pulse">Loading recall settings...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#081120] text-white">
      <div className="border-b border-[#1a3358] bg-[#0d1b30] px-4 py-6 md:px-8">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">Patient Recall & Reactivation</h1>
            <p className="text-sm text-blue-300/70 mt-0.5">
              Automatically reach out to inactive patients
            </p>
          </div>
          <Link href="/human/dashboard" className="rounded-xl border border-white/20 px-3 py-2 text-sm text-white/70 hover:bg-white/10 transition">
            Dashboard
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 space-y-6">
        {/* Settings */}
        <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6 space-y-4">
          <h2 className="text-lg font-semibold">Recall Settings</h2>

          <div className="flex items-center gap-3">
            <label className="text-sm text-white/70">Recall Enabled</label>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`w-12 h-6 rounded-full transition ${enabled ? 'bg-[#c9a227]' : 'bg-white/20'} relative`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${enabled ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">
                Inactive After (days)
              </label>
              <input
                type="number"
                value={inactiveDays}
                onChange={e => setInactiveDays(parseInt(e.target.value) || 30)}
                className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white outline-none focus:border-[#c9a227]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">
                Method
              </label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value)}
                className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white outline-none focus:border-[#c9a227]"
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">
                Follow-up Days (comma-separated)
              </label>
              <input
                value={followUpDays}
                onChange={e => setFollowUpDays(e.target.value)}
                className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white outline-none focus:border-[#c9a227]"
                placeholder="7,14,30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">
              Message Template
            </label>
            <textarea
              value={messageTemplate}
              onChange={e => setMessageTemplate(e.target.value)}
              className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227] min-h-[80px]"
              placeholder="Use {first_name} for patient's first name"
            />
            <p className="text-xs text-white/40 mt-1">Available variables: {'{first_name}'}, {'{last_name}'}, {'{days_inactive}'}, {'{practice_name}'}</p>
          </div>

          {msg && <p className={`text-sm ${msg.includes('Failed') || msg.includes('error') ? 'text-red-400' : 'text-green-400'}`}>{msg}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="rounded-xl bg-[#c9a227] px-6 py-2.5 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Inactive Patients */}
        <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Inactive Patients <span className="text-sm text-white/50 font-normal">({inactivePatients.length})</span>
            </h2>
            {inactivePatients.length > 0 && (
              <button
                onClick={triggerRecallNow}
                disabled={sending}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50"
              >
                {sending ? 'Sending...' : `Send Recall to All (${inactivePatients.length})`}
              </button>
            )}
          </div>

          {inactivePatients.length === 0 ? (
            <p className="text-white/50 text-sm">No inactive patients found. All patients are up to date!</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {inactivePatients.map(p => (
                <div key={p.id} className="flex items-center justify-between rounded-xl bg-[#081120] border border-[#1a3358] px-4 py-3">
                  <div>
                    <span className="text-sm font-medium">{p.first_name} {p.last_name}</span>
                    <span className="text-xs text-white/40 ml-2">Last visit: {p.last_visit_date}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${p.days_inactive > 60 ? 'text-red-400' : p.days_inactive > 30 ? 'text-yellow-400' : 'text-white/70'}`}>
                      {p.days_inactive}d inactive
                    </span>
                    {p.email && <span className="text-xs text-blue-300/50">Email</span>}
                    {p.phone && <span className="text-xs text-green-300/50">SMS</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Messages */}
        {recentMessages.length > 0 && (
          <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Recall Messages</h2>
            <div className="space-y-2">
              {recentMessages.map(m => (
                <div key={m.id} className="flex items-center justify-between rounded-xl bg-[#081120] border border-[#1a3358] px-4 py-3">
                  <div>
                    <span className="text-sm">
                      {m.human_patients ? `${m.human_patients.first_name} ${m.human_patients.last_name}` : 'Unknown'}
                    </span>
                    <span className="text-xs text-white/40 ml-2">via {m.method}</span>
                    <span className="text-xs text-white/40 ml-2">{new Date(m.sent_at).toLocaleDateString()}</span>
                  </div>
                  <span className={`text-xs font-semibold ${m.status === 'sent' ? 'text-blue-300' : m.status === 'delivered' ? 'text-green-400' : m.status === 'responded' ? 'text-[#c9a227]' : 'text-red-400'}`}>
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
