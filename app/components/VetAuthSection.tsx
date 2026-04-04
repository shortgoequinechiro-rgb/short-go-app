'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

type VetAuth = {
  id: string
  vet_name: string
  vet_license_number: string | null
  vet_practice_name: string | null
  vet_phone: string | null
  vet_email: string | null
  authorization_date: string
  expires_at: string
  status: string
  source: string
  vet_exam_confirmed: boolean
  vet_notes: string | null
  created_at: string
}

type Props = {
  horseId: string
  horseName: string
  onAuthStatusChange?: (hasValidAuth: boolean) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VetAuthSection({ horseId, horseName, onAuthStatusChange }: Props) {
  const [authorizations, setAuthorizations] = useState<VetAuth[]>([])
  const [hasValidAuth, setHasValidAuth] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showManualForm, setShowManualForm] = useState(false)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)

  // Manual form state
  const [vetName, setVetName] = useState('')
  const [vetLicense, setVetLicense] = useState('')
  const [vetPractice, setVetPractice] = useState('')
  const [vetPhone, setVetPhone] = useState('')
  const [vetEmail, setVetEmail] = useState('')
  const [vetNotes, setVetNotes] = useState('')

  // Request form state
  const [reqVetName, setReqVetName] = useState('')
  const [reqVetEmail, setReqVetEmail] = useState('')
  const [reqVetPhone, setReqVetPhone] = useState('')
  const [reqMethod, setReqMethod] = useState<'email' | 'sms'>('email')
  const [sending, setSending] = useState(false)

  async function loadAuths() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`/api/vet-auth?horse_id=${horseId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return

      const data = await res.json()
      setAuthorizations(data.authorizations || [])
      setHasValidAuth(data.hasValidAuth)
      onAuthStatusChange?.(data.hasValidAuth)
    } catch {
      // Silently handle — table might not exist yet
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAuths() }, [horseId])

  async function handleManualSave() {
    if (!vetName.trim()) { setMessage('Vet name is required.'); return }
    setSaving(true); setMessage('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMessage('Not authenticated.'); setSaving(false); return }

    const res = await fetch('/api/vet-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        horse_id: horseId,
        vet_name: vetName.trim(),
        vet_license_number: vetLicense.trim() || null,
        vet_practice_name: vetPractice.trim() || null,
        vet_phone: vetPhone.trim() || null,
        vet_email: vetEmail.trim() || null,
        vet_notes: vetNotes.trim() || null,
      }),
    })

    if (res.ok) {
      setMessage('Authorization saved!')
      setShowManualForm(false)
      setVetName(''); setVetLicense(''); setVetPractice(''); setVetPhone(''); setVetEmail(''); setVetNotes('')
      await loadAuths()
    } else {
      const data = await res.json().catch(() => ({}))
      setMessage(data.error || 'Failed to save.')
    }
    setSaving(false)
  }

  async function handleSendRequest() {
    if (!reqVetName.trim()) { setMessage('Vet name is required.'); return }
    if (reqMethod === 'email' && !reqVetEmail.trim()) { setMessage('Vet email is required.'); return }
    if (reqMethod === 'sms' && !reqVetPhone.trim()) { setMessage('Vet phone is required.'); return }

    setSending(true); setMessage('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMessage('Not authenticated.'); setSending(false); return }

    const res = await fetch('/api/vet-auth/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        horse_id: horseId,
        vet_name: reqVetName.trim(),
        vet_email: reqVetEmail.trim() || null,
        vet_phone: reqVetPhone.trim() || null,
        method: reqMethod,
      }),
    })

    if (res.ok) {
      setMessage(`Authorization request sent via ${reqMethod}!`)
      setShowRequestForm(false)
      setReqVetName(''); setReqVetEmail(''); setReqVetPhone('')
    } else {
      const data = await res.json().catch(() => ({}))
      setMessage(data.error || 'Failed to send request.')
    }
    setSending(false)
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this authorization?')) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    await fetch(`/api/vet-auth?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    await loadAuths()
  }

  function copyAuthLink() {
    const url = `${window.location.origin}/authorize/${horseId}`
    navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const activeAuths = authorizations.filter(a => a.status === 'active')
  const expiredAuths = authorizations.filter(a => a.status !== 'active')

  // Days until the nearest active auth expires
  const daysUntilExpiry = activeAuths.length > 0
    ? Math.ceil((new Date(activeAuths[0].expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  if (loading) return null

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
          <span className="text-lg">🩺</span> Vet Authorization
        </h2>
        <div className="flex gap-2">
          <button
            onClick={copyAuthLink}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 transition"
          >
            {linkCopied ? '✓ Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* Status banner */}
      {hasValidAuth ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                Valid Authorization
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Dr. {activeAuths[0]?.vet_name}
                {activeAuths[0]?.vet_practice_name && ` · ${activeAuths[0].vet_practice_name}`}
              </p>
              <p className="text-xs text-emerald-500 mt-0.5">
                Expires {new Date(activeAuths[0]?.expires_at).toLocaleDateString()}
                {daysUntilExpiry !== null && daysUntilExpiry <= 30 && (
                  <span className="text-amber-600 font-semibold"> · Expiring soon!</span>
                )}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-700">No Valid Authorization</p>
          <p className="text-xs text-amber-600 mt-0.5">
            Texas law requires veterinary authorization before providing chiropractic care.
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            const opening = !showManualForm
            setShowManualForm(opening)
            setShowRequestForm(false)
            setMessage('')
            if (opening) {
              const lastAuth = authorizations[0]
              if (lastAuth) {
                setVetName(lastAuth.vet_name || '')
                setVetLicense(lastAuth.vet_license_number || '')
                setVetPractice(lastAuth.vet_practice_name || '')
                setVetPhone(lastAuth.vet_phone || '')
                setVetEmail(lastAuth.vet_email || '')
              }
            }
          }}
          className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
        >
          {showManualForm ? 'Cancel' : '+ Add Manually'}
        </button>
        <button
          onClick={() => {
            const opening = !showRequestForm
            setShowRequestForm(opening)
            setShowManualForm(false)
            setMessage('')
            // Pre-fill from most recent vet auth (active first, then expired)
            if (opening) {
              const lastAuth = authorizations[0]
              if (lastAuth) {
                setReqVetName(lastAuth.vet_name || '')
                setReqVetEmail(lastAuth.vet_email || '')
                setReqVetPhone(lastAuth.vet_phone || '')
              }
            }
          }}
          className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 transition"
        >
          {showRequestForm ? 'Cancel' : 'Request from Vet'}
        </button>
      </div>

      {/* Manual entry form */}
      {showManualForm && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">Enter Vet Authorization Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Vet Name *</label>
              <input value={vetName} onChange={e => setVetName(e.target.value)} placeholder="Dr. Jane Smith, DVM"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500">License #</label>
              <input value={vetLicense} onChange={e => setVetLicense(e.target.value)} placeholder="TX-12345"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Practice</label>
              <input value={vetPractice} onChange={e => setVetPractice(e.target.value)} placeholder="Hill Country Vet"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Phone</label>
              <input value={vetPhone} onChange={e => setVetPhone(e.target.value)} placeholder="(512) 555-0123"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500">Email</label>
              <input value={vetEmail} onChange={e => setVetEmail(e.target.value)} placeholder="vet@clinic.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500">Notes</label>
              <input value={vetNotes} onChange={e => setVetNotes(e.target.value)} placeholder="Cleared for chiro, no contraindications"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <button onClick={handleManualSave} disabled={saving}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
            {saving ? 'Saving...' : 'Save Authorization'}
          </button>
        </div>
      )}

      {/* Request from vet form */}
      {showRequestForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-700">Send Authorization Request to Vet</p>
          <p className="text-xs text-blue-600">The vet will receive a link to a simple form where they can authorize treatment for {horseName}.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-slate-500">Vet Name *</label>
              <input value={reqVetName} onChange={e => setReqVetName(e.target.value)} placeholder="Dr. Jane Smith"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Send via</label>
              <select value={reqMethod} onChange={e => setReqMethod(e.target.value as 'email' | 'sms')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="email">Email</option>
                <option value="sms">SMS/Text</option>
              </select>
            </div>
            {reqMethod === 'email' ? (
              <div>
                <label className="text-xs text-slate-500">Vet Email *</label>
                <input value={reqVetEmail} onChange={e => setReqVetEmail(e.target.value)} placeholder="vet@clinic.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
            ) : (
              <div>
                <label className="text-xs text-slate-500">Vet Phone *</label>
                <input value={reqVetPhone} onChange={e => setReqVetPhone(e.target.value)} placeholder="(512) 555-0123"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
            )}
          </div>
          <button onClick={handleSendRequest} disabled={sending}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
            {sending ? 'Sending...' : `Send via ${reqMethod === 'email' ? 'Email' : 'Text'}`}
          </button>
        </div>
      )}

      {/* Message */}
      {message && (
        <p className={`text-sm ${message.includes('Error') || message.includes('Failed') || message.includes('required') ? 'text-red-500' : 'text-emerald-600'}`}>
          {message}
        </p>
      )}

      {/* Auth history */}
      {activeAuths.length > 0 && (
        <div className="space-y-2">
          {activeAuths.map(auth => (
            <div key={auth.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-slate-800">Dr. {auth.vet_name}</p>
                <p className="text-xs text-slate-500">
                  {auth.source === 'digital_form' ? 'Digital form' : auth.source === 'upload' ? 'Uploaded' : 'Manual entry'}
                  {' · '}Authorized {new Date(auth.authorization_date).toLocaleDateString()}
                  {' · '}Expires {new Date(auth.expires_at).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => handleRevoke(auth.id)}
                className="rounded-lg border border-red-100 px-2.5 py-1 text-xs text-red-400 hover:bg-red-50 transition">
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {expiredAuths.length > 0 && (
        <details className="text-xs">
          <summary className="text-slate-400 cursor-pointer">Past authorizations ({expiredAuths.length})</summary>
          <div className="mt-2 space-y-1">
            {expiredAuths.map(auth => (
              <div key={auth.id} className="rounded-lg bg-slate-50 px-3 py-2 text-slate-400">
                Dr. {auth.vet_name} · {auth.status} · {new Date(auth.authorization_date).toLocaleDateString()}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
