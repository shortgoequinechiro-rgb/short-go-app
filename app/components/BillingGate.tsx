'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '../lib/supabase'

// Paths that bypass billing/onboarding checks entirely.
// - /: landing page (unauthenticated visitors, exact match only)
// - /login, /signup: unauthenticated entry points
// - /onboarding: new user setup (can't check billing before onboarding completes)
// - /intake, /consent: accessed by horse owners without any account
// - /billing: the paywall destination itself
const PUBLIC_PREFIXES = ['/login', '/signup', '/onboarding', '/intake', '/consent', '/billing', '/landing']

export default function BillingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const checked = useRef(false)

  const isPublic =
    pathname === '/' ||
    PUBLIC_PREFIXES.some((p) => pathname?.startsWith(p))

  useEffect(() => {
    // Public paths always pass through without any checks
    if (isPublic) {
      setReady(true)
      return
    }

    // Only run once per mount cycle to avoid double-checks
    if (checked.current) return
    checked.current = true

    async function checkAccess() {
      // When offline, skip billing checks entirely — let the user work with cached data
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setReady(true)
        return
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Not logged in — let the individual page handle its own auth redirect
        setReady(true)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setReady(true)
        return
      }

      try {
        // Ensure practitioner record exists (creates a 14-day trial for brand-new signups)
        const res = await fetch('/api/billing/ensure-practitioner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: session.access_token }),
        })

        if (!res.ok) {
          // If the check fails, don't block the user — fail open
          console.error('BillingGate: ensure-practitioner returned', res.status)
          setReady(true)
          return
        }

        const practitioner = await res.json()

        // 1. Onboarding check — new users must complete setup first
        if (!practitioner.onboarding_complete) {
          router.push('/onboarding')
          return
        }

        // 2. Billing check — block access if trial expired or subscription is not active
        const status = practitioner.subscription_status as string
        const trialEnd = practitioner.trial_ends_at
          ? new Date(practitioner.trial_ends_at)
          : null
        const trialExpired = trialEnd ? trialEnd < new Date() : false

        const hasAccess =
          status === 'active' || (status === 'trialing' && !trialExpired)

        if (!hasAccess) {
          router.push('/billing')
          return
        }
      } catch (err) {
        // On network error, fail open so we don't lock users out unexpectedly
        console.error('BillingGate error:', err)
      }

      setReady(true)
    }

    checkAccess()
  }, [pathname, isPublic, router])

  // Show a minimal loading state while checking (only on gated routes)
  if (!ready && !isPublic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    )
  }

  return <>{children}</>
}
