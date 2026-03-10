'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '../lib/supabase'

// These paths bypass the billing check entirely
const PUBLIC_PATHS = ['/login', '/intake', '/consent', '/billing']

export default function BillingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const checked = useRef(false)

  const isPublic = PUBLIC_PATHS.some((p) => pathname?.startsWith(p))

  useEffect(() => {
    // Public paths (login, intake forms, consent forms, billing page itself) always pass through
    if (isPublic) {
      setReady(true)
      return
    }

    // Only run the billing check once per mount cycle
    if (checked.current) return
    checked.current = true

    async function checkBilling() {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        // Not logged in — let the page handle its own redirect to /login
        setReady(true)
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        setReady(true)
        return
      }

      try {
        // Ensure practitioner record exists (creates it if first login)
        const res = await fetch('/api/billing/ensure-practitioner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: session.access_token }),
        })

        if (!res.ok) {
          // If the API fails for some reason, don't block the user
          console.error('BillingGate: ensure-practitioner returned', res.status)
          setReady(true)
          return
        }

        const practitioner = await res.json()
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
        console.error('BillingGate error:', err)
        // On network error, don't block the user
      }

      setReady(true)
    }

    checkBilling()
  }, [pathname, isPublic, router])

  // Show a minimal loading state while checking billing (only on protected routes)
  if (!ready && !isPublic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    )
  }

  return <>{children}</>
}
