'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

type Step = 'name' | 'practice' | 'branding' | 'done'

const ANIMALS = [
  { value: 'horses', label: 'Horses', emoji: '🐴', desc: 'Equine chiropractic & bodywork' },
  { value: 'dogs', label: 'Dogs', emoji: '🐕', desc: 'Canine chiropractic & bodywork' },
  { value: 'both', label: 'Both', emoji: '🐴🐕', desc: 'Equine & canine practice' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('name')
  const [fullName, setFullName] = useState('')
  const [practiceName, setPracticeName] = useState('')
  const [animalsServed, setAnimalsServed] = useState('both')
  const [location, setLocation] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)

  // Verify user is authenticated
  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/signup')
        return
      }
      setCheckingAuth(false)
    }
    check()
  }, [router])

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleFinish() {
    setError('')
    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    const res = await fetch('/api/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: session.access_token,
        full_name: fullName.trim(),
        practice_name: practiceName.trim(),
        animals_served: animalsServed,
        location: location.trim(),
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    // Upload logo if one was selected
    if (logoFile) {
      const formData = new FormData()
      formData.append('file', logoFile)
      await fetch('/api/upload-logo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })
      // Non-blocking — if logo upload fails, onboarding still succeeds
    }

    setStep('done')
    // Small pause so the user sees the success state, then redirect
    setTimeout(() => router.push('/dashboard'), 1800)
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0f2040 60%, #162d55 100%)' }}
    >
      {/* Horse silhouette */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-end pr-8 md:pr-16"
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/horse-bg.png"
          alt=""
          className="h-[80vh] max-h-[700px] w-auto select-none object-contain"
          style={{ opacity: 0.12, filter: 'invert(1) sepia(1) saturate(4) hue-rotate(5deg)' }}
        />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">

          {/* Done state */}
          {step === 'done' && (
            <div className="rounded-3xl bg-white/95 p-10 shadow-2xl text-center">
              <div className="mb-4 text-5xl">🎉</div>
              <h2 className="text-2xl font-bold text-slate-900">You&apos;re all set!</h2>
              <p className="mt-2 text-slate-500">
                Welcome to Stride. Taking you to your practice dashboard…
              </p>
              <div className="mt-6 flex justify-center">
                <div className="h-1 w-48 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-slate-900 rounded-full animate-[progress_1.8s_linear_forwards]" />
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Your name */}
          {step === 'name' && (
            <div className="rounded-3xl bg-white/95 p-8 shadow-2xl backdrop-blur-sm">
              <ProgressDots current={0} total={3} />

              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Welcome to Stride</h2>
                <p className="mt-2 text-slate-500">
                  Let&apos;s get your practice set up. This takes about 60 seconds.
                </p>
              </div>

              <div className="grid gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fullName.trim() && setStep('practice')}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition"
                    placeholder="Dr. Jane Smith"
                    autoFocus
                  />
                </div>

                <button
                  onClick={() => setStep('practice')}
                  disabled={!fullName.trim()}
                  className="mt-2 w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-[#162d55] disabled:opacity-40"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Practice details */}
          {step === 'practice' && (
            <div className="rounded-3xl bg-white/95 p-8 shadow-2xl backdrop-blur-sm">
              <ProgressDots current={1} total={3} />

              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">About your practice</h2>
                <p className="mt-2 text-slate-500">
                  This helps us tailor the app for your workflow.
                </p>
              </div>

              <div className="grid gap-5">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Practice Name
                  </label>
                  <input
                    type="text"
                    value={practiceName}
                    onChange={(e) => setPracticeName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition"
                    placeholder="e.g. Blue Ridge Equine Chiro"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Animals You Work With
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {ANIMALS.map((a) => (
                      <button
                        key={a.value}
                        type="button"
                        onClick={() => setAnimalsServed(a.value)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-sm font-medium transition ${
                          animalsServed === a.value
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        <span className="text-xl">{a.emoji}</span>
                        <span>{a.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Location <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFinish()}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition"
                    placeholder="e.g. Lexington, KY"
                  />
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setStep('name')}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setStep('branding')}
                    disabled={!practiceName.trim()}
                    className="flex-1 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-[#162d55] disabled:opacity-40"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Step 3: Branding (optional logo) */}
          {step === 'branding' && (
            <div className="rounded-3xl bg-white/95 p-8 shadow-2xl backdrop-blur-sm">
              <ProgressDots current={2} total={3} />

              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Your practice branding</h2>
                <p className="mt-2 text-slate-500">
                  Upload your practice logo to personalize client-facing forms and emails. You can always do this later in Settings.
                </p>
              </div>

              <div className="grid gap-5">
                {/* Logo upload */}
                <div className="flex flex-col items-center gap-4">
                  <label
                    htmlFor="logo-upload"
                    className="group flex h-36 w-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-slate-500 hover:bg-slate-100 overflow-hidden"
                  >
                    {logoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoPreview} alt="Logo preview" className="h-full w-full object-contain p-2" />
                    ) : (
                      <>
                        <span className="text-3xl text-slate-400 group-hover:text-slate-600 transition">📷</span>
                        <span className="mt-2 text-xs text-slate-400 group-hover:text-slate-600 transition">Upload logo</span>
                      </>
                    )}
                  </label>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoSelect}
                    className="hidden"
                  />
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={() => { setLogoFile(null); setLogoPreview(null) }}
                      className="text-xs text-slate-400 hover:text-red-500 transition"
                    >
                      Remove
                    </button>
                  )}
                  <p className="text-xs text-slate-400 text-center max-w-xs">
                    PNG, JPG, or SVG. This will appear on intake forms, consent forms, and emails sent to your clients.
                  </p>
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setStep('practice')}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleFinish}
                    disabled={loading}
                    className="flex-1 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-[#162d55] disabled:opacity-40"
                  >
                    {loading ? 'Setting up your practice…' : 'Launch my practice →'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </main>
  )
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-8 flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all ${
            i <= current
              ? 'w-6 bg-slate-900'
              : 'w-2 bg-slate-200'
          }`}
        />
      ))}
      <span className="ml-2 text-xs text-slate-400">
        Step {current + 1} of {total}
      </span>
    </div>
  )
}
