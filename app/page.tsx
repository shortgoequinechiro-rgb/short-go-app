'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

type Owner = {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  created_at: string
}

type Horse = {
  id: string
  owner_id: string | null
  name: string
  breed: string | null
  discipline: string | null
  barn_location: string | null
  created_at: string
  owners?: {
    full_name: string
  } | null
}

export default function Home() {
  const router = useRouter()

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [message, setMessage] = useState('')

  const [owners, setOwners] = useState<Owner[]>([])
  const [horses, setHorses] = useState<Horse[]>([])
  const [visitCount, setVisitCount] = useState(0)
  const [photoCount, setPhotoCount] = useState(0)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const [selectedOwnerId, setSelectedOwnerId] = useState('')
  const [horseName, setHorseName] = useState('')
  const [horseBreed, setHorseBreed] = useState('')
  const [horseDiscipline, setHorseDiscipline] = useState('')
  const [barnLocation, setBarnLocation] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [disciplineFilter, setDisciplineFilter] = useState('all')

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return false
    }

    setUserEmail(user.email || '')
    setCheckingAuth(false)
    return true
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function loadOwners() {
    const { data, error } = await supabase
      .from('owners')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(`Error loading owners: ${error.message}`)
      return
    }

    const ownerData = data || []
    setOwners(ownerData)

    if (!selectedOwnerId && ownerData.length > 0) {
      setSelectedOwnerId(ownerData[0].id)
    }
  }

  async function loadHorses() {
    const { data, error } = await supabase
      .from('horses')
      .select(
        `
        *,
        owners (
          full_name
        )
      `
      )
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(`Error loading horses: ${error.message}`)
      return
    }

    setHorses(data || [])
  }

  async function loadVisitCount() {
    const { count, error } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })

    if (error) {
      setMessage(`Error loading visit count: ${error.message}`)
      return
    }

    setVisitCount(count || 0)
  }

  async function loadPhotoCount() {
    const { count, error } = await supabase
      .from('photos')
      .select('*', { count: 'exact', head: true })

    if (error) {
      setMessage(`Error loading photo count: ${error.message}`)
      return
    }

    setPhotoCount(count || 0)
  }

  async function addOwner() {
    setMessage('')

    if (!fullName.trim()) {
      setMessage('Full name is required.')
      return
    }

    const { error } = await supabase.from('owners').insert([
      {
        full_name: fullName,
        phone: phone || null,
        email: email || null,
      },
    ])

    if (error) {
      setMessage(`Error saving owner: ${error.message}`)
      return
    }

    setMessage('Owner saved successfully.')
    setFullName('')
    setPhone('')
    setEmail('')
    await loadOwners()
  }

  async function addHorse() {
    setMessage('')

    if (!selectedOwnerId) {
      setMessage('Please select an owner.')
      return
    }

    if (!horseName.trim()) {
      setMessage('Horse name is required.')
      return
    }

    const { error } = await supabase.from('horses').insert([
      {
        owner_id: selectedOwnerId,
        name: horseName,
        breed: horseBreed || null,
        discipline: horseDiscipline || null,
        barn_location: barnLocation || null,
      },
    ])

    if (error) {
      setMessage(`Error saving horse: ${error.message}`)
      return
    }

    setMessage('Horse saved successfully.')
    setHorseName('')
    setHorseBreed('')
    setHorseDiscipline('')
    setBarnLocation('')
    await loadHorses()
  }

  const disciplineOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        horses
          .map((horse) => horse.discipline?.trim())
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b))

    return values
  }, [horses])

  const filteredHorses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return horses.filter((horse) => {
      const matchesSearch =
        !query ||
        horse.name.toLowerCase().includes(query) ||
        (horse.owners?.full_name || '').toLowerCase().includes(query) ||
        (horse.breed || '').toLowerCase().includes(query) ||
        (horse.barn_location || '').toLowerCase().includes(query) ||
        (horse.discipline || '').toLowerCase().includes(query)

      const matchesDiscipline =
        disciplineFilter === 'all' ||
        (horse.discipline || '').toLowerCase() === disciplineFilter.toLowerCase()

      return matchesSearch && matchesDiscipline
    })
  }, [horses, searchTerm, disciplineFilter])

  useEffect(() => {
    async function init() {
      const isLoggedIn = await checkUser()
      if (!isLoggedIn) return

      await loadOwners()
      await loadHorses()
      await loadVisitCount()
      await loadPhotoCount()
    }

    init()
  }, [])

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 md:p-8">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-slate-700">Checking login...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6 xl:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                Short-Go Equine Chiropractic
              </p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">
                Client Dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
                iPad-first and phone-safe horse records, visit notes, and photos.
              </p>
            </div>

            <div className="flex flex-col gap-3 xl:items-end">
              <p className="text-sm text-slate-500 break-all">
                Signed in as: {userEmail || 'Unknown user'}
              </p>
              <button
                onClick={handleSignOut}
                className="min-h-[44px] rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 grid-cols-2 xl:grid-cols-4">
          <StatCard label="Owners" value={owners.length} />
          <StatCard label="Horses" value={horses.length} />
          <StatCard label="Visits" value={visitCount} />
          <StatCard label="Photos" value={photoCount} />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
              Quick Add Owner
            </h2>

            <div className="mt-4 grid gap-4">
              <Field label="Full Name">
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                  placeholder="Owner full name"
                />
              </Field>

              <Field label="Phone">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                  placeholder="Phone number"
                />
              </Field>

              <Field label="Email">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                  placeholder="Email address"
                />
              </Field>

              <button
                onClick={addOwner}
                className="min-h-[48px] rounded-2xl bg-slate-900 px-5 py-3 text-base font-medium text-white"
              >
                Save Owner
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
              Quick Add Horse
            </h2>

            <div className="mt-4 grid gap-4">
              <Field label="Owner">
                <select
                  value={selectedOwnerId}
                  onChange={(e) => setSelectedOwnerId(e.target.value)}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                >
                  <option value="">Select an owner</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.full_name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Horse Name">
                <input
                  value={horseName}
                  onChange={(e) => setHorseName(e.target.value)}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                  placeholder="Horse name"
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Breed">
                  <input
                    value={horseBreed}
                    onChange={(e) => setHorseBreed(e.target.value)}
                    className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                    placeholder="Breed"
                  />
                </Field>

                <Field label="Discipline">
                  <input
                    value={horseDiscipline}
                    onChange={(e) => setHorseDiscipline(e.target.value)}
                    className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                    placeholder="Barrel, ranch, dressage, etc."
                  />
                </Field>
              </div>

              <Field label="Barn Location">
                <input
                  value={barnLocation}
                  onChange={(e) => setBarnLocation(e.target.value)}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                  placeholder="Barn or ranch name"
                />
              </Field>

              <button
                onClick={addHorse}
                className="min-h-[48px] rounded-2xl bg-slate-900 px-5 py-3 text-base font-medium text-white"
              >
                Save Horse
              </button>
            </div>
          </div>
        </div>

        {message ? (
          <div className="mt-5 rounded-3xl bg-white p-4 text-sm text-slate-700 shadow-sm">
            {message}
          </div>
        ) : null}

        <div className="mt-5 rounded-3xl bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
                Horse Records
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Fast lookup for iPad in the barn, but still easy on phone.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:min-w-[520px]">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Search
                </label>
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                  placeholder="Horse, owner, breed, barn, discipline..."
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Discipline
                </label>
                <select
                  value={disciplineFilter}
                  onChange={(e) => setDisciplineFilter(e.target.value)}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                >
                  <option value="all">All disciplines</option>
                  {disciplineOptions.map((discipline) => (
                    <option key={discipline} value={discipline}>
                      {discipline}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
              Showing {filteredHorses.length} of {horses.length} horses
            </span>

            {(searchTerm || disciplineFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('')
                  setDisciplineFilter('all')
                }}
                className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {filteredHorses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-slate-500">
                No horses match your search or filter.
              </div>
            ) : (
              filteredHorses.map((horse) => (
                <Link
                  key={horse.id}
                  href={`/horses/${horse.id}`}
                  className="rounded-3xl border border-slate-200 p-5 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-semibold text-slate-900">
                        {horse.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Owner: {horse.owners?.full_name || '—'}
                      </p>
                    </div>

                    {horse.discipline ? (
                      <span className="rounded-2xl bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {horse.discipline}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-slate-600">
                    <p>Breed: {horse.breed || '—'}</p>
                    <p>Barn: {horse.barn_location || '—'}</p>
                  </div>

                  <div className="mt-5 inline-flex min-h-[44px] items-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                    Open Record
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">
        {value}
      </p>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  )
}