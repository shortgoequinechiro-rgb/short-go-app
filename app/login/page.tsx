'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignUp() {
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setMessage(`Sign up error: ${error.message}`)
    } else {
      setMessage('Account created. Check your email if confirmation is enabled.')
    }

    setLoading(false)
  }

  async function handleSignIn() {
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(`Sign in error: ${error.message}`)
    } else {
      router.push('/')
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

      {/* Subtle grain / vignette overlay */}
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
              Equine Chiropractic
            </p>
            <div className="mt-4 h-px w-12 rounded-full bg-slate-900" />
          </div>

          <p className="mb-6 text-sm text-slate-500">
            Sign in to access client records.
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
              />
            </div>

            <button
              onClick={handleSignIn}
              disabled={loading}
              className="mt-1 w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-[#162d55] disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>

            <button
              onClick={handleSignUp}
              disabled={loading}
              className="w-full rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? 'Working…' : 'Create Account'}
            </button>

            {message && (
              <p className={`text-sm ${message.includes('error') || message.includes('Error') ? 'text-red-500' : 'text-emerald-600'}`}>
                {message}
              </p>
            )}
          </div>

          <p className="mt-8 text-center text-xs text-slate-400">
            Dr. Andrew Leo D.C., M.S., cAVCA
          </p>
        </div>
      </div>
    </main>
  )
}