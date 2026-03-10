'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

type Practitioner = {
  subscription_status: string
  trial_ends_at: string | null
  stripe_customer_id: string | null
  email: string | null
}

function getTrialDaysLeft(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0
  const end = new Date(trialEndsAt)
  const now = new Date()
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    trialing: 'bg-blue-100 text-blue-700',
    past_due: 'bg-amber-100 text-amber-700',
    canceled: 'bg-red-100 text-red-700',
    incomplete: 'bg-slate-100 text-slate-700',
  }
  const labels: Record<string, string> = {
    active: 'Active',
    trialing: 'Free Trial',
    past_due: 'Past Due',
    canceled: 'Canceled',
    incomplete: 'Incomplete',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${styles[status] ?? 'bg-slate-100 text-slate-700'}`}
    >
      {labels[status] ?? status}
    </span>
  )
}

function BillingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [practitioner, setPractitioner] = useState<Practitioner | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  const successParam = searchParams.get('success')
  const isSuccess = successParam === 'true'

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      const res = await fetch('/api/billing/ensure-practitioner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session.access_token }),
      })

      if (!res.ok) {
        setError('Could not load billing information. Please refresh.')
        setLoading(false)
        return
      }

      const data = await res.json()
      setPractitioner(data)
      setLoading(false)
    }

    load()
  }, [router])

  async function handleSubscribe() {
    setActionLoading(true)
    setError('')

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: session?.access_token }),
    })

    const data = await res.json()

    if (data.url) {
      window.location.href = data.url
    } else {
      setError(data.error || 'Failed to start checkout. Please try again.')
      setActionLoading(false)
    }
  }

  async function handleManageBilling() {
    setActionLoading(true)
    setError('')

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch('/api/billing/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: session?.access_token }),
    })

    const data = await res.json()

    if (data.url) {
      window.location.href = data.url
    } else {
      setError(data.error || 'Failed to open billing portal. Please try again.')
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm">Loading billing info…</div>
      </div>
    )
  }

  const status = practitioner?.subscription_status ?? 'unknown'
  const daysLeft = getTrialDaysLeft(practitioner?.trial_ends_at ?? null)
  const trialExpired = status === 'trialing' && daysLeft === 0
  const hasStripeCustomer = Boolean(practitioner?.stripe_customer_id)
  const needsSubscription =
    !practitioner ||
    trialExpired ||
    status === 'canceled' ||
    status === 'incomplete' ||
    status === 'past_due'

  return (
    <main
      className="relative min-h-screen"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0f2040 60%, #162d55 100%)' }}
    >
      <div className="mx-auto max-w-2xl px-4 py-16">

        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-sm text-blue-300 hover:text-white transition mb-6 inline-block">
            ← Back to dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white">Billing &amp; Subscription</h1>
          <p className="mt-2 text-blue-200">
            Manage your Short-Go subscription
          </p>
        </div>

        {/* Success banner */}
        {isSuccess && (
          <div className="mb-6 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 px-6 py-4">
            <p className="text-emerald-300 font-medium">
              🎉 You&apos;re all set! Your subscription is now active.
            </p>
          </div>
        )}

        {/* Main card */}
        <div className="rounded-3xl bg-white/95 p-8 shadow-2xl backdrop-blur-sm">

          {/* Current plan */}
          <div className="mb-8 pb-8 border-b border-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Current Plan
                </p>
                <p className="text-xl font-bold text-slate-900">Short-Go Pro</p>
                <p className="text-sm text-slate-500 mt-0.5">$59 / month</p>
              </div>
              <StatusBadge status={status} />
            </div>

            {/* Trial countdown */}
            {status === 'trialing' && !trialExpired && (
              <div className="mt-4 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                <p className="text-sm text-blue-700">
                  <span className="font-semibold">{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span> in your free trial.
                  Add a payment method before it ends to keep access.
                </p>
              </div>
            )}

            {/* Trial expired */}
            {trialExpired && (
              <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="text-sm text-amber-700 font-medium">
                  Your free trial has ended. Subscribe to restore access to your practice records.
                </p>
              </div>
            )}

            {/* Past due */}
            {status === 'past_due' && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-700 font-medium">
                  Your last payment failed. Please update your payment method to restore full access.
                </p>
              </div>
            )}

            {/* Canceled */}
            {status === 'canceled' && (
              <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                <p className="text-sm text-slate-600">
                  Your subscription has been canceled. Re-subscribe below to regain access.
                </p>
              </div>
            )}
          </div>

          {/* What's included */}
          <div className="mb-8 pb-8 border-b border-slate-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
              What&apos;s Included
            </p>
            <ul className="space-y-2">
              {[
                'Unlimited patient records (horses & dogs)',
                'AI-powered SOAP note generation',
                'Digital intake & consent forms',
                'Visit photos & anatomy viewer',
                'Spine assessment tracker',
                'Appointment scheduling',
                'Offline mode with sync',
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-0.5 text-emerald-500 font-bold shrink-0">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {error && (
              <p className="text-sm text-red-500 mb-2">{error}</p>
            )}

            {needsSubscription ? (
              <button
                onClick={handleSubscribe}
                disabled={actionLoading}
                className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-[#162d55] disabled:opacity-50"
              >
                {actionLoading
                  ? 'Redirecting to checkout…'
                  : status === 'canceled'
                  ? 'Re-subscribe — $59/month'
                  : 'Start Free Trial — $59/month after'}
              </button>
            ) : (
              <>
                {hasStripeCustomer && (
                  <button
                    onClick={handleManageBilling}
                    disabled={actionLoading}
                    className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-[#162d55] disabled:opacity-50"
                  >
                    {actionLoading ? 'Opening portal…' : 'Manage Billing'}
                  </button>
                )}
                <p className="text-center text-xs text-slate-400">
                  Update card, view invoices, or cancel anytime from the billing portal.
                </p>
              </>
            )}

            {/* Always show subscribe button if trialing (to add payment info early) */}
            {status === 'trialing' && !trialExpired && (
              <button
                onClick={handleSubscribe}
                disabled={actionLoading}
                className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {actionLoading ? 'Redirecting…' : 'Add Payment Method Now'}
              </button>
            )}
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center text-xs text-blue-200/60">
          Payments are securely processed by Stripe. Cancel anytime — no lock-in.
        </p>
      </div>
    </main>
  )
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingPageContent />
    </Suspense>
  )
}
