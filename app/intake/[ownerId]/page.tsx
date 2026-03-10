'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

// ── SQL Setup ──────────────────────────────────────────────────────────────────
// Run once in Supabase SQL editor:
//
// CREATE TABLE intake_forms (
//   id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   owner_id              uuid REFERENCES owners(id) ON DELETE CASCADE NOT NULL,
//   horse_id              uuid REFERENCES horses(id) ON DELETE SET NULL,
//   submitted_at          timestamptz DEFAULT now() NOT NULL,
//   form_date             date,
//   referral_source       text[],
//   animal_name           text NOT NULL,
//   animal_age            text,
//   animal_breed          text,
//   animal_dob            date,
//   animal_gender         text,
//   animal_height         text,
//   animal_color          text,
//   reason_for_care       text,
//   health_problems       text,
//   behavior_changes      text,
//   conditions_illnesses  text,
//   medications_supplements text,
//   use_of_animal         text,
//   previous_chiro_care   boolean,
//   consent_signed        boolean DEFAULT false,
//   signature_data        text,
//   signed_name           text,
//   created_at            timestamptz DEFAULT now()
// );
//
// If table already exists, add horse_id column:
// ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS horse_id uuid REFERENCES horses(id) ON DELETE SET NULL;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Owner = {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  address: string | null
}

type PatientAnimal = {
  id: string
  name: string
  species: 'equine' | 'canine' | null
  breed: string | null
  age: string | null
  sex: string | null
  barn_location: string | null
}

const REFERRAL_OPTIONS = [
  'Friend/Family member',
  'Other Chiropractor/Veterinarian',
  'Google',
  'Social Media',
  'Other',
]

const GENDER_OPTIONS: Record<string, string[]> = {
  equine: ['Mare', 'Gelding', 'Stallion'],
  canine: ['Female', 'Male', 'Female (Spayed)', 'Male (Neutered)'],
}

