'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function NavBar() {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null)
    }).catch(() => {
      // Offline — try to get cached session
      // Supabase stores session in localStorage so getSession() should still work,
      // but if it throws, just leave email null (NavBar won't render)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // Don't render on public/marketing pages or when unauthenticated
  const isPublicPage =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname?.startsWith('/onboarding') ||
    pathname?.startsWith('/landing')
  if (isPublicPage || !userEmail) return null

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isAnatomy = pathname?.startsWith('/anatomy')
  const isHorse = pathname?.startsWith('/horses')
  const isCalendar = pathname?.startsWith('/calendar')
  const isAccount = pathname?.startsWith('/account') || pathname?.startsWith('/billing')

  const navLinks = [
    { href: '/calendar', label: '📅 Scheduler', hidden: isCalendar },
    { href: '/account', label: 'Account', hidden: isAccount },
  ]

  return (
    <nav className="sticky top-0 z-50 border-b border-[#1a3358] bg-[#0f2040] shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">

        {/* Left: logo + brand */}
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
          <div className="relative h-12 w-12 flex-shrink-0">
            <Image
              src="/logo-gold.png"
              alt="Stride"
              fill
              className="object-contain"
            />
          </div>
          <div className="hidden flex-col leading-none sm:flex">
            <span className="whitespace-nowrap text-lg font-extrabold tracking-widest text-white md:text-xl">
              STRIDE
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#c9a227]">
              Equine &amp; Canine Chiro
            </span>
          </div>
        </Link>

        {/* Center: breadcrumb on sub-pages (desktop only) */}
        {(isHorse || isAnatomy) && (
          <div className="hidden items-center gap-1.5 text-sm md:flex">
            <Link href="/dashboard" className="text-blue-200 transition-colors hover:text-white">
              Dashboard
            </Link>
            <span className="text-white/30">/</span>
            <span className="font-medium text-white">
              {isAnatomy ? 'Anatomy Viewer' : 'Patient Record'}
            </span>
          </div>
        )}

        {/* Right: desktop nav + email */}
        <div className="flex items-center gap-2">
          {/* Email (xl only) */}
          <span className="hidden max-w-[200px] truncate text-sm text-blue-200 xl:block">
            {userEmail}
          </span>

          {/* Desktop links */}
          <div className="hidden items-center gap-2 sm:flex">
            {!isCalendar && (
              <Link
                href="/calendar"
                className="whitespace-nowrap rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
              >
                📅 Scheduler
              </Link>
            )}
            {!isAccount && (
              <Link
                href="/account"
                className="whitespace-nowrap rounded-xl border border-white/25 bg-transparent px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Account
              </Link>
            )}
            <button
              onClick={handleSignOut}
              className="whitespace-nowrap rounded-xl border border-white/25 bg-transparent px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
            >
              Sign Out
            </button>
          </div>

          {/* Mobile: hamburger */}
          <div className="relative sm:hidden" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Open menu"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white transition hover:bg-white/20"
            >
              {menuOpen ? (
                /* X icon */
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                /* Hamburger icon */
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>

            {/* Dropdown */}
            {menuOpen && (
              <div className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-2xl border border-[#1a3358] bg-[#0f2040] shadow-2xl">
                {/* User email */}
                <div className="border-b border-white/10 px-4 py-3">
                  <p className="truncate text-xs text-blue-200">{userEmail}</p>
                </div>

                {/* Nav items */}
                <div className="p-1.5">
                  {navLinks.map((link) =>
                    link.hidden ? null : (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/10"
                      >
                        {link.label}
                      </Link>
                    )
                  )}

                  <button
                    onClick={handleSignOut}
                    className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-red-300 transition hover:bg-white/10"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </nav>
  )
}
