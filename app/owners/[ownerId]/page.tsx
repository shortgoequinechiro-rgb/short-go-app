'use client'

import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { getCachedOwnerById, getCachedHorsesByOwner, getCachedVisitsByHorse } from '../../lib/offlineDb'

type SpeciesType = 'equine' | 'canine' | 'feline' | 'bovine' | 'porcine' | 'exotic'

function speciesEmoji(s: string | null | undefined): string {
  switch (s) {
    case 'canine': return '🐕'
    case 'feline': return '🐱'
    case 'bovine': return '🐄'
    case 'porcine': return '🐷'
    case 'exotic': return '🦎'
    default: return '🐴'
  }
}

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
  species: SpeciesType | null
  breed: string | null
  age: string | null
  sex: string | null
  discipline: string | null
  barn_location: string | null
  archived: boolean
}

type IntakeForm = {
  id: string
  submitted_at: string
  animal_name: string
  signed_name: string | null
}

type ConsentForm = {
  id: string
  signed_at: string
  signed_name: string | null
  horses_acknowledged: string | null
}

type OwnerDocument = {
  id: string
  file_name: string
  file_type: string | null
  file_size: number | null
  category: string
  note: string | null
  uploaded_at: string
  source_id: string | null
  url: string | null
}

type VetAuthorization = {
  id: string
  horse_id: string
  horse_name: string
  vet_name: string
  vet_practice_name: string | null
  vet_license_number: string | null
  authorization_date: string
  expires_at: string
  status: string
  source: string
}

