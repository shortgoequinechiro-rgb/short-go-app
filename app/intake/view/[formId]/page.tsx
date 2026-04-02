'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'

type IntakeFormFull = {
  id: string
  submitted_at: string
  form_date: string | null
  signed_name: string | null
  signature_data: string | null
  consent_signed: boolean
  archived: boolean | null
  referral_source: string[] | null
  practitioner_id: string | null
  animal_name: string
  animal_age: string | null
  animal_breed: string | null
  animal_dob: string | null
  animal_gender: string | null
  animal_height: string | null
  animal_color: string | null
  reason_for_care: string | null
  health_problems: string | null
  behavior_changes: string | null
  conditions_illnesses: string | null
  medications_supplements: string | null
  use_of_animal: string | null
  previous_chiro_care: boolean | null
  owners: {
    full_name: string
    phone: string | null
    email: string | null
    address: string | null
  } | null
  horses: {
    id: string
    name: string
    species: string | null
  } | null
  practitioners: {
    practice_name: string | null
    full_name: string | null
  } | null
}

export default function IntakeFormViewPage() {
  const params = useParams()
  const formId = params?.formId as string

  const [form, setForm] = useState<IntakeFormFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [archiving, setArchiving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (!formId) return
    loadForm()
  }, [formId])

  async function loadForm() {
    const { data } = await supabase
      .from('intake_forms')
      .select(`
        *,
        owners ( full_name, phone, email, address ),
        horses ( id, name, species ),
        practitioners ( practice_name, full_name )
      `)
      .eq('id', formId)
      .single()

    setForm(data || null)
    setLoading(false)
  }

  async function toggleArchive() {
    if (!form) return
    setArchiving(true)
    const newArchived = !form.archived
    const { error } = await supabase
      .from('intake_forms')
      .update({ archived: newArchived })
      .eq('id', formId)
    if (!error) setForm({ ...form, archived: newArchived })
    setArchiving(false)
    setShowConfirm(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#edf2f7]">
        <p className="text-slate-500">Loading…</p>
      </div>
    )
  }

  if (!form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#edf2f7]">
        <p className="text-slate-500">Form not found.</p>
      </div>
    )
  }

  const submittedAt = new Date(form.submitted_at)
  const formattedDate = submittedAt.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
  const formattedTime = submittedAt.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  })

  return (
    <div className="min-h-screen bg-[#edf2f7] py-10 px-4">
      <div className="mx-auto max-w-2xl">

        {/* Back link */}
        <div className="mb-6 flex items-center justify-between gap-4">
          {form.horses?.id ? (
            <Link
              href={`/horses/${form.horses.id}`}
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition"
            >
              ← Back to {form.horses.name}&apos;s Record
            </Link>
          ) : <span />}

          {/* Archive button */}
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                form.archived
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {form.archived ? '↩ Unarchive' : '🗄 Archive'}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">
                {form.archived ? 'Unarchive this form?' : 'Archive this form?'}
              </span>
              <button
                onClick={toggleArchive}
                disabled={archiving}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {archiving ? 'Saving…' : 'Confirm'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Archived banner */}
        {form.archived && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
            🗄 This intake form has been archived and is hidden from the patient record.
          </div>
        )}

        {/* Header */}
        <div className="mb-6 rounded-3xl bg-white p-8 shadow-md text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Submitted Intake Form</p>
          <h1 className="text-2xl font-bold text-slate-900">Equine Chiropractic Intake Form</h1>
          <p className="mt-1 text-sm text-slate-500">{form.practitioners?.practice_name || 'Practice'}{form.practitioners?.full_name ? ` · ${form.practitioners.full_name}` : ''}</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-2">
            <span className="text-emerald-600 font-bold text-sm">✓</span>
            <span className="text-sm font-semibold text-emerald-700">
              Signed &amp; Submitted — {formattedDate} at {formattedTime}
            </span>
          </div>
        </div>

        <div className="space-y-6">

          {/* Owner Info */}
          <Section title="Owner Information">
            <Row label="Name" value={form.owners?.full_name || form.signed_name || '—'} />
            <Row label="Phone" value={form.owners?.phone || '—'} />
            <Row label="Email" value={form.owners?.email || '—'} />
            <Row label="Address" value={form.owners?.address || '—'} />
            {form.referral_source && form.referral_source.length > 0 && (
              <Row label="Referred By" value={form.referral_source.join(', ')} />
            )}
          </Section>

          {/* Animal Info */}
          <Section title="Animal Information">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <Row label="Name" value={form.animal_name} />
              <Row label="Age" value={form.animal_age || '—'} />
              <Row label="Breed" value={form.animal_breed || '—'} />
              <Row label="Date of Birth" value={form.animal_dob ? new Date(form.animal_dob).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'} />
              <Row label="Gender" value={form.animal_gender || '—'} />
              <Row label="Height" value={form.animal_height || '—'} />
              <Row label="Color" value={form.animal_color || '—'} />
              <Row label="Previous Chiro Care" value={form.previous_chiro_care === true ? 'Yes' : form.previous_chiro_care === false ? 'No' : '—'} />
            </div>
            {form.reason_for_care && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <Row label="Reason for Care" value={form.reason_for_care} block />
              </div>
            )}
          </Section>

          {/* Medical History */}
          <Section title="Medical History">
            <Row label="Health Problems / Concerns" value={form.health_problems || '—'} block />
            <Row label="Recent Behavior Changes" value={form.behavior_changes || '—'} block />
            <Row label="Conditions / Illnesses" value={form.conditions_illnesses || '—'} block />
            <Row label="Medications / Supplements" value={form.medications_supplements || '—'} block />
            <Row label="Use / Job of Animal" value={form.use_of_animal || '—'} block />
          </Section>

          {/* Consent & Signature */}
          <Section title="Informed Consent">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600 space-y-3">
              <p>
                I, <strong>{form.signed_name || form.owners?.full_name || '—'}</strong>, hereby give my consent for{' '}
                <strong>{form.animal_name}</strong> to receive chiropractic care from {form.practitioners?.full_name || 'the attending practitioner'}.
              </p>
              <p className="text-xs text-slate-400 italic">
                Full consent text was presented and acknowledged at time of signing.
              </p>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-slate-700">Signature</p>
              {form.signature_data ? (
                <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.signature_data}
                    alt="Owner signature"
                    className="w-full object-contain"
                    style={{ maxHeight: 160 }}
                  />
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">No signature image recorded.</p>
              )}
              <p className="mt-2 text-xs text-slate-400">
                Signed by <strong>{form.signed_name || '—'}</strong> on {formattedDate} at {formattedTime}
              </p>
            </div>
          </Section>

        </div>

        <p className="mt-8 pb-8 text-center text-xs text-slate-400">
          {form.practitioners?.practice_name || 'Practice'}{form.practitioners?.full_name ? ` · ${form.practitioners.full_name}` : ''}
        </p>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-md">
      <h2 className="mb-4 border-b border-slate-100 pb-3 text-lg font-bold text-slate-900">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Row({ label, value, block }: { label: string; value: string; block?: boolean }) {
  if (block) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{value}</p>
      </div>
    )
  }
  return (
    <div className="flex items-baseline gap-2">
      <span className="min-w-[120px] text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-sm text-slate-800">{value}</span>
    </div>
  )
}
