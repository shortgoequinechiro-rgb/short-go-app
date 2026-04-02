'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

type HorseInfo = {
  id: string
  name: string
  species: string
  breed: string | null
}

type PractitionerInfo = {
  full_name: string
  practice_name: string | null
  logo_url: string | null
}

type ExistingAuth = {
  id: string
  vet_name: string
  authorization_date: string
  expires_at: string
  status: string
}

type SiblingAnimal = {
  id: string
  name: string
  species: string
  breed: string | null
  hasActiveAuth: boolean
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VetAuthorizationPage() {
  const { horseId } = useParams<{ horseId: string }>()

  // Data
  const [horse, setHorse] = useState<HorseInfo | null>(null)
  const [practitioner, setPractitioner] = useState<PractitionerInfo | null>(null)
  const [existingAuths, setExistingAuths] = useState<ExistingAuth[]>([])
  const [siblingAnimals, setSiblingAnimals] = useState<SiblingAnimal[]>([])
  const [selectedSiblings, setSelectedSiblings] = useState<Set<string>>(new Set())
  const [ownerName, setOwnerName] = useState<string | null>(null)

  // Form fields
  const [vetName, setVetName] = useState('')
  const [vetLicenseNumber, setVetLicenseNumber] = useState('')
  const [vetPracticeName, setVetPracticeName] = useState('')
  const [vetPhone, setVetPhone] = useState('')
  const [vetEmail, setVetEmail] = useState('')
  const [vetNotes, setVetNotes] = useState('')
  const [examConfirmed, setExamConfirmed] = useState(false)
  const [understandsScope, setUnderstandsScope] = useState(false)

  // Signature
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const [hasSigned, setHasSigned] = useState(false)

  // UI
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const practiceName = practitioner?.practice_name || practitioner?.full_name || 'the requesting practitioner'
  const canSubmit = vetName.trim() && examConfirmed && understandsScope && hasSigned
  const totalAnimals = 1 + selectedSiblings.size

  function toggleSibling(id: string) {
    setSelectedSiblings((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function selectAllSiblings() {
    setSelectedSiblings(new Set(siblingAnimals.map((s) => s.id)))
  }

  function deselectAllSiblings() {
    setSelectedSiblings(new Set())
  }

  // ── Load horse data ─────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/public/horse/${horseId}`)
        if (!res.ok) { setLoading(false); return }
        const data = await res.json()
        setHorse(data.horse)
        setPractitioner(data.practitioner)
        setExistingAuths(data.existingAuths || [])
        setSiblingAnimals(data.siblingAnimals || [])
        setOwnerName(data.ownerName || null)
      } catch {
        setError('Failed to load information.')
      }
      setLoading(false)
    }
    load()
  }, [horseId])

  // ── Signature canvas ────────────────────────────────────────────────────────

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
    isDrawingRef.current = true
    const ctx = canvas.getContext('2d')!
    const pos = getCanvasPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const pos = getCanvasPos(e, canvas)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1e3a5f'
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    setHasSigned(true)
  }

  function endDraw() {
    isDrawingRef.current = false
  }

  function clearSignature() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSigned(false)
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!canSubmit) return
    setSaving(true)
    setError('')

    const signatureData = canvasRef.current?.toDataURL('image/png') || null

    try {
      const res = await fetch('/api/vet-auth/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          horseId,
          additionalHorseIds: Array.from(selectedSiblings),
          vetName: vetName.trim(),
          vetLicenseNumber: vetLicenseNumber.trim() || undefined,
          vetPracticeName: vetPracticeName.trim() || undefined,
          vetPhone: vetPhone.trim() || undefined,
          vetEmail: vetEmail.trim() || undefined,
          vetExamConfirmed: examConfirmed,
          vetNotes: vetNotes.trim() || undefined,
          signatureData,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to submit authorization.')
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Failed to submit. Please try again.')
    }

    setSaving(false)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a1628] to-[#162a4a] flex items-center justify-center">
        <p className="text-white/60">Loading...</p>
      </div>
    )
  }

  if (!horse) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a1628] to-[#162a4a] flex items-center justify-center p-6">
        <div className="bg-[#1a2d4a] rounded-2xl p-8 max-w-md text-center">
          <p className="text-lg text-white">Animal not found.</p>
          <p className="text-sm text-blue-300 mt-2">This authorization link may be invalid or expired.</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    const allAuthorizedNames = [
      horse.name,
      ...siblingAnimals.filter((s) => selectedSiblings.has(s.id)).map((s) => s.name),
    ]
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a1628] to-[#162a4a] flex items-center justify-center p-6">
        <div className="bg-[#1a2d4a] rounded-2xl p-8 max-w-md text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h1 className="text-2xl font-bold text-white">
            {allAuthorizedNames.length === 1 ? 'Authorization Submitted' : `${allAuthorizedNames.length} Authorizations Submitted`}
          </h1>
          <p className="text-blue-200">
            Thank you, Dr. {vetName}. Your authorization for chiropractic care of{' '}
            {allAuthorizedNames.length === 1 ? (
              <strong>{allAuthorizedNames[0]}</strong>
            ) : (
              <>
                {allAuthorizedNames.slice(0, -1).map((name, i) => (
                  <span key={name}>{i > 0 ? ', ' : ''}<strong>{name}</strong></span>
                ))}
                {' and '}
                <strong>{allAuthorizedNames[allAuthorizedNames.length - 1]}</strong>
              </>
            )}
            {' '}has been recorded.
          </p>
          <p className="text-sm text-blue-300/70">
            {allAuthorizedNames.length === 1 ? 'This authorization is' : 'These authorizations are'} valid for 1 year. {practiceName} has been notified.
          </p>
          <p className="text-xs text-blue-400/50 mt-4">You can close this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1628] to-[#162a4a] py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          {practitioner?.logo_url && (
            <img src={practitioner.logo_url} alt="" className="h-16 mx-auto rounded-xl" />
          )}
          <h1 className="text-2xl font-bold text-white">Veterinary Authorization</h1>
          <p className="text-blue-200 text-sm">
            {practiceName} is requesting your authorization to provide chiropractic care for:
          </p>
          <div className="inline-block bg-[#1a2d4a] rounded-xl px-6 py-3 mt-2">
            <p className="text-lg font-semibold text-white">{horse.name}</p>
            <p className="text-xs text-blue-300 capitalize">{horse.species}{horse.breed ? ` · ${horse.breed}` : ''}</p>
          </div>
        </div>

        {/* Existing authorizations */}
        {existingAuths.length > 0 && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
            <p className="text-sm text-emerald-300 font-semibold">Active Authorization on File</p>
            <p className="text-xs text-emerald-400/70 mt-1">
              Dr. {existingAuths[0].vet_name} — valid through {new Date(existingAuths[0].expires_at).toLocaleDateString()}
            </p>
            <p className="text-xs text-blue-300 mt-2">You can submit a new authorization below if needed.</p>
          </div>
        )}

        {/* Sibling animals — select additional animals from same owner */}
        {siblingAnimals.length > 0 && (
          <div className="bg-[#1a2d4a] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">
                  {ownerName ? `${ownerName}'s Other Animals` : 'Additional Animals on File'}
                </h2>
                <p className="text-xs text-blue-300 mt-0.5">
                  Select any additional animals you&apos;d like to authorize
                </p>
              </div>
              <button
                type="button"
                onClick={selectedSiblings.size === siblingAnimals.length ? deselectAllSiblings : selectAllSiblings}
                className="text-xs text-blue-400 hover:text-blue-300 transition whitespace-nowrap ml-3"
              >
                {selectedSiblings.size === siblingAnimals.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="space-y-2">
              {siblingAnimals.map((sibling) => (
                <label
                  key={sibling.id}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer transition border ${
                    selectedSiblings.has(sibling.id)
                      ? 'bg-blue-500/15 border-blue-500/40'
                      : 'bg-[#0f1f36] border-[#244770]/50 hover:border-[#244770]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSiblings.has(sibling.id)}
                    onChange={() => toggleSibling(sibling.id)}
                    className="h-4 w-4 rounded border-[#244770] bg-[#0f1f36] text-blue-500 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{sibling.name}</p>
                    <p className="text-xs text-blue-300/70 capitalize">
                      {sibling.species}{sibling.breed ? ` · ${sibling.breed}` : ''}
                    </p>
                  </div>
                  {sibling.hasActiveAuth && (
                    <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5 whitespace-nowrap">
                      Auth on file
                    </span>
                  )}
                </label>
              ))}
            </div>
            {selectedSiblings.size > 0 && (
              <p className="text-xs text-blue-300">
                Authorizing <strong className="text-white">{totalAnimals} animal{totalAnimals > 1 ? 's' : ''}</strong> total
              </p>
            )}
          </div>
        )}

        {/* Legal context */}
        <div className="bg-[#1a2d4a] rounded-xl p-4 text-sm text-blue-200 space-y-2">
          <p className="font-semibold text-white">Texas Compliance Notice</p>
          <p>
            Under Texas Occupations Code Chapter 801, animal chiropractic is classified as an alternate therapy
            within veterinary medicine. A veterinarian-client-patient relationship and veterinary examination are
            required before chiropractic treatment may be provided.
          </p>
          <p>
            By completing this form, you confirm that you have examined this animal and that chiropractic treatment
            is not likely to be harmful.
          </p>
        </div>

        {/* Form */}
        <div className="bg-[#1a2d4a] rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-bold text-white">Veterinarian Information</h2>

          <div>
            <label className="block text-sm text-blue-300 mb-1">Full Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              placeholder="Dr. Jane Smith, DVM"
              value={vetName}
              onChange={(e) => setVetName(e.target.value)}
              className="w-full rounded-lg bg-[#0f1f36] border border-[#244770] text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-blue-300 mb-1">License Number <span className="text-blue-400/60 font-normal">(Optional)</span></label>
            <input
              type="text"
              placeholder="TX-12345"
              value={vetLicenseNumber}
              onChange={(e) => setVetLicenseNumber(e.target.value)}
              className="w-full rounded-lg bg-[#0f1f36] border border-[#244770] text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-blue-300 mb-1">Practice Name</label>
            <input
              type="text"
              placeholder="Hill Country Veterinary Clinic"
              value={vetPracticeName}
              onChange={(e) => setVetPracticeName(e.target.value)}
              className="w-full rounded-lg bg-[#0f1f36] border border-[#244770] text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-blue-300 mb-1">Phone</label>
              <input
                type="tel"
                placeholder="(512) 555-0123"
                value={vetPhone}
                onChange={(e) => setVetPhone(e.target.value)}
                className="w-full rounded-lg bg-[#0f1f36] border border-[#244770] text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-blue-300 mb-1">Email</label>
              <input
                type="email"
                placeholder="vet@clinic.com"
                value={vetEmail}
                onChange={(e) => setVetEmail(e.target.value)}
                className="w-full rounded-lg bg-[#0f1f36] border border-[#244770] text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-blue-300 mb-1">Notes (optional)</label>
            <textarea
              placeholder="Any relevant notes, restrictions, or recommendations..."
              value={vetNotes}
              onChange={(e) => setVetNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg bg-[#0f1f36] border border-[#244770] text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Confirmations */}
          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={examConfirmed}
                onChange={(e) => setExamConfirmed(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-[#244770] bg-[#0f1f36] text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-blue-200">
                I confirm that I have examined{' '}
                {selectedSiblings.size === 0 ? (
                  <strong className="text-white">{horse.name}</strong>
                ) : (
                  <strong className="text-white">
                    all {totalAnimals} selected animal{totalAnimals > 1 ? 's' : ''}
                  </strong>
                )}
                {' '}and that chiropractic treatment is not likely to be harmful. <span className="text-red-400">*</span>
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={understandsScope}
                onChange={(e) => setUnderstandsScope(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-[#244770] bg-[#0f1f36] text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-blue-200">
                I understand that this authorization permits chiropractic treatment as a complementary therapy under
                my veterinary supervision, and is valid for one year from today. <span className="text-red-400">*</span>
              </span>
            </label>
          </div>

          {/* Signature */}
          <div className="pt-2">
            <label className="block text-sm text-blue-300 mb-2">Signature <span className="text-red-400">*</span></label>
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={500}
                height={150}
                className="w-full rounded-lg bg-white/5 border border-[#244770] cursor-crosshair touch-none"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
              {hasSigned && (
                <button
                  onClick={clearSignature}
                  className="absolute top-2 right-2 text-xs text-red-400 hover:text-red-300 bg-[#0f1f36]/80 px-2 py-1 rounded"
                >
                  Clear
                </button>
              )}
              {!hasSigned && (
                <p className="absolute inset-0 flex items-center justify-center text-blue-300/40 text-sm pointer-events-none">
                  Sign here
                </p>
              )}
            </div>
          </div>

          {/* Error */}
          {error && <p className="text-sm text-red-400">{error}</p>}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="w-full rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving
              ? 'Submitting...'
              : totalAnimals > 1
                ? `Submit Authorization for ${totalAnimals} Animals`
                : 'Submit Authorization'}
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-blue-400/40">
          Powered by Stride · Secure veterinary authorization form
        </p>
      </div>
    </div>
  )
}
