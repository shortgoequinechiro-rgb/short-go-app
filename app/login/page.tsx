'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0f2040 60%, #162d55 100%)' }}
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
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Short-Go
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500 uppercase tracking-widest">
              Equine &amp; Canine Chiropractic
            </p>
            <div className="mt-4 h-px w-12 rounded-full bg-slate-900" />
          </div>

          <p className="mb-6 text-sm text-slate-500">
            Sign in to access your practice records.
          </p>

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
