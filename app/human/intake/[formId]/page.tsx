'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition'
const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5'

export default function HumanIntakeFormPage() {
  const params = useParams()
  const router = useRouter()
  const formId = params.formId as string

  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [practiceName, setPracticeName] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  const [form, setForm] = useState({
    first_name: '', last_name: '', date_of_birth: '', phone: '', email: '', address: '',
    emergency_contact: '', emergency_phone: '',
    insurance_provider: '', insurance_id: '', insurance_group: '', insurance_phone: '',
    chief_complaint: '', pain_location: '', pain_duration: '', pain_scale: 5, pain_description: '',
    medical_history: '', surgeries: '', medications: '', allergies: '', family_history: '',
    occupation: '', exercise_habits: '', sleep_quality: '', stress_level: '',
  })

  useEffect(() => {
    loadForm()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadForm() {
    const { data } = await supabase
      .from('human_intake_forms')
      .select('*, practitioners(practice_name, logo_url)')
      .eq('id', formId)
      .single()

    if (!data) { setError('Form not found.'); setLoading(false); return }
    if (data.status === 'submitted') { setSubmitted(true); setLoading(false); return }

    const prac = (data as any).practitioners
    if (prac) {
      setPracticeName(prac.practice_name || '')
      setLogoUrl(prac.logo_url)
    }

    setForm(prev => ({
      ...prev,
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      date_of_birth: data.date_of_birth || '',
      phone: data.phone || '',
      email: data.email || '',
      address: data.address || '',
      emergency_contact: data.emergency_contact || '',
      emergency_phone: data.emergency_phone || '',
      insurance_provider: data.insurance_provider || '',
      insurance_id: data.insurance_id || '',
      insurance_group: data.insurance_group || '',
      insurance_phone: data.insurance_phone || '',
      chief_complaint: data.chief_complaint || '',
      pain_location: data.pain_location || '',
      pain_duration: data.pain_duration || '',
      pain_scale: data.pain_scale ?? 5,
      pain_description: data.pain_description || '',
      medical_history: data.medical_history || '',
      surgeries: data.surgeries || '',
      medications: data.medications || '',
      allergies: data.allergies || '',
      family_history: data.family_history || '',
      occupation: data.occupation || '',
      exercise_habits: data.exercise_habits || '',
      sleep_quality: data.sleep_quality || '',
      stress_level: data.stress_level || '',
    }))
    setLoading(false)
  }

  async function handleSubmit() {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('First and last name are required.')
      return
    }
    setSaving(true); setError('')

    const { error: err } = await supabase
      .from('human_intake_forms')
      .update({
        ...form,
        date_of_birth: form.date_of_birth || null,
        pain_scale: form.pain_scale,
        status: 'submitted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', formId)

    setSaving(false)
    if (err) { setError('Failed to submit. Please try again.'); return }
    setSubmitted(true)
  }

  function updateForm(key: string, value: string | number) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-400 text-sm animate-pulse">Loading intake form...</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">&#10003;</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Thank You!</h1>
          <p className="text-slate-600">Your intake form has been submitted successfully. Your care provider will review your information before your visit.</p>
          {practiceName && <p className="mt-4 text-sm text-slate-500">{practiceName}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-6">
        <div className="mx-auto max-w-2xl text-center">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo" className="h-12 mx-auto mb-3 object-contain" />
          )}
          <h1 className="text-2xl font-bold text-slate-900">{practiceName || 'Patient Intake Form'}</h1>
          <p className="text-sm text-slate-500 mt-1">Please fill out this form before your appointment</p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="space-y-8">

          {/* Personal Information */}
          <section className="rounded-2xl bg-white border border-slate-200 p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">Personal Information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>First Name *</label>
                <input type="text" value={form.first_name} onChange={e => updateForm('first_name', e.target.value)} className={inputClass} placeholder="John" />
              </div>
              <div>
                <label className={labelClass}>Last Name *</label>
                <input type="text" value={form.last_name} onChange={e => updateForm('last_name', e.target.value)} className={inputClass} placeholder="Doe" />
              </div>
              <div>
                <label className={labelClass}>Date of Birth</label>
                <input type="date" value={form.date_of_birth} onChange={e => updateForm('date_of_birth', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input type="tel" value={form.phone} onChange={e => updateForm('phone', e.target.value)} className={inputClass} placeholder="(555) 123-4567" />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input type="email" value={form.email} onChange={e => updateForm('email', e.target.value)} className={inputClass} placeholder="john@example.com" />
              </div>
              <div>
                <label className={labelClass}>Address</label>
                <input type="text" value={form.address} onChange={e => updateForm('address', e.target.value)} className={inputClass} placeholder="123 Main St, City, ST" />
              </div>
            </div>
          </section>

          {/* Emergency Contact */}
          <section className="rounded-2xl bg-white border border-slate-200 p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">Emergency Contact</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Contact Name</label>
                <input type="text" value={form.emergency_contact} onChange={e => updateForm('emergency_contact', e.target.value)} className={inputClass} placeholder="Jane Doe" />
              </div>
              <div>
                <label className={labelClass}>Contact Phone</label>
                <input type="tel" value={form.emergency_phone} onChange={e => updateForm('emergency_phone', e.target.value)} className={inputClass} placeholder="(555) 987-6543" />
              </div>
            </div>
          </section>

          {/* Insurance */}
          <section className="rounded-2xl bg-white border border-slate-200 p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">Insurance Information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Insurance Provider</label>
                <input type="text" value={form.insurance_provider} onChange={e => updateForm('insurance_provider', e.target.value)} className={inputClass} placeholder="Blue Cross Blue Shield" />
              </div>
              <div>
                <label className={labelClass}>Member ID</label>
                <input type="text" value={form.insurance_id} onChange={e => updateForm('insurance_id', e.target.value)} className={inputClass} placeholder="XYZ123456" />
              </div>
              <div>
                <label className={labelClass}>Group Number</label>
                <input type="text" value={form.insurance_group} onChange={e => updateForm('insurance_group', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Insurance Phone</label>
                <input type="tel" value={form.insurance_phone} onChange={e => updateForm('insurance_phone', e.target.value)} className={inputClass} />
              </div>
            </div>
          </section>

          {/* Chief Complaint & Pain */}
          <section className="rounded-2xl bg-white border border-slate-200 p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">Reason for Visit</h2>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Chief Complaint</label>
                <textarea value={form.chief_complaint} onChange={e => updateForm('chief_complaint', e.target.value)}
                  className={inputClass + ' min-h-[80px]'} placeholder="What brings you in today?" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Pain Location</label>
                  <input type="text" value={form.pain_location} onChange={e => updateForm('pain_location', e.target.value)} className={inputClass} placeholder="Lower back, neck, shoulders..." />
                </div>
                <div>
                  <label className={labelClass}>Duration of Symptoms</label>
                  <input type="text" value={form.pain_duration} onChange={e => updateForm('pain_duration', e.target.value)} className={inputClass} placeholder="2 weeks, 3 months..." />
                </div>
              </div>
              <div>
                <label className={labelClass}>Pain Scale (0-10): {form.pain_scale}</label>
                <input type="range" min={0} max={10} value={form.pain_scale}
                  onChange={e => updateForm('pain_scale', Number(e.target.value))}
                  className="w-full accent-blue-500" />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>No Pain</span><span>Worst Pain</span>
                </div>
              </div>
              <div>
                <label className={labelClass}>Describe Your Pain</label>
                <textarea value={form.pain_description} onChange={e => updateForm('pain_description', e.target.value)}
                  className={inputClass + ' min-h-[60px]'} placeholder="Sharp, dull, aching, burning, radiating..." />
              </div>
            </div>
          </section>

          {/* Medical History */}
          <section className="rounded-2xl bg-white border border-slate-200 p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">Medical History</h2>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Past Medical Conditions</label>
                <textarea value={form.medical_history} onChange={e => updateForm('medical_history', e.target.value)}
                  className={inputClass + ' min-h-[60px]'} placeholder="Diabetes, heart disease, arthritis, etc." />
              </div>
              <div>
                <label className={labelClass}>Previous Surgeries</label>
                <textarea value={form.surgeries} onChange={e => updateForm('surgeries', e.target.value)}
                  className={inputClass + ' min-h-[60px]'} placeholder="List any previous surgeries and approximate dates..." />
              </div>
              <div>
                <label className={labelClass}>Current Medications</label>
                <textarea value={form.medications} onChange={e => updateForm('medications', e.target.value)}
                  className={inputClass + ' min-h-[60px]'} placeholder="Include dosage if known..." />
              </div>
              <div>
                <label className={labelClass}>Allergies</label>
                <textarea value={form.allergies} onChange={e => updateForm('allergies', e.target.value)}
                  className={inputClass + ' min-h-[60px]'} placeholder="Drug allergies, latex, food allergies..." />
              </div>
              <div>
                <label className={labelClass}>Family Medical History</label>
                <textarea value={form.family_history} onChange={e => updateForm('family_history', e.target.value)}
                  className={inputClass + ' min-h-[60px]'} placeholder="Heart disease, cancer, diabetes in family..." />
              </div>
            </div>
          </section>

          {/* Lifestyle */}
          <section className="rounded-2xl bg-white border border-slate-200 p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">Lifestyle</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Occupation</label>
                <input type="text" value={form.occupation} onChange={e => updateForm('occupation', e.target.value)} className={inputClass} placeholder="Office worker, construction, retired..." />
              </div>
              <div>
                <label className={labelClass}>Exercise Habits</label>
                <input type="text" value={form.exercise_habits} onChange={e => updateForm('exercise_habits', e.target.value)} className={inputClass} placeholder="3x/week, running, none..." />
              </div>
              <div>
                <label className={labelClass}>Sleep Quality</label>
                <select value={form.sleep_quality} onChange={e => updateForm('sleep_quality', e.target.value)} className={inputClass}>
                  <option value="">Select...</option>
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Stress Level</label>
                <select value={form.stress_level} onChange={e => updateForm('stress_level', e.target.value)} className={inputClass}>
                  <option value="">Select...</option>
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                  <option value="very-high">Very High</option>
                </select>
              </div>
            </div>
          </section>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <button onClick={handleSubmit} disabled={saving}
            className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition">
            {saving ? 'Submitting...' : 'Submit Intake Form'}
          </button>

          <p className="text-[11px] text-slate-400 text-center">
            Your information is private and will only be shared with your care provider.
          </p>
        </div>
      </div>
    </div>
  )
}
