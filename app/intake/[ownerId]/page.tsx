'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { offlineDb, syncPendingData } from '../../lib/offlineDb'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type SpeciesType = 'equine' | 'canine' | 'feline' | 'bovine' | 'porcine' | 'exotic'

type Owner = {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  address: string | null
  practitioner_id: string | null
}

type Practitioner = {
  id: string
  practice_name: string
  full_name: string | null
  logo_url: string | null
}

type PatientAnimal = {
  id: string
  name: string
  species: SpeciesType | null
  breed: string | null
  age: string | null
  sex: string | null
  barn_location: string | null
}

type AnimalEntry = {
  localKey: string
  selectedHorseId: string
  species: SpeciesType
  name: string
  age: string
  breed: string
  barnLocation: string
  gender: string
  height: string
  color: string
  reasonForCare: string
  healthProblems: string
  behaviorChanges: string
  conditionsIllnesses: string
  medications: string
  useOfAnimal: string
  previousChiroCare: boolean | null
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
  feline: ['Female', 'Male', 'Female (Spayed)', 'Male (Neutered)'],
  bovine: ['Cow', 'Bull', 'Steer', 'Heifer'],
  porcine: ['Gilt', 'Sow', 'Boar', 'Barrow'],
  exotic: ['Female', 'Male', 'Unknown'],
}

function blankAnimal(): AnimalEntry {
  return {
    localKey: crypto.randomUUID(),
    selectedHorseId: 'new',
    species: 'equine',
    name: '',
    age: '',
    breed: '',
    barnLocation: '',
    gender: '',
    height: '',
    color: '',
    reasonForCare: '',
    healthProblems: '',
    behaviorChanges: '',
    conditionsIllnesses: '',
    medications: '',
    useOfAnimal: '',
    previousChiroCare: null,
  }
}

