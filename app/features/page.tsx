"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import MarketingLayout from "@/app/components/MarketingLayout";
import { FadeIn, SlideIn } from "@/app/components/motion-helpers";
import {
  ClipboardList,
  Bone,
  BrainCircuit,
  CalendarDays,
  FileSignature,
  WifiOff,
  Layers,
  PenTool,
  MessageSquare,
  Users,
  Check,
  ChevronRight,
  ArrowRight,
  Smartphone,
  BarChart3,
  CreditCard,
  Mail,
  Shield,
  Zap,
  Camera,
  FileText,
  Globe,
} from "lucide-react";

/* ───────────────── data ───────────────── */

const heroFeatures = [
  {
    id: "records",
    icon: ClipboardList,
    title: "Patient Records",
    tagline: "Complete profiles. Full history.",
    description:
      "Build detailed profiles for every equine and canine patient. Track breed, age, discipline, medical history, photos, and complete visit timelines — all in one place.",
    bullets: [
      "Species-specific profile fields for horses and dogs",
      "Photo uploads and visual documentation per visit",
      "Full visit timeline with linked SOAP notes",
      "Quick search across all patients and owners",
    ],
  },
  {
    id: "spine",
    icon: Bone,
    title: "Spine Assessment",
    tagline: "Map. Track. Visualize.",
    description:
      "Tap on species-specific spinal diagrams to record subluxation findings. Track changes across visits and visualize patient progress with built-in comparison tools.",
    bullets: [
      "Interactive spinal maps for equine and canine anatomy",
      "Tap-to-record subluxation findings per vertebra",
      "Visit-over-visit comparison and progress tracking",
      "Export assessment reports for client records",
    ],
  },
  {
    id: "ai-soap",
    icon: BrainCircuit,
    title: "AI SOAP Notes",
    tagline: "One click. Professional notes.",
    description:
      "Select a few quick clinical observations and let AI generate complete, professional SOAP notes. Spend more time with patients and less time writing documentation.",
    bullets: [
      "Quick-add chips for common subjective and objective findings",
      "AI generates assessment and plan from your observations",
      "Fully editable output — customize before saving",
      "Notes linked directly to patient records and visits",
    ],
  },
  {
    id: "scheduling",
    icon: CalendarDays,
    title: "Scheduling & Reminders",
    tagline: "Book. Remind. Confirm.",
    description:
      "Manage your entire appointment calendar from one place. Send automated reminders via SMS and email, and let clients confirm with a single tap.",
    bullets: [
      "Day, week, and month calendar views",
      "Automated SMS and email reminders",
      "One-tap client confirmation links",
      "Appointment history per patient and owner",
    ],
  },
  {
    id: "forms",
    icon: FileSignature,
    title: "Digital Intake & Consent",
    tagline: "No more paper. Ever.",
    description:
      "Send intake and consent forms directly to clients via text or email. Clients fill them out on their phone with built-in e-signatures. Data flows right into patient records.",
    bullets: [
      "Send forms via SMS or email with one tap",
      "Mobile-friendly forms with e-signature support",
      "Auto-populate patient records from intake data",
      "Custom consent form templates",
    ],
  },
  {
    id: "offline",
    icon: WifiOff,
    title: "Offline Mode",
    tagline: "No signal? No problem.",
    description:
      "Chiro Stride is a Progressive Web App that works without internet. Take notes at the barn, the arena, or the middle of nowhere. Everything syncs automatically when you're back online.",
    bullets: [
      "Full app functionality without cell signal",
      "Install on your phone like a native app",
      "Background sync when connectivity returns",
      "Offline data stored securely on-device",
    ],
  },
];

const additionalFeatures = [
  {
    icon: Layers,
    title: "3D Anatomy Viewer",
    desc: "Interactive 3D models with toggleable layers — skeleton, muscles, nerves, organs. Annotate directly on the model.",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    desc: "Track revenue, appointment volume, patient trends, and more with built-in reporting dashboards.",
  },
  {
    icon: CreditCard,
    title: "Invoicing & Payments",
    desc: "Create and send invoices. Accept payments via Stripe. Track outstanding balances automatically.",
  },
  {
    icon: Mail,
    title: "SMS & Email",
    desc: "Send appointment confirmations, reminders, form links, and custom messages via Twilio and Resend.",
  },
  {
    icon: Camera,
    title: "Photo Documentation",
    desc: "Attach photos to visits for visual progress tracking. Before/after comparisons made easy.",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    desc: "Your data is encrypted and stored securely with Supabase. Row-level security ensures practice isolation.",
  },
  {
    icon: Users,
    title: "Owner Management",
    desc: "Track multiple pets per owner. Manage contact information, communication preferences, and visit history.",
  },
  {
    icon: Globe,
    title: "PWA — Works Everywhere",
    desc: "Install Chiro Stride on any device — iPhone, Android, tablet, desktop. One app that works everywhere.",
  },
];

/* ───────────────── page ───────────────── */

