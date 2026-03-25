"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, MapPin, ArrowUpRight } from "lucide-react";

const footerSections = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Offline Mode", href: "/features#offline" },
      { label: "AI SOAP Notes", href: "/features#ai-soap" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Center", href: "/help" },
      { label: "Login", href: "/login" },
      { label: "Sign Up", href: "/signup" },
    ],
  },
];

export default function MarketingFooter() {
  return (
    <footer className="relative bg-[#0b1627] border-t border-white/5 overflow-hidden">
      {/* Subtle glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[1px] bg-gradient-to-r from-transparent via-[#c9a227]/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 pt-16 pb-8">
        {/* Top row */}
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-5">
              <Image src="/stride-logo-gold.png" alt="Chiro Stride" width={36} height={36} />
              <span className="text-lg font-bold tracking-tight text-white">CHIRO STRIDE</span>
            </Link>
            <p className="text-white/60 text-sm leading-relaxed max-w-sm mb-6">
              Practice management software built by animal chiropractors, for animal chiropractors.
              Designed for the field, not the office.
            </p>
            <div className="space-y-2">
              <a
                href="mailto:hello@chirostride.com"
                className="flex items-center gap-2 text-white/60 text-sm hover:text-[#c9a227] transition"
              >
                <Mail className="w-4 h-4" />
                hello@chirostride.com
              </a>
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <MapPin className="w-4 h-4" />
                Serving practitioners nationwide
              </div>
            </div>
          </div>

          {/* Link columns */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="text-white text-sm font-semibold mb-4 tracking-wide">
                {section.title}
              </h4>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-white/60 text-sm hover:text-white transition inline-flex items-center gap-1 group"
                    >
                      {link.label}
                      <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-0.5 translate-x-[-2px] group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter */}
        <div className="border-t border-b border-white/5 py-8 mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-white text-sm font-semibold mb-1">Stay in the loop</h4>
              <p className="text-white/60 text-xs">Product updates, tips, and chiropractic insights.</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <input
                type="email"
                placeholder="you@example.com"
                className="flex-1 sm:w-64 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/50 focus:outline-none focus:border-[#c9a227]/50 transition"
              />
              <button className="px-5 py-2.5 rounded-full bg-[#c9a227] text-[#0a1628] font-semibold text-sm hover:bg-[#ddb832] transition-all hover:scale-105 whitespace-nowrap">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/50 text-xs">
            &copy; {new Date().getFullYear()} Chiro Stride Animal Chiropractic Software. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-white/50">
            <a href="#" className="hover:text-white/70 transition">Privacy Policy</a>
            <a href="#" className="hover:text-white/70 transition">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
