'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

export default function BillingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const success = searchParams.get('success')

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly')
  const [status, setStatus] = useState<string>('')
  const [daysLeft, setDaysLeft] = useState(0)
  const [graceDaysLeft, setGraceDaysLeft] = useState(0)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      try {
        const res = await fetch('/api/billing/ensure-practitioner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: session.access_token }),
        })
        if (res.ok) {
          const p = await res.json()
          setStatus(p.subscription_status || 'unknown')
          if (p.trial_ends_at) {
            const diff = Math.max(0, Math.ceil((new Date(p.trial_ends_at).getTime() - Date.now()) / 86400000))
            setDaysLeft(diff)
          }
          if (p.grace_period_ends_at) {
            const diff = Math.max(0, Math.ceil((new Date(p.grace_period_ends_at).getTime() - Date.now()) / 86400000))
            setGraceDaysLeft(diff)
          }
          // If user has active subscription, send them to dashboard
          if (p.subscription_status === 'active') {
            router.push('/dashboard')
            return
          }
        }
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [router])

  async function handleSubscribe() {
    setActionLoading(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const priceId = selectedPlan === 'annual'
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0f2040 60%, #162d55 100%)' }}>
        <div className="text-white/40 text-sm">Loading...</div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0f2040 60%, #162d55 100%)' }}>
        <div className="w-full max-w-md rounded-3xl bg-white/95 p-10 text-center shadow-2xl backdrop-blur-sm">
          <div className="mb-4 text-5xl">🎉</div>
          <h2 className="text-2xl font-bold text-slate-900">You&apos;re all set!</h2>
          <p className="mt-3 text-slate-500">Your subscription is active. Welcome to STRIDE.</p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-xl bg-slate-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#162d55]"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const trialExpired = status === 'trialing' && daysLeft === 0
  const isCanceled = status === 'canceled'
  const isPastDue = status === 'past_due'

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0f2040 60%, #162d55 100%)' }}>
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-widest text-white">STRIDE</h1>
          <p className="mt-1 text-sm text-blue-300 uppercase tracking-widest">
            Chiropractic Practice Management
          </p>
        </div>

        {/* Status message */}
        {trialExpired && (
          <div className="mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 px-5 py-4 text-center">
            <p className="text-amber-200 font-semibold">Your 7-day free trial has ended.</p>
            <p className="text-amber-200/70 text-sm mt-1">Choose a plan below to continue using STRIDE.</p>
          </div>
        )}
        {isCanceled && (
          <div className="mb-6 rounded-2xl bg-white/5 border border-white/10 px-5 py-4 text-center">
            <p className="text-white font-semibold">Your subscription has been canceled.</p>
            {graceDaysLeft > 0 ? (
              <p className="text-white/60 text-sm mt-1">You have {graceDaysLeft} day{graceDaysLeft !== 1 ? 's' : ''} of access remaining. Re-subscribe to keep your data.</p>
            ) : (
              <p className="text-white/60 text-sm mt-1">Re-subscribe below to regain access to your practice data.</p>
            )}
          </div>
        )}
        {isPastDue && (
          <div className="mb-6 rounded-2xl bg-red-500/10 border border-red-500/30 px-5 py-4 text-center">
            <p className="text-red-200 font-semibold">Your payment failed.</p>
            {graceDaysLeft > 0 ? (
              <p className="text-red-200/70 text-sm mt-1">You have {graceDaysLeft} day{graceDaysLeft !== 1 ? 's' : ''} to update your payment method before access is suspended.</p>
            ) : (
              <p className="text-red-200/70 text-sm mt-1">Update your payment method to restore access.</p>
            )}
          </div>
        )}

        {/* Pricing cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">

          {/* Monthly */}
          <button
            onClick={() => setSelectedPlan('monthly')}
            className={`rounded-2xl border-2 p-5 text-left transition ${
              selectedPlan === 'monthly'
                ? 'border-[#c9a227] bg-[#c9a227]/10'
                : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-300 mb-2">Monthly</p>
            <p className="text-3xl font-bold text-white">$49</p>
            <p className="text-sm text-blue-300/70 mt-0.5">per month</p>
            {selectedPlan === 'monthly' && (
              <div className="mt-3 text-xs font-semibold text-[#c9a227]">Selected</div>
            )}
          </button>

          {/* Annual */}
          <button
            onClick={() => setSelectedPlan('annual')}
            className={`relative rounded-2xl border-2 p-5 text-left transition ${
              selectedPlan === 'annual'
                ? 'border-[#c9a227] bg-[#c9a227]/10'
                : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            <div className="absolute -top-2.5 right-3 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
              Save 15%
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-300 mb-2">Annual</p>
            <p className="text-3xl font-bold text-white">$499</p>
            <p className="text-sm text-blue-300/70 mt-0.5">per year</p>
            {selectedPlan === 'annual' && (
              <div className="mt-3 text-xs font-semibold text-[#c9a227]">Selected</div>
            )}
          </button>
        </div>

        {/* 7-day trial badge */}
        {(trialExpired || status === 'trialing') && (
          <div className="mb-4 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1">
              <span className="text-emerald-400 text-xs font-bold">✓</span>
              <span className="text-xs font-semibold text-emerald-300">7-day free trial · No credit card required</span>
            </span>
          </div>
        )}

        {/* Subscribe button */}
        {error && <p className="text-sm text-red-400 text-center mb-3">{error}</p>}

        <button
          onClick={handleSubscribe}
          disabled={actionLoading}
          className="w-full rounded-xl bg-[#c9a227] py-4 text-base font-bold text-[#0f2040] transition hover:bg-[#b89020] disabled:opacity-50"
        >
          {actionLoading
            ? 'Redirecting to Stripe...'
            : `Subscribe — ${selectedPlan === 'annual' ? '$499/year' : '$49/month'}`
          }
        </button>

        <p className="mt-3 text-[11px] text-blue-400/60 text-center">
          Payments processed securely by Stripe. Cancel anytime.
        </p>

        {/* What's included */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-4">Everything in STRIDE Pro</p>
          <div className="grid grid-cols-2 gap-2 text-sm text-blue-200/80">
            <div>&#10003; Unlimited patients</div>
            <div>&#10003; SOAP notes & visits</div>
            <div>&#10003; Spine assessments</div>
            <div>&#10003; Client portal</div>
            <div>&#10003; Intake forms</div>
            <div>&#10003; Appointment booking</div>
            <div>&#10003; SMS reminders</div>
            <div>&#10003; Offline mode</div>
            <div>&#10003; Document storage</div>
            <div>&#10003; AI-powered SOAP</div>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-blue-400/60 hover:text-blue-300 transition">
            Sign in with a different account
          </Link>
        </div>
      </div>
    </div>
  )
}