export default function IntakeFormPage() {
  const params = useParams()
  const ownerId = params?.ownerId as string

  const [owner, setOwner] = useState<Owner | null>(null)
  const [ownerHorses, setOwnerHorses] = useState<PatientAnimal[]>([])
  const [selectedHorseId, setSelectedHorseId] = useState<string>('new')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submittedHorseId, setSubmittedHorseId] = useState<string | null>(null)
  const [submittedFormId, setSubmittedFormId] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Owner section
  const [ownerFirstName, setOwnerFirstName] = useState('')
  const [ownerLastName, setOwnerLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [streetAddress, setStreetAddress] = useState('')
  const [streetAddress2, setStreetAddress2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [referralSources, setReferralSources] = useState<string[]>([])

  // Animal section
  const [animalSpecies, setAnimalSpecies] = useState<'equine' | 'canine'>('equine')
  const [animalName, setAnimalName] = useState('')
  const [animalAge, setAnimalAge] = useState('')
  const [animalBreed, setAnimalBreed] = useState('')
  const [animalDob, setAnimalDob] = useState('')
  const [animalGender, setAnimalGender] = useState('')
  const [animalHeight, setAnimalHeight] = useState('')
  const [animalColor, setAnimalColor] = useState('')
  const [reasonForCare, setReasonForCare] = useState('')
  const [healthProblems, setHealthProblems] = useState('')
  const [behaviorChanges, setBehaviorChanges] = useState('')
  const [conditionsIllnesses, setConditionsIllnesses] = useState('')
  const [medications, setMedications] = useState('')
  const [useOfAnimal, setUseOfAnimal] = useState('')
  const [previousChiroCare, setPreviousChiroCare] = useState<boolean | null>(null)

  // Signature
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const [hasSigned, setHasSigned] = useState(false)

  const today = new Date().toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric',
  })

  useEffect(() => {
    if (!ownerId) return
    loadOwnerAndAnimals()
  }, [ownerId])

  async function loadOwnerAndAnimals() {
    const [ownerRes, horsesRes] = await Promise.all([
      supabase.from('owners').select('id, full_name, phone, email, address').eq('id', ownerId).single(),
      supabase.from('horses').select('id, name, species, breed, age, sex, barn_location').eq('owner_id', ownerId).order('name'),
    ])

    if (ownerRes.data) {
      const data = ownerRes.data
      setOwner(data)
      const parts = data.full_name?.split(' ') || []
      setOwnerFirstName(parts[0] || '')
      setOwnerLastName(parts.slice(1).join(' ') || '')
      setPhone(data.phone || '')
      setEmail(data.email || '')
      if (data.address) setStreetAddress(data.address)
    }

    if (horsesRes.data) {
      setOwnerHorses(horsesRes.data)
    }

    setLoading(false)
  }

  // When the dropdown selection changes, pre-fill animal fields
  function handleAnimalSelect(horseId: string) {
    setSelectedHorseId(horseId)
    if (horseId === 'new') {
      setAnimalName('')
      setAnimalAge('')
      setAnimalBreed('')
      setAnimalGender('')
      return
    }
    const horse = ownerHorses.find(h => h.id === horseId)
    if (!horse) return
    setAnimalName(horse.name || '')
    setAnimalAge(horse.age || '')
    setAnimalBreed(horse.breed || '')
    setAnimalGender(horse.sex || '')
    setAnimalSpecies(horse.species === 'canine' ? 'canine' : 'equine')
  }

  function handleSpeciesChange(species: 'equine' | 'canine') {
    setAnimalSpecies(species)
    setAnimalGender('') // reset gender when species changes
  }

  // ── Signature canvas ────────────────────────────────────────────────────────
  function getCanvasPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    isDrawingRef.current = true
    const ctx = canvas.getContext('2d')!
    ctx.beginPath()
    const pos = getCanvasPos(e, canvas)
    ctx.moveTo(pos.x, pos.y)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    const ctx = canvas.getContext('2d')!
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1e293b'
    const pos = getCanvasPos(e, canvas)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    setHasSigned(true)
  }

  function stopDraw() {
    isDrawingRef.current = false
  }

  function clearSignature() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSigned(false)
  }

  function toggleReferral(option: string) {
    setReferralSources(prev =>
      prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const canvas = canvasRef.current
    const signatureData = canvas ? canvas.toDataURL('image/png') : null
    const now = new Date().toISOString()

    // ── Auto-create horse record for new patients ────────────────────────────
    let resolvedHorseId: string | null = selectedHorseId !== 'new' ? selectedHorseId : null

    if (selectedHorseId === 'new') {
      const { data: newHorse, error: horseError } = await supabase
        .from('horses')
        .insert({
          owner_id: ownerId,
          name: animalName.trim() || 'Unknown Patient',
          breed: animalBreed || null,
          age: animalAge || null,
          sex: animalGender || null,
          species: animalSpecies,
          archived: false,
        })
        .select('id')
        .single()

      if (horseError || !newHorse) {
        setError(`Could not create patient record: ${horseError?.message || 'unknown error'}`)
        setSubmitting(false)
        return
      }
      resolvedHorseId = newHorse.id
    }

    const { data: newForm, error: dbError } = await supabase
      .from('intake_forms')
      .insert({
        owner_id: ownerId,
        horse_id: resolvedHorseId,
        submitted_at: now,
        form_date: now.split('T')[0],
        referral_source: referralSources,
        animal_name: animalName.trim() || 'Unknown Patient',
        animal_age: animalAge || null,
        animal_breed: animalBreed || null,
        animal_dob: animalDob || null,
        animal_gender: animalGender || null,
        animal_height: animalHeight || null,
        animal_color: animalColor || null,
        reason_for_care: reasonForCare || null,
        health_problems: healthProblems || null,
        behavior_changes: behaviorChanges || null,
        conditions_illnesses: conditionsIllnesses || null,
        medications_supplements: medications || null,
        use_of_animal: useOfAnimal || null,
        previous_chiro_care: previousChiroCare,
        consent_signed: true,
        signature_data: signatureData,
        signed_name: `${ownerFirstName} ${ownerLastName}`.trim(),
      })
      .select('id')
      .single()

    if (dbError) {
      // Roll back the horse record we just created so retrying doesn't duplicate it
      if (selectedHorseId === 'new' && resolvedHorseId) {
        await supabase.from('horses').delete().eq('id', resolvedHorseId)
      }
      setError(`Submission error: ${dbError.message}`)
      setSubmitting(false)
      return
    }

    setSubmittedHorseId(resolvedHorseId)
    setSubmittedFormId(newForm?.id ?? null)
    setSubmitted(true)
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#edf2f7]">
        <p className="text-slate-500">Loading form…</p>
      </div>
    )
  }

  if (!owner) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#edf2f7]">
        <p className="text-slate-500">Form not found.</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#edf2f7] p-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl">✓</div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Form Submitted!</h1>
          <p className="mt-2 text-slate-500">Thank you, {ownerFirstName}. Your intake form has been received.</p>
          <p className="mt-1 text-sm text-slate-400">We look forward to seeing you and {animalName}!</p>
        </div>
        <div className="flex flex-col items-center gap-3 mt-2">
          {submittedFormId && (
            <a
              href={`/api/intake/${submittedFormId}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 transition"
            >
              📄 View / Download PDF
            </a>
          )}
          {submittedHorseId && (
            <a
              href={`/horses/${submittedHorseId}`}
              className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              View Patient Record →
            </a>
          )}
        </div>
      </div>
    )
  }

  const ownerFullName = `${ownerFirstName} ${ownerLastName}`.trim()
  const consentAnimalName = animalName.trim() || "[Pet's Name]"

  return (
    <div className="min-h-screen bg-[#edf2f7] py-10 px-4">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-8 rounded-3xl bg-white p-8 shadow-md text-center">
          <h1 className="text-3xl font-bold text-slate-900">Equine Chiropractic Intake Form</h1>
          <p className="mt-2 text-sm text-slate-500">Short-Go Equine Chiropractic · Dr. Andrew Leo, D.C. c.AVCA</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">

          {/* ── Owner Info ── */}
          <Section title="Owner Information">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name">
                <input value={ownerFirstName} onChange={e => setOwnerFirstName(e.target.value)}
                  className={inputCls} placeholder="First Name" />
              </Field>
              <Field label="Last Name">
                <input value={ownerLastName} onChange={e => setOwnerLastName(e.target.value)}
                  className={inputCls} placeholder="Last Name" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Today's Date">
                <input value={today} readOnly className={`${inputCls} bg-slate-50 text-slate-500`} />
              </Field>
              <Field label="Phone Number">
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  className={inputCls} placeholder="(000) 000-0000" type="tel" />
              </Field>
            </div>

            <Field label="Address">
              <input value={streetAddress} onChange={e => setStreetAddress(e.target.value)}
                className={`${inputCls} mb-3`} placeholder="Street Address" />
              <input value={streetAddress2} onChange={e => setStreetAddress2(e.target.value)}
                className={`${inputCls} mb-3`} placeholder="Street Address Line 2" />
              <div className="grid grid-cols-2 gap-3">
                <input value={city} onChange={e => setCity(e.target.value)}
                  className={inputCls} placeholder="City" />
                <input value={state} onChange={e => setState(e.target.value)}
                  className={inputCls} placeholder="State / Province" />
              </div>
              <input value={zip} onChange={e => setZip(e.target.value)}
                className={`${inputCls} mt-3`} placeholder="Postal / Zip Code" />
            </Field>

            <Field label="Email">
              <input value={email} onChange={e => setEmail(e.target.value)}
                className={inputCls} placeholder="example@example.com" type="email" />
            </Field>
          </Section>

          {/* ── Referral ── */}
          <Section title="">
            <Field label="How did you hear about our Animal Chiropractic services? We are always sure to thank our referral sources.">
              <div className="mt-2 space-y-3">
                {REFERRAL_OPTIONS.map(opt => (
                  <label key={opt} className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={referralSources.includes(opt)}
                      onChange={() => toggleReferral(opt)}
                      className="h-5 w-5 rounded border-slate-300 accent-slate-800"
                    />
                    <span className="text-sm text-slate-700">{opt}</span>
                  </label>
                ))}
              </div>
            </Field>
          </Section>

          {/* ── Animal Info ── */}
          <Section title="Animal Information">

            {/* Patient selector */}
            {ownerHorses.length > 0 && (
              <Field label="Select Patient">
                <select
                  value={selectedHorseId}
                  onChange={e => handleAnimalSelect(e.target.value)}
                  className={`${inputCls} cursor-pointer`}
                >
                  <option value="new">➕ New / First-time patient</option>
                  {ownerHorses.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.species === 'canine' ? '🐕' : '🐴'} {h.name}{h.breed ? ` — ${h.breed}` : ''}
                    </option>
                  ))}
                </select>
                {selectedHorseId !== 'new' && (
                  <p className="mt-1.5 text-xs text-emerald-600">
                    ✓ Linked to existing patient record — fields pre-filled below
                  </p>
                )}
              </Field>
            )}

            <Field label="Species">
              <div className="flex gap-4 mt-2">
                {[
                  { value: 'equine', label: '🐴 Horse / Equine' },
                  { value: 'canine', label: '🐕 Dog / Canine' },
                ].map(opt => (
                  <label key={opt.value} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="species"
                      value={opt.value}
                      checked={animalSpecies === opt.value}
                      onChange={() => handleSpeciesChange(opt.value as 'equine' | 'canine')}
                      className="h-4 w-4 accent-slate-800"
                    />
                    <span className="text-sm text-slate-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Animal Name">
                <input value={animalName} onChange={e => setAnimalName(e.target.value)}
                  className={inputCls} placeholder="Animal's name" />
              </Field>
              <Field label="Age">
                <input value={animalAge} onChange={e => setAnimalAge(e.target.value)}
                  className={inputCls} placeholder="e.g. 7" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Breed">
                <input value={animalBreed} onChange={e => setAnimalBreed(e.target.value)}
                  className={inputCls} placeholder="e.g. Quarter Horse" />
              </Field>
              <Field label="Date of Birth">
                <input value={animalDob} onChange={e => setAnimalDob(e.target.value)}
                  className={inputCls} type="date" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Sex">
                <div className="mt-2 space-y-2">
                  {GENDER_OPTIONS[animalSpecies].map(g => (
                    <label key={g} className="flex cursor-pointer items-center gap-3">
                      <input
                        type="radio"
                        name="gender"
                        value={g}
                        checked={animalGender === g}
                        onChange={() => setAnimalGender(g)}
                        className="h-4 w-4 accent-slate-800"
                      />
                      <span className="text-sm text-slate-700">{g}</span>
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Height">
                <input value={animalHeight} onChange={e => setAnimalHeight(e.target.value)}
                  className={inputCls} placeholder="e.g. 15.2 hh" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Color">
                <input value={animalColor} onChange={e => setAnimalColor(e.target.value)}
                  className={inputCls} placeholder="e.g. Bay" />
              </Field>
              <Field label="Reason for Seeking Chiropractic Care">
                <textarea value={reasonForCare} onChange={e => setReasonForCare(e.target.value)}
                  className={`${inputCls} min-h-24 resize-none`}
                  placeholder="Describe the reason…" />
              </Field>
            </div>
          </Section>

          {/* ── Medical History ── */}
          <Section title="Medical History">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Health Problems / Concerns">
                <textarea value={healthProblems} onChange={e => setHealthProblems(e.target.value)}
                  className={`${inputCls} min-h-28 resize-none`} placeholder="Describe any health problems…" />
              </Field>
              <Field label="Any Recent Changes in Behavior? (If so, explain)">
                <textarea value={behaviorChanges} onChange={e => setBehaviorChanges(e.target.value)}
                  className={`${inputCls} min-h-28 resize-none`} placeholder="Describe any behavioral changes…" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Condition / Illnesses (List doctors seen, date last seen, diagnosis)">
                <textarea value={conditionsIllnesses} onChange={e => setConditionsIllnesses(e.target.value)}
                  className={`${inputCls} min-h-28 resize-none`} placeholder="List conditions and treating vets…" />
              </Field>
              <Field label="Medications / Supplements">
                <textarea value={medications} onChange={e => setMedications(e.target.value)}
                  className={`${inputCls} min-h-28 resize-none`} placeholder="List all medications and supplements…" />
              </Field>
            </div>

            <Field label="Use / Job of Animal">
              <textarea value={useOfAnimal} onChange={e => setUseOfAnimal(e.target.value)}
                className={`${inputCls} min-h-24 resize-none`} placeholder="e.g. Barrel racing, trail riding, companion…" />
            </Field>

            <Field label="Has your animal had previous chiropractic care?">
              <div className="mt-2 flex gap-6">
                {[true, false].map(val => (
                  <label key={String(val)} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="prevChiro"
                      checked={previousChiroCare === val}
                      onChange={() => setPreviousChiroCare(val)}
                      className="h-4 w-4 accent-slate-800"
                    />
                    <span className="text-sm text-slate-700">{val ? 'Yes' : 'No'}</span>
                  </label>
                ))}
              </div>
            </Field>
          </Section>

          {/* ── Consent ── */}
          <Section title="Informed Consent">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-700 space-y-4">
              <p>
                I, <strong>{ownerFullName || "[Pet Owner's Name]"}</strong>, hereby give my consent for{' '}
                <strong>{consentAnimalName}</strong> to receive chiropractic care from Dr. Andrew Leo, D.C. c.AVCA, Animal
                Chiropractor. I understand that chiropractic care involves the assessment and adjustment of the
                musculoskeletal system of animals to restore proper function and mobility.
              </p>
              <p>
                I acknowledge that chiropractic care is a complementary therapy and is not a substitute for traditional
                veterinary medical care. I understand that while chiropractic adjustments are generally safe and
                well-tolerated, there are inherent risks associated with any manual therapy, including the risk of
                injury or exacerbation of pre-existing conditions.
              </p>
              <p>
                I agree to provide accurate and complete information about <strong>{consentAnimalName}</strong>&apos;s
                medical history, current health status, and any relevant veterinary treatments or procedures. I
                understand that this information will be used by the chiropractor to assess{' '}
                <strong>{consentAnimalName}</strong>&apos;s condition and develop an appropriate treatment plan.
              </p>
              <p>
                I understand that the chiropractor may need to perform a physical examination and/or diagnostic tests
                to evaluate <strong>{consentAnimalName}</strong>&apos;s condition and determine the appropriate course of
                chiropractic care. I agree to comply with any recommendations or instructions provided by the
                chiropractor regarding <strong>{consentAnimalName}</strong>&apos;s care, including follow-up appointments
                and home care exercises.
              </p>
              <p>
                I understand that I have the right to ask questions and seek clarification about{' '}
                <strong>{consentAnimalName}</strong>&apos;s chiropractic care at any time. I acknowledge that I have been
                provided with information about the benefits, risks, and alternatives to chiropractic care for animals,
                and I have had the opportunity to discuss any concerns or questions with the chiropractor.
              </p>
              <p>
                By signing below, I acknowledge that I have read and understood the information provided in this
                consent form, and I voluntarily consent to <strong>{consentAnimalName}</strong> receiving chiropractic
                care from Dr. Andrew Leo, DC c.AVCA, Animal Chiropractor.
              </p>
            </div>

            <Field label="Pet Owner's Signature">
              <div className="mt-2 overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-white">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={160}
                  className="w-full touch-none cursor-crosshair"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={stopDraw}
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  {hasSigned ? '✓ Signature captured' : 'Sign in the box above'}
                </p>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="text-xs text-slate-400 underline hover:text-slate-600"
                >
                  Clear
                </button>
              </div>
            </Field>
          </Section>

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-slate-900 py-4 text-sm font-semibold text-white shadow-md transition hover:bg-slate-700 disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit Intake Form'}
          </button>

          <p className="pb-8 text-center text-xs text-slate-400">
            Short-Go Equine Chiropractic · Dr. Andrew Leo, D.C. c.AVCA, Animal Chiropractor
          </p>
        </form>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-md">
      {title && <h2 className="mb-5 text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">{title}</h2>}
      <div className="space-y-5">{children}</div>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-800">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}