export default function IntakeFormPage() {
  const params = useParams()
  const ownerId = params?.ownerId as string

  const [owner, setOwner] = useState<Owner | null>(null)
  const [practitioner, setPractitioner] = useState<Practitioner | null>(null)
  const [ownerHorses, setOwnerHorses] = useState<PatientAnimal[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [offlineSaved, setOfflineSaved] = useState(false)
  const [error, setError] = useState('')

  // Owner section
  const [ownerFirstName, setOwnerFirstName] = useState('')
  const [ownerLastName, setOwnerLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [streetAddress, setStreetAddress] = useState('')
  const [streetAddress2, setStreetAddress2] = useState('')
  const [city, setCity] = useState('')
  const [stateVal, setStateVal] = useState('')
  const [zip, setZip] = useState('')
  const [referralSources, setReferralSources] = useState<string[]>([])

  // Multiple animal entries
  const [animals, setAnimals] = useState<AnimalEntry[]>([blankAnimal()])

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
    const res = await fetch(`/api/public/owner/${ownerId}`)
    if (!res.ok) return
    const { owner: ownerData, horses: horsesData } = await res.json()

    if (ownerData) {
      setOwner(ownerData)
      const parts = ownerData.full_name?.split(' ') || []
      setOwnerFirstName(parts[0] || '')
      setOwnerLastName(parts.slice(1).join(' ') || '')
      setPhone(ownerData.phone || '')
      setEmail(ownerData.email || '')
      if (ownerData.address) setStreetAddress(ownerData.address)

      // Fetch practitioner data if practitioner_id exists
      if (ownerData.practitioner_id) {
        const practRes = await fetch(`/api/public/practitioner/${ownerData.practitioner_id}`)
        if (practRes.ok) {
          const practData = await practRes.json()
          setPractitioner(practData)
        }
      }
    }

    if (horsesData) {
      setOwnerHorses(horsesData)
    }

    setLoading(false)
  }

  // ── Animal entry helpers ────────────────────────────────────────────────────
  function updateAnimal(localKey: string, updates: Partial<AnimalEntry>) {
    setAnimals(prev =>
      prev.map(a => (a.localKey === localKey ? { ...a, ...updates } : a))
    )
  }

  function handleAnimalSelect(localKey: string, horseId: string) {
    if (horseId === 'new') {
      updateAnimal(localKey, {
        selectedHorseId: 'new',
        name: '', age: '', breed: '', gender: '',
      })
      return
    }
    const horse = ownerHorses.find(h => h.id === horseId)
    if (!horse) return
    updateAnimal(localKey, {
      selectedHorseId: horseId,
      name: horse.name || '',
      age: horse.age || '',
      breed: horse.breed || '',
      gender: horse.sex || '',
      species: horse.species === 'canine' ? 'canine' : 'equine',
    })
  }

  function handleSpeciesChange(localKey: string, species: SpeciesType) {
    updateAnimal(localKey, { species, gender: '' })
  }

  function addAnimal() {
    setAnimals(prev => [...prev, blankAnimal()])
  }

  function removeAnimal(localKey: string) {
    setAnimals(prev => prev.filter(a => a.localKey !== localKey))
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

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const canvas = canvasRef.current
    const signatureData = canvas ? canvas.toDataURL('image/png') : null
    const now = new Date().toISOString()
    const resolvedSignedName = `${ownerFirstName} ${ownerLastName}`.trim()

    // ── OFFLINE PATH ──────────────────────────────────────────────────────────
    if (!navigator.onLine) {
      for (const animal of animals) {
        const horseLocalId = crypto.randomUUID()
        const formLocalId = crypto.randomUUID()
        const resolvedAnimalName = animal.name.trim() || 'Unknown Patient'
        const resolvedHorseId = animal.selectedHorseId !== 'new' ? animal.selectedHorseId : horseLocalId

        if (animal.selectedHorseId === 'new') {
          await offlineDb.pendingHorses.add({
            localId: horseLocalId,
            ownerId,
            name: resolvedAnimalName,
            breed: animal.breed || null,
            age: animal.age || null,
            sex: animal.gender || null,
            species: animal.species,
            archived: false,
            createdAt: now,
          })
        }

        await offlineDb.pendingIntakeForms.add({
          localId: formLocalId,
          localHorseId: resolvedHorseId,
          isNewHorse: animal.selectedHorseId === 'new',
          ownerId,
          submittedAt: now,
          formDate: now.split('T')[0],
          referralSource: referralSources,
          animalName: resolvedAnimalName,
          animalAge: animal.age || null,
          animalBreed: animal.breed || null,
          animalGender: animal.gender || null,
          animalHeight: animal.height || null,
          animalColor: animal.color || null,
          reasonForCare: animal.reasonForCare || null,
          healthProblems: animal.healthProblems || null,
          behaviorChanges: animal.behaviorChanges || null,
          conditionsIllnesses: animal.conditionsIllnesses || null,
          medicationsSupplements: animal.medications || null,
          useOfAnimal: animal.useOfAnimal || null,
          previousChiroCare: animal.previousChiroCare,
          consentSigned: true,
          signatureData,
          signedName: resolvedSignedName,
        })
      }

      setOfflineSaved(true)
      setSubmitted(true)
      setSubmitting(false)
      return
    }

    // ── ONLINE PATH ───────────────────────────────────────────────────────────
    await syncPendingData(supabase)

    try {
      const res = await fetch('/api/intake/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId,
          referralSources,
          animals: animals.map(a => ({
            selectedHorseId: a.selectedHorseId,
            species: a.species,
            name: a.name,
            age: a.age,
            breed: a.breed,
            gender: a.gender,
            height: a.height,
            color: a.color,
            reasonForCare: a.reasonForCare,
            healthProblems: a.healthProblems,
            behaviorChanges: a.behaviorChanges,
            conditionsIllnesses: a.conditionsIllnesses,
            medications: a.medications,
            useOfAnimal: a.useOfAnimal,
            previousChiroCare: a.previousChiroCare,
          })),
          signatureData,
          signedName: resolvedSignedName,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Submission failed. Please try again.')
        setSubmitting(false)
        return
      }
    } catch {
      setError('Network error. Please check your connection and try again.')
      setSubmitting(false)
      return
    }

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
    const firstAnimalName = animals[0]?.name.trim() || 'your animal'
    const animalCount = animals.length
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#edf2f7] p-8 text-center">
        <div className={`flex h-20 w-20 items-center justify-center rounded-full text-4xl ${offlineSaved ? 'bg-amber-100' : 'bg-emerald-100'}`}>
          {offlineSaved ? '📵' : '✓'}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {offlineSaved ? 'Saved Offline' : 'Form Submitted!'}
          </h1>
          {offlineSaved ? (
            <>
              <p className="mt-2 text-slate-500">Thank you, {ownerFirstName}. Your form has been saved to this device.</p>
              <p className="mt-2 max-w-xs text-sm text-amber-700 bg-amber-50 rounded-2xl px-4 py-2">
                No internet connection detected. This form will automatically upload to the system when signal is restored.
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-slate-500">Thank you, {ownerFirstName}. Your intake form has been received.</p>
              <p className="mt-1 text-sm text-slate-400">
                We look forward to seeing you and {animalCount === 1 ? firstAnimalName : `your ${animalCount} animals`}!
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  const ownerFullName = `${ownerFirstName} ${ownerLastName}`.trim()
  const consentAnimalName = animals.length === 1
    ? (animals[0].name.trim() || "[Pet's Name]")
    : animals.map(a => a.name.trim() || 'Unknown').join(', ')

  return (
    <div className="min-h-screen bg-[#edf2f7] py-10 px-4">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-8 rounded-3xl bg-white p-8 shadow-md text-center">
          {practitioner?.logo_url && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={practitioner.logo_url} alt="Practice Logo" className="mx-auto mb-4 max-h-16 object-contain" />
            </>
          )}
          <h1 className="text-3xl font-bold text-slate-900">Equine Chiropractic Intake Form</h1>
          <p className="mt-2 text-sm text-slate-500">{practitioner?.practice_name || 'Your Care Provider'}{practitioner?.full_name ? ` · ${practitioner.full_name}` : ''}</p>
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
                <input value={stateVal} onChange={e => setStateVal(e.target.value)}
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

          {/* ── Animal Entries ── */}
          {animals.map((animal, index) => (
            <AnimalSection
              key={animal.localKey}
              animal={animal}
              index={index}
              total={animals.length}
              ownerHorses={ownerHorses}
              onUpdate={(updates) => updateAnimal(animal.localKey, updates)}
              onSelectHorse={(horseId) => handleAnimalSelect(animal.localKey, horseId)}
              onSpeciesChange={(species) => handleSpeciesChange(animal.localKey, species)}
              onRemove={() => removeAnimal(animal.localKey)}
            />
          ))}

          {/* Add Another Animal button */}
          <button
            type="button"
            onClick={addAnimal}
            className="w-full rounded-2xl border-2 border-dashed border-slate-300 py-4 text-sm font-semibold text-slate-500 hover:border-slate-400 hover:text-slate-700 transition"
          >
            + Add Another Animal
          </button>

          {/* ── Consent ── */}
          <Section title="Informed Consent">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-700 space-y-4">
              <p>
                I, <strong>{ownerFullName || "[Pet Owner's Name]"}</strong>, hereby give my consent for{' '}
                <strong>{consentAnimalName}</strong> to receive chiropractic care from {practitioner?.full_name || 'the attending practitioner'}. I understand that chiropractic care involves the assessment and adjustment of the
                musculoskeletal system of animals to restore proper function and mobility.
              </p>
              <p>
                I acknowledge that chiropractic care is a complementary therapy and is not a substitute for traditional
                veterinary medical care. I understand that while chiropractic adjustments are generally safe and
                well-tolerated, there are inherent risks associated with any manual therapy, including the risk of
                injury or exacerbation of pre-existing conditions.
              </p>
              <p>
                I agree to provide accurate and complete information about my animal(s)&apos; medical history, current
                health status, and any relevant veterinary treatments or procedures. I understand that this information
                will be used by the chiropractor to assess each animal&apos;s condition and develop an appropriate
                treatment plan.
              </p>
              <p>
                I understand that the chiropractor may need to perform a physical examination and/or diagnostic tests
                to evaluate each animal&apos;s condition and determine the appropriate course of chiropractic care. I
                agree to comply with any recommendations or instructions provided by the chiropractor regarding care,
                including follow-up appointments and home care exercises.
              </p>
              <p>
                I understand that I have the right to ask questions and seek clarification about my animal(s)&apos;
                chiropractic care at any time. I acknowledge that I have been provided with information about the
                benefits, risks, and alternatives to chiropractic care for animals, and I have had the opportunity to
                discuss any concerns or questions with the chiropractor.
              </p>
              <p>
                By signing below, I acknowledge that I have read and understood the information provided in this
                consent form, and I voluntarily consent to my animal(s) receiving chiropractic care from {practitioner?.full_name || 'the attending practitioner'}.
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
            {submitting
              ? 'Submitting…'
              : animals.length === 1
              ? 'Submit Intake Form'
              : `Submit Intake Form (${animals.length} Animals)`}
          </button>

          <p className="pb-8 text-center text-xs text-slate-400">
            {practitioner?.practice_name || 'Your Care Provider'}{practitioner?.full_name ? ` · ${practitioner.full_name}` : ''}
          </p>
        </form>
      </div>
    </div>
  )
}

// ── AnimalSection Component ───────────────────────────────────────────────────
function AnimalSection({
  animal,
  index,
  total,
  ownerHorses,
  onUpdate,
  onSelectHorse,
  onSpeciesChange,
  onRemove,
}: {
  animal: AnimalEntry
  index: number
  total: number
  ownerHorses: PatientAnimal[]
  onUpdate: (updates: Partial<AnimalEntry>) => void
  onSelectHorse: (horseId: string) => void
  onSpeciesChange: (species: SpeciesType) => void
  onRemove: () => void
}) {
  const title = total === 1 ? 'Animal Information' : `Animal ${index + 1}`

  return (
    <div className="rounded-3xl bg-white p-6 shadow-md">
      <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {total > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-400 hover:text-red-600 font-medium transition"
          >
            Remove
          </button>
        )}
      </div>

      <div className="space-y-5">

        {/* Patient selector */}
        {ownerHorses.length > 0 && (
          <Field label="Select Patient">
            <select
              value={animal.selectedHorseId}
              onChange={e => onSelectHorse(e.target.value)}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="new">➕ New / First-time patient</option>
              {ownerHorses.map(h => (
                <option key={h.id} value={h.id}>
                  {h.species === 'canine' ? '🐕' : '🐴'} {h.name}{h.breed ? ` — ${h.breed}` : ''}
                </option>
              ))}
            </select>
            {animal.selectedHorseId !== 'new' && (
              <p className="mt-1.5 text-xs text-emerald-600">
                ✓ Linked to existing patient record — fields pre-filled below
              </p>
            )}
          </Field>
        )}

        <Field label="Species">
          <div className="flex flex-wrap gap-4 mt-2">
            {[
              { value: 'equine', label: '🐴 Horse / Equine' },
              { value: 'canine', label: '🐕 Dog / Canine' },
              { value: 'feline', label: '🐱 Cat / Feline' },
              { value: 'bovine', label: '🐄 Cow / Bovine' },
              { value: 'porcine', label: '🐷 Pig / Porcine' },
              { value: 'exotic', label: '🦎 Exotic' },
            ].map(opt => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name={`species-${animal.localKey}`}
                  value={opt.value}
                  checked={animal.species === opt.value}
                  onChange={() => onSpeciesChange(opt.value as SpeciesType)}
                  className="h-4 w-4 accent-slate-800"
                />
                <span className="text-sm text-slate-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Animal Name">
            <input value={animal.name} onChange={e => onUpdate({ name: e.target.value })}
              className={inputCls} placeholder="Animal's name" />
          </Field>
          <Field label="Age">
            <input value={animal.age} onChange={e => onUpdate({ age: e.target.value })}
              className={inputCls} placeholder="e.g. 7" />
          </Field>
        </div>

        <Field label="Breed">
          <input value={animal.breed} onChange={e => onUpdate({ breed: e.target.value })}
            className={inputCls} placeholder="e.g. Quarter Horse" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Sex">
            <div className="mt-2 space-y-2">
              {GENDER_OPTIONS[animal.species].map(g => (
                <label key={g} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name={`gender-${animal.localKey}`}
                    value={g}
                    checked={animal.gender === g}
                    onChange={() => onUpdate({ gender: g })}
                    className="h-4 w-4 accent-slate-800"
                  />
                  <span className="text-sm text-slate-700">{g}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Height">
            <input value={animal.height} onChange={e => onUpdate({ height: e.target.value })}
              className={inputCls} placeholder="e.g. 15.2 hh" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Color">
            <input value={animal.color} onChange={e => onUpdate({ color: e.target.value })}
              className={inputCls} placeholder="e.g. Bay" />
          </Field>
          <Field label="Reason for Seeking Chiropractic Care">
            <textarea value={animal.reasonForCare} onChange={e => onUpdate({ reasonForCare: e.target.value })}
              className={`${inputCls} min-h-24 resize-none`}
              placeholder="Describe the reason…" />
          </Field>
        </div>

        {/* Medical History */}
        <div className="pt-3 border-t border-slate-100">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Medical History</h3>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Health Problems / Concerns">
                <textarea value={animal.healthProblems} onChange={e => onUpdate({ healthProblems: e.target.value })}
                  className={`${inputCls} min-h-28 resize-none`} placeholder="Describe any health problems…" />
              </Field>
              <Field label="Any Recent Changes in Behavior? (If so, explain)">
                <textarea value={animal.behaviorChanges} onChange={e => onUpdate({ behaviorChanges: e.target.value })}
                  className={`${inputCls} min-h-28 resize-none`} placeholder="Describe any behavioral changes…" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Condition / Illnesses (List doctors seen, date last seen, diagnosis)">
                <textarea value={animal.conditionsIllnesses} onChange={e => onUpdate({ conditionsIllnesses: e.target.value })}
                  className={`${inputCls} min-h-28 resize-none`} placeholder="List conditions and treating vets…" />
              </Field>
              <Field label="Medications / Supplements">
                <textarea value={animal.medications} onChange={e => onUpdate({ medications: e.target.value })}
                  className={`${inputCls} min-h-28 resize-none`} placeholder="List all medications and supplements…" />
              </Field>
            </div>

            <Field label="Use / Job of Animal">
              <textarea value={animal.useOfAnimal} onChange={e => onUpdate({ useOfAnimal: e.target.value })}
                className={`${inputCls} min-h-24 resize-none`} placeholder="e.g. Barrel racing, trail riding, companion…" />
            </Field>

            <Field label="Has your animal had previous chiropractic care?">
              <div className="mt-2 flex gap-6">
                {[true, false].map(val => (
                  <label key={String(val)} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name={`prevChiro-${animal.localKey}`}
                      checked={animal.previousChiroCare === val}
                      onChange={() => onUpdate({ previousChiroCare: val })}
                      className="h-4 w-4 accent-slate-800"
                    />
                    <span className="text-sm text-slate-700">{val ? 'Yes' : 'No'}</span>
                  </label>
                ))}
              </div>
            </Field>
          </div>
        </div>

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
