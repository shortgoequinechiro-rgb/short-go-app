'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { NotificationBell } from './NotificationBell'

export default function NavBar() {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null)
    }).catch(() => {})
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    setMoreOpen(false)
  }, [pathname])

  const isPublicPage =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname?.startsWith('/onboarding') ||
    pathname === '/contact' ||
    pathname === '/features' ||
    pathname === '/pricing' ||
    pathname === '/about' ||
    pathname === '/blog'
  if (isPublicPage || !userEmail) return null

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isAnatomy = pathname?.startsWith('/anatomy')
  const isHorse = pathname?.startsWith('/horses')
  const isCalendar = pathname?.startsWith('/calendar')
  const isInvoices = pathname?.startsWith('/invoices')
  const isReports = pathname?.startsWith('/reports')
  const isComms = pathname?.startsWith('/communications')
  const isServices = pathname?.startsWith('/services')
  const isHelp = pathname?.startsWith('/help')
  const isAccount = pathname?.startsWith('/account') || pathname?.startsWith('/billing')

  // Mobile nav links — show all pages for easy access
  const mobileNavLinks = [
    { href: '/dashboard', label: '\u{1F3E0} Dashboard', icon: 'dashboard' },
    { href: '/calendar', label: '\u{1F4C5} Scheduler', icon: 'calendar' },
    { href: '/invoices', label: '\u{1F4B0} Invoices', icon: 'invoices' },
    { href: '/reports', label: '\u{1F4CA} Reports', icon: 'reports' },
    { href: '/communications', label: '\u{1F4E8} Messages', icon: 'comms' },
    { href: '/services', label: '\u{1F4CB} Services', icon: 'services' },
    { href: '/help', label: '\u{2753} Help', icon: 'help' },
    { href: '/account', label: '\u{2699}\u{FE0F} Account', icon: 'account' },
  ]

  return (
    <nav className="sticky top-0 z-50 border-b border-[#1e3a60] bg-[#0f2040] shadow-[0_2px_16px_rgba(0,0,0,0.3)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 md:px-6">

        {/* Left: logo + brand */}
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
          <div className="relative h-10 w-10 flex-shrink-0 sm:h-12 sm:w-12">
            <Image
              src="/logo-gold.png"
              alt="Chiro Stride"
              fill
              className="object-contain"
            />
          </div>
          <div className="hidden flex-col leading-none sm:flex">
            <span className="whitespace-nowrap text-lg font-extrabold tracking-widest text-white md:text-xl">
              CHIRO STRIDE
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

        {/* Right: desktop nav + notifications + email */}
        <div className="flex items-center gap-2">
          {/* Email (xl only) */}
          <span className="hidden max-w-[180px] truncate text-sm text-blue-200 xl:block">
            {userEmail}
          </span>

          {/* Desktop links */}
          <div className="hidden items-center gap-1.5 md:flex">
            {!isCalendar && (
              <Link
                href="/calendar"
                className="whitespace-nowrap rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
              >
                Scheduler
              </Link>
            )}
            {!isInvoices && (
              <Link
                href="/invoices"
                className="whitespace-nowrap rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
              >
                Invoices
              </Link>
            )}
            {!isReports && (
              <Link
                href="/reports"
                className="whitespace-nowrap rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
              >
                Reports
              </Link>
            )}
            {!isComms && (
              <Link
                href="/communications"
                className="whitespace-nowrap rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
              >
                Messages
              </Link>
            )}

            {/* More dropdown — Services, Help, Account */}
            <div className="relative" ref={moreRef}>
              <button
                onClick={() => setMoreOpen((o) => !o)}
                className={`whitespace-nowrap rounded-xl border border-white/25 px-3 py-2 text-sm font-medium transition inline-flex items-center gap-1.5 ${
                  isServices || isHelp || isAccount
                    ? 'bg-white/20 text-white'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                More
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-3.5 w-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {moreOpen && (
                <div className="absolute right-0 top-11 z-50 w-48 overflow-hidden rounded-2xl border border-[#1e3a60] bg-[#132a4d] shadow-2xl">
                  <div className="p-1.5">
                    <Link
                      href="/services"
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        isServices ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="text-base">&#128203;</span>
                      Services
                    </Link>
                    <Link
                      href="/help"
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        isHelp ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="text-base">&#10067;</span>
                      Help
                    </Link>
                    <Link
                      href="/account"
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        isAccount ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="text-base">&#9881;&#65039;</span>
                      Account
                    </Link>
                  </div>
                  <div className="border-t border-white/10 p-1.5">
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-300 transition hover:bg-white/10"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notification bell — visible on all sizes */}
          <NotificationBell />

          {/* Mobile: hamburger */}
          <div className="relative md:hidden" ref={menuRef}>
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

            {/* Mobile Dropdown — full navigation */}
            {menuOpen && (
              <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-[#1e3a60] bg-[#132a4d] shadow-2xl">
                {/* User email */}
                <div className="border-b border-white/10 px-4 py-3">
                  <p className="truncate text-xs text-blue-200">{userEmail}</p>
                </div>

                {/* Nav grid */}
                <div className="p-2">
                  {mobileNavLinks.map((link) => {
                    const isActive = pathname === link.href || pathname?.startsWith(link.href + '/')
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                          isActive
                            ? 'bg-white/15 text-white'
                            : 'text-white/80 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {link.label}
                      </Link>
                    )
                  })}
                </div>

                {/* Sign out */}
                <div className="border-t border-white/10 p-2">
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-300 transition hover:bg-white/10"
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
