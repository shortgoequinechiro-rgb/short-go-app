"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import MarketingLayout from "@/app/components/MarketingLayout";
import { FadeIn } from "@/app/components/motion-helpers";
import {
  Check,
  ChevronRight,
  Star,
  HelpCircle,
  Zap,
  Shield,
  Clock,
  Users,
} from "lucide-react";

/* ───────────────── data ───────────────── */

const allFeatures = [
  { category: "Patient Management", features: [
    "Unlimited patients (all species)",
    "Detailed patient profiles with photos",
    "Owner management with multi-pet support",
    "Full visit timeline and history",
    "Quick search across all records",
  ]},
  { category: "Clinical Tools", features: [
    "AI-powered SOAP note generation",
    "Interactive spine assessment maps",
    "3D anatomy viewer with annotations",
    "Toggleable anatomy layers (skeleton, muscles, nerves)",
    "Visit-over-visit comparison tools",
  ]},
  { category: "Scheduling & Communication", features: [
    "Full appointment calendar (day/week/month)",
    "Automated SMS reminders via Twilio",
    "Automated email reminders via Resend",
    "One-tap client confirmation links",
    "Appointment history tracking",
  ]},
  { category: "Forms & Documents", features: [
    "Digital intake forms",
    "Digital consent forms with e-signatures",
    "Send forms via SMS or email",
    "Auto-populate records from intake data",
    "PDF export for reports and records",
  ]},
  { category: "Billing & Invoicing", features: [
    "Invoice creation and management",
    "Stripe payment integration",
    "Track outstanding balances",
    "Service and pricing management",
    "Revenue reporting",
  ]},
  { category: "Platform", features: [
    "Offline mode — works without signal",
    "Progressive Web App (install on any device)",
    "Automatic background sync",
    "Encrypted data with Supabase",
    "99.9% uptime guarantee",
  ]},
];

const faqs = [
  {
    q: "How does the free trial work?",
    a: "Sign up with just your email — no credit card required. You get full access to every feature for 7 days. If you love it, subscribe. If not, no worries.",
  },
  {
    q: "Can I switch between monthly and annual billing?",
    a: "Yes! You can switch at any time from your account settings. When you switch to annual, you'll save 15% compared to monthly billing.",
  },
  {
    q: "What happens to my data if I cancel?",
    a: "Your data remains accessible for 7 days after cancellation. You can export everything during that period. After that, data is securely deleted.",
  },
  {
    q: "Is there a limit on patients or SOAP notes?",
    a: "No limits. Add as many patients, generate as many SOAP notes, and book as many appointments as you need. Everything is unlimited.",
  },
  {
    q: "Does it work on my phone?",
    a: "Chiro Stride is a Progressive Web App. Install it on your iPhone, Android, or tablet — it looks and feels like a native app. No app store required.",
  },
  {
    q: "What about offline use?",
    a: "Chiro Stride works fully offline. Take notes at the barn without cell signal. Everything syncs automatically when connectivity returns.",
  },
];

/* ───────────────── page ───────────────── */

