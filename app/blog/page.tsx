"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import MarketingLayout from "@/app/components/MarketingLayout";
import { FadeIn } from "@/app/components/motion-helpers";
import {
  BookOpen,
  ChevronRight,
  Clock,
  ArrowRight,
  Bone,
  BrainCircuit,
  WifiOff,
  CalendarDays,
  FileSignature,
  Layers,
} from "lucide-react";

/* ───────────────── data ───────────────── */

const posts = [
  {
    icon: BrainCircuit,
    category: "Product",
    title: "How AI SOAP Notes Save You 30 Minutes Per Patient",
    excerpt:
      "See how Chiro Stride's AI-powered SOAP note generation works — from quick clinical observations to professional documentation in one click.",
    readTime: "4 min read",
    date: "Coming Soon",
  },
  {
    icon: Bone,
    category: "Clinical",
    title: "Tracking Subluxation Patterns Over Time: A Digital Approach",
    excerpt:
      "How digital spine assessment maps give you clearer patient progress data than paper-based tracking ever could.",
    readTime: "5 min read",
    date: "Coming Soon",
  },
  {
    icon: WifiOff,
    category: "Technology",
    title: "Why Offline-First Matters for Mobile Practitioners",
    excerpt:
      "Barns don't have Wi-Fi. Here's how Progressive Web Apps are changing the game for practitioners who work in the field.",
    readTime: "3 min read",
    date: "Coming Soon",
  },
  {
    icon: CalendarDays,
    category: "Practice Management",
    title: "Reducing No-Shows with Automated SMS Reminders",
    excerpt:
      "Learn how automated appointment reminders via text message can cut no-show rates by up to 40%.",
    readTime: "4 min read",
    date: "Coming Soon",
  },
  {
    icon: FileSignature,
    category: "Workflow",
    title: "Going Paperless: Digital Intake & Consent Forms",
    excerpt:
      "Ditch the clipboard. Send forms via text, collect e-signatures, and auto-populate patient records.",
    readTime: "3 min read",
    date: "Coming Soon",
  },
  {
    icon: Layers,
    category: "Feature Spotlight",
    title: "Inside the 3D Anatomy Viewer: Annotate, Educate, Document",
    excerpt:
      "A deep dive into Chiro Stride's interactive 3D anatomy tool — toggle layers, draw annotations, and educate clients visually.",
    readTime: "5 min read",
    date: "Coming Soon",
  },
];

/* ───────────────── page ───────────────── */

export default function BlogPage() {
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
            <BookOpen className="w-4 h-4 text-[#c9a227]" />
            <span className="text-[#c9a227] text-sm font-medium">Chiro Stride Blog</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold tracking-tight mb-6"
          >
            Insights for
            <br />
            <span className="bg-gradient-to-r from-[#c9a227] via-[#f5e6b8] to-[#c9a227] bg-clip-text text-transparent">
              modern practitioners.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="text-white/70 text-lg md:text-xl max-w-2xl mx-auto"
          >
            Tips, product updates, and practice management insights for equine and canine chiropractors.
          </motion.p>
        </div>
      </section>

      {/* Posts grid */}
      <section className="py-24 md:py-32 bg-[#0e1e38]">
        <div className="max-w-6xl mx-auto px-6">
          {/* Newsletter signup */}
          <FadeIn className="mb-16">
            <div className="bg-gradient-to-r from-[#c9a227]/10 to-[#c9a227]/5 border border-[#c9a227]/20 rounded-2xl p-8 text-center">
              <h2 className="text-xl font-bold mb-2">Get notified when we publish</h2>
              <p className="text-white/60 text-sm mb-6">We&apos;re working on our first articles. Subscribe to be the first to know.</p>
              <div className="flex gap-2 max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="flex-1 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-[#c9a227]/50 transition"
                />
                <button className="px-5 py-2.5 rounded-full bg-[#c9a227] text-[#0a1628] font-semibold text-sm hover:bg-[#ddb832] transition-all hover:scale-105 whitespace-nowrap">
                  Notify Me
                </button>
              </div>
            </div>
          </FadeIn>

          {/* Blog cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post, i) => (
              <FadeIn key={i} delay={i * 0.08}>
                <div className="group bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden hover:border-[#c9a227]/20 transition-all duration-500 h-full flex flex-col">
                  {/* Card header */}
                  <div className="aspect-[16/9] bg-gradient-to-br from-white/[0.05] to-white/[0.02] flex items-center justify-center relative">
                    <post.icon className="w-16 h-16 text-[#c9a227]/15 group-hover:text-[#c9a227]/25 transition-all duration-500" />
                    <div className="absolute top-4 left-4">
                      <span className="text-[#c9a227] text-xs font-medium bg-[#c9a227]/10 px-3 py-1 rounded-full">
                        {post.category}
                      </span>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-6 flex flex-col flex-1">
                    <h3 className="text-base font-semibold mb-2 group-hover:text-[#c9a227] transition-colors leading-snug">
                      {post.title}
                    </h3>
                    <p className="text-white/60 text-sm leading-relaxed mb-4 flex-1">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between text-xs text-white/50">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {post.readTime}
                      </div>
                      <span className="text-[#c9a227]/60 font-medium">{post.date}</span>
                    </div>
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
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
              Don&apos;t wait for the blog.
              <br />
              <span className="text-white/50">Try the product.</span>
            </h2>
          </FadeIn>
          <FadeIn delay={0.15}>
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
