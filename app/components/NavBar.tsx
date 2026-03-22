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
    pathname === '/contact' ||
    pathname === '/select-mode'
  if (isPublicPage || !userEmail) return null

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Detect which mode we're in
  const isHumanMode = pathname?.startsWith('/human')

  const isAnatomy = pathname?.startsWith('/anatomy')
  const isHorse = pathname?.startsWith('/horses')
  const isCalendar = pathname?.startsWith('/calendar')
  const isAccount = pathname?.startsWith('/account') || pathname?.startsWith('/billing')
  const isHumanPatient = pathname?.startsWith('/human/patients')

  // Dashboard link based on current mode
  const dashboardHref = isHumanMode ? '/human/dashboard' : '/dashboard'
  const subtitle = isHumanMode ? 'Human Chiropractic' : 'Equine & Canine Chiro'

  const isHumanCalendar = pathname?.startsWith('/human/calendar')

  const navLinks = isHumanMode
    ? [
        { href: '/human/calendar', label: 'Scheduler', hidden: isHumanCalendar },
        { href: '/select-mode', label: 'Switch Mode', hidden: false },
        { href: '/account', label: 'Account', hidden: isAccount },
      ]
    : [
        { href: '/calendar', label: '📅 Scheduler', hidden: isCalendar },
        { href: '/select-mode', label: 'Switch Mode', hidden: false },
        { href: '/account', label: 'Account', hidden: isAccount },
      ]

  return (
    <nav className="sticky top-0 z-50 border-b border-[#1a3358] bg-[#0f2040] shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">

        {/* Left: logo + brand */}
        <Link href={dashboardHref} className="flex min-w-0 items-center gap-3">
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
              {subtitle}
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

        {/* Center: breadcrumb for human patient pages */}
        {isHumanPatient && (
          <div className="hidden items-center gap-1.5 text-sm md:flex">
            <Link href="/human/dashboard" className="text-blue-200 transition-colors hover:text-white">
              Dashboard
            </Link>
            <span className="text-white/30">/</span>
            <span className="font-medium text-white">Patient Record</span>
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
            {navLinks.map((link) =>
              link.hidden ? null : (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap rounded-xl border border-white/25 px-3 py-2 text-sm font-medium transition
                    ${link.href === '/select-mode'
                      ? 'bg-[#c9a227]/10 text-[#c9a227] border-[#c9a227]/30 hover:bg-[#c9a227]/20'
                      : link.href === '/calendar'
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'bg-transparent text-white/70 hover:bg-white/10 hover:text-white'}`}
                >
                  {link.label}
                </Link>
              )
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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
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
                        className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-white/10
                          ${link.href === '/select-mode' ? 'text-[#c9a227]' : 'text-white/90'}`}
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
