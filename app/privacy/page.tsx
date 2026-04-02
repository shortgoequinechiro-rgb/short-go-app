"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import MarketingLayout from "@/app/components/MarketingLayout";
import { FadeIn } from "@/app/components/motion-helpers";
import { ChevronRight } from "lucide-react";

export default function PrivacyPage() {
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
            className="text-4xl md:text-5xl font-bold tracking-tight mb-6"
          >
            Privacy Policy
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white/70 text-lg"
          >
            Last Updated: April 2, 2026
          </motion.p>
        </div>
      </section>

      {/* Content */}
      <section className="py-20 md:py-28 bg-[#0e1e38]">
        <div className="max-w-3xl mx-auto px-6">
          <FadeIn>
            <div className="prose prose-invert max-w-none">
              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">1. Introduction</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                Chiro Stride ("we," "us," "our," or "Company") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our practice management software platform.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">2. Information We Collect</h2>
              <p className="text-white/70 leading-relaxed mb-4 font-semibold">
                We collect information in the following categories:
              </p>

              <h3 className="text-xl font-semibold text-white mb-3">Practice Information</h3>
              <p className="text-white/70 leading-relaxed mb-6">
                Business name, practice address, phone number, email address, and other details about your chiropractic practice.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3">User Account Information</h3>
              <p className="text-white/70 leading-relaxed mb-6">
                Name, email address, password (hashed), and account preferences.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3">Animal Medical Records and Clinical Data</h3>
              <p className="text-white/70 leading-relaxed mb-6">
                Patient (animal) names, species, age, medical history, treatment notes, SOAP notes, diagnostic information, examination findings, and other clinical information necessary for practice management.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3">Owner and Contact Information</h3>
              <p className="text-white/70 leading-relaxed mb-6">
                Names, phone numbers, email addresses, and mailing addresses of animal owners and clients.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3">Payment Information</h3>
              <p className="text-white/70 leading-relaxed mb-6">
                Payment method details (credit card numbers, billing addresses) are processed through Stripe and are not stored directly on our servers. We store transaction history and billing records.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3">Signatures and Consent Forms</h3>
              <p className="text-white/70 leading-relaxed mb-6">
                Digital signatures, consent forms, and other legal documentation provided by clients and animal owners.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3">Usage Data</h3>
              <p className="text-white/70 leading-relaxed mb-6">
                Information about how you use the service, including pages visited, features used, timestamps, and similar technical data.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">3. How We Use Your Information</h2>
              <p className="text-white/70 leading-relaxed mb-4">
                We use the information we collect for the following purposes:
              </p>
              <ul className="list-disc list-inside text-white/70 space-y-2 mb-6">
                <li>Providing and improving the Chiro Stride service</li>
                <li>Processing payments and managing your subscription</li>
                <li>Communicating with you about your account and the service</li>
                <li>Sending service updates, security alerts, and support messages</li>
                <li>Responding to your inquiries and customer support requests</li>
                <li>Troubleshooting and technical support</li>
                <li>Complying with legal obligations</li>
                <li>Analyzing usage patterns to improve user experience</li>
              </ul>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">4. Third-Party Service Providers</h2>
              <p className="text-white/70 leading-relaxed mb-4">
                We use the following third-party services to operate Chiro Stride:
              </p>
              <ul className="list-disc list-inside text-white/70 space-y-3 mb-6">
                <li><strong>Supabase:</strong> Database hosting and data storage. Your data is stored on Supabase infrastructure.</li>
                <li><strong>Stripe:</strong> Payment processing. Payment information is securely processed through Stripe and not stored on our servers.</li>
                <li><strong>Twilio:</strong> SMS and communication delivery. Patient reminders and notifications may be sent through Twilio.</li>
                <li><strong>OpenAI:</strong> AI-powered SOAP note generation. Clinical notes may be processed by OpenAI to assist in generating formatted SOAP notes.</li>
                <li><strong>Resend:</strong> Email delivery. Transactional emails and notifications are sent through Resend.</li>
              </ul>
              <p className="text-white/70 leading-relaxed mb-6">
                These third-party providers are bound by confidentiality agreements and are only permitted to use your data to provide services on our behalf.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">5. Data Retention</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                We retain your account data and animal medical records for as long as your subscription is active. Upon account deletion or subscription cancellation, we retain data for 30 days to allow for recovery. After 30 days, data is permanently deleted from our systems unless we are required to retain it by law.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">6. Data Security</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                We implement industry-standard security measures to protect your data, including encryption in transit and at rest, secure authentication, and regular security audits. However, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security of your information.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">7. Your Rights and Choices</h2>

              <h3 className="text-xl font-semibold text-white mb-3">Access and Portability</h3>
              <p className="text-white/70 leading-relaxed mb-6">
                You have the right to access, review, and export your data at any time through your account settings.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3">Correction</h3>
              <p className="text-white/70 leading-relaxed mb-6">
                You can correct or update inaccurate information in your account.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3">Deletion</h3>
              <p className="text-white/70 leading-relaxed mb-6">
                You may request deletion of your account and associated data at any time. Note that deletion is permanent and cannot be undone.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3">Communication Preferences</h3>
              <p className="text-white/70 leading-relaxed mb-6">
                You can manage your communication preferences in your account settings or by contacting us directly.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">8. CCPA (California Consumer Privacy Act) Compliance</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                If you are a California resident, you have the right to:
              </p>
              <ul className="list-disc list-inside text-white/70 space-y-2 mb-6">
                <li>Know what personal information is collected, used, and shared</li>
                <li>Delete personal information collected from you</li>
                <li>Opt-out of the sale of your personal information</li>
                <li>Non-discrimination for exercising your CCPA rights</li>
              </ul>
              <p className="text-white/70 leading-relaxed mb-6">
                To exercise these rights, please contact us at shortgoequinechiro@gmail.com.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">9. GDPR (General Data Protection Regulation) Compliance</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                If you are located in the European Union, we process your data in accordance with GDPR. You have the right to access, correct, delete, port, and restrict the processing of your personal data. If you wish to exercise any of these rights, please contact us at shortgoequinechiro@gmail.com.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">10. SMS and Communications Privacy</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                When you opt into SMS communications or use our communication features, we collect phone numbers and communication preferences. You can opt out of SMS communications at any time by replying STOP to any message. We will process your opt-out request within one business day.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">11. Cookies and Similar Technologies</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                We use cookies and similar tracking technologies to enhance your experience, remember your preferences, and analyze usage patterns. You can control cookie preferences through your browser settings. We also use localStorage to store preferences and offline data locally on your device.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">12. Children's Privacy</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                Chiro Stride is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If we learn that we have collected personal information from a child under 18, we will delete such information promptly.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">13. Contact Us</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                If you have questions about this Privacy Policy or our privacy practices, please contact us at:
              </p>
              <p className="text-white/70 leading-relaxed mb-6">
                <strong>Email:</strong> shortgoequinechiro@gmail.com
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">14. Changes to This Privacy Policy</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by email or through the service. Your continued use of Chiro Stride following any changes constitutes your acceptance of the updated Privacy Policy.
              </p>
            </div>
          </FadeIn>

          {/* Back to Home */}
          <FadeIn delay={0.2} className="mt-16 pt-8 border-t border-white/10">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[#c9a227] hover:text-[#ddb832] transition"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Back to Home
            </Link>
          </FadeIn>
        </div>
      </section>
    </MarketingLayout>
  );
}
