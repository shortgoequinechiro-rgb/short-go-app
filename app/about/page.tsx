"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import MarketingLayout from "@/app/components/MarketingLayout";
import { FadeIn, SlideIn } from "@/app/components/motion-helpers";
import {
  Heart,
  Target,
  Lightbulb,
  ChevronRight,
  WifiOff,
  BrainCircuit,
  Bone,
  CalendarDays,
  ArrowRight,
} from "lucide-react";

/* ───────────────── data ───────────────── */

const values = [
  {
    icon: Target,
    title: "Built for the Field",
    desc: "We know you're not sitting at a desk. Chiro Stride works at the barn, the arena, or the middle of nowhere — because that's where the work happens.",
  },
  {
    icon: Lightbulb,
    title: "Simple by Design",
    desc: "No steep learning curves. No bloated features. Every screen, every button, every workflow is designed to save you time and reduce friction.",
  },
  {
    icon: Heart,
    title: "By Practitioners, For Practitioners",
    desc: "Chiro Stride was built by animal chiropractors who were frustrated with generic software. We understand your workflow because we live it.",
  },
];

const timeline = [
  {
    year: "The Problem",
    title: "Generic software doesn't fit",
    desc: "Veterinary and human chiropractic software wasn't built for the unique needs of equine and canine chiropractors. Notes were messy, scheduling was manual, and nothing worked offline.",
  },
  {
    year: "The Idea",
    title: "What if software matched the workflow?",
    desc: "What if SOAP notes wrote themselves? What if you could map subluxations on a real spinal diagram? What if the app actually worked at the barn?",
  },
  {
    year: "Chiro Stride",
    title: "Software that gets out of your way",
    desc: "We built the tool we always wanted: fast, focused, offline-ready, with AI that handles the paperwork so you can focus on the patient.",
  },
];

/* ───────────────── page ───────────────── */

export default function AboutPage() {
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
            Built by chiropractors,
            <br />
            <span className="bg-gradient-to-r from-[#c9a227] via-[#f5e6b8] to-[#c9a227] bg-clip-text text-transparent">
              for chiropractors.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white/70 text-lg md:text-xl max-w-2xl mx-auto"
          >
            We got tired of software that didn&apos;t understand our work. So we built something that does.
          </motion.p>
        </div>
      </section>

      {/* Story */}
      <section className="py-24 md:py-32 bg-[#0e1e38]">
        <div className="max-w-4xl mx-auto px-6">
          <FadeIn className="text-center mb-16">
            <p className="text-[#c9a227] text-sm tracking-[0.3em] uppercase font-medium mb-3">Our Story</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              From frustration
              <span className="text-white/50"> to solution.</span>
            </h2>
          </FadeIn>

          <div className="space-y-0">
            {timeline.map((item, i) => (
              <FadeIn key={i} delay={i * 0.15}>
                <div className="relative pl-8 pb-12 last:pb-0">
                  {/* Timeline line */}
                  {i < timeline.length - 1 && (
                    <div className="absolute left-[11px] top-6 bottom-0 w-px bg-gradient-to-b from-[#c9a227]/30 to-transparent" />
                  )}
                  {/* Dot */}
                  <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-[#c9a227]/10 border-2 border-[#c9a227]/40 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[#c9a227]" />
                  </div>
                  <div className="ml-4">
                    <span className="text-[#c9a227] text-xs font-semibold tracking-widest uppercase">{item.year}</span>
                    <h3 className="text-xl font-bold mt-1 mb-2">{item.title}</h3>
                    <p className="text-white/60 text-sm leading-relaxed max-w-2xl">{item.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 md:py-32 bg-gradient-to-b from-[#0e1e38] via-[#0f2040] to-[#0e1e38] border-y border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn className="text-center mb-16">
            <p className="text-[#c9a227] text-sm tracking-[0.3em] uppercase font-medium mb-3">Our Values</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              What drives us.
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-8">
            {values.map((v, i) => (
              <FadeIn key={i} delay={i * 0.12}>
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#c9a227]/10 flex items-center justify-center mx-auto mb-5">
                    <v.icon className="w-7 h-7 text-[#c9a227]" />
                  </div>
                  <h3 className="text-lg font-bold mb-3">{v.title}</h3>
                  <p className="text-white/60 text-sm leading-relaxed">{v.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* What makes Chiro Stride different */}
      <section className="py-24 md:py-32 bg-[#0e1e38]">
        <div className="max-w-5xl mx-auto px-6">
          <FadeIn className="text-center mb-16">
            <p className="text-[#c9a227] text-sm tracking-[0.3em] uppercase font-medium mb-3">Why Chiro Stride</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              What makes us
              <span className="text-white/50"> different.</span>
            </h2>
          </FadeIn>

          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                icon: WifiOff,
                title: "Offline-first architecture",
                desc: "Not an afterthought. Chiro Stride was designed from day one to work without internet. Your data is always available.",
              },
              {
                icon: BrainCircuit,
                title: "AI that understands chiropractic",
                desc: "Our AI isn't generic. It's trained on chiropractic terminology and generates SOAP notes that actually sound like you.",
              },
              {
                icon: Bone,
                title: "Species-specific clinical tools",
                desc: "Spinal maps, anatomy models, and assessment tools designed specifically for equine and canine patients.",
              },
              {
                icon: CalendarDays,
                title: "All-in-one platform",
                desc: "Records, scheduling, billing, forms, communication — everything in one place instead of five different apps.",
              },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="flex gap-4 bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:border-[#c9a227]/20 transition">
                  <div className="w-10 h-10 rounded-xl bg-[#c9a227]/10 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-[#c9a227]" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{item.title}</h3>
                    <p className="text-white/60 text-sm leading-relaxed">{item.desc}</p>
                  </div>
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
              Join practitioners who
              <br />
              <span className="bg-gradient-to-r from-[#c9a227] via-[#f5e6b8] to-[#c9a227] bg-clip-text text-transparent">
                love their software.
              </span>
            </h2>
          </FadeIn>
          <FadeIn delay={0.15}>
            <p className="text-white/70 text-lg mb-10">
              Start your free trial today and see why Chiro Stride is the practice management tool animal chiropractors have been waiting for.
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
                href="/contact"
                className="px-8 py-4 rounded-full border border-white/20 text-white font-medium text-lg hover:bg-white/5 transition-all"
              >
                Get in Touch
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </MarketingLayout>
  );
}
