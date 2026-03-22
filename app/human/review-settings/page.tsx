'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'

type ReviewSettings = {
  id: string
  enabled: boolean
  google_review_url: string | null
  delay_hours: number
  min_visits_before_ask: number
  send_method: string
  message_template: string
  cooldown_days: number
}

type ReviewRequest = {
  id: string
  patient_id: string
  visit_id: string | null
  method: string
  sent_at: string
  status: string
  human_patients?: { first_name: string; last_name: string } | null
}

type EligiblePatient = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  total_visits: number
  last_visit_date: string
}

export default function ReviewSettingsPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)

  const [settings, setSettings] = useState<ReviewSettings | null>(null)
  const [recentRequests, setRecentRequests] = useState<ReviewRequest[]>([])
  const [eligiblePatients, setEligiblePatients] = useState<EligiblePatient[]>([])

  // Form
  const [enabled, setEnabled] = useState(true)
  const [googleUrl, setGoogleUrl] = useState('')
  const [delayHours, setDelayHours] = useState(2)
  const [minVisits, setMinVisits] = useState(2)
  const [sendMethod, setSendMethod] = useState('email')
  const [messageTemplate, setMessageTemplate] = useState(
    "Hi {first_name}, thank you for choosing our practice! If you had a great experience, we'd really appreciate a Google review. It helps others find quality care. {review_link}"
  )
  const [cooldownDays, setCooldownDays] = useState(90)

  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

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
      .from('review_request_settings')
      .select('*')
      .eq('practitioner_id', user.id)
      .single()

    if (s) {
      setSettings(s)
      setEnabled(s.enabled)
      setGoogleUrl(s.google_review_url || '')
      setDelayHours(s.delay_hours)
      setMinVisits(s.min_visits_before_ask)
      setSendMethod(s.send_method)
      setMessageTemplate(s.message_template || '')
      setCooldownDays(s.cooldown_days)
    }

    // Load recent requests
    const { data: reqs } = await supabase
      .from('review_requests')
      .select('*, human_patients(first_name, last_name)')
      .eq('practitioner_id', user.id)
      .order('sent_at', { ascending: false })
      .limit(20)
    if (reqs) setRecentRequests(reqs as unknown as ReviewRequest[])

    // Find eligible patients
    await findEligiblePatients(user.id, s?.min_visits_before_ask || 2, s?.cooldown_days || 90)
    setLoading(false)
  }

  async function findEligiblePatients(uid: string, minV: number, cooldown: number) {
    // Get patients with visit counts
    const { data: patients } = await supabase
      .from('human_patients')
      .select('id, first_name, last_name, email, phone')
      .eq('practitioner_id', uid)
      .eq('archived', false)

    if (!patients) return

    const { data: visits } = await supabase
      .from('human_visits')
      .select('patient_id, visit_date')
      .eq('practitioner_id', uid)
      .order('visit_date', { ascending: false })

    if (!visits) return

    // Count visits per patient and get latest date
    const visitCounts = new Map<string, number>()
    const latestVisit = new Map<string, string>()
    for (const v of visits) {
      visitCounts.set(v.patient_id, (visitCounts.get(v.patient_id) || 0) + 1)
      if (!latestVisit.has(v.patient_id)) {
        latestVisit.set(v.patient_id, v.visit_date)
      }
    }

    // Check cooldown
    const cooldownCutoff = new Date()
    cooldownCutoff.setDate(cooldownCutoff.getDate() - cooldown)

    const { data: recentReqs } = await supabase
      .from('review_requests')
      .select('patient_id')
      .eq('practitioner_id', uid)
      .gte('sent_at', cooldownCutoff.toISOString())

    const recentlyAsked = new Set(recentReqs?.map(r => r.patient_id) || [])

    const eligible: EligiblePatient[] = []
    for (const p of patients) {
      const count = visitCounts.get(p.id) || 0
      const last = latestVisit.get(p.id)
      if (count >= minV && last && !recentlyAsked.has(p.id) && (p.email || p.phone)) {
        eligible.push({
          ...p,
          total_visits: count,
          last_visit_date: last,
        })
      }
    }

    eligible.sort((a, b) => b.total_visits - a.total_visits)
    setEligiblePatients(eligible)
  }

  async function handleSaveSettings() {
    setSaving(true); setMsg('')

    const payload = {
      practitioner_id: userId,
      enabled,
      google_review_url: googleUrl.trim() || null,
      delay_hours: delayHours,
      min_visits_before_ask: minVisits,
      send_method: sendMethod,
      message_template: messageTemplate,
      cooldown_days: cooldownDays,
      updated_at: new Date().toISOString(),
    }

    if (settings) {
      const { error } = await supabase
        .from('review_request_settings')
        .update(payload)
        .eq('id', settings.id)
      if (error) { setMsg('Failed to save.'); setSaving(false); return }
    } else {
      const { data, error } = await supabase
        .from('review_request_settings')
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

  async function sendReviewRequests() {
    if (!googleUrl.trim()) {
      setMsg('Please set your Google Review URL first.')
      return
    }
    if (eligiblePatients.length === 0) return
    setSending(true)

    try {
      const res = await fetch('/api/review-requests/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practitionerId: userId }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg(`Review requests sent to ${data.sent || 0} patient(s)!`)
        logAudit({ action: 'send', resourceType: 'review_request' })
        // Reload
        const { data: reqs } = await supabase
          .from('review_requests')
          .select('*, human_patients(first_name, last_name)')
          .eq('practitioner_id', userId)
          .order('sent_at', { ascending: false })
          .limit(20)
        if (reqs) setRecentRequests(reqs as unknown as ReviewRequest[])
        await findEligiblePatients(userId, minVisits, cooldownDays)
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
        <p className="text-white/60 text-sm animate-pulse">Loading review settings...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#081120] text-white">
      <div className="border-b border-[#1a3358] bg-[#0d1b30] px-4 py-6 md:px-8">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">Google Review Requests</h1>
            <p className="text-sm text-blue-300/70 mt-0.5">
              Grow your online reputation with post-visit review prompts
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
          <h2 className="text-lg font-semibold">Review Request Settings</h2>

          <div className="flex items-center gap-3">
            <label className="text-sm text-white/70">Enabled</label>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`w-12 h-6 rounded-full transition ${enabled ? 'bg-[#c9a227]' : 'bg-white/20'} relative`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${enabled ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">
              Google Review URL
            </label>
            <input
              value={googleUrl}
              onChange={e => setGoogleUrl(e.target.value)}
              className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227]"
              placeholder="https://g.page/r/YOUR-BUSINESS-ID/review"
            />
            <p className="text-xs text-white/40 mt-1">
              Find this in Google Business Profile → Share review form
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">
                Delay (hours after visit)
              </label>
              <input
                type="number"
                value={delayHours}
                onChange={e => setDelayHours(parseInt(e.target.value) || 2)}
                className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white outline-none focus:border-[#c9a227]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">
                Min Visits Before Asking
              </label>
              <input
                type="number"
                value={minVisits}
                onChange={e => setMinVisits(parseInt(e.target.value) || 2)}
                className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white outline-none focus:border-[#c9a227]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">
                Method
              </label>
              <select
                value={sendMethod}
                onChange={e => setSendMethod(e.target.value)}
                className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white outline-none focus:border-[#c9a227]"
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">
                Cooldown (days)
              </label>
              <input
                type="number"
                value={cooldownDays}
                onChange={e => setCooldownDays(parseInt(e.target.value) || 90)}
                className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white outline-none focus:border-[#c9a227]"
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
            />
            <p className="text-xs text-white/40 mt-1">Variables: {'{first_name}'}, {'{last_name}'}, {'{practice_name}'}, {'{review_link}'}</p>
          </div>

          {msg && <p className={`text-sm ${msg.includes('Failed') || msg.includes('error') || msg.includes('Please') ? 'text-red-400' : 'text-green-400'}`}>{msg}</p>}

          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="rounded-xl bg-[#c9a227] px-6 py-2.5 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* Eligible Patients */}
        <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Eligible for Review Request <span className="text-sm text-white/50 font-normal">({eligiblePatients.length})</span>
            </h2>
            {eligiblePatients.length > 0 && (
              <button
                onClick={sendReviewRequests}
                disabled={sending || !googleUrl.trim()}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50"
              >
                {sending ? 'Sending...' : `Send to All (${eligiblePatients.length})`}
              </button>
            )}
          </div>

          {eligiblePatients.length === 0 ? (
            <p className="text-white/50 text-sm">No patients eligible right now. Patients need at least {minVisits} visits and haven&apos;t been asked in the last {cooldownDays} days.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {eligiblePatients.map(p => (
                <div key={p.id} className="flex items-center justify-between rounded-xl bg-[#081120] border border-[#1a3358] px-4 py-3">
                  <div>
                    <span className="text-sm font-medium">{p.first_name} {p.last_name}</span>
                    <span className="text-xs text-white/40 ml-2">{p.total_visits} visits</span>
                    <span className="text-xs text-white/40 ml-2">Last: {p.last_visit_date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.email && <span className="text-xs text-blue-300/50">Email</span>}
                    {p.phone && <span className="text-xs text-green-300/50">SMS</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Requests */}
        {recentRequests.length > 0 && (
          <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Review Requests</h2>
            <div className="space-y-2">
              {recentRequests.map(r => (
                <div key={r.id} className="flex items-center justify-between rounded-xl bg-[#081120] border border-[#1a3358] px-4 py-3">
                  <div>
                    <span className="text-sm">
                      {r.human_patients ? `${r.human_patients.first_name} ${r.human_patients.last_name}` : 'Unknown'}
                    </span>
                    <span className="text-xs text-white/40 ml-2">via {r.method}</span>
                    <span className="text-xs text-white/40 ml-2">{new Date(r.sent_at).toLocaleDateString()}</span>
                  </div>
                  <span className={`text-xs font-semibold ${r.status === 'clicked' ? 'text-[#c9a227]' : r.status === 'reviewed' ? 'text-green-400' : r.status === 'sent' ? 'text-blue-300' : 'text-red-400'}`}>
                    {r.status}
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
