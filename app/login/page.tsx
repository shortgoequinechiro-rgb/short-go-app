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
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto mt-16 max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Short-Go Login</h1>
        <p className="mt-2 text-slate-600">
          Sign in to access client records.
        </p>

        <div className="mt-6 grid gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
              placeholder="Password"
            />
          </div>

          <button
            onClick={handleSignIn}
            disabled={loading}
            className="rounded-xl bg-slate-900 px-5 py-3 text-white disabled:opacity-50"
          >
            {loading ? 'Working...' : 'Sign In'}
          </button>

          <button
            onClick={handleSignUp}
            disabled={loading}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-slate-900 disabled:opacity-50"
          >
            {loading ? 'Working...' : 'Create Account'}
          </button>

          {message ? (
            <p className="text-sm text-slate-700">{message}</p>
          ) : null}
        </div>
      </div>
    </main>
  )
}