export default function FeaturesPage() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-28 bg-gradient-to-b from-[#0e1e38] via-[#0f2040] to-[#0e1e38] relative">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }} />
        <div className="max-w-4xl mx-auto px-6 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-[#c9a227]/10 border border-[#c9a227]/20 px-4 py-2 rounded-full mb-6"
          >
            <Zap className="w-4 h-4 text-[#c9a227]" />
            <span className="text-[#c9a227] text-sm font-medium">Built for the field</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold tracking-tight mb-6"
          >
            Features that
            <br />
            <span className="bg-gradient-to-r from-[#c9a227] via-[#f5e6b8] to-[#c9a227] bg-clip-text text-transparent">
              actually matter.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="text-white/70 text-lg md:text-xl max-w-2xl mx-auto"
          >
            Every tool is designed around the real workflow of equine and canine chiropractors. No bloat, no learning curve.
          </motion.p>
        </div>
      </section>

      {/* Feature deep-dives */}
      <section className="bg-[#0e1e38]">
        {heroFeatures.map((feature, i) => (
          <div
            key={feature.id}
            id={feature.id}
            className={`py-20 md:py-28 ${i % 2 === 1 ? "bg-gradient-to-b from-[#0e1e38] via-[#0f2040]/50 to-[#0e1e38]" : ""}`}
          >
            <div className="max-w-6xl mx-auto px-6">
              <div className={`grid md:grid-cols-2 gap-12 items-center ${i % 2 === 1 ? "md:direction-rtl" : ""}`}>
                <SlideIn direction={i % 2 === 0 ? "left" : "right"}>
                  <div className={i % 2 === 1 ? "md:order-2" : ""}>
                    <div className="inline-flex items-center gap-2 bg-[#c9a227]/10 px-3 py-1.5 rounded-full mb-4">
                      <feature.icon className="w-4 h-4 text-[#c9a227]" />
                      <span className="text-[#c9a227] text-xs font-medium tracking-wide uppercase">{feature.title}</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                      {feature.tagline}
                    </h2>
                    <p className="text-white/70 text-base leading-relaxed mb-8">
                      {feature.description}
                    </p>
                    <div className="space-y-3">
                      {feature.bullets.map((bullet, j) => (
                        <FadeIn key={j} delay={j * 0.08}>
                          <div className="flex items-start gap-3">
                            <Check className="w-4 h-4 text-[#c9a227] shrink-0 mt-0.5" />
                            <span className="text-white/60 text-sm">{bullet}</span>
                          </div>
                        </FadeIn>
                      ))}
                    </div>
                  </div>
                </SlideIn>

                <SlideIn direction={i % 2 === 0 ? "right" : "left"} delay={0.15}>
                  <div className={`${i % 2 === 1 ? "md:order-1" : ""}`}>
                    <div className="relative aspect-[4/3] rounded-2xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/10 overflow-hidden flex items-center justify-center">
                      <feature.icon className="w-24 h-24 text-[#c9a227]/20" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0e1e38]/50 to-transparent" />
                    </div>
                  </div>
                </SlideIn>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Additional features grid */}
      <section className="py-24 md:py-32 bg-gradient-to-b from-[#0e1e38] via-[#0f2040] to-[#0e1e38] border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn className="text-center mb-16">
            <p className="text-[#c9a227] text-sm tracking-[0.3em] uppercase font-medium mb-3">And More</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Everything else
              <span className="text-white/50"> you&apos;d expect.</span>
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {additionalFeatures.map((f, i) => (
              <FadeIn key={i} delay={i * 0.06}>
                <div className="group bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:border-[#c9a227]/30 transition-all duration-500 hover:bg-white/[0.05] h-full">
                  <div className="w-10 h-10 rounded-xl bg-[#c9a227]/10 flex items-center justify-center mb-4 group-hover:bg-[#c9a227]/20 transition">
                    <f.icon className="w-5 h-5 text-[#c9a227]" />
                  </div>
                  <h3 className="text-sm font-semibold mb-2">{f.title}</h3>
                  <p className="text-white/60 text-xs leading-relaxed">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 md:py-32 bg-[#0e1e38] border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
              See it in action.
            </h2>
          </FadeIn>
          <FadeIn delay={0.15}>
            <p className="text-white/70 text-lg mb-10">
              Start your free trial today — no credit card required.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="px-8 py-4 rounded-full bg-[#c9a227] text-[#0a1628] font-bold text-lg hover:bg-[#ddb832] transition-all hover:scale-105 shadow-lg shadow-[#c9a227]/20 inline-flex items-center gap-2"
              >
                Start Free Trial
                <ChevronRight className="w-5 h-5" />
              </Link>
              <Link
                href="/pricing"
                className="px-8 py-4 rounded-full border border-white/20 text-white font-medium text-lg hover:bg-white/5 transition-all inline-flex items-center gap-2"
              >
                View Pricing
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </MarketingLayout>
  );
}