export default function PricingPage() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-28 bg-gradient-to-b from-[#0e1e38] via-[#0f2040] to-[#0e1e38] relative">
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
            Simple, transparent
            <br />
            <span className="bg-gradient-to-r from-[#c9a227] via-[#f5e6b8] to-[#c9a227] bg-clip-text text-transparent">
              pricing.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white/70 text-lg md:text-xl max-w-2xl mx-auto"
          >
            One plan. Everything included. No hidden fees, no per-patient charges, no surprises.
          </motion.p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="pb-24 md:pb-32 bg-[#0e1e38]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8 -mt-4">
            {/* Monthly */}
            <FadeIn>
              <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 md:p-10 relative h-full flex flex-col">
                <h3 className="text-lg font-semibold mb-1">Monthly</h3>
                <p className="text-white/60 text-sm mb-6">Pay as you go. Cancel anytime.</p>
                <div className="mb-6">
                  <span className="text-5xl font-black text-white">$49</span>
                  <span className="text-white/60 text-lg">/month</span>
                </div>
                <Link
                  href="/signup"
                  className="block w-full py-4 rounded-full border border-white/20 text-white font-bold text-center hover:bg-white/5 transition-all mb-8"
                >
                  Start 7-Day Free Trial
                </Link>
                <div className="space-y-3 flex-1">
                  {["Everything included", "Unlimited patients", "Cancel anytime", "No credit card for trial"].map((f, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Check className="w-4 h-4 text-[#c9a227] shrink-0" />
                      <span className="text-white/60 text-sm">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>

            {/* Annual */}
            <FadeIn delay={0.15}>
              <div className="bg-white/[0.03] border border-[#c9a227]/30 rounded-3xl p-8 md:p-10 relative h-full flex flex-col overflow-hidden">
                {/* Glow */}
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#c9a227]/10 rounded-full blur-3xl" />

                {/* Badge */}
                <div className="absolute top-6 right-6 bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full">
                  SAVE 15%
                </div>

                <div className="relative">
                  <div className="flex items-center gap-1 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-[#c9a227] text-[#c9a227]" />
                    ))}
                  </div>
                  <h3 className="text-lg font-semibold mb-1">Annual</h3>
                  <p className="text-white/60 text-sm mb-6">Best value. Save $89/year.</p>
                  <div className="mb-2">
                    <span className="text-5xl font-black text-white">$499</span>
                    <span className="text-white/60 text-lg">/year</span>
                  </div>
                  <p className="text-white/50 text-xs mb-6">That&apos;s just $41.58/month</p>
                  <Link
                    href="/signup"
                    className="block w-full py-4 rounded-full bg-[#c9a227] text-[#0a1628] font-bold text-center text-lg hover:bg-[#ddb832] transition-all hover:scale-[1.02] shadow-lg shadow-[#c9a227]/20 mb-8"
                  >
                    Start 7-Day Free Trial
                  </Link>
                  <div className="space-y-3">
                    {["Everything included", "Unlimited patients", "Priority support", "No credit card for trial"].map((f, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Check className="w-4 h-4 text-[#c9a227] shrink-0" />
                        <span className="text-white/60 text-sm">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>

          {/* Trust badges */}
          <FadeIn delay={0.3}>
            <div className="flex flex-wrap items-center justify-center gap-8 mt-12 text-white/50 text-sm">
              {[
                { icon: Shield, text: "Secure & encrypted" },
                { icon: Clock, text: "7-day free trial" },
                { icon: Users, text: "Unlimited patients" },
                { icon: Zap, text: "Instant setup" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <item.icon className="w-4 h-4 text-[#c9a227]/50" />
                  {item.text}
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Full feature breakdown */}
      <section className="py-24 md:py-32 bg-gradient-to-b from-[#0e1e38] via-[#0f2040] to-[#0e1e38] border-y border-white/5">
        <div className="max-w-5xl mx-auto px-6">
          <FadeIn className="text-center mb-16">
            <p className="text-[#c9a227] text-sm tracking-[0.3em] uppercase font-medium mb-3">What&apos;s Included</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Everything.
              <span className="text-white/50"> Seriously.</span>
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {allFeatures.map((category, i) => (
              <FadeIn key={i} delay={i * 0.08}>
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                  <h3 className="text-sm font-semibold text-[#c9a227] mb-4 tracking-wide uppercase">{category.category}</h3>
                  <div className="space-y-3">
                    {category.features.map((f, j) => (
                      <div key={j} className="flex items-start gap-2.5">
                        <Check className="w-3.5 h-3.5 text-[#c9a227]/60 shrink-0 mt-0.5" />
                        <span className="text-white/70 text-sm">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 md:py-32 bg-[#0e1e38]">
        <div className="max-w-3xl mx-auto px-6">
          <FadeIn className="text-center mb-16">
            <p className="text-[#c9a227] text-sm tracking-[0.3em] uppercase font-medium mb-3">FAQ</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Questions?
              <span className="text-white/50"> Answers.</span>
            </h2>
          </FadeIn>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <FadeIn key={i} delay={i * 0.06}>
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition">
                  <h3 className="text-white font-semibold mb-2 flex items-start gap-3">
                    <HelpCircle className="w-5 h-5 text-[#c9a227] shrink-0 mt-0.5" />
                    {faq.q}
                  </h3>
                  <p className="text-white/60 text-sm leading-relaxed ml-8">{faq.a}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 md:py-32 bg-gradient-to-b from-[#0e1e38] via-[#0f2040] to-[#0e1e38] border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
              Ready to get started?
            </h2>
          </FadeIn>
          <FadeIn delay={0.15}>
            <p className="text-white/70 text-lg mb-10">
              7-day free trial. No credit card required. Full access to everything.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[#c9a227] text-[#0a1628] font-bold text-lg hover:bg-[#ddb832] transition-all hover:scale-105 shadow-lg shadow-[#c9a227]/20"
            >
              Start Free Trial
              <ChevronRight className="w-5 h-5" />
            </Link>
          </FadeIn>
        </div>
      </section>
    </MarketingLayout>
  );
}
