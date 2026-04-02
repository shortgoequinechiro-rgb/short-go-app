"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import MarketingLayout from "@/app/components/MarketingLayout";
import { FadeIn } from "@/app/components/motion-helpers";
import { ChevronRight } from "lucide-react";

export default function TermsPage() {
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
            Terms of Service
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
              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">1. Service Description</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                Chiro Stride is a practice management software platform specifically designed for animal chiropractic practitioners. The service provides tools for managing patient records, scheduling appointments, creating and storing clinical notes, managing invoices and payments, and other practice administration functions related to animal chiropractic care.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">2. User Responsibilities</h2>
              <p className="text-white/70 leading-relaxed mb-4">
                You agree to:
              </p>
              <ul className="list-disc list-inside text-white/70 space-y-3 mb-6">
                <li>Use the service only for legitimate animal chiropractic practice management purposes</li>
                <li>Comply with all applicable federal, state, and local laws, including animal welfare laws and professional practice regulations</li>
                <li>Maintain the accuracy of all information you enter into the system</li>
                <li>Maintain confidentiality of your login credentials and API keys</li>
                <li>Notify us immediately of any unauthorized access or use of your account</li>
                <li>Not use the service for any illegal or unethical purposes</li>
              </ul>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">3. Data Ownership</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                You retain full ownership of all data you store in Chiro Stride, including patient records, medical notes, contact information, and billing information. We do not claim ownership of your data. You grant us a license to store, process, and maintain your data for the purpose of providing the service to you.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">4. Animal Medical Records Notice</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                Chiro Stride handles animal medical records and clinical information. This service is NOT subject to HIPAA (Health Insurance Portability and Accountability Act), which applies only to human healthcare. However, you remain responsible for maintaining appropriate confidentiality and security of all animal medical information in accordance with applicable professional standards and state veterinary board regulations.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">5. Payment Terms</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                Pricing is offered on a subscription basis:
              </p>
              <ul className="list-disc list-inside text-white/70 space-y-2 mb-6">
                <li>Monthly Plan: $49 USD per month, billed monthly</li>
                <li>Annual Plan: $499 USD per year, billed annually</li>
              </ul>
              <p className="text-white/70 leading-relaxed mb-6">
                Billing occurs on the date your subscription begins and every 30 days (monthly) or 365 days (annual) thereafter. Payment is processed through Stripe and charged to the payment method you provide. All fees are exclusive of applicable taxes, which will be added where required by law.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">6. Cancellation Policy</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                You may cancel your subscription at any time through your account settings or by contacting us at shortgoequinechiro@gmail.com. Cancellation takes effect at the end of your current billing period. You will have access to the service through the end of the billing period you have already paid for. We do not offer refunds for partial months or unused portions of annual subscriptions.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">7. SMS and Communication Consent (TCPA Compliance)</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                By creating an account and using Chiro Stride, you consent to receive SMS text messages, email communications, and other communications from us regarding your account, service updates, and practice-related notifications. Specifically:
              </p>
              <ul className="list-disc list-inside text-white/70 space-y-3 mb-6">
                <li>You agree that Chiro Stride may send appointment reminders, billing notifications, and other service-related SMS messages to phone numbers associated with your account</li>
                <li>You acknowledge that you have provided express written consent to receive these SMS communications as required by the Telephone Consumer Protection Act (TCPA)</li>
                <li>Message and data rates may apply. Message frequency varies by usage</li>
                <li>You may opt-out of SMS communications by replying STOP to any message, and we will respect your preferences going forward</li>
              </ul>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">8. Limitation of Liability</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, CHIRO STRIDE AND ITS OWNERS, MANAGERS, MEMBERS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO DAMAGES FOR LOSS OF PROFITS, GOODWILL, USE, DATA, OR OTHER INTANGIBLE LOSSES, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
              </p>
              <p className="text-white/70 leading-relaxed mb-6">
                OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING OUT OF OR RELATING TO THIS AGREEMENT SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE 12 MONTHS PRECEDING THE CLAIM.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">9. Disclaimer of Warranties</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">10. Third-Party Services</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                Chiro Stride integrates with third-party services including Supabase (database), Stripe (payment processing), Twilio (SMS communications), OpenAI (AI-powered note generation), and Resend (email delivery). Your use of these integrations is subject to their respective terms and privacy policies. We are not responsible for the security or privacy practices of these third-party services.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">11. Governing Law</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                These Terms of Service shall be governed by and construed in accordance with the laws of the State of Colorado, without regard to its conflicts of law principles. Any legal action or proceeding relating to these Terms shall be brought exclusively in the courts located in Colorado, and you consent to the personal jurisdiction of such courts.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">12. Modifications to Terms</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                We reserve the right to modify these Terms of Service at any time. We will notify you of material changes by email or through the service. Your continued use of the service following any changes constitutes your acceptance of the new Terms.
              </p>

              <h2 className="text-2xl md:text-3xl font-bold mt-12 mb-6 text-white">13. Contact Information</h2>
              <p className="text-white/70 leading-relaxed mb-6">
                If you have questions about these Terms of Service, please contact us at shortgoequinechiro@gmail.com.
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
