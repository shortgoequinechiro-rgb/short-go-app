'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

type Owner = {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  address: string | null
}

type Animal = {
  id: string
  name: string
  species: 'equine' | 'canine' | null
  breed: string | null
  age: string | null
  gender: string | null
  discipline: string | null
  barn_location: string | null
  archived: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OwnerPage() {
  const router = useRouter()
  const params = useParams()
  const ownerId = params.ownerId as string

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [owner, setOwner] = useState<Owner | null>(null)
  const [animals, setAnimals] = useState<Animal[]>([])
  const [visitCounts, setVisitCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setCheckingAuth(false)
    })
  }, [router])

  // ── Load data ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (checkingAuth || !ownerId) return
    async function load() {
      setLoading(true)

      // Owner
      const { data: ownerData, error: ownerErr } = await supabase
        .from('owners')
        .select('id, full_name, phone, email, address')
        .eq('id', ownerId)
        .single()

      if (ownerErr || !ownerData) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setOwner(ownerData as Owner)

      // Animals
      const { data: animalData } = await supabase
        .from('horses')
        .select('id, name, species, breed, age, gender, discipline, barn_location, archived')
        .eq('owner_id', ownerId)
        .eq('archived', false)
        .order('name')

      const animalList = (animalData || []) as Animal[]
      setAnimals(animalList)

      // Visit counts
      if (animalList.length > 0) {
        const ids = animalList.map(a => a.id)
        const { data: visitData } = await supabase
          .from('visits')
          .select('horse_id')
          .in('horse_id', ids)

        const counts: Record<string, number> = {}
        for (const v of (visitData || [])) {
          if (v.horse_id) counts[v.horse_id] = (counts[v.horse_id] || 0) + 1
        }
        setVisitCounts(counts)
      }

      setLoading(false)
    }
    load()
  }, [checkingAuth, ownerId])

  // ── Render ────────────────────────────────────────────────────────────────

  if (checkingAuth) return null

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition"
          >
            ← Dashboard
          </Link>
          <div className="flex-1 min-w-0">
            {owner ? (
              <>
                <h1 className="text-lg font-semibold text-slate-900 leading-tight truncate">{owner.full_name}</h1>
                <p className="text-xs text-slate-500">Owner profile</p>
              </>
            ) : (
              <h1 className="text-lg font-semibold text-slate-900">Owner</h1>
            )}
          </div>
          <Link
            href="/appointments"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition"
          >
            📅 Appointments
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">

        {/* ── Loading / not found ── */}
        {loading && (
          <p className="text-sm text-slate-400 py-12 text-center">Loading…</p>
        )}

        {notFound && !loading && (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
            <p className="text-2xl">🔍</p>
            <p className="mt-3 font-semibold text-slate-700">Owner not found</p>
            <Link href="/dashboard" className="mt-4 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">
              Back to Dashboard
            </Link>
          </div>
        )}

        {!loading && owner && (
          <>
            {/* ── Owner contact card ── */}
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-slate-900">{owner.full_name}</h2>
                  {owner.phone && (
                    <a
                      href={`tel:${owner.phone}`}
                      className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition w-fit"
                    >
                      <span className="text-slate-400">📞</span>
                      {formatPhone(owner.phone)}
                    </a>
                  )}
                  {owner.email && (
                    <a
                      href={`mailto:${owner.email}`}
                      className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition w-fit"
                    >
                      <span className="text-slate-400">✉️</span>
                      {owner.email}
                    </a>
                  )}
                  {owner.address && (
                    <p className="flex items-center gap-1.5 text-sm text-slate-500">
                      <span className="text-slate-400">📍</span>
                      {owner.address}
                    </p>
                  )}
                </div>
                <Link
                  href={`/appointments?ownerId=${owner.id}`}
                  className="shrink-0 rounded-xl bg-[#0f2040] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#162d55] transition"
                >
                  + Book Appointment
                </Link>
              </div>
            </div>

            {/* ── Animals ── */}
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {animals.length === 0
                      ? 'Animals'
                      : `${animals.length} Animal${animals.length > 1 ? 's' : ''}`}
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">Select an animal to start or view a visit record</p>
                </div>
              </div>

              {animals.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10">
                  <p className="text-2xl">🐾</p>
                  <p className="mt-2 text-sm text-slate-500">No animals on file for this owner</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {animals.map(animal => {
                    const emoji = animal.species === 'canine' ? '🐕' : '🐴'
                    const visits = visitCounts[animal.id] || 0

                    return (
                      <Link
                        key={animal.id}
                        href={`/horses/${animal.id}`}
                        className="group relative flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-400 hover:bg-white hover:shadow-md"
                      >
                        {/* Name + species */}
                        <div className="flex items-start gap-3">
                          <span className="text-2xl mt-0.5">{emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-lg font-semibold text-slate-900 leading-tight">{animal.name}</p>
                            {animal.breed && (
                              <p className="text-sm text-slate-500 mt-0.5">{animal.breed}</p>
                            )}
                          </div>
                          {/* Visit count badge */}
                          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            visits > 0 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
                          }`}>
                            {visits} {visits === 1 ? 'visit' : 'visits'}
                          </span>
                        </div>

                        {/* Meta row */}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {animal.age && (
                            <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600">
                              {animal.age}
                            </span>
                          )}
                          {animal.gender && (
                            <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600">
                              {animal.gender}
                            </span>
                          )}
                          {animal.discipline && (
                            <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600">
                              {animal.discipline}
                            </span>
                          )}
                          {animal.barn_location && (
                            <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-xs text-slate-500">
                              📍 {animal.barn_location}
                            </span>
                          )}
                        </div>

                        {/* CTA */}
                        <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                          <span className="text-xs text-slate-400 group-hover:text-slate-600 transition">
                            View record & history
                          </span>
                          <span className="rounded-xl bg-[#0f2040] px-3 py-1.5 text-xs font-semibold text-white group-hover:bg-[#162d55] transition">
                            Start Visit →
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
