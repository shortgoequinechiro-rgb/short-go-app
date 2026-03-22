'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '../lib/supabase'

const TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes of inactivity
const WARNING_MS = 2 * 60 * 1000 // Show warning 2 minutes before timeout
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart']

// Paths that don't need session timeout
const PUBLIC_PATHS = ['/login', '/signup', '/human/intake', '/human/portal']

export default function SessionTimeout() {
  const router = useRouter()
  const pathname = usePathname()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const warningRef = useRef<NodeJS.Timeout | null>(null)
  const warningShownRef = useRef(false)

  const isPublic = PUBLIC_PATHS.some(p => pathname?.startsWith(p)) || pathname === '/'

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/login?reason=timeout')
  }, [router])

  const resetTimer = useCallback(() => {
    if (isPublic) return

    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningRef.current) clearTimeout(warningRef.current)
    warningShownRef.current = false

    // Dismiss any visible warning
    const existing = document.getElementById('session-timeout-warning')
    if (existing) existing.remove()

    // Set warning timer
    warningRef.current = setTimeout(() => {
      warningShownRef.current = true
      const warning = document.createElement('div')
      warning.id = 'session-timeout-warning'
      warning.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#dc2626;color:white;text-align:center;padding:12px;font-size:14px;font-weight:600;'
      warning.textContent = 'Your session will expire in 2 minutes due to inactivity. Move your mouse or press any key to stay signed in.'
      document.body.appendChild(warning)
    }, TIMEOUT_MS - WARNING_MS)

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      handleLogout()
    }, TIMEOUT_MS)
  }, [isPublic, handleLogout])

  useEffect(() => {
    if (isPublic) return

    resetTimer()

    ACTIVITY_EVENTS.forEach(event =>
      document.addEventListener(event, resetTimer, { passive: true })
    )

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (warningRef.current) clearTimeout(warningRef.current)
      ACTIVITY_EVENTS.forEach(event =>
        document.removeEventListener(event, resetTimer)
      )
      const existing = document.getElementById('session-timeout-warning')
      if (existing) existing.remove()
    }
  }, [isPublic, resetTimer])

  return null // This component renders nothing — it just manages timers
}
