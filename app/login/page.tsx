'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricLoading, setBiometricLoading] = useState(false)

  useEffect(() => {
    // Check if WebAuthn is supported and if user has used it before
    if (browserSupportsWebAuthn()) {
      // Check if this device has previously enrolled (stored in a simple flag)
      const enrolled = localStorage.getItem('chirostride_passkey_enrolled')
      setBiometricAvailable(!!enrolled)
    }
  }, [])

  async function handleSignIn() {
    setLoading(true)
    setError('')

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
    } else {
      router.push('/dashboard')
      router.refresh()
    }

    setLoading(false)
  }

  async function handleBiometricSignIn() {
    setBiometricLoading(true)
    setError('')
    try {
      // 1. Get authentication options (no auth needed — user not signed in yet)
      const optionsRes = await fetch('/api/webauthn/authenticate-options', { method: 'POST' })
      const options = await optionsRes.json()
      if (!optionsRes.ok) throw new Error(options.error || 'Failed to get options')

      // 2. Prompt biometric verification (Face ID, Touch ID, fingerprint)
      const authentication = await startAuthentication({ optionsJSON: options })

      // 3. Verify with server
      const verifyRes = await fetch('/api/webauthn/authenticate-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: authentication }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Authentication failed')

      // 4. Use the token_hash to complete sign-in via Supabase OTP
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: verifyData.token_hash,
        type: 'magiclink',
      })

      if (otpError) throw new Error(otpError.message)

      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Biometric sign-in failed'
      if (msg.includes('cancelled') || msg.includes('NotAllowedError')) {
        setError('Biometric sign-in was cancelled.')
      } else {
        setError(msg)
      }
    } finally {
      setBiometricLoading(false)
    }
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0e1e38 0%, #132d50 60%, #1a3a5e 100%)' }}
    >
      {/* Horse silhouette background */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-end pr-8 md:pr-16"
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/horse-bg.png"
          alt=""
          className="h-[80vh] max-h-[700px] w-auto select-none object-contain"
          style={{ opacity: 0.18, filter: 'invert(1) sepia(1) saturate(4) hue-rotate(5deg)' }}
        />
      </div>

      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 30% 50%, transparent 40%, rgba(0,0,0,0.45) 100%)',
        }}
      />

      {/* Login card */}
      <div className="relative flex min-h-screen items-center justify-center px-4 py-12 md:justify-start md:pl-16 lg:pl-24">
        <div className="w-full max-w-md rounded-3xl bg-white/95 p-8 shadow-2xl backdrop-blur-sm">

          {/* Brand */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-widest text-slate-900">
              CHIRO STRIDE
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500 uppercase tracking-widest">
              Equine &amp; Canine Chiropractic
            </p>
            <div className="mt-4 h-px w-12 rounded-full bg-slate-900" />
          </div>

          <p className="mb-6 text-sm text-slate-500">
            Sign in to access your practice records.
          </p>

          {/* Biometric sign-in button (shown if previously enrolled on this device) */}
          {biometricAvailable && (
            <>
              <button
                onClick={handleBiometricSignIn}
                disabled={biometricLoading}
                className="mb-4 w-full flex items-center justify-center gap-2.5 rounded-xl border-2 border-slate-900 bg-white py-3.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 10v4" />
                  <path d="M7.5 7.5C9 6 10.5 5 12 5s3 1 4.5 2.5" />
                  <path d="M5 5c2.5-2.5 5-3.5 7-3.5s4.5 1 7 3.5" />
                  <path d="M9.5 9.5c1-1 1.5-1.5 2.5-1.5s1.5.5 2.5 1.5" />
                  <path d="M12 14c0 1 .5 2.5 1.5 3.5" />
                  <path d="M12 14c0 1.5-.5 3-2 4" />
                </svg>
                {biometricLoading ? 'Verifying…' : 'Sign in with Face ID'}
              </button>

              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">or</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            </>
          )}

          <div className="grid gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
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
                onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none transition"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <button
              onClick={handleSignIn}
              disabled={loading || !email || !password}
              className="mt-1 w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-[#162d55] disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-semibold text-slate-900 hover:underline">
              Start free trial
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
