"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import MarketingLayout from "@/app/components/MarketingLayout";
import { FadeIn, SlideIn } from "@/app/components/motion-helpers";
import {
  Send,
  CheckCircle,
  Loader2,
  Mail,
  MessageSquare,
  Clock,
  ChevronRight,
} from "lucide-react";

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    practiceName: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      setStatus("sent");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to send. Please try again.");
    }
  }

  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="pt-32 pb-16 md:pt-40 md:pb-20 bg-gradient-to-b from-[#0a1628] via-[#0f2040] to-[#0a1628] relative">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }} />
        <div className="max-w-4xl mx-auto px-6 text-center relative">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-4xl md:text-6xl font-bold tracking-tight mb-6"
          >
            Get in
            <span className="bg-gradient-to-r from-[#c9a227] via-[#f5e6b8] to-[#c9a227] bg-clip-text text-transparent">
              {" "}touch.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white/50 text-lg md:text-xl max-w-2xl mx-auto"
          >
            Have a question? Want to see a demo? We&apos;d love to hear from you.
          </motion.p>
        </div>
      </section>

      {/* Content */}
      <section className="pb-24 md:pb-32 bg-[#0a1628]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-5 gap-12">
            {/* Left: info cards */}
            <div className="lg:col-span-2 space-y-6">
              <SlideIn direction="left">
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                  <div className="w-10 h-10 rounded-xl bg-[#c9a227]/10 flex items-center justify-center mb-4">
                    <Mail className="w-5 h-5 text-[#c9a227]" />
                  </div>
                  <h3 className="font-semibold mb-1">Email Us</h3>
                  <p className="text-white/40 text-sm mb-3">For general inquiries and support.</p>
                  <a href="mailto:hello@chirostride.com" className="text-[#c9a227] text-sm font-medium hover:underline">
                    hello@chirostride.com
                  </a>
                </div>
              </SlideIn>

              <SlideIn direction="left" delay={0.1}>
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                  <div className="w-10 h-10 rounded-xl bg-[#c9a227]/10 flex items-center justify-center mb-4">
                    <MessageSquare className="w-5 h-5 text-[#c9a227]" />
                  </div>
                  <h3 className="font-semibold mb-1">Request a Demo</h3>
                  <p className="text-white/40 text-sm">
                    Want a walkthrough? Let us know in your message and we&apos;ll set up a time.
                  </p>
                </div>
              </SlideIn>

              <SlideIn direction="left" delay={0.2}>
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                  <div className="w-10 h-10 rounded-xl bg-[#c9a227]/10 flex items-center justify-center mb-4">
                    <Clock className="w-5 h-5 text-[#c9a227]" />
                  </div>
                  <h3 className="font-semibold mb-1">Response Time</h3>
                  <p className="text-white/40 text-sm">
                    We typically respond within 24 hours on business days.
                  </p>
                </div>
              </SlideIn>
            </div>

            {/* Right: form */}
            <div className="lg:col-span-3">
              <SlideIn direction="right">
                {status === "sent" ? (
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
                  <form
                    onSubmit={handleSubmit}
                    className="space-y-6 rounded-3xl border border-white/5 bg-white/[0.03] p-8 md:p-10"
                  >
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
                          onChange={(e) => update("name", e.target.value)}
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
                          onChange={(e) => update("email", e.target.value)}
                          placeholder="jane@example.com"
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-[#c9a227]/50 focus:ring-1 focus:ring-[#c9a227]/30"
                        />
                      </div>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2">
                      <div>
                        <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-white/70">
                          Phone <span className="text-white/30">(optional)</span>
                        </label>
                        <input
                          id="phone"
                          type="tel"
                          value={form.phone}
                          onChange={(e) => update("phone", e.target.value)}
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
                          onChange={(e) => update("practiceName", e.target.value)}
                          placeholder="Smith Animal Chiropractic"
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-[#c9a227]/50 focus:ring-1 focus:ring-[#c9a227]/30"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-white/70">
                        Message <span className="text-[#c9a227]">*</span>
                      </label>
                      <textarea
                        id="message"
                        required
                        rows={5}
                        value={form.message}
                        onChange={(e) => update("message", e.target.value)}
                        placeholder="Tell us what you're looking for..."
                        className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-[#c9a227]/50 focus:ring-1 focus:ring-[#c9a227]/30"
                      />
                    </div>

                    {status === "error" && (
                      <p className="rounded-lg bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                        {errorMsg}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={status === "sending"}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[#c9a227] py-4 font-bold text-lg text-[#0a1628] shadow-lg shadow-[#c9a227]/20 transition-all hover:scale-[1.02] hover:bg-[#ddb832] disabled:opacity-60 disabled:hover:scale-100"
                    >
                      {status === "sending" ? (
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
              </SlideIn>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