type Tab = 'profile' | 'records'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(type: string | null): string {
  if (!type) return '📄'
  if (type.startsWith('image/')) return '🖼️'
  if (type === 'application/pdf') return '📑'
  if (type.includes('word') || type.includes('document')) return '📝'
  if (type.includes('spreadsheet') || type.includes('excel')) return '📊'
  return '📄'
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
  const [vetAuthStatus, setVetAuthStatus] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Tabs
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  // Intake / consent status
  const [hasIntake, setHasIntake] = useState(false)
  const [hasConsent, setHasConsent] = useState(false)

  // Records tab data
  const [intakeForms, setIntakeForms] = useState<IntakeForm[]>([])
  const [consentForms, setConsentForms] = useState<ConsentForm[]>([])
  const [documents, setDocuments] = useState<OwnerDocument[]>([])
  const [vetAuthorizations, setVetAuthorizations] = useState<VetAuthorization[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadNote, setUploadNote] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit owner
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [savingOwner, setSavingOwner] = useState(false)

  // Sending state
  const [sendingIntake, setSendingIntake] = useState(false)
  const [sendingIntakeSms, setSendingIntakeSms] = useState(false)
  const [sendingConsent, setSendingConsent] = useState(false)
  const [sendingConsentSms, setSendingConsentSms] = useState(false)
  const [message, setMessage] = useState('')

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        // Try cached session when offline
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) { setCheckingAuth(false) }
          else { router.push('/login') }
        })
        return
      }
      setCheckingAuth(false)
    }).catch(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) { setCheckingAuth(false) }
        else { router.push('/login') }
      })
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
        // Offline fallback for owner
        try {
          const cached = await getCachedOwnerById(ownerId)
          if (cached) {
            setOwner({ id: cached.id, full_name: cached.full_name, phone: cached.phone, email: cached.email, address: cached.address })
          } else {
            setNotFound(true)
            setLoading(false)
            return
          }
        } catch {
          setNotFound(true)
          setLoading(false)
          return
        }
      } else {
        setOwner(ownerData as Owner)
      }

      // Animals
      const { data: animalData } = await supabase
        .from('horses')
        .select('id, name, species, breed, age, sex, discipline, barn_location, archived')
        .eq('owner_id', ownerId)
        .eq('archived', false)
        .order('name')

      let animalList: Animal[]
      if (animalData) {
        animalList = animalData as Animal[]
      } else {
        // Offline fallback
        try {
          const cached = await getCachedHorsesByOwner(ownerId)
          animalList = cached.filter(h => !h.archived).map(h => ({
            id: h.id, name: h.name, species: h.species as SpeciesType | null,
            breed: h.breed, age: h.age, sex: h.sex, discipline: h.discipline,
            barn_location: h.barn_location, archived: h.archived,
          }))
        } catch { animalList = [] }
      }
      setAnimals(animalList)

      // Visit counts
      if (animalList.length > 0) {
        const ids = animalList.map(a => a.id)
        const { data: visitData } = await supabase
          .from('visits')
          .select('horse_id')
          .in('horse_id', ids)

        if (visitData) {
          const counts: Record<string, number> = {}
          for (const v of visitData) {
            if (v.horse_id) counts[v.horse_id] = (counts[v.horse_id] || 0) + 1
          }
          setVisitCounts(counts)
        } else {
          // Offline fallback for visit counts
          try {
            const counts: Record<string, number> = {}
            for (const id of ids) {
              const cached = await getCachedVisitsByHorse(id)
              if (cached.length > 0) counts[id] = cached.length
            }
            setVisitCounts(counts)
          } catch { /* ignore */ }
        }
      }

      // Vet authorization status per animal
      if (animalList.length > 0) {
        const ids = animalList.map(a => a.id)
        const today = new Date().toISOString().split('T')[0]
        const { data: authData } = await supabase
          .from('vet_authorizations')
          .select('horse_id')
          .in('horse_id', ids)
          .eq('status', 'active')
          .gte('expires_at', today)

        if (authData) {
          const authMap: Record<string, boolean> = {}
          for (const a of authData) {
            if (a.horse_id) authMap[a.horse_id] = true
          }
          setVetAuthStatus(authMap)
        }
      }

      // Intake / consent status (non-critical, just skip offline)
      if (navigator.onLine) {
        const [intakeRes, consentRes] = await Promise.all([
          supabase.from('intake_forms').select('id').eq('owner_id', ownerId).limit(1),
          supabase.from('consent_forms').select('id').eq('owner_id', ownerId).limit(1),
        ])
        setHasIntake(!intakeRes.error && (intakeRes.data?.length ?? 0) > 0)
        setHasConsent(!consentRes.error && (consentRes.data?.length ?? 0) > 0)
      }

      setLoading(false)
    }
    load()
  }, [checkingAuth, ownerId])

  // ── Load records when tab switches ─────────────────────────────────────

  useEffect(() => {
    if (activeTab !== 'records' || checkingAuth || !ownerId) return
    loadRecords()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, checkingAuth, ownerId])

  async function loadRecords() {
    setLoadingRecords(true)

    // Intake forms
    const { data: intakes } = await supabase
      .from('intake_forms')
      .select('id, submitted_at, animal_name, signed_name')
      .eq('owner_id', ownerId)
      .order('submitted_at', { ascending: false })

    setIntakeForms((intakes || []) as IntakeForm[])

    // Consent forms
    const { data: consents } = await supabase
      .from('consent_forms')
      .select('id, signed_at, signed_name, horses_acknowledged')
      .eq('owner_id', ownerId)
      .order('signed_at', { ascending: false })

    setConsentForms((consents || []) as ConsentForm[])

    // Vet authorizations for all of this owner's animals
    if (animals.length > 0) {
      const animalIds = animals.map(a => a.id)
      const { data: authData } = await supabase
        .from('vet_authorizations')
        .select('id, horse_id, vet_name, vet_practice_name, vet_license_number, authorization_date, expires_at, status, source')
        .in('horse_id', animalIds)
        .order('authorization_date', { ascending: false })

      if (authData) {
        const animalNameMap: Record<string, string> = {}
        for (const a of animals) animalNameMap[a.id] = a.name
        setVetAuthorizations(
          authData.map(a => ({
            ...a,
            horse_name: animalNameMap[a.horse_id] || 'Unknown',
          })) as VetAuthorization[]
        )
      }
    }

    // Uploaded documents
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      try {
        const res = await fetch(`/api/owners/${ownerId}/documents`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setDocuments(data.documents || [])
        }
      } catch (err) {
        console.error('Failed to load documents:', err)
      }
    }

    setLoadingRecords(false)
  }

  // ── Upload handler ─────────────────────────────────────────────────────

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) { setMessage('Not authenticated.'); return }

    setUploading(true)
    setMessage('')

    let successCount = 0

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      if (file.size > 20 * 1024 * 1024) {
        setMessage(`${file.name} is too large (max 20 MB). Skipped.`)
        continue
      }

      const formData = new FormData()
      formData.append('file', file)
      if (uploadNote.trim()) formData.append('note', uploadNote.trim())

      try {
        const res = await fetch(`/api/owners/${ownerId}/documents`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        })

        if (res.ok) {
          successCount++
        } else {
          const data = await res.json()
          setMessage(data.error || `Failed to upload ${file.name}.`)
        }
      } catch {
        setMessage(`Failed to upload ${file.name}.`)
      }
    }

    if (successCount > 0) {
      setMessage(`${successCount} file${successCount > 1 ? 's' : ''} uploaded.`)
      setUploadNote('')
      loadRecords()
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Delete handler ─────────────────────────────────────────────────────

  async function handleDelete(docId: string) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    setDeletingId(docId)
    try {
      const res = await fetch(`/api/owners/${ownerId}/documents/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.id !== docId))
      } else {
        setMessage('Failed to delete document.')
      }
    } catch {
      setMessage('Failed to delete document.')
    }
    setDeletingId(null)
  }

  // ── Send helpers ─────────────────────────────────────────────────────────

  async function sendIntakeEmail() {
    if (!owner?.email) { setMessage('This owner does not have an email address on file.'); return }
    setSendingIntake(true); setMessage('')
    try {
      const res = await fetch(`/api/owners/${ownerId}/send-intake`, {
        method: 'POST',
        headers: await getAuthHeaders(),
      })
      const data = await res.json()
      setMessage(res.ok ? `Intake form link sent to ${owner.email}.` : (data.error || 'Failed to send intake email.'))
    } catch { setMessage('Failed to send intake email.') }
    finally { setSendingIntake(false) }
  }

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return {}
    return { Authorization: `Bearer ${session.access_token}` }
  }

  async function sendOptInSms() {
    const res = await fetch(`/api/owners/${ownerId}/send-optin-sms`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })
    return res.ok
  }

  async function sendIntakeSms() {
    if (!owner?.phone) { setMessage('This owner does not have a phone number on file.'); return }
    setSendingIntakeSms(true); setMessage('')
    try {
      const res = await fetch(`/api/owners/${ownerId}/send-intake-sms`, {
        method: 'POST',
        headers: await getAuthHeaders(),
      })
      const data = await res.json()
      if (!res.ok && data.needsConsent) {
        const sent = await sendOptInSms()
        setMessage(sent ? `SMS opt-in request sent to ${owner.phone}. Once they reply YES, you can text them forms.` : 'Failed to send opt-in request.')
      } else {
        setMessage(res.ok ? `Intake form link texted to ${owner.phone}.` : (data.error || 'Failed to send text.'))
      }
    } catch { setMessage('Failed to send text.') }
    finally { setSendingIntakeSms(false) }
  }

  async function sendConsentEmail() {
    if (!owner?.email) { setMessage('This owner does not have an email address on file.'); return }
    setSendingConsent(true); setMessage('')
    try {
      const res = await fetch(`/api/owners/${ownerId}/send-consent`, {
        method: 'POST',
        headers: await getAuthHeaders(),
      })
      const data = await res.json()
      setMessage(res.ok ? `Consent form link sent to ${owner.email}.` : (data.error || 'Failed to send consent email.'))
    } catch { setMessage('Failed to send consent email.') }
    finally { setSendingConsent(false) }
  }

  async function sendConsentSms() {
    if (!owner?.phone) { setMessage('This owner does not have a phone number on file.'); return }
    setSendingConsentSms(true); setMessage('')
    try {
      const res = await fetch(`/api/owners/${ownerId}/send-consent-sms`, {
        method: 'POST',
        headers: await getAuthHeaders(),
      })
      const data = await res.json()
      if (!res.ok && data.needsConsent) {
        const sent = await sendOptInSms()
        setMessage(sent ? `SMS opt-in request sent to ${owner.phone}. Once they reply YES, you can text them forms.` : 'Failed to send opt-in request.')
      } else {
        setMessage(res.ok ? `Consent form link texted to ${owner.phone}.` : (data.error || 'Failed to send text.'))
      }
    } catch { setMessage('Failed to send text.') }
    finally { setSendingConsentSms(false) }
  }

  // ── Edit owner ──────────────────────────────────────────────────────────

  function startEditing() {
    if (!owner) return
    setEditName(owner.full_name || '')
    setEditPhone(owner.phone || '')
    setEditEmail(owner.email || '')
    setEditAddress(owner.address || '')
    setEditing(true)
  }

  async function saveOwner() {
    if (!owner) return
    setSavingOwner(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { error: updateErr } = await supabase
        .from('owners')
        .update({
          full_name: editName.trim(),
          phone: editPhone.trim() || null,
          email: editEmail.trim() || null,
          address: editAddress.trim() || null,
        })
        .eq('id', owner.id)

      if (updateErr) {
        setMessage(`Failed to update: ${updateErr.message}`)
      } else {
        setOwner({
          ...owner,
          full_name: editName.trim(),
          phone: editPhone.trim() || null,
          email: editEmail.trim() || null,
          address: editAddress.trim() || null,
        })
        setEditing(false)
        setMessage('Owner updated successfully.')
        setTimeout(() => setMessage(''), 3000)
      }
    } catch {
      setMessage('Failed to update owner.')
    } finally {
      setSavingOwner(false)
    }
  }

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
            className="flex-shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition"
          >
            <span className="hidden sm:inline">📅 Appointments</span>
            <span className="sm:hidden">📅</span>
          </Link>
        </div>

        {/* ── Tabs ── */}
        {!loading && owner && (
          <div className="mx-auto max-w-4xl px-4">
            <div className="flex gap-0 border-b-0">
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-5 py-2.5 text-sm font-semibold transition border-b-2 -mb-px ${
                  activeTab === 'profile'
                    ? 'border-[#0f2040] text-[#0f2040]'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Profile
              </button>
              <button
                onClick={() => setActiveTab('records')}
                className={`px-5 py-2.5 text-sm font-semibold transition border-b-2 -mb-px flex items-center gap-1.5 ${
                  activeTab === 'records'
                    ? 'border-[#0f2040] text-[#0f2040]'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Records
                {(intakeForms.length + consentForms.length + documents.length > 0) && (
                  <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                    {intakeForms.length + consentForms.length + documents.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
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

        {/* ── Status message ── */}
        {message && (
          <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm border border-slate-200">
            {message}
          </div>
        )}

        {!loading && owner && activeTab === 'profile' && (
          <>
            {/* ── Owner contact card ── */}
            <div className="rounded-3xl bg-white p-4 shadow-sm md:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                {/* Left: contact info or edit form */}
                <div className="space-y-1 flex-1 min-w-0">
                  {editing ? (
                    <div className="space-y-3 max-w-sm">
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Full Name</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-[#0f2040] focus:bg-white focus:outline-none transition"
                          placeholder="Full name"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={editPhone}
                          onChange={e => setEditPhone(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-[#0f2040] focus:bg-white focus:outline-none transition"
                          placeholder="(555) 123-4567"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Email</label>
                        <input
                          type="email"
                          value={editEmail}
                          onChange={e => setEditEmail(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-[#0f2040] focus:bg-white focus:outline-none transition"
                          placeholder="email@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Address</label>
                        <input
                          type="text"
                          value={editAddress}
                          onChange={e => setEditAddress(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-[#0f2040] focus:bg-white focus:outline-none transition"
                          placeholder="123 Main St, City, ST"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={saveOwner}
                          disabled={savingOwner || !editName.trim()}
                          className="rounded-xl bg-[#0f2040] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162d55] transition disabled:opacity-50"
                        >
                          {savingOwner ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditing(false)}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-bold text-slate-900">{owner.full_name}</h2>
                        <button
                          onClick={startEditing}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition"
                          title="Edit owner"
                        >
                          Edit
                        </button>
                      </div>
                      {owner.phone ? (
                        <a
                          href={`tel:${owner.phone}`}
                          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition w-fit"
                        >
                          <span className="text-slate-400">📞</span>
                          {formatPhone(owner.phone)}
                        </a>
                      ) : (
                        <p className="flex items-center gap-1.5 text-sm text-slate-400">
                          <span>📞</span> No phone on file
                        </p>
                      )}
                      {owner.email ? (
                        <a
                          href={`mailto:${owner.email}`}
                          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition w-fit"
                        >
                          <span className="text-slate-400">✉️</span>
                          {owner.email}
                        </a>
                      ) : (
                        <p className="flex items-center gap-1.5 text-sm text-slate-400">
                          <span>✉️</span> No email on file
                        </p>
                      )}
                      {owner.address && (
                        <p className="flex items-center gap-1.5 text-sm text-slate-500">
                          <span className="text-slate-400">📍</span>
                          {owner.address}
                        </p>
                      )}

                      {/* ── Intake / Consent status badges ── */}
                      <div className="pt-2 flex flex-wrap items-center gap-2">
                        {hasIntake ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            ✓ Intake on file
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-600">
                            ✗ No intake on file
                          </span>
                        )}
                        {hasConsent ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            ✓ Consent on file
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-600">
                            ✗ No consent on file
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Right: actions */}
                <div className="flex flex-col gap-2 sm:min-w-[230px]">
                  {/* Book appointment */}
                  <Link
                    href={`/appointments?ownerId=${owner.id}`}
                    className="w-full rounded-xl bg-[#0f2040] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#162d55] transition"
                  >
                    + Book Appointment
                  </Link>

                  {/* Intake row */}
                  <div className="flex items-center gap-1.5">
                    <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Intake</span>
                    <a
                      href={`/intake/${owner.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                    >
                      📋 Open
                    </a>
                    <button
                      onClick={sendIntakeEmail}
                      disabled={sendingIntake}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition disabled:opacity-50"
                    >
                      {sendingIntake ? '…' : '📧 Email'}
                    </button>
                    <button
                      onClick={sendIntakeSms}
                      disabled={sendingIntakeSms}
                      className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition disabled:opacity-50"
                    >
                      {sendingIntakeSms ? '…' : '📱 Text'}
                    </button>
                  </div>

                  {/* Consent row */}
                  <div className="flex items-center gap-1.5">
                    <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Consent</span>
                    <a
                      href={`/consent/${owner.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                    >
                      📝 Open
                    </a>
                    <button
                      onClick={sendConsentEmail}
                      disabled={sendingConsent}
                      className="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 transition disabled:opacity-50"
                    >
                      {sendingConsent ? '…' : '📧 Email'}
                    </button>
                    <button
                      onClick={sendConsentSms}
                      disabled={sendingConsentSms}
                      className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 transition disabled:opacity-50"
                    >
                      {sendingConsentSms ? '…' : '📱 Text'}
                    </button>
                  </div>
                </div>
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
                    const emoji = speciesEmoji(animal.species)
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

                        {/* Vet auth badge */}
                        {vetAuthStatus[animal.id] ? (
                          <div className="mt-2 flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              Vet Authorization
                            </span>
                          </div>
                        ) : (
                          <div className="mt-2 flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                              No Vet Authorization
                            </span>
                          </div>
                        )}

                        {/* Meta row */}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {animal.age && (
                            <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600">
                              {animal.age}
                            </span>
                          )}
                          {animal.sex && (
                            <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600">
                              {animal.sex}
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
                            View record & history →
                          </span>
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              router.push(`/horses/${animal.id}/spine?newVisit=true&species=${animal.species || 'equine'}`)
                            }}
                            className="rounded-xl bg-[#0f2040] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#162d55] transition"
                          >
                            Start Visit →
                          </button>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            RECORDS TAB
        ══════════════════════════════════════════════════════════════════════ */}

        {!loading && owner && activeTab === 'records' && (
          <>
            {/* ── Upload section ── */}
            <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Upload Documents</h3>
              <p className="text-sm text-slate-500 mb-4">
                Upload vet records, imaging, lab work, or any files related to this owner. Max 20 MB per file.
              </p>

              <div className="flex flex-col gap-3">
                {/* Note input */}
                <input
                  type="text"
                  placeholder="Optional note (e.g. 'X-rays from Dr. Smith')"
                  value={uploadNote}
                  onChange={e => setUploadNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0f2040]/20 focus:border-[#0f2040]"
                />

                {/* Drop zone / file input */}
                <label
                  className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 cursor-pointer transition ${
                    uploading
                      ? 'border-slate-300 bg-slate-100 cursor-not-allowed'
                      : 'border-slate-300 bg-slate-50 hover:border-[#0f2040] hover:bg-blue-50/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    disabled={uploading}
                    onChange={e => handleUpload(e.target.files)}
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.csv,.txt,.heic,.webp"
                  />
                  {uploading ? (
                    <>
                      <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mb-2" />
                      <p className="text-sm font-medium text-slate-500">Uploading…</p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl mb-1">📎</p>
                      <p className="text-sm font-medium text-slate-700">Click to choose files</p>
                      <p className="text-xs text-slate-400 mt-0.5">PDF, images, documents — up to 20 MB each</p>
                    </>
                  )}
                </label>
              </div>
            </div>

            {loadingRecords ? (
              <p className="text-sm text-slate-400 py-8 text-center">Loading records…</p>
            ) : (
              <>
                {/* ── Intake Forms ── */}
                {intakeForms.length > 0 && (
                  <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
                    <h3 className="text-base font-semibold text-slate-900 mb-1 flex items-center gap-2">
                      <span className="text-emerald-600">📋</span>
                      Intake Forms
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        {intakeForms.length}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mb-3">Submitted intake forms for this owner</p>
                    <div className="space-y-2">
                      {intakeForms.map(form => (
                        <div
                          key={form.id}
                          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-white hover:shadow-sm transition"
                        >
                          <span className="text-lg">📑</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              Intake — {form.animal_name || 'Unknown'}
                            </p>
                            <p className="text-xs text-slate-500">
                              Submitted {formatDate(form.submitted_at)}
                              {form.signed_name && ` · Signed by ${form.signed_name}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <a
                              href={`/intake/view/${form.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                            >
                              View
                            </a>
                            <a
                              href={`/api/intake/${form.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition"
                            >
                              PDF
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Consent Forms ── */}
                {consentForms.length > 0 && (
                  <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
                    <h3 className="text-base font-semibold text-slate-900 mb-1 flex items-center gap-2">
                      <span className="text-purple-600">📝</span>
                      Consent Forms
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                        {consentForms.length}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mb-3">Signed consent & service agreements</p>
                    <div className="space-y-2">
                      {consentForms.map(form => (
                        <div
                          key={form.id}
                          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-white hover:shadow-sm transition"
                        >
                          <span className="text-lg">📑</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              Consent — {form.horses_acknowledged || 'General'}
                            </p>
                            <p className="text-xs text-slate-500">
                              Signed {formatDate(form.signed_at)}
                              {form.signed_name && ` · by ${form.signed_name}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <a
                              href={`/api/consent/${form.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 transition"
                            >
                              PDF
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Vet Authorizations ── */}
                {vetAuthorizations.length > 0 && (
                  <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
                    <h3 className="text-base font-semibold text-slate-900 mb-1 flex items-center gap-2">
                      <span className="text-blue-600">🩺</span>
                      Vet Authorizations
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        {vetAuthorizations.length}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mb-3">Veterinary authorizations for chiropractic care</p>
                    <div className="space-y-2">
                      {vetAuthorizations.map(auth => {
                        const today = new Date().toISOString().split('T')[0]
                        const isActive = auth.status === 'active' && auth.expires_at >= today
                        const isExpired = auth.status === 'expired' || auth.expires_at < today
                        const isRevoked = auth.status === 'revoked'

                        return (
                          <div
                            key={auth.id}
                            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-white hover:shadow-sm transition"
                          >
                            <span className="text-lg">
                              {isActive ? '✅' : isRevoked ? '🚫' : '⏳'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">
                                Dr. {auth.vet_name}{auth.vet_practice_name ? ` — ${auth.vet_practice_name}` : ''}
                              </p>
                              <p className="text-xs text-slate-500">
                                {auth.horse_name} · {auth.source === 'digital_form' ? 'Digital form' : auth.source === 'upload' ? 'Uploaded' : 'Manual entry'}
                                {auth.vet_license_number ? ` · Lic. ${auth.vet_license_number}` : ''}
                              </p>
                              <p className="text-xs text-slate-400">
                                {formatDate(auth.authorization_date)} → Expires {formatDate(auth.expires_at)}
                              </p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-700'
                                : isRevoked
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-slate-200 text-slate-600'
                            }`}>
                              {isActive ? 'Active' : isRevoked ? 'Revoked' : isExpired ? 'Expired' : auth.status}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── Uploaded Documents ── */}
                <div className="rounded-3xl bg-white p-5 shadow-sm md:p-6">
                  <h3 className="text-base font-semibold text-slate-900 mb-1 flex items-center gap-2">
                    <span className="text-blue-600">📁</span>
                    Uploaded Files
                    {documents.filter(d => d.category === 'upload').length > 0 && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        {documents.filter(d => d.category === 'upload').length}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">Vet records, x-rays, lab work, and other uploaded files</p>

                  {documents.filter(d => d.category === 'upload').length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-8">
                      <p className="text-2xl">📂</p>
                      <p className="mt-2 text-sm text-slate-500">No files uploaded yet</p>
                      <p className="text-xs text-slate-400 mt-0.5">Use the upload area above to add files</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {documents
                        .filter(d => d.category === 'upload')
                        .map(doc => (
                          <div
                            key={doc.id}
                            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-white hover:shadow-sm transition"
                          >
                            <span className="text-lg">{fileIcon(doc.file_type)}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{doc.file_name}</p>
                              <p className="text-xs text-slate-500">
                                {formatDate(doc.uploaded_at)}
                                {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ''}
                                {doc.note && ` · ${doc.note}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {doc.url && (
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                                >
                                  Open
                                </a>
                              )}
                              <button
                                onClick={() => handleDelete(doc.id)}
                                disabled={deletingId === doc.id}
                                className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition disabled:opacity-50"
                              >
                                {deletingId === doc.id ? '…' : '✕'}
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* ── Empty state for no records at all ── */}
                {intakeForms.length === 0 && consentForms.length === 0 && vetAuthorizations.length === 0 && documents.length === 0 && (
                  <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
                    <p className="text-3xl">📂</p>
                    <p className="mt-3 font-semibold text-slate-700">No records yet</p>
                    <p className="text-sm text-slate-500 mt-1">
                      Upload files above, or send this owner an intake or consent form from the Profile tab.
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
