'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '../lib/supabase'

export default function SelectModePage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [practiceMode, setPracticeMode] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [practiceName, setPracticeName] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data: prac } = await supabase
        .from('practitioners')
        .select('practice_mode, logo_url, practice_name')
        .eq('id', user.id)
        .single()

      if (prac) {
        setPracticeMode(prac.practice_mode ?? 'both')
        setLogoUrl(prac.logo_url)
        setPracticeName(prac.practice_name ?? '')

        // If practitioner is limited to one mode, skip selection
        if (prac.practice_mode === 'humans') {
          router.replace('/human/dashboard')
          return
        }
        if (prac.practice_mode === 'animals') {
          router.replace('/dashboard')
          return
        }
      }

      setChecking(false)
    }
    init()
  }, [router])

  function selectMode(mode: 'humans' | 'animals') {
    if (mode === 'humans') {
      router.push('/human/dashboard')
    } else {
      router.push('/dashboard')
    }
  }

  if (checking) {
    return (
      <main
        className="flex min-h-screen items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0f2040 60%, #162d55 100%)' }}
      >
        <p className="text-white/60 text-sm animate-pulse">Loading...</p>
      </main>
    )
  }

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0f2040 60%, #162d55 100%)' }}
    >
      {/* Brand header */}
      <div className="mb-12 text-center">
        {logoUrl ? (
          <div className="mx-auto mb-4 h-20 w-20 overflow-hidden rounded-2xl bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="Practice logo" className="h-full w-full object-contain" />
          </div>
        ) : (
          <div className="mx-auto mb-4 relative h-16 w-16">
            <Image src="/logo-gold.png" alt="Stride" fill className="object-contain" />
          </div>
        )}
        <h1 className="text-3xl font-bold tracking-widest text-white">STRIDE</h1>
        {practiceName && (
          <p className="mt-1 text-sm font-medium text-[#c9a227] tracking-wide">{practiceName}</p>
        )}
        <p className="mt-4 text-blue-300/80 text-sm">Select your practice mode</p>
      </div>

      {/* Mode selection cards */}
      <div className="grid w-full max-w-2xl gap-6 sm:grid-cols-2">

        {/* Humans card */}
        <button
          onClick={() => selectMode('humans')}
          className="group relative overflow-hidden rounded-3xl border border-[#1a3358] bg-[#0d1b30] p-8 text-left transition-all duration-300 hover:border-[#c9a227]/60 hover:bg-[#0d1b30]/80 hover:shadow-[0_0_40px_rgba(201,162,39,0.15)] hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#c9a227]/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="relative">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#c9a227]/10">
              <svg viewBox="0 0 100 100" className="h-10 w-10" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Circle */}
                <circle cx="50" cy="52" r="38" stroke="#c9a227" strokeWidth="1.5" opacity="0.5" />
                {/* Square */}
                <rect x="18" y="18" width="64" height="70" rx="1" stroke="#c9a227" strokeWidth="1.5" opacity="0.3" />
                {/* Head */}
                <circle cx="50" cy="22" r="7" stroke="#c9a227" strokeWidth="2" />
                {/* Torso */}
                <line x1="50" y1="29" x2="50" y2="62" stroke="#c9a227" strokeWidth="2" />
                {/* Arms outstretched */}
                <line x1="50" y1="40" x2="22" y2="36" stroke="#c9a227" strokeWidth="2" strokeLinecap="round" />
                <line x1="50" y1="40" x2="78" y2="36" stroke="#c9a227" strokeWidth="2" strokeLinecap="round" />
                {/* Arms raised (secondary pose) */}
                <line x1="50" y1="38" x2="26" y2="22" stroke="#c9a227" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
                <line x1="50" y1="38" x2="74" y2="22" stroke="#c9a227" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
                {/* Legs */}
                <line x1="50" y1="62" x2="35" y2="88" stroke="#c9a227" strokeWidth="2" strokeLinecap="round" />
                <line x1="50" y1="62" x2="65" y2="88" stroke="#c9a227" strokeWidth="2" strokeLinecap="round" />
                {/* Legs spread (secondary pose) */}
                <line x1="50" y1="62" x2="24" y2="82" stroke="#c9a227" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
                <line x1="50" y1="62" x2="76" y2="82" stroke="#c9a227" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Humans</h2>
            <p className="text-sm text-blue-300/70 leading-relaxed">
              Patient records, SOAP notes, visit tracking, and scheduling for human chiropractic care.
            </p>
          </div>
          <div className="absolute bottom-4 right-4 text-[#c9a227] opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0 translate-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
        </button>

        {/* Animals card */}
        <button
          onClick={() => selectMode('animals')}
          className="group relative overflow-hidden rounded-3xl border border-[#1a3358] bg-[#0d1b30] p-8 text-left transition-all duration-300 hover:border-[#c9a227]/60 hover:bg-[#0d1b30]/80 hover:shadow-[0_0_40px_rgba(201,162,39,0.15)] hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#c9a227]/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="relative">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#c9a227]/10 text-4xl">
              🐴
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Animals</h2>
            <p className="text-sm text-blue-300/70 leading-relaxed">
              Equine &amp; canine chiropractic — spine assessments, 3D anatomy, patient records, and more.
            </p>
          </div>
          <div className="absolute bottom-4 right-4 text-[#c9a227] opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0 translate-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
        </button>

      </div>

      {/* Footer hint */}
      <p className="mt-8 text-xs text-blue-400/50">
        You can change this anytime in Account Settings
      </p>
    </main>
  )
}
