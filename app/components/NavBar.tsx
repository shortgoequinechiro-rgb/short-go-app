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

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">

        {/* Left: logo + brand */}
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
            <Image
              src="/logo.png"
              alt="Short-Go"
              fill
              className="object-contain p-0.5"
            />
          </div>
          <span className="hidden whitespace-nowrap text-sm font-semibold text-slate-900 sm:block">
            Short-Go Equine Chiropractic
          </span>
        </Link>

        {/* Center: breadcrumb on sub-pages */}
        {(isHorse || isAnatomy) && (
          <div className="hidden items-center gap-1.5 text-sm text-slate-500 md:flex">
            <Link href="/" className="transition-colors hover:text-slate-900">
              Dashboard
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-900">
              {isAnatomy ? 'Anatomy Viewer' : 'Horse Record'}
            </span>
          </div>
        )}

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <span className="hidden max-w-[200px] truncate text-sm text-slate-500 xl:block">
            {userEmail}
          </span>
          {!isAnatomy && (
            <Link
              href="/anatomy"
              className="whitespace-nowrap rounded-xl border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              Anatomy Viewer
            </Link>
          )}
          <button
            onClick={handleSignOut}
            className="whitespace-nowrap rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
          >
            Sign Out
          </button>
        </div>

      </div>
    </nav>
  )
}
