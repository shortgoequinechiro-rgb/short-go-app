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

type SearchMode = 'owner' | 'horse'

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

  const [selectedOwnerIdForAdd, setSelectedOwnerIdForAdd] = useState('')
  const [horseName, setHorseName] = useState('')
  const [horseBreed, setHorseBreed] = useState('')
  const [horseDiscipline, setHorseDiscipline] = useState('')
  const [barnLocation, setBarnLocation] = useState('')

  const [searchMode, setSearchMode] = useState<SearchMode>('owner')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null)

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
      .order('full_name', { ascending: true })

    if (error) {
      setMessage(`Error loading owners: ${error.message}`)
      return
    }

    const ownerData = data || []
    setOwners(ownerData)

    if (!selectedOwnerIdForAdd && ownerData.length > 0) {
      setSelectedOwnerIdForAdd(ownerData[0].id)
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
      .order('name', { ascending: true })

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

    if (!selectedOwnerIdForAdd) {
      setMessage('Please select an owner.')
      return
    }

    if (!horseName.trim()) {
      setMessage('Horse name is required.')
      return
    }

    const { error } = await supabase.from('horses').insert([
      {
        owner_id: selectedOwnerIdForAdd,
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

  const filteredOwners = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    if (searchMode !== 'owner') return owners
    if (!query) return owners

    return owners.filter((owner) => {
      return (
        owner.full_name.toLowerCase().includes(query) ||
        (owner.phone || '').toLowerCase().includes(query) ||
        (owner.email || '').toLowerCase().includes(query)
      )
    })
  }, [owners, searchTerm, searchMode])

  const filteredHorses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    if (searchMode === 'horse') {
      if (!query) return horses

      return horses.filter((horse) => {
        return (
          horse.name.toLowerCase().includes(query) ||
          (horse.owners?.full_name || '').toLowerCase().includes(query) ||
          (horse.breed || '').toLowerCase().includes(query) ||
          (horse.discipline || '').toLowerCase().includes(query) ||
          (horse.barn_location || '').toLowerCase().includes(query)
        )
      })
    }

    if (!selectedOwnerId) return []

    return horses.filter((horse) => horse.owner_id === selectedOwnerId)
  }, [horses, searchTerm, searchMode, selectedOwnerId])

  const selectedOwner = useMemo(() => {
    if (!selectedOwnerId) return null
    return owners.find((owner) => owner.id === selectedOwnerId) || null
  }, [owners, selectedOwnerId])

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

  useEffect(() => {
    if (searchMode === 'horse') {
      setSelectedOwnerId(null)
    }
  }, [searchMode])

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
                Search by owner or horse, then open the full horse record.
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

        <div className="mt-5 rounded-3xl bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
                Find Records
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Search by owner first or jump straight to a horse.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-[180px_1fr] xl:min-w-[560px]">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Search By
                </label>
                <select
                  value={searchMode}
                  onChange={(e) => setSearchMode(e.target.value as SearchMode)}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                >
                  <option value="owner">Owner</option>
                  <option value="horse">Horse</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Search
                </label>
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
                  placeholder={
                    searchMode === 'owner'
                      ? 'Search owner name, phone, or email...'
                      : 'Search horse, owner, breed, discipline, barn...'
                  }
                />
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[340px_1fr]">
            <div className="rounded-3xl bg-slate-50 p-4 md:p-5">
              <h3 className="text-lg font-semibold text-slate-900">
                {searchMode === 'owner' ? 'Owners' : 'Horse Results'}
              </h3>

              <div className="mt-4 space-y-3">
                {searchMode === 'owner' ? (
                  filteredOwners.length === 0 ? (
                    <p className="text-sm text-slate-500">No owners found.</p>
                  ) : (
                    filteredOwners.map((owner) => {
                      const isSelected = selectedOwnerId === owner.id

                      return (
                        <button
                          key={owner.id}
                          onClick={() => setSelectedOwnerId(owner.id)}
                          className={`w-full rounded-2xl border p-4 text-left transition ${
                            isSelected
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <p className="font-semibold">{owner.full_name}</p>
                          <p
                            className={`mt-1 text-sm ${
                              isSelected ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {owner.phone || 'No phone'}
                          </p>
                          <p
                            className={`text-sm ${
                              isSelected ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {owner.email || 'No email'}
                          </p>
                        </button>
                      )
                    })
                  )
                ) : filteredHorses.length === 0 ? (
                  <p className="text-sm text-slate-500">No horses found.</p>
                ) : (
                  filteredHorses.map((horse) => (
                    <Link
                      key={horse.id}
                      href={`/horses/${horse.id}`}
                      className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
                    >
                      <p className="font-semibold text-slate-900">{horse.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Owner: {horse.owners?.full_name || '—'}
                      </p>
                      <p className="text-sm text-slate-500">
                        {horse.discipline || 'No discipline'}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-white border border-slate-200 p-5 md:p-6">
              {searchMode === 'owner' ? (
                !selectedOwner ? (
                  <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-300">
                    <p className="text-slate-500">Select an owner to view horses.</p>
                  </div>
                ) : (
                  <div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <h3 className="text-xl font-semibold text-slate-900">
                        {selectedOwner.full_name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Phone: {selectedOwner.phone || '—'}
                      </p>
                      <p className="text-sm text-slate-600">
                        Email: {selectedOwner.email || '—'}
                      </p>
                    </div>

                    <div className="mt-5">
                      <h4 className="text-lg font-semibold text-slate-900">
                        Horses
                      </h4>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {filteredHorses.length === 0 ? (
                          <p className="text-sm text-slate-500">
                            No horses for this owner yet.
                          </p>
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
                                    Breed: {horse.breed || '—'}
                                  </p>
                                </div>

                                {horse.discipline ? (
                                  <span className="rounded-2xl bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                                    {horse.discipline}
                                  </span>
                                ) : null}
                              </div>

                              <div className="mt-4 text-sm text-slate-600">
                                <p>Barn: {horse.barn_location || '—'}</p>
                              </div>

                              <div className="mt-5 inline-flex min-h-[44px] items-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                                Open Horse Record
                              </div>
                            </Link>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    Matching Horses
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Click a horse to open info, visits, and pictures.
                  </p>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {filteredHorses.length === 0 ? (
                      <p className="text-sm text-slate-500">No horses found.</p>
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

                          <div className="mt-4 grid gap-1 text-sm text-slate-600">
                            <p>Breed: {horse.breed || '—'}</p>
                            <p>Barn: {horse.barn_location || '—'}</p>
                          </div>

                          <div className="mt-5 inline-flex min-h-[44px] items-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                            Open Horse Record
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
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
                  value={selectedOwnerIdForAdd}
                  onChange={(e) => setSelectedOwnerIdForAdd(e.target.value)}
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