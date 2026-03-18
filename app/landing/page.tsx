"use client";

import React, { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { ContainerScroll } from "@/app/components/ui/container-scroll-animation";
import {
  ClipboardList,
  Bone,
  BrainCircuit,
  CalendarDays,
  FileSignature,
  WifiOff,
  Check,
  Smartphone,
  ChevronRight,
  Star,
  Layers,
  PenTool,
  MessageSquare,
  Users,
  ArrowRight,
} from "lucide-react";

/* ───────────────────────── helpers ───────────────────────── */

function FadeIn({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SlideIn({
  children,
  className = "",
  direction = "left",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  direction?: "left" | "right";
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const x = direction === "left" ? -60 : 60;
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ───────────────────────── feature data ───────────────────────── */

const features = [
  {
    icon: ClipboardList,
    title: "Patient Records",
    desc: "Complete equine and canine profiles with breed, discipline, medical history, photos, and full visit timelines.",
  },
  {
    icon: Bone,
    title: "Spine Assessment",
    desc: "Species-specific spinal maps. Track subluxation findings visit-to-visit and visualize patient progress over time.",
  },
  {
    icon: BrainCircuit,
    title: "AI SOAP Notes",
    desc: "Generate professional SOAP notes from quick clinical observations. One click — done. More time with patients, less with paperwork.",
  },
  {
    icon: CalendarDays,
    title: "Scheduling",
    desc: "Book appointments, send confirmations, and automate reminders via email and SMS. Clients confirm with one tap.",
  },
  {
    icon: FileSignature,
    title: "Digital Forms",
    desc: "Send intake and consent forms directly to clients via text or email. E-signatures built in. No more paper.",
  },
  {
    icon: WifiOff,
    title: "Offline Mode",
    desc: "Works without cell signal. Take notes at the barn, sync automatically when you're back online. Built for the field.",
  },
];

const pricingFeatures = [
  "Unlimited patients",
  "AI SOAP notes",
  "Spine assessments",
  "3D anatomy viewer",
  "Digital intake & consent forms",
  "SMS & email reminders",
  "Offline mode & PWA",
  "Custom practice branding",
];

/* ───────────────────────── page ───────────────────────── */

export default function LandingPage() {
  return (
    <div className="bg-[#0a1628] text-white overflow-x-hidden">
      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0a1628]/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/landing" className="flex items-center gap-3">
            <Image src="/stride-logo-gold.png" alt="Stride" width={40} height={40} />
            <span className="text-xl font-bold tracking-tight">
              <span className="text-white">STRIDE</span>
              <span className="text-[#c9a227]/60 text-xs ml-2 tracking-widest uppercase hidden sm:inline">
                Equine & Canine Chiro
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm text-white/60 hover:text-white transition hidden md:block">
              Features
            </a>
            <a href="#anatomy" className="text-sm text-white/60 hover:text-white transition hidden md:block">
              Anatomy
            </a>
            <a href="#pricing" className="text-sm text-white/60 hover:text-white transition hidden md:block">
              Pricing
            </a>
            <Link
              href="/login"
              className="text-sm px-5 py-2.5 rounded-full bg-[#c9a227] text-[#0a1628] font-semibold hover:bg-[#ddb832] transition-all hover:scale-105"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero with Container Scroll ── */}
      <section className="bg-gradient-to-b from-[#0a1628] via-[#0f2040] to-[#0a1628] pb-24 md:pb-40">
        <ContainerScroll
          titleComponent={
            <div className="mt-20">
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-[#c9a227] text-sm md:text-base tracking-[0.3em] uppercase font-medium mb-4"
              >
                Practice Management for Animal Chiropractors
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.15 }}
                className="text-4xl md:text-[5rem] font-bold leading-[1.1] tracking-tight text-white"
              >
                Your practice.
                <br />
                <span className="bg-gradient-to-r from-[#c9a227] via-[#f5e6b8] to-[#c9a227] bg-clip-text text-transparent">
                  Simplified.
                </span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-white/50 text-lg md:text-xl max-w-2xl mx-auto mt-6"
              >
                Patient records, AI-powered SOAP notes, scheduling, digital forms, and more
                — designed for the field, not the office.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.45 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 mb-16 md:mb-24"
              >
                <Link
                  href="/login"
                  className="px-8 py-4 rounded-full bg-[#c9a227] text-[#0a1628] font-bold text-lg hover:bg-[#ddb832] transition-all hover:scale-105 shadow-lg shadow-[#c9a227]/20"
                >
                  Start Free Trial
                  <ChevronRight className="inline ml-1 w-5 h-5" />
                </Link>
                <span className="text-white/30 text-sm">14 days free · No credit card required</span>
              </motion.div>
            </div>
          }
        >
          {/* Real app screenshot */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://pyuarwwhmtoflyzwblbn.supabase.co/storage/v1/object/public/marketing/dashboard-screenshot.png?v=4"
            alt="Stride dashboard showing client records, appointments, and patient management"
            className="mx-auto rounded-xl object-cover h-full w-full object-top"
            draggable={false}
          />
        </ContainerScroll>
      </section>

      {/* ── Social proof bar ── */}
      <section className="border-y border-white/5 bg-[#0a1628]">
        <div className="max-w-5xl mx-auto py-8 px-6 flex flex-wrap items-center justify-center gap-8 md:gap-16 text-center">
          {[
            { value: "500+", label: "Patients Managed" },
            { value: "2,000+", label: "SOAP Notes Generated" },
            { value: "14", label: "Day Free Trial" },
            { value: "99.9%", label: "Uptime" },
          ].map((stat, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <p className="text-2xl md:text-3xl font-bold text-white">{stat.value}</p>
              <p className="text-white/40 text-xs mt-1">{stat.label}</p>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 md:py-32 bg-[#0a1628]">
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn className="text-center mb-16">
            <p className="text-[#c9a227] text-sm tracking-[0.3em] uppercase font-medium mb-3">Features</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Everything you need.
              <span className="text-white/30"> Nothing you don&apos;t.</span>
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <FadeIn key={i} delay={i * 0.08}>
                <div className="group relative bg-white/[0.03] border border-white/5 rounded-2xl p-7 hover:border-[#c9a227]/30 transition-all duration-500 hover:bg-white/[0.05]">
                  <div className="w-12 h-12 rounded-xl bg-[#c9a227]/10 flex items-center justify-center mb-5 group-hover:bg-[#c9a227]/20 transition">
                    <f.icon className="w-6 h-6 text-[#c9a227]" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Anatomy section ── */}
      <section id="anatomy" className="py-24 md:py-32 bg-gradient-to-b from-[#0a1628] via-[#0f2040] to-[#0a1628] border-y border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <SlideIn direction="left">
              <p className="text-[#c9a227] text-sm tracking-[0.3em] uppercase font-medium mb-3">Interactive Anatomy</p>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
                Annotate. Educate.
                <span className="text-white/30"> Document.</span>
              </h2>
              <p className="text-white/50 text-base leading-relaxed mb-8">
                Draw directly on 3D anatomical models. Circle problem areas, add arrows, and write notes.
                Switch between clinical terminology and owner-friendly language for patient education.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Layers, text: "Toggle muscles, skeleton, nerves, vascular, and organ layers" },
                  { icon: PenTool, text: "Draw, circle, and annotate directly on the model" },
                  { icon: MessageSquare, text: "Owner-friendly mode for client education" },
                  { icon: Users, text: "Save annotations per visit for progress tracking" },
                ].map((item, i) => (
                  <FadeIn key={i} delay={i * 0.1}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#c9a227]/10 flex items-center justify-center shrink-0 mt-0.5">
                        <item.icon className="w-4 h-4 text-[#c9a227]" />
                      </div>
                      <span className="text-white/50 text-sm">{item.text}</span>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </SlideIn>

            <SlideIn direction="right" delay={0.2}>
              <div className="relative">
                <div className="rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://pyuarwwhmtoflyzwblbn.supabase.co/storage/v1/object/public/marketing/anatomy-screenshot.png?v=1"
                    alt="Stride 3D Horse Anatomy Viewer with skeleton layer, annotation tools, and region details"
                    className="w-full h-auto object-cover rounded-3xl"
                    draggable={false}
                  />
                </div>
                {/* Floating badges */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 }}
                  className="absolute -top-4 -right-4 bg-[#c9a227] text-[#0a1628] text-xs font-bold px-3 py-1.5 rounded-full shadow-lg"
                >
                  NEW
                </motion.div>
              </div>
            </SlideIn>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-24 md:py-32 bg-[#0a1628]">
        <div className="max-w-5xl mx-auto px-6">
          <FadeIn className="text-center mb-16">
            <p className="text-[#c9a227] text-sm tracking-[0.3em] uppercase font-medium mb-3">How It Works</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Three steps.
              <span className="text-white/30"> That&apos;s it.</span>
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Add your patients",
                desc: "Create profiles for each horse or dog with breed, discipline, medical history, and photos.",
              },
              {
                step: "02",
                title: "Document visits",
                desc: "Use AI-assisted SOAP notes, spine assessments, and interactive anatomy annotations.",
              },
              {
                step: "03",
                title: "Engage clients",
                desc: "Send intake forms, consent forms, and appointment reminders via email or text.",
              },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 0.15}>
                <div className="text-center">
                  <span className="text-6xl md:text-7xl font-black text-[#c9a227]/10">{item.step}</span>
                  <h3 className="text-xl font-bold mt-2 mb-3">{item.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Built for the field ── */}
      <section className="py-24 md:py-32 bg-gradient-to-b from-[#0a1628] to-[#0f2040] border-y border-white/5">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 bg-[#c9a227]/10 px-4 py-2 rounded-full mb-6">
              <WifiOff className="w-4 h-4 text-[#c9a227]" />
              <span className="text-[#c9a227] text-sm font-medium">Works Offline</span>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
              No signal?
              <span className="text-white/30"> No problem.</span>
            </h2>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p className="text-white/50 text-lg max-w-2xl mx-auto leading-relaxed mb-10">
              Stride is a Progressive Web App that works without internet.
              Take notes at the barn, the arena, or the middle of nowhere.
              Everything syncs automatically when you&apos;re back online.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              {[
                { icon: Smartphone, text: "Install on your phone" },
                { icon: WifiOff, text: "Works without signal" },
                { icon: ArrowRight, text: "Auto-syncs when online" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-white/40 text-sm">
                  <item.icon className="w-4 h-4 text-[#c9a227]" />
                  {item.text}
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 md:py-32 bg-[#0a1628]">
        <div className="max-w-4xl mx-auto px-6">
          <FadeIn className="text-center mb-16">
            <p className="text-[#c9a227] text-sm tracking-[0.3em] uppercase font-medium mb-3">Pricing</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              One plan.
              <span className="text-white/30"> Everything included.</span>
            </h2>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="max-w-md mx-auto bg-white/[0.03] border border-[#c9a227]/20 rounded-3xl p-8 md:p-10 text-center relative overflow-hidden">
              {/* Glow effect */}
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#c9a227]/10 rounded-full blur-3xl" />

              <div className="relative">
                <div className="flex items-center justify-center gap-1 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-[#c9a227] text-[#c9a227]" />
                  ))}
                </div>
                <p className="text-white/40 text-sm mb-6">Trusted by animal chiropractors</p>

                <div className="mb-6">
                  <span className="text-5xl md:text-6xl font-black text-white">$59</span>
                  <span className="text-white/40 text-lg">/month</span>
                </div>

                <p className="text-[#c9a227] text-sm font-medium mb-8">
                  14-day free trial · No credit card required
                </p>

                <div className="space-y-3 text-left mb-8">
                  {pricingFeatures.map((f, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Check className="w-4 h-4 text-[#c9a227] shrink-0" />
                      <span className="text-white/60 text-sm">{f}</span>
                    </div>
                  ))}
                </div>

                <Link
                  href="/login"
                  className="block w-full py-4 rounded-full bg-[#c9a227] text-[#0a1628] font-bold text-lg hover:bg-[#ddb832] transition-all hover:scale-[1.02] shadow-lg shadow-[#c9a227]/20"
                >
                  Start Free Trial
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 bg-[#060e1a] py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Image src="/stride-logo-gold.png" alt="Stride" width={32} height={32} />
              <span className="text-white/60 text-sm">
                Built by animal chiropractors, for animal chiropractors.
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-white/30">
              <Link href="/login" className="hover:text-white/60 transition">Login</Link>
              <a href="mailto:support@stridechiro.com" className="hover:text-white/60 transition">Contact</a>
              <a href="#" className="hover:text-white/60 transition">Privacy</a>
            </div>
          </div>
          <div className="text-center mt-8 text-white/20 text-xs">
            &copy; {new Date().getFullYear()} Stride Equine & Canine Chiropractic Software. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
