'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function fmtDate(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function ConfirmedContent() {
  const searchParams = useSearchParams()
  const error      = searchParams.get('error')
  const patientName = searchParams.get('name') ?? 'your appointment'
  const date        = searchParams.get('date') ?? ''

  if (error === 'not_found') {
    return (
      <div className="text-center">
        <div className="mb-4 text-5xl">❓</div>
        <h1 className="text-2xl font-bold text-white mb-2">Appointment Not Found</h1>
        <p className="text-blue-300 text-sm">
          This confirmation link may have expired or the appointment may have been removed.
          Please contact your provider directly.
        </p>
      </div>
    )
  }

  if (error === 'cancelled') {
    return (
      <div className="text-center">
        <div className="mb-4 text-5xl">❌</div>
        <h1 className="text-2xl font-bold text-white mb-2">Appointment Cancelled</h1>
        <p className="text-blue-300 text-sm">
          This appointment has been cancelled. Please contact your provider to reschedule.
        </p>
      </div>
    )
  }

  return (
    <div className="text-center">
      {/* Animated checkmark */}
      <div className="mb-6 flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 border-2 border-emerald-500/60 text-4xl">
          ✓
        </div>
      </div>

      <h1 className="text-3xl font-bold text-white mb-2">You&apos;re Confirmed!</h1>

      <p className="text-blue-200 text-base mb-6">
        {patientName}&apos;s appointment has been confirmed.
        {date && <><br /><span className="font-semibold text-white">{fmtDate(date)}</span></>}
      </p>

      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-4 text-sm text-emerald-200 mb-6">
        We&apos;ve noted your confirmation. No further action is needed — we&apos;ll see you then!
      </div>

      <p className="text-xs text-blue-400/60">
        If you need to reschedule, please contact your provider directly.
      </p>
    </div>
  )
}

export default function ConfirmedPage() {
  return (
    <main
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0f2040 60%, #162d55 100%)' }}
    >
      <div className="w-full max-w-md rounded-3xl border border-[#1a3358] bg-[#0d1b30]/80 p-10 shadow-2xl backdrop-blur">
        {/* Logo / brand */}
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#c9a227]">
            Stride Equine Chiropractic
          </p>
        </div>
        <Suspense>
          <ConfirmedContent />
        </Suspense>
      </div>
    </main>
  )
}
