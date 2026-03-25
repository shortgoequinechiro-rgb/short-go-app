'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  // Account fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Practice profile fields
  const [fullName, setFullName] = useState('')
  const [credentials, setCredentials] = useState('')
  const [practiceName, setPracticeName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [country, setCountry] = useState('')
  const [website, setWebsite] = useState('')
  const [phone, setPhone] = useState('')

  async function handleSignUp() {
    setError('')

    // Validation
    if (!fullName.trim()) { setError('Full name is required.'); return }
    if (!practiceName.trim()) { setError('Practice name is required.'); return }
    if (!email.trim()) { setError('Email is required.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }

    setLoading(true)

    // 1. Create auth account
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    const userId = signUpData.user?.id
    const session = signUpData.session

    // 2. Save practitioner profile immediately (works even before email confirmation)
    if (userId) {
      try {
        const res = await fetch('/api/onboarding/setup-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            email: email.trim(),
            full_name: fullName.trim(),
            credentials: credentials.trim(),
            practice_name: practiceName.trim(),
            city: city.trim(),
            state: state.trim(),
            country: country.trim(),
            website: website.trim(),
            phone: phone.trim(),
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Failed to set up practice. Please try again.')
          setLoading(false)
          return
        }
      } catch {
        console.error('Profile setup call failed')
      }
    }

    // 3. If we have a session (email confirmation disabled), go straight in
    if (session) {
      router.push('/select-mode')
      return
    }

    // 4. Otherwise, show "check your email" confirmation
    setLoading(false)
    setConfirmationSent(true)
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
          style={{ opacity: 0.15, filter: 'invert(1) sepia(1) saturate(4) hue-rotate(5deg)' }}
        />
      </div>

      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 30% 50%, transparent 40%, rgba(0,0,0,0.45) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative flex min-h-screen items-center justify-center px-4 py-10 md:justify-start md:pl-16 lg:pl-24">

        {/* ── Email confirmation screen ── */}
        {confirmationSent ? (
          <div className="w-full max-w-md rounded-3xl bg-white/95 p-10 shadow-2xl backdrop-blur-sm text-center">
            <div className="mb-4 text-5xl">✉️</div>
            <h2 className="text-2xl font-bold text-slate-900">Check your email</h2>
            <p className="mt-3 text-slate-500 leading-relaxed">
              We sent a confirmation link to <span className="font-semibold text-slate-700">{email}</span>.
              Click the link in your email to activate your account, then come back and sign in.
            </p>
            <div className="mt-6 h-px w-full bg-slate-100" />
            <p className="mt-4 text-sm text-slate-400">
              Didn&apos;t receive it? Check your spam folder or{' '}
              <button
                onClick={() => setConfirmationSent(false)}
                className="font-semibold text-slate-700 hover:underline"
              >
                try again
              </button>.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-xl bg-slate-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#162d55]"
            >
              Go to Sign In
            </Link>
          </div>
        ) : (

        <div className="w-full max-w-md rounded-3xl bg-white/95 p-8 shadow-2xl backdrop-blur-sm">

          {/* Header with LOG IN / SIGN UP toggle */}
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/login"
              className="text-sm font-bold tracking-wider text-slate-400 uppercase hover:text-slate-700 transition"
            >
              Log In
            </Link>
            <h1 className="text-xl font-bold tracking-widest text-slate-900 uppercase">
              Sign Up
            </h1>
          </div>

          {/* Brand */}
          <div className="mb-5">
            <h2 className="text-3xl font-bold tracking-widest text-slate-900">CHIRO STRIDE</h2>
            <p className="mt-1 text-sm font-medium text-slate-500 uppercase tracking-widest">
              Chiropractic Practice Management
            </p>
            <div className="mt-3 h-px w-12 rounded-full bg-slate-900" />
          </div>

          {/* Trial badge */}
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1">
            <span className="text-emerald-500 text-xs font-bold">✓</span>
            <span className="text-xs font-semibold text-emerald-700">
              7-day free trial · No credit card required
            </span>
          </div>

          <p className="mb-5 text-sm text-slate-500">
            You are only 1 minute away from effortless practice management.
          </p>

          <div className="grid gap-3">
            {/* Full Name */}
            <InputField
              icon="👤"
              placeholder="Full Name"
              value={fullName}
              onChange={setFullName}
              autoFocus
            />

            {/* Credentials */}
            <InputField
              icon="🎓"
              placeholder="Credentials (e.g. DC, AVCA, IVCA)"
              value={credentials}
              onChange={setCredentials}
            />

            {/* Practice / Clinic Name */}
            <InputField
              icon="🏠"
              placeholder="Practice Name"
              value={practiceName}
              onChange={setPracticeName}
            />

            {/* City */}
            <InputField
              icon="🏙️"
              placeholder="City"
              value={city}
              onChange={setCity}
            />

            {/* State / Province */}
            <InputField
              icon="🏛️"
              placeholder="State / Province"
              value={state}
              onChange={setState}
            />

            {/* Country */}
            <InputField
              icon="🌎"
              placeholder="Country"
              value={country}
              onChange={setCountry}
            />

            {/* Clinic Website */}
            <InputField
              icon="🌐"
              placeholder="Practice Website (optional)"
              value={website}
              onChange={setWebsite}
              type="url"
            />

            {/* Business Phone */}
            <InputField
              icon="📞"
              placeholder="Business Phone Number"
              value={phone}
              onChange={setPhone}
              type="tel"
            />

            {/* Email */}
            <InputField
              icon="✉️"
              placeholder="Email"
              value={email}
              onChange={setEmail}
              type="email"
              autoComplete="email"
            />

            {/* Password */}
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                🔒
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSignUp()}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition"
                placeholder="Password (8+ characters)"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition text-sm"
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            {/* Terms */}
            <p className="text-xs text-slate-400 leading-relaxed">
              By creating an account, you agree to our{' '}
              <span className="text-slate-600 underline cursor-pointer">Terms and Conditions</span>
              {' '}and{' '}
              <span className="text-slate-600 underline cursor-pointer">Privacy Policy</span>.
            </p>

            {/* Sign Up button */}
            <button
              onClick={handleSignUp}
              disabled={loading || !email || !password || !fullName || !practiceName}
              className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-[#162d55] disabled:opacity-50"
            >
              {loading ? 'Creating your practice…' : 'SIGN UP'}
            </button>
          </div>

          <p className="mt-5 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-slate-900 hover:underline">
              Sign in
            </Link>
          </p>

          <p className="mt-4 text-center text-xs text-slate-400 leading-relaxed">
            After your 7-day trial, plans start at $49/month.
          </p>
        </div>

        )}
      </div>
    </main>
  )
}

/* ── Reusable input row ──────────────────────────── */
function InputField({
  icon,
  placeholder,
  value,
  onChange,
  type = 'text',
  autoComplete,
  autoFocus,
}: {
  icon: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  type?: string
  autoComplete?: string
  autoFocus?: boolean
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
        {icon}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition"
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
      />
    </div>
  )
}
