'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from './lib/supabase'

// ─── Feature card data ────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: '🧠',
    title: 'AI-Powered SOAP Notes',
    desc: 'Generate complete, professional SOAP notes from your visit findings in seconds — ready to send or save.',
  },
  {
    icon: '📋',
    title: 'Digital Intake & Consent Forms',
    desc: 'Send owners a link before the appointment. Forms fill your records automatically — no paper, no re-entry.',
  },
  {
    icon: '🐴',
    title: 'Horse & Dog Records',
    desc: 'Separate profiles for every patient with breed, discipline, barn location, and full visit history in one place.',
  },
  {
    icon: '🦴',
    title: 'Spine Assessment Tracker',
    desc: 'Document spinal findings visit-over-visit with a visual timeline to show owners real progress.',
  },
  {
    icon: '🫀',
    title: '3D Anatomy Viewer',
    desc: 'Walk through a full equine anatomy model and annotate regions directly — great for owner education.',
  },
  {
    icon: '📅',
    title: 'Appointment Scheduling',
    desc: 'Manage your calendar, track upcoming visits, and send appointment confirmations by email.',
  },
  {
    icon: '📸',
    title: 'Visit Photos',
    desc: 'Attach before/after photos to every visit so you and the owner can see changes over time.',
  },
  {
    icon: '📵',
    title: 'Offline Mode',
    desc: 'Works in the field with no signal. All data syncs automatically when you\'re back online.',
  },
]

// ─── Testimonial / social proof ───────────────────────────────────────────────
const TESTIMONIALS = [
  {
    quote: "Finally — software that actually understands how an equine chiropractic practice works. The AI SOAP notes alone save me 30 minutes a day.",
    name: "Dr. Sarah M.",
    title: "Certified Animal Chiropractor, TX",
  },
  {
    quote: "The digital intake forms changed everything. Owners fill them out from the barn and by the time I arrive I already know the horse's history.",
    name: "Dr. James K.",
    title: "Equine & Canine Practitioner, KY",
  },
  {
    quote: "I've tried three different practice management apps. None of them understood what we actually do until Stride.",
    name: "Dr. Alicia R.",
    title: "cAVCA Certified Chiropractor, CO",
  },
]

