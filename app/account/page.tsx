'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser'

// ── Types ─────────────────────────────────────────────────────────────────────

type Practitioner = {
  id: string
  email: string | null
  full_name: string | null
  practice_name: string | null
  animals_served: string | null
  location: string | null
  logo_url: string | null
  subscription_status: string
  trial_ends_at: string | null
  stripe_customer_id: string | null
}

type Tab = 'profile' | 'security' | 'billing' | 'reminders'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTrialDaysLeft(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0
  const end = new Date(trialEndsAt)
  const now = new Date()
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:     'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    trialing:   'bg-blue-500/20 text-blue-300 border border-blue-500/40',
    past_due:   'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    canceled:   'bg-red-500/20 text-red-300 border border-red-500/40',
    incomplete: 'bg-slate-500/20 text-slate-300 border border-slate-500/40',
  }
  const labels: Record<string, string> = {
    active:     'Active',
    trialing:   'Free Trial',
    past_due:   'Past Due',
    canceled:   'Canceled',
    incomplete: 'Incomplete',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${styles[status] ?? 'bg-slate-500/20 text-slate-300'}`}>
      {labels[status] ?? status}
    </span>
  )
}

// ── Profile Tab ───────────────────────────────────────────────────────────────

function ProfileTab({ practitioner, onSaved }: { practitioner: Practitioner; onSaved: (p: Practitioner) => void }) {
  const [fullName,      setFullName]      = useState(practitioner.full_name ?? '')
  const [practiceName,  setPracticeName]  = useState(practitioner.practice_name ?? '')
  const [animalsServed, setAnimalsServed] = useState(practitioner.animals_served ?? 'both')
  const [location,      setLocation]      = useState(practitioner.location ?? '')
  const [logoUrl,       setLogoUrl]       = useState(practitioner.logo_url ?? '')
  const [logoUploading, setLogoUploading] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState('')

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Not authenticated.'); setLogoUploading(false); return }
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload-logo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: formData,
    })
    const data = await res.json()
    if (res.ok) {
      setLogoUrl(data.logo_url)
      onSaved({ ...practitioner, logo_url: data.logo_url })
    } else {
      console.error('Logo upload failed:', res.status, data)
      setError(data.error || 'Failed to upload logo. Please try again.')
    }
    setLogoUploading(false)
  }

  async function handleLogoRemove() {
    setLogoUploading(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Not authenticated.'); setLogoUploading(false); return }
    const res = await fetch('/api/upload-logo', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (res.ok) {
      setLogoUrl('')
      onSaved({ ...practitioner, logo_url: null })
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Failed to remove logo.')
    }
    setLogoUploading(false)
  }

  const isDirty =
    fullName      !== (practitioner.full_name      ?? '') ||
    practiceName  !== (practitioner.practice_name  ?? '') ||
    animalsServed !== (practitioner.animals_served  ?? 'both') ||
    location      !== (practitioner.location        ?? '')

  async function handleSave() {
    if (!practiceName.trim()) { setError('Practice name is required.'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase
      .from('practitioners')
      .update({
        full_name:      fullName.trim() || null,
        practice_name:  practiceName.trim(),
        animals_served: animalsServed,
        location:       location.trim() || null,
      })
      .eq('id', practitioner.id)
    setSaving(false)
    if (err) { setError('Failed to save. Please try again.'); return }
    setSaved(true)
    onSaved({ ...practitioner, full_name: fullName.trim() || null, practice_name: practiceName.trim(), animals_served: animalsServed, location: location.trim() || null })
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">Practice Profile</h2>
        <p className="text-sm text-blue-300 mt-0.5">Update your practice info shown throughout the app.</p>
      </div>

      {/* Practice Logo */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-3">
          Practice Logo
        </label>
        <div className="flex items-center gap-5">
          <label
            htmlFor="logo-upload-settings"
            className={`group flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border transition hover:border-[#c9a227] overflow-hidden shrink-0 ${logoUrl ? 'border-[#c9a227]/30 bg-white' : 'border-[#244770] bg-[#0f2040]'}`}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Practice logo" className="h-full w-full object-contain p-2" />
            ) : (
              <span className="text-2xl text-white/20 group-hover:text-white/60 transition">📷</span>
            )}
          </label>
          <input
            id="logo-upload-settings"
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            className="hidden"
          />
          <div className="space-y-2">
            <p className="text-xs text-blue-200/60">
              {logoUrl ? 'Your logo appears on client intake forms, consent forms, and emails.' : 'Upload a logo to personalize client-facing forms and emails.'}
            </p>
            <div className="flex gap-2">
              <label htmlFor="logo-upload-settings" className="cursor-pointer text-xs font-medium text-[#c9a227] hover:text-[#b89020] transition">
                {logoUploading ? 'Uploading…' : logoUrl ? 'Replace' : 'Upload'}
              </label>
              {logoUrl && (
                <button onClick={handleLogoRemove} disabled={logoUploading} className="text-xs text-red-400 hover:text-red-300 transition">
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Full name */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">
            Your Name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={e => { setFullName(e.target.value); setSaved(false) }}
            placeholder="Dr. Jane Smith"
            className="w-full rounded-xl border border-[#244770] bg-[#0f2040] px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227]/40 transition"
          />
        </div>

        {/* Practice name */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">
            Practice Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={practiceName}
            onChange={e => { setPracticeName(e.target.value); setSaved(false) }}
            placeholder="Chiro Stride Equine Chiropractic"
            className="w-full rounded-xl border border-[#244770] bg-[#0f2040] px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227]/40 transition"
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">
            Location / Region
          </label>
          <input
            type="text"
            value={location}
            onChange={e => { setLocation(e.target.value); setSaved(false) }}
            placeholder="Nashville, TN"
            className="w-full rounded-xl border border-[#244770] bg-[#0f2040] px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227]/40 transition"
          />
        </div>

        {/* Animals served */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">
            Animals Served
          </label>
          <select
            value={animalsServed}
            onChange={e => { setAnimalsServed(e.target.value); setSaved(false) }}
            className="w-full rounded-xl border border-[#244770] bg-[#0f2040] px-4 py-2.5 text-sm text-white outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227]/40 transition"
          >
            <option value="equine">🐴 Equine only</option>
            <option value="canine">🐕 Canine only</option>
            <option value="feline">🐱 Feline only</option>
            <option value="bovine">🐄 Bovine only</option>
            <option value="porcine">🐷 Porcine only</option>
            <option value="exotic">🦎 Exotic only</option>
            <option value="all">All species</option>
          </select>
        </div>
      </div>

      {/* Email (read-only) */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">
          Email Address
        </label>
        <input
          type="email"
          value={practitioner.email ?? ''}
          disabled
          className="w-full rounded-xl border border-[#244770] bg-[#0f2040]/50 px-4 py-2.5 text-sm text-white/60 cursor-not-allowed"
        />
        <p className="mt-1 text-[11px] text-blue-400/60">Email is tied to your login and cannot be changed here.</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving || !isDirty}
        className={`rounded-xl px-6 py-2.5 text-sm font-semibold transition
          ${isDirty
            ? 'bg-[#c9a227] text-[#0f2040] hover:bg-[#b89020]'
            : 'bg-white/5 text-white/50 cursor-not-allowed'}`}
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
      </button>
    </div>
  )
}

// ── Biometric / Face ID Section ───────────────────────────────────────────────

type PasskeyCredential = {
  id: string
  device_name: string | null
  created_at: string
  last_used_at: string | null
}

function BiometricSection() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>([])
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadPasskeys = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data } = await supabase
      .from('passkey_credentials')
      .select('id, device_name, created_at, last_used_at')
      .order('created_at', { ascending: false })
    setPasskeys(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    setSupported(browserSupportsWebAuthn())
    loadPasskeys()
  }, [loadPasskeys])

  async function handleEnroll() {
    setEnrolling(true)
    setError('')
    setMessage('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      // 1. Get registration options from server
      const optionsRes = await fetch('/api/webauthn/register-options', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const options = await optionsRes.json()
      if (!optionsRes.ok) throw new Error(options.error || 'Failed to get options')

      // 2. Prompt the user's device for biometric (Face ID, Touch ID, etc.)
      const registration = await startRegistration({ optionsJSON: options })

      // 3. Verify with server and store
      const verifyRes = await fetch('/api/webauthn/register-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ response: registration, deviceName: getDeviceName() }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Verification failed')

      setMessage('Biometric login enabled! You can now use Face ID / Touch ID to sign in.')
      // Set a flag so the login page knows to show the biometric option on this device
      localStorage.setItem('chirostride_passkey_enrolled', 'true')
      loadPasskeys()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Enrollment failed'
      if (msg.includes('cancelled') || msg.includes('NotAllowedError')) {
        setError('Enrollment was cancelled.')
      } else {
        setError(msg)
      }
    } finally {
      setEnrolling(false)
    }
  }

  async function handleRemove(id: string) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await supabase.from('passkey_credentials').delete().eq('id', id)
    loadPasskeys()
  }

  if (supported === false) return null // Don't show on unsupported browsers

  return (
    <div className="space-y-4">
      <div className="h-px bg-[#244770]" />
      <div>
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <span className="text-xl">👆</span> Biometric Login
        </h3>
        <p className="text-sm text-blue-300 mt-0.5">
          Use Face ID, Touch ID, or fingerprint to sign in without a password.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-white/50">Loading…</p>
      ) : (
        <>
          {passkeys.length > 0 && (
            <div className="space-y-2">
              {passkeys.map((pk) => (
                <div
                  key={pk.id}
                  className="flex items-center justify-between rounded-xl border border-[#244770] bg-[#0f2040] px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {pk.device_name || 'Passkey'}
                    </p>
                    <p className="text-xs text-blue-400/60">
                      Added {new Date(pk.created_at).toLocaleDateString()}
                      {pk.last_used_at && ` · Last used ${new Date(pk.last_used_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(pk.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleEnroll}
            disabled={enrolling}
            className="w-full max-w-sm rounded-xl bg-[#c9a227] px-6 py-2.5 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition disabled:opacity-50"
          >
            {enrolling
              ? 'Waiting for biometric…'
              : passkeys.length > 0
                ? 'Add Another Device'
                : 'Enable Face ID / Biometric Login'}
          </button>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="text-sm text-emerald-400 font-medium">{message}</p>}
        </>
      )}
    </div>
  )
}

function getDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Unknown device'
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/Android/.test(ua)) return 'Android'
  if (/Windows/.test(ua)) return 'Windows'
  return 'Device'
}

// ── Security Tab ──────────────────────────────────────────────────────────────

function SecurityTab() {
  const [currentPw,  setCurrentPw]  = useState('')
  const [newPw,      setNewPw]      = useState('')
  const [confirmPw,  setConfirmPw]  = useState('')
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [error,      setError]      = useState('')

  async function handleChangePassword() {
    setError('')
    if (!newPw) { setError('New password is required.'); return }
    if (newPw.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (newPw !== confirmPw) { setError('Passwords do not match.'); return }

    setSaving(true)
    // Re-auth to verify current password
    const { data: userData } = await supabase.auth.getUser()
    const email = userData.user?.email
    if (!email) { setError('Unable to verify identity. Please sign in again.'); setSaving(false); return }

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPw })
    if (signInErr) { setError('Current password is incorrect.'); setSaving(false); return }

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPw })
    setSaving(false)
    if (updateErr) { setError(updateErr.message); return }

    setSaved(true)
    setCurrentPw(''); setNewPw(''); setConfirmPw('')
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">Security</h2>
        <p className="text-sm text-blue-300 mt-0.5">Manage your login credentials.</p>
      </div>

      <div className="max-w-sm space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">
            Current Password
          </label>
          <input
            type="password"
            value={currentPw}
            onChange={e => { setCurrentPw(e.target.value); setError(''); setSaved(false) }}
            placeholder="••••••••"
            className="w-full rounded-xl border border-[#244770] bg-[#0f2040] px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227]/40 transition"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">
            New Password
          </label>
          <input
            type="password"
            value={newPw}
            onChange={e => { setNewPw(e.target.value); setError(''); setSaved(false) }}
            placeholder="••••••••"
            className="w-full rounded-xl border border-[#244770] bg-[#0f2040] px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227]/40 transition"
          />
          <p className="mt-1 text-[11px] text-blue-400/60">Minimum 8 characters.</p>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirmPw}
            onChange={e => { setConfirmPw(e.target.value); setError(''); setSaved(false) }}
            placeholder="••••••••"
            className="w-full rounded-xl border border-[#244770] bg-[#0f2040] px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227]/40 transition"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {saved && <p className="text-sm text-emerald-400 font-medium">✓ Password updated successfully.</p>}

        <button
          onClick={handleChangePassword}
          disabled={saving || !currentPw || !newPw || !confirmPw}
          className={`w-full rounded-xl px-6 py-2.5 text-sm font-semibold transition
            ${currentPw && newPw && confirmPw
              ? 'bg-[#c9a227] text-[#0f2040] hover:bg-[#b89020]'
              : 'bg-white/5 text-white/50 cursor-not-allowed'}`}
        >
          {saving ? 'Updating…' : 'Update Password'}
        </button>
      </div>

      {/* Biometric / Face ID enrollment */}
      <BiometricSection />
    </div>
  )
}

// ── QuickBooks Connection Section ─────────────────────────────────────────────

type QBConnection = {
  realm_id: string
  company_name: string | null
  connected_at: string
  last_synced_at: string | null
}

function QuickBooksSection() {
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [connection, setConnection] = useState<QBConnection | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/quickbooks/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      setConnected(data.connected)
      setConnection(data.connection)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function handleConnect() {
    setConnecting(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/quickbooks/auth', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Failed to start QuickBooks connection')
      }
    } catch {
      setError('Failed to connect to QuickBooks')
    } finally {
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await fetch('/api/quickbooks/status', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      setConnected(false)
      setConnection(null)
    } catch {
      setError('Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="h-px bg-[#244770]" />
      <div>
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <span className="text-lg">📗</span> QuickBooks
        </h3>
        <p className="text-sm text-blue-300 mt-0.5">
          Sync invoices and payments to QuickBooks Online automatically.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-white/50">Loading…</p>
      ) : connected && connection ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-300 flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                  Connected
                </p>
                <p className="text-xs text-emerald-400/70 mt-0.5">
                  {connection.company_name || `Company ${connection.realm_id}`}
                </p>
                <p className="text-[11px] text-blue-400/50 mt-1">
                  Connected {new Date(connection.connected_at).toLocaleDateString()}
                  {connection.last_synced_at && ` · Last synced ${new Date(connection.last_synced_at).toLocaleDateString()}`}
                </p>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-xs text-red-400 hover:text-red-300 transition"
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>
          <p className="text-xs text-blue-400/60">
            New invoices and payments are automatically synced to your QuickBooks account.
          </p>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="w-full max-w-sm rounded-xl bg-[#2CA01C] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#249016] transition disabled:opacity-50"
        >
          {connecting ? 'Connecting…' : 'Connect QuickBooks'}
        </button>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}

// ── Billing Tab ───────────────────────────────────────────────────────────────

function BillingTab({ practitioner }: { practitioner: Practitioner }) {
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  const status = practitioner.subscription_status ?? 'unknown'
  const daysLeft = getTrialDaysLeft(practitioner.trial_ends_at)
  const trialExpired = status === 'trialing' && daysLeft === 0
  const hasStripeCustomer = Boolean(practitioner.stripe_customer_id)
  const needsSubscription = !practitioner || trialExpired || status === 'canceled' || status === 'incomplete' || status === 'past_due'

  async function handleSubscribe(plan: 'monthly' | 'annual' = 'monthly') {
    setActionLoading(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const priceId = plan === 'annual'
      ? process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL
      : process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: session?.access_token, priceId }),
    })
    const data = await res.json()
    if (data.url) { window.location.href = data.url }
    else { setError(data.error || 'Failed to open checkout.'); setActionLoading(false) }
  }

  async function handleManageBilling() {
    setActionLoading(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/billing/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: session?.access_token }),
    })
    const data = await res.json()
    if (data.url) { window.location.href = data.url }
    else { setError(data.error || 'Failed to open billing portal.'); setActionLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">Billing &amp; Subscription</h2>
        <p className="text-sm text-blue-300 mt-0.5">Manage your Chiro Stride subscription and payment method.</p>
      </div>

      {/* Plan card */}
      <div className="rounded-2xl border border-[#244770] bg-[#162d50] p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1">Current Plan</p>
            <p className="text-xl font-bold text-white tracking-wide">Chiro Stride Pro</p>
            <p className="text-sm text-blue-300 mt-0.5">$49/month or $499/year</p>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Status messages */}
        {status === 'trialing' && !trialExpired && (
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/30 px-4 py-3 mb-4">
            <p className="text-sm text-blue-200">
              <span className="font-semibold">{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span> in your free trial.
              Choose a plan before it ends to keep access.
            </p>
          </div>
        )}
        {trialExpired && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 mb-4">
            <p className="text-sm text-amber-200 font-medium">
              Your free trial has ended. Subscribe to restore access.
            </p>
          </div>
        )}
        {status === 'past_due' && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 mb-4">
            <p className="text-sm text-red-200 font-medium">
              Your last payment failed. Please update your payment method.
            </p>
          </div>
        )}
        {status === 'canceled' && (
          <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 mb-4">
            <p className="text-sm text-white/60">
              Your subscription has been canceled. Re-subscribe below to regain access.
            </p>
          </div>
        )}

        {/* Actions */}
        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        <div className="space-y-2">
          {needsSubscription ? (
            <>
              <button
                onClick={() => handleSubscribe('monthly')}
                disabled={actionLoading}
                className="w-full rounded-xl bg-[#c9a227] py-3 text-sm font-semibold text-[#0f2040] transition hover:bg-[#b89020] disabled:opacity-50"
              >
                {actionLoading ? 'Redirecting to checkout…' : 'Subscribe — $49/month'}
              </button>
              <button
                onClick={() => handleSubscribe('annual')}
                disabled={actionLoading}
                className="w-full rounded-xl border border-[#c9a227] py-3 text-sm font-semibold text-[#c9a227] transition hover:bg-[#c9a227]/10 disabled:opacity-50"
              >
                {actionLoading ? 'Redirecting…' : 'Subscribe — $499/year (save 15%)'}
              </button>
            </>
          ) : (
            hasStripeCustomer && (
              <button
                onClick={handleManageBilling}
                disabled={actionLoading}
                className="w-full rounded-xl bg-[#c9a227] py-3 text-sm font-semibold text-[#0f2040] transition hover:bg-[#b89020] disabled:opacity-50"
              >
                {actionLoading ? 'Opening portal…' : 'Manage Billing & Invoices'}
              </button>
            )
          )}
          {status === 'trialing' && !trialExpired && (
            <>
              <button
                onClick={() => handleSubscribe('monthly')}
                disabled={actionLoading}
                className="w-full rounded-xl border border-white/20 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                {actionLoading ? 'Redirecting…' : 'Add Payment — $49/month'}
              </button>
              <button
                onClick={() => handleSubscribe('annual')}
                disabled={actionLoading}
                className="w-full rounded-xl border border-white/20 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                {actionLoading ? 'Redirecting…' : 'Add Payment — $499/year (save 15%)'}
              </button>
            </>
          )}
        </div>

        <p className="mt-3 text-[11px] text-blue-400/60 text-center">
          Payments processed securely by Stripe. Cancel anytime.
        </p>
      </div>

      {/* What's included */}
      <div className="rounded-2xl border border-[#244770] bg-[#162d50] p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-4">What&apos;s Included</p>
        <ul className="space-y-2">
          {[
            'Unlimited patient records (horses & dogs)',
            'AI-powered SOAP note generation',
            'Digital intake & consent forms',
            'Visit photos & anatomy viewer',
            'Spine assessment tracker',
            'Appointment scheduling & calendar',
            'Offline mode with sync',
          ].map(f => (
            <li key={f} className="flex items-start gap-2 text-sm text-blue-200">
              <span className="mt-0.5 text-emerald-400 font-bold shrink-0">✓</span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* QuickBooks integration */}
      <QuickBooksSection />
    </div>
  )
}

// ── Reminders Tab ────────────────────────────────────────────────────────────

function RemindersTab() {
  const [running,  setRunning]  = useState(false)
  const [result,   setResult]   = useState<{ sent: number; skipped: number; errors?: unknown[] } | null>(null)
  const [error,    setError]    = useState('')

  async function handleRunNow() {
    setRunning(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/reminders/send')
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Reminder run failed.')
      else setResult(data)
    } catch {
      setError('Network error — could not reach reminder endpoint.')
    }
    setRunning(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">Appointment Reminders</h2>
        <p className="text-sm text-blue-300 mt-0.5">
          Automatically email and text owners the day before their appointment.
        </p>
      </div>

      {/* How it works */}
      <div className="rounded-2xl border border-[#244770] bg-[#162d50] p-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-400">How It Works</p>
        <ul className="space-y-2 text-sm text-blue-200">
          <li className="flex gap-2">
            <span className="text-[#c9a227] shrink-0 mt-0.5">✓</span>
            Runs automatically every day at <strong className="text-white">8:00 AM</strong> via Vercel Cron.
          </li>
          <li className="flex gap-2">
            <span className="text-[#c9a227] shrink-0 mt-0.5">✓</span>
            Finds all <strong className="text-white">scheduled or confirmed</strong> appointments for tomorrow that haven&apos;t had a reminder sent yet.
          </li>
          <li className="flex gap-2">
            <span className="text-[#c9a227] shrink-0 mt-0.5">✓</span>
            Sends a <strong className="text-white">reminder email</strong> to any owner with an email address on file.
          </li>
          <li className="flex gap-2">
            <span className="text-[#c9a227] shrink-0 mt-0.5">✓</span>
            Sends a <strong className="text-white">reminder text (SMS)</strong> to any owner with a phone number on file (requires Twilio).
          </li>
          <li className="flex gap-2">
            <span className="text-[#c9a227] shrink-0 mt-0.5">✓</span>
            Marks each appointment&apos;s <em>reminder sent</em> flag so no one gets contacted twice.
          </li>
        </ul>
      </div>

      {/* Required env vars */}
      <div className="rounded-2xl border border-[#244770] bg-[#162d50] p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-3">Required Configuration</p>
        <div className="space-y-2">
          {[
            ['RESEND_API_KEY',         'Email delivery (required)', true],
            ['FROM_EMAIL',             'Sender address (required)', true],
            ['TWILIO_ACCOUNT_SID',     'SMS delivery (optional)', false],
            ['TWILIO_AUTH_TOKEN',      'SMS delivery (optional)', false],
            ['TWILIO_PHONE_NUMBER',    'SMS sender number (optional)', false],
            ['CRON_SECRET',            'Secures the cron endpoint (recommended)', false],
          ].map(([key, desc, required]) => (
            <div key={key as string} className="flex items-start gap-3 text-xs">
              <code className={`rounded px-1.5 py-0.5 font-mono shrink-0 ${required ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'}`}>
                {key}
              </code>
              <span className="text-blue-200/70">{desc}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-blue-400/60">
          Set these in your Vercel project → Settings → Environment Variables.
          Add <code className="bg-white/10 px-1 rounded font-mono">CRON_SECRET</code> to the same place and Vercel will pass it automatically on scheduled runs.
        </p>
      </div>

      {/* Manual trigger */}
      <div className="rounded-2xl border border-[#244770] bg-[#162d50] p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">Manual Trigger</p>
        <p className="text-sm text-blue-200/70 mb-4">
          Run the reminder job right now to test it or catch up on any missed runs.
        </p>

        <button
          onClick={handleRunNow}
          disabled={running}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition
            ${running ? 'bg-white/10 text-white/60 cursor-not-allowed' : 'bg-[#c9a227] text-[#0f2040] hover:bg-[#b89020]'}`}
        >
          {running ? 'Running…' : 'Run Reminders Now'}
        </button>

        {error && (
          <div className="mt-3 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 space-y-1">
            <p className="text-sm font-semibold text-emerald-300">✓ Run complete</p>
            <p className="text-xs text-emerald-200/80">
              {result.sent} reminder{result.sent !== 1 ? 's' : ''} sent · {result.skipped} skipped
            </p>
            {result.errors && result.errors.length > 0 && (
              <p className="text-xs text-amber-300">{result.errors.length} error{result.errors.length !== 1 ? 's' : ''} — check server logs.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Account Page ─────────────────────────────────────────────────────────

function AccountPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [practitioner, setPractitioner] = useState<Practitioner | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get('tab')
    return (t === 'security' || t === 'billing' || t === 'reminders') ? t as Tab : 'profile'
  })

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // Try local session when offline
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) { router.push('/login'); return }
      }
    } catch {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/login'); return }
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    if (!navigator.onLine) {
      // Show a limited offline state instead of failing
      setLoading(false)
      return
    }

    const res = await fetch('/api/billing/ensure-practitioner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: session.access_token }),
    })
    if (res.ok) {
      const data = await res.json()
      setPractitioner(data)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f2040]">
        <div className="text-blue-300 text-sm">Loading account…</div>
      </div>
    )
  }

  if (!practitioner) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f2040]">
        <div className="text-center">
          <div className="text-amber-400 text-sm mb-2">
            {navigator.onLine ? 'Could not load account info. Please refresh.' : 'Account settings are not available offline.'}
          </div>
          <Link href="/dashboard" className="text-blue-400 text-sm underline hover:text-blue-300">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'profile',   label: 'Profile',   icon: '👤' },
    { id: 'security',  label: 'Security',  icon: '🔒' },
    { id: 'billing',   label: 'Billing',   icon: '💳' },
    { id: 'reminders', label: 'Reminders', icon: '🔔' },
  ]

  return (
    <main className="min-h-screen bg-[#0f2040]">
      <div className="mx-auto max-w-3xl px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard" className="text-sm text-blue-300 hover:text-white transition mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#c9a227]/20 border border-[#c9a227]/40 text-2xl">
              👤
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {practitioner.full_name ?? practitioner.email ?? 'Your Account'}
              </h1>
              <p className="text-sm text-blue-300">{practitioner.practice_name ?? 'No practice name set'}</p>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mb-8 flex gap-1 rounded-2xl border border-[#244770] bg-[#0e1e38] p-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition
                ${tab === t.id
                  ? 'bg-[#c9a227] text-[#0f2040] font-semibold shadow'
                  : 'text-blue-300 hover:text-white hover:bg-white/5'}`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="rounded-2xl border border-[#244770] bg-[#0e1e38] p-6">
          {tab === 'profile' && (
            <ProfileTab
              practitioner={practitioner}
              onSaved={updated => setPractitioner(updated)}
            />
          )}
          {tab === 'security'  && <SecurityTab />}
          {tab === 'billing'   && <BillingTab practitioner={practitioner} />}
          {tab === 'reminders' && <RemindersTab />}
        </div>
      </div>
    </main>
  )
}

export default function AccountPage() {
  return (
    <Suspense>
      <AccountPageContent />
    </Suspense>
  )
}
