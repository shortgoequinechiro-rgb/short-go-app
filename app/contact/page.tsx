'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Send, CheckCircle, Loader2 } from 'lucide-react'

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    practiceName: '',
    message: '',
  })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg('')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Something went wrong')
      }

      setStatus('sent')
    } catch (err: unknown) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      {/* ── Nav ── */}
      <nav className="border-b border-white/5 bg-[#0a1628]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/stride-logo-gold.png" alt="Stride" width={40} height={40} />
            <span className="text-xl font-bold tracking-tight">
              <span className="text-white">STRIDE</span>
              <span className="ml-2 hidden text-xs tracking-widest uppercase text-[#c9a227]/60 sm:inline">
                Equine & Canine Chiro
              </span>
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-white/50 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-2xl px-6 py-16 md:py-24">
        {/* ── Header ── */}
        <div className="mb-12 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.3em] text-[#c9a227]">
            Get in Touch
          </p>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            Contact Us
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base text-white/50 leading-relaxed">
            Have a question about Stride? Want to see a demo? Drop us a message and
            we&apos;ll get back to you within 24 hours.
          </p>
        </div>

        {status === 'sent' ? (
          /* ── Success state ── */
          <div className="rounded-3xl border border-[#c9a227]/20 bg-white/[0.03] p-10 text-center">
            <CheckCircle className="mx-auto mb-4 h-14 w-14 text-emerald-400" />
            <h2 className="mb-2 text-2xl font-bold">Message Sent!</h2>
            <p className="mb-8 text-white/50">
              Thanks for reaching out. We&apos;ll get back to you shortly.
            </p>
            <Link
              href="/"
              className="inline-block rounded-full bg-[#c9a227] px-8 py-3 font-semibold text-[#0a1628] transition-all hover:scale-105 hover:bg-[#ddb832]"
            >
              Back to Home
            </Link>
          </div>
        ) : (
          /* ── Form ── */
          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-3xl border border-white/5 bg-white/[0.03] p-8 md:p-10"
          >
            {/* Name + Email row */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-white/70">
                  Name <span className="text-[#c9a227]">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="Dr. Jane Smith"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-[#c9a227]/50 focus:ring-1 focus:ring-[#c9a227]/30"
                />
              </div>
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-white/70">
                  Email <span className="text-[#c9a227]">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-[#c9a227]/50 focus:ring-1 focus:ring-[#c9a227]/30"
                />
              </div>
            </div>

            {/* Phone + Practice row */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-white/70">
                  Phone <span className="text-white/30">(optional)</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-[#c9a227]/50 focus:ring-1 focus:ring-[#c9a227]/30"
                />
              </div>
              <div>
                <label htmlFor="practiceName" className="mb-1.5 block text-sm font-medium text-white/70">
                  Practice Name <span className="text-white/30">(optional)</span>
                </label>
                <input
                  id="practiceName"
                  type="text"
                  value={form.practiceName}
                  onChange={(e) => update('practiceName', e.target.value)}
                  placeholder="Smith Animal Chiropractic"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-[#c9a227]/50 focus:ring-1 focus:ring-[#c9a227]/30"
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-white/70">
                Message <span className="text-[#c9a227]">*</span>
              </label>
              <textarea
                id="message"
                required
                rows={5}
                value={form.message}
                onChange={(e) => update('message', e.target.value)}
                placeholder="Tell us what you're looking for..."
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-[#c9a227]/50 focus:ring-1 focus:ring-[#c9a227]/30"
              />
            </div>

            {/* Error */}
            {status === 'error' && (
              <p className="rounded-lg bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                {errorMsg}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={status === 'sending'}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#c9a227] py-4 font-bold text-lg text-[#0a1628] shadow-lg shadow-[#c9a227]/20 transition-all hover:scale-[1.02] hover:bg-[#ddb832] disabled:opacity-60 disabled:hover:scale-100"
            >
              {status === 'sending' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Send Message
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 bg-[#060e1a] py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-xs text-white/20">
          &copy; {new Date().getFullYear()} Stride Equine & Canine Chiropractic Software. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