export default function LandingPage() {
  const router = useRouter()

  // Redirect authenticated users straight to the app
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard')
    })
  }, [router])

  return (
    <div className="min-h-screen bg-white">

      {/* ── NAV ────────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b border-white/10"
        style={{ background: '#0f2040' }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-gold.png" alt="Stride" className="h-14 w-14" />
            <div className="flex flex-col leading-none">
              <span className="text-xl font-extrabold text-white tracking-tight" style={{ fontFamily: "'Geist', system-ui, sans-serif" }}>
                Stride
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#c9a227]">
                Equine &amp; Canine Chiro
              </span>
            </div>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-medium text-white/80 transition hover:text-white"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-semibold text-[#0f2040] transition hover:bg-[#b89020]"
            >
              Start Free Trial
            </Link>
          </nav>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden px-6 py-24 md:py-36"
        style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0f2040 60%, #162d55 100%)' }}
      >
        {/* Horse silhouette */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-end"
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/horse-bg.png"
            alt=""
            className="h-full max-h-[800px] w-auto object-contain"
            style={{ opacity: 0.1, filter: 'invert(1) sepia(1) saturate(3) hue-rotate(5deg)' }}
          />
        </div>

        <div className="relative mx-auto max-w-4xl">
          {/* Brand lockup */}
          <div className="mb-8 flex items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-gold.png"
              alt="Stride"
              className="h-60 w-60 sm:h-72 sm:w-72 drop-shadow-2xl"
            />
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl" style={{ fontFamily: "'Geist', system-ui, sans-serif" }}>
                Stride
              </h2>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#c9a227]">
                Equine &amp; Canine Chiropractic
              </p>
            </div>
          </div>

          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#c9a227]/40 bg-[#c9a227]/10 px-4 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#c9a227]">
              Built for animal chiropractors
            </span>
          </div>

          <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl md:text-6xl">
            Practice management<br />
            <span className="text-[#c9a227]">built for the field.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-blue-200 leading-relaxed">
            Stride is the only practice management platform designed specifically for
            equine and canine chiropractors. AI SOAP notes, digital intake forms, spine
            tracking, and offline access — everything you need, nothing you don&apos;t.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className="rounded-2xl bg-[#c9a227] px-8 py-4 text-base font-bold text-[#0f2040] shadow-lg transition hover:bg-[#b89020]"
            >
              Start 14-Day Free Trial
            </Link>
            <Link
              href="/login"
              className="rounded-2xl border border-white/25 px-8 py-4 text-base font-medium text-white transition hover:bg-white/10"
            >
              Sign In →
            </Link>
          </div>

          <p className="mt-4 text-sm text-blue-200/60">
            No credit card required · Cancel anytime
          </p>
        </div>
      </section>

      {/* ── SOCIAL PROOF STRIP ─────────────────────────────────────────────── */}
      <section className="border-y border-slate-100 bg-slate-50 px-6 py-5">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-10 gap-y-2 text-sm text-slate-500">
          <span className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Equine &amp; canine records</span>
          <span className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> AI-generated SOAP notes</span>
          <span className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Works offline in the field</span>
          <span className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Digital intake &amp; consent forms</span>
          <span className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> No long-term contracts</span>
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────────────────── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Everything your practice needs
            </h2>
            <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
              Built by working with real practitioners, not by copying generic vet software.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-slate-200"
              >
                <div className="mb-3 text-3xl">{f.icon}</div>
                <h3 className="mb-2 font-bold text-slate-900">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────────────── */}
      <section
        className="px-6 py-24"
        style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0f2040 100%)' }}
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
              Your entire practice in one place
            </h2>
            <p className="mt-4 text-lg text-blue-200">
              From intake to SOAP note to follow-up email — all from your phone.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Owner fills out intake',
                desc: 'Send a link before you arrive. The owner fills in their horse or dog\'s history from their phone — no paper forms.',
              },
              {
                step: '02',
                title: 'You do the assessment',
                desc: 'Document findings with the spine tracker, anatomy viewer, and photo capture — all from the field, even offline.',
              },
              {
                step: '03',
                title: 'AI writes the SOAP note',
                desc: 'One tap generates a complete, professional SOAP note. Review, edit, and send the owner a summary by email.',
              },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl border border-white/10 bg-white/5 p-8">
                <div className="mb-4 text-4xl font-black text-[#c9a227]/40">{item.step}</div>
                <h3 className="mb-3 text-lg font-bold text-white">{item.title}</h3>
                <p className="text-sm text-blue-200 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ───────────────────────────────────────────────────── */}
      <section className="px-6 py-24 bg-slate-50">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-3xl font-extrabold text-slate-900 sm:text-4xl">
            Loved by animal chiropractors
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl bg-white p-8 shadow-sm border border-slate-100"
              >
                <p className="mb-6 text-slate-600 leading-relaxed text-sm">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{t.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────────────────────────── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-lg text-center">
          <h2 className="mb-4 text-3xl font-extrabold text-slate-900 sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mb-12 text-slate-500">
            One plan. Everything included. No surprises.
          </p>

          <div className="rounded-3xl border-2 border-[#0f2040] bg-white p-10 shadow-xl">
            <div className="mb-2 flex items-center justify-center gap-2">
              <span className="text-sm font-extrabold uppercase tracking-widest text-slate-900">Stride</span>
              <span className="rounded-full bg-[#c9a227]/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#c9a227]">Pro</span>
            </div>
            <div className="mb-1 flex items-end justify-center gap-1">
              <span className="text-6xl font-black text-slate-900">$59</span>
              <span className="mb-3 text-lg text-slate-400">/month</span>
            </div>
            <p className="mb-8 text-sm text-slate-400">
              14-day free trial · No credit card required
            </p>

            <ul className="mb-8 space-y-3 text-left">
              {[
                'Unlimited patient records',
                'AI SOAP note generation',
                'Digital intake & consent forms',
                'Spine assessment tracker',
                '3D anatomy viewer',
                'Appointment scheduling',
                'Visit photos & timeline',
                'Offline mode with sync',
                'Email summaries to owners',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-slate-700">
                  <span className="text-emerald-500 font-bold shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href="/signup"
              className="block w-full rounded-xl bg-[#0f2040] py-4 text-center text-sm font-bold text-white transition hover:bg-[#162d55]"
            >
              Start Free Trial
            </Link>
            <p className="mt-3 text-xs text-slate-400">
              Cancel anytime. No long-term commitment.
            </p>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────────────────── */}
      <section
        className="px-6 py-24 text-center"
        style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0f2040 100%)' }}
      >
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Ready to modernize your practice?
          </h2>
          <p className="mt-4 text-lg text-blue-200">
            Join practitioners who are spending less time on paperwork and more time with their patients.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-2xl bg-[#c9a227] px-10 py-4 text-base font-bold text-[#0f2040] shadow-lg transition hover:bg-[#b89020]"
            >
              Start Your Free Trial
            </Link>
          </div>
          <p className="mt-4 text-sm text-blue-200/50">
            14 days free · No credit card · Cancel anytime
          </p>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer
        className="border-t border-white/10 px-6 py-8"
        style={{ background: '#0a1628' }}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-blue-200/50 sm:flex-row">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-gold.png" alt="Stride" className="h-10 w-10 opacity-70" />
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-blue-200/70 text-sm">Stride</span>
              <span className="text-[10px] text-blue-200/40">Equine &amp; Canine Chiropractic</span>
            </div>
          </div>
          <div className="flex gap-6">
            <Link href="/login" className="transition hover:text-white">Sign In</Link>
            <Link href="/signup" className="transition hover:text-white">Sign Up</Link>
            <Link href="/billing" className="transition hover:text-white">Billing</Link>
          </div>
          <span>© {new Date().getFullYear()} Stride. All rights reserved.</span>
        </div>
      </footer>

    </div>
  )
}
