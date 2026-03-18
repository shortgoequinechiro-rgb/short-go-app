'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignUp() {
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const { error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Redirect to onboarding to collect practice details
    router.push('/onboarding')
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

      {/* Card */}
      <div className="relative flex min-h-screen items-center justify-center px-4 py-12 md:justify-start md:pl-16 lg:pl-24">
        <div className="w-full max-w-md rounded-3xl bg-white/95 p-8 shadow-2xl backdrop-blur-sm">

          {/* Brand */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-widest text-slate-900">STRIDE</h1>
            <p className="mt-1 text-sm font-medium text-slate-500 uppercase tracking-widest">
              Equine &amp; Canine Chiropractic
            </p>
            <div className="mt-4 h-px w-12 rounded-full bg-slate-900" />
          </div>

          {/* Trial badge */}
          <div className="mb-6 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1">
            <span className="text-emerald-500 text-xs font-bold">✓</span>
            <span className="text-xs font-semibold text-emerald-700">
              14-day free trial · No credit card required
            </span>
          </div>

          <div className="grid gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSignUp()}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition"
                placeholder="Min. 8 characters"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSignUp()}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <button
              onClick={handleSignUp}
              disabled={loading || !email || !password || !confirmPassword}
              className="mt-1 w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-[#162d55] disabled:opacity-50"
            >
              {loading ? 'Creating account…' : 'Start Free Trial'}
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-slate-900 hover:underline">
              Sign in
            </Link>
          </p>

          <p className="mt-6 text-center text-xs text-slate-400 leading-relaxed">
            By creating an account you agree to our Terms of Service and Privacy Policy.
            After your 14-day trial, plans start at $59/month.
          </p>
        </div>
      </div>
    </main>
  )
}
