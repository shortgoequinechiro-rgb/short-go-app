'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function NavBar() {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Don't render on login page or when unauthenticated
  if (pathname === '/login' || !userEmail) return null

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isAnatomy = pathname?.startsWith('/anatomy')
  const isHorse = pathname?.startsWith('/horses')
  const isAppointments = pathname?.startsWith('/appointments')

  return (
    <nav className="sticky top-0 z-50 border-b border-[#1a3358] bg-[#0f2040] shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">

        {/* Left: logo + brand */}
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-xl bg-white/10">
            <Image
              src="/logo.png"
              alt="Short-Go"
              fill
              className="object-contain p-0.5"
            />
          </div>
          <span className="hidden whitespace-nowrap text-sm font-semibold text-white sm:block tracking-wide">
            Short-Go Equine Chiropractic
          </span>
        </Link>

        {/* Center: breadcrumb on sub-pages */}
        {(isHorse || isAnatomy) && (
          <div className="hidden items-center gap-1.5 text-sm md:flex">
            <Link href="/" className="text-blue-200 transition-colors hover:text-white">
              Dashboard
            </Link>
            <span className="text-white/30">/</span>
            <span className="font-medium text-white">
              {isAnatomy ? 'Anatomy Viewer' : 'Horse Record'}
            </span>
          </div>
        )}

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <span className="hidden max-w-[200px] truncate text-sm text-blue-200 xl:block">
            {userEmail}
          </span>
          {!isAppointments && (
            <Link
              href="/appointments"
              className="whitespace-nowrap rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
            >
              Appointments
            </Link>
          )}
          {!isAnatomy && (
            <Link
              href="/anatomy"
              className="whitespace-nowrap rounded-xl border border-[#c9a227] bg-[#c9a227] px-3 py-2 text-sm font-semibold text-[#0f2040] transition hover:bg-[#b89020] hover:border-[#b89020]"
            >
              Anatomy Viewer
            </Link>
          )}
          <button
            onClick={handleSignOut}
            className="whitespace-nowrap rounded-xl border border-white/25 bg-transparent px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
          >
            Sign Out
          </button>
        </div>

      </div>
    </nav>
  )
}
