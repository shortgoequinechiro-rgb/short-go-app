'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

type Owner = {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  practitioner_id: string | null
}

type Practitioner = {
  id: string
  practice_name: string
  logo_url: string | null
}

type ConsentRecord = {
  id: string
  owner_id: string
  signed_name: string
  signed_at: string
  form_version: string
  horses_acknowledged: string | null
  notes: string | null
  signature_data: string | null
}

// ── SQL Setup hint ────────────────────────────────────────────────────────────

const SQL_SETUP = `
CREATE TABLE consent_forms (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id             uuid REFERENCES owners(id) ON DELETE CASCADE NOT NULL,
  signed_name          text NOT NULL,
  signed_at            timestamptz DEFAULT now() NOT NULL,
  form_version         text DEFAULT '1.0',
  horses_acknowledged  text,
  notes                text,
  signature_data       text,
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX ON consent_forms (owner_id, signed_at DESC);

-- If table already exists, add signature_data column:
-- ALTER TABLE consent_forms ADD COLUMN IF NOT EXISTS signature_data text;
`.trim()

// ── Agreement items ───────────────────────────────────────────────────────────

const AGREEMENT_ITEMS = [
  {
    key: 'scope',
    text: 'I understand that Stride Equine Chiropractic provides animal chiropractic care and that this service is complementary to, and not a replacement for, conventional veterinary care.',
  },
  {
    key: 'risks',
    text: 'I acknowledge that, as with any hands-on therapy, there are inherent risks associated with chiropractic treatment, and I consent to care being provided under these conditions.',
  },
  {
    key: 'records',
    text: 'I authorize Stride Equine Chiropractic to create and retain health records for my animal(s) and to contact me regarding follow-up care and scheduling.',
  },
  {
    key: 'photos',
    text: 'I understand that clinical photographs and notes may be taken during sessions for the purpose of record-keeping and treatment planning.',
  },
  {
    key: 'payment',
    text: 'I agree to be responsible for all fees associated with care provided to my animal(s) at the time of service.',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConsentFormPage() {
  const { ownerId } = useParams<{ ownerId: string }>()
  const router = useRouter()

  // Data state
  const [owner, setOwner] = useState<Owner | null>(null)
  const [practitioner, setPractitioner] = useState<Practitioner | null>(null)
  const [existingConsents, setExistingConsents] = useState<ConsentRecord[]>([])
  const [horses, setHorses] = useState<{ id: string; name: string }[]>([])

  // UI state
  const [loading, setLoading] = useState(true)
  const [noTable, setNoTable] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [linkedHorseId, setLinkedHorseId] = useState<string | null>(null)

  // Form state
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const [formNotes, setFormNotes] = useState('')

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const [hasSigned, setHasSigned] = useState(false)

  const allChecked =
    AGREEMENT_ITEMS.every((item) => checkedItems[item.key]) && hasSigned

  // ── Load data ───────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true)

      const publicRes = await fetch(`/api/public/owner/${ownerId}`)
      if (!publicRes.ok) {
        setLoading(false)
        return
      }
      const { owner: ownerData, horses: horseData } = await publicRes.json()

      if (!ownerData) {
        setLoading(false)
        return
      }

      setOwner(ownerData as Owner)
      setHorses((horseData || []) as { id: string; name: string }[])

      // Fetch practitioner data if practitioner_id exists
      if (ownerData.practitioner_id) {
        const practRes = await fetch(`/api/public/practitioner/${ownerData.practitioner_id}`)
        if (practRes.ok) {
          const practData = await practRes.json()
          setPractitioner(practData)
        }
      }

      const params = new URLSearchParams(window.location.search)
      const horseIdParam = params.get('horseId')
      if (horseIdParam) setLinkedHorseId(horseIdParam)

      const consentRes = await fetch(`/api/public/consent/${ownerId}`)
      if (!consentRes.ok) {
        const err = await consentRes.json().catch(() => ({}))
        if (err?.error?.includes('42P01')) setNoTable(true)
        setLoading(false)
        return
      }
      const { consents: consentData } = await consentRes.json()

      setExistingConsents((consentData || []) as ConsentRecord[])
      if (!consentData || consentData.length === 0) setShowForm(true)

      setLoading(false)
    }

    load()
  }, [ownerId])

  // ── Signature canvas helpers ─────────────────────────────────────────────────

  function getCanvasPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    isDrawingRef.current = true
    const ctx = canvas.getContext('2d')!
    ctx.beginPath()
    const pos = getCanvasPos(e, canvas)
    ctx.moveTo(pos.x, pos.y)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    const ctx = canvas.getContext('2d')!
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1e293b'
    const pos = getCanvasPos(e, canvas)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    setHasSigned(true)
  }

  function stopDraw() {
    isDrawingRef.current = false
  }

  function clearSignature() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setHasSigned(false)
  }

  // ── Toggle agreement checkbox ───────────────────────────────────────────────

  function toggleItem(key: string) {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!allChecked || !owner) return
    setSaving(true)
    setSaveMsg('')

    const canvas = canvasRef.current
    const signatureData = canvas ? canvas.toDataURL('image/png') : null
    const horsesAcknowledged = horses.map((h) => h.name).join(', ') || null

    try {
      const res = await fetch('/api/consent/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId,
          signedName: owner.full_name,
          signatureData,
          horsesAcknowledged,
          notes: formNotes.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSaveMsg(`Error: ${data.error || 'Submission failed.'}`)
        setSaving(false)
        return
      }
    } catch {
      setSaveMsg('Network error. Please try again.')
      setSaving(false)
      return
    }

    // Reload consents via service-role API
    const freshRes = await fetch(`/api/public/consent/${ownerId}`)
    if (freshRes.ok) {
      const { consents } = await freshRes.json()
      setExistingConsents((consents || []) as ConsentRecord[])
    }

    setSaving(false)
    setShowForm(false)
    setSaveMsg('Consent form signed and saved.')

    if (linkedHorseId) {
      setTimeout(() => router.push(`/horses/${linkedHorseId}`), 1800)
    }
  }

  // ── Back link ───────────────────────────────────────────────────────────────

  const backHref = linkedHorseId ? `/horses/${linkedHorseId}` : '/'
  const backLabel = linkedHorseId ? '← Back to Horse Record' : '← Back to Dashboard'

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    )
  }

  if (!owner) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <p className="text-slate-600">Owner not found.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-slate-500 underline">← Dashboard</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href={backHref}
              className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              {backLabel}
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 leading-tight">Consent Form</h1>
              <p className="text-xs text-slate-500">{owner.full_name}</p>
            </div>
          </div>

          {existingConsents.length > 0 && !showForm && (
            <button
              onClick={() => {
                setCheckedItems({})
                clearSignature()
                setFormNotes('')
                setSaveMsg('')
                setShowForm(true)
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Re-sign / Renew
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">

        {/* ── No table setup ── */}
        {noTable && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="font-semibold text-amber-900">One-time setup needed</h2>
            <p className="mt-1 text-sm text-amber-800">
              Run this SQL in your Supabase dashboard (SQL Editor), then refresh.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-2xl border border-amber-200 bg-white p-4 text-xs text-slate-700 leading-relaxed">
              {SQL_SETUP}
            </pre>
          </div>
        )}

        {/* ── Existing consent history ── */}
        {existingConsents.length > 0 && (
          <div className="rounded-3xl bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold">✓</span>
              <h2 className="text-base font-semibold text-slate-900">Consent on File</h2>
            </div>

            <div className="mt-3 space-y-3">
              {existingConsents.map((c, idx) => (
                <div
                  key={c.id}
                  className={`rounded-2xl border px-4 py-3 ${idx === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{c.signed_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDate(c.signed_at)}</p>
                      {c.horses_acknowledged && (
                        <p className="text-xs text-slate-500 mt-0.5">Animals: {c.horses_acknowledged}</p>
                      )}
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${idx === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {idx === 0 ? 'Current' : 'Previous'}
                    </span>
                  </div>
                  {c.signature_data && (
                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <p className="text-xs text-slate-400 mb-1">Signature</p>
                      <img src={c.signature_data} alt="Signature" className="max-h-16 rounded border border-slate-100 bg-white p-1" />
                    </div>
                  )}
                  {c.notes && (
                    <p className="mt-2 text-xs text-slate-600 border-t border-slate-200 pt-2">{c.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Success message ── */}
        {saveMsg && !showForm && (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="text-sm font-medium text-emerald-700">{saveMsg}</p>
            {linkedHorseId && (
              <p className="text-xs text-emerald-600 mt-1">Returning to horse record…</p>
            )}
          </div>
        )}

        {/* ── Consent form ── */}
        {showForm && (
          <div className="space-y-4">

            {/* Practice header */}
            <div className="rounded-3xl bg-slate-900 px-6 py-6 text-center">
              {practitioner?.logo_url && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={practitioner.logo_url} alt="Practice Logo" className="mx-auto mb-4 max-h-16 object-contain" />
                </>
              )}
              <h2 className="text-xl font-bold text-white">{practitioner?.practice_name || 'Stride Equine Chiropractic'}</h2>
              <p className="mt-1 text-sm text-slate-400">Client Consent & Service Agreement</p>
              <p className="mt-2 text-xs text-slate-500">Version 1.0 · {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            </div>

            {/* Client & animal info */}
            <div className="rounded-3xl bg-white px-5 py-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Client Information</h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">Name</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">{owner.full_name}</p>
                </div>
                {owner.email && (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{owner.email}</p>
                  </div>
                )}
                {owner.phone && (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">Phone</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{owner.phone}</p>
                  </div>
                )}
              </div>

              {horses.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-slate-500 mb-2">Animal(s) in Care</p>
                  <div className="flex flex-wrap gap-2">
                    {horses.map((h) => (
                      <span key={h.id} className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                        {h.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Agreement items */}
            <div className="rounded-3xl bg-white px-5 py-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">Terms of Care</h3>
              <p className="mt-1 text-sm text-slate-500">Please read and acknowledge each item below.</p>

              <div className="mt-4 space-y-4">
                {AGREEMENT_ITEMS.map((item, idx) => {
                  const checked = !!checkedItems[item.key]
                  return (
                    <label
                      key={item.key}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                        checked ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleItem(item.key)}
                          className="h-5 w-5 cursor-pointer rounded accent-slate-900"
                        />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{idx + 1}.</span>
                        <p className="mt-0.5 text-sm leading-relaxed text-slate-700">{item.text}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Signature */}
            <div className="rounded-3xl bg-white px-5 py-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">Signature</h3>
              <p className="mt-1 text-sm text-slate-500">
                Sign below using your finger or stylus to confirm your agreement.
              </p>

              <div className="mt-4">
                <div className="overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-white">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={180}
                    className="w-full touch-none cursor-crosshair"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={stopDraw}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-slate-400">
                    {hasSigned ? '✓ Signature captured' : 'Sign in the box above'}
                  </p>
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="text-xs text-slate-400 underline hover:text-slate-600"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Notes (optional)
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="Any additional notes or conditions…"
                  className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">
                  By signing above, <strong>{owner.full_name}</strong> confirms they have read and agree to all items in this consent form and are the authorized owner or guardian of the animal(s) listed.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Date: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Save error */}
            {saveMsg && (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveMsg}</p>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!allChecked || saving}
              className="w-full rounded-2xl bg-slate-900 py-4 text-base font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
            >
              {saving
                ? 'Saving…'
                : !allChecked
                ? 'Please acknowledge all items & sign to continue'
                : 'Sign & Submit Consent Form'}
            </button>

            {!allChecked && (
              <p className="text-center text-xs text-slate-400">
                {AGREEMENT_ITEMS.filter((i) => !checkedItems[i.key]).length} item{AGREEMENT_ITEMS.filter((i) => !checkedItems[i.key]).length !== 1 ? 's' : ''} remaining
                {!hasSigned ? ' · Signature required' : ''}
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
