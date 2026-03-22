'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'

type Patient = { id: string; first_name: string; last_name: string }

type PatientDoc = {
  id: string
  patient_id: string
  file_name: string
  file_type: string
  file_size: number | null
  storage_path: string
  category: string
  description: string | null
  uploaded_at: string
  human_patients?: { first_name: string; last_name: string } | null
}

const CATEGORIES = [
  { value: 'xray', label: 'X-Ray' },
  { value: 'mri', label: 'MRI' },
  { value: 'ct_scan', label: 'CT Scan' },
  { value: 'lab_report', label: 'Lab Report' },
  { value: 'referral', label: 'Referral Letter' },
  { value: 'insurance', label: 'Insurance Document' },
  { value: 'consent', label: 'Consent Form' },
  { value: 'imaging', label: 'Other Imaging' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'other', label: 'Other' },
]

const categoryLabel = (c: string) => CATEGORIES.find(x => x.value === c)?.label || c

const fileIcon = (type: string) => {
  if (type.includes('pdf')) return '📄'
  if (type.includes('image')) return '🖼️'
  if (type.includes('dicom')) return '🔬'
  return '📎'
}

const formatSize = (bytes: number | null) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentsPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<Patient[]>([])
  const [documents, setDocuments] = useState<PatientDoc[]>([])
  const [filterPatient, setFilterPatient] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  // Upload modal
  const [showUpload, setShowUpload] = useState(false)
  const [uploadPatient, setUploadPatient] = useState('')
  const [uploadCategory, setUploadCategory] = useState('other')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const [pRes, dRes] = await Promise.all([
      supabase.from('human_patients').select('id, first_name, last_name').eq('practitioner_id', user.id).eq('archived', false).order('last_name'),
      supabase.from('patient_documents').select('*, human_patients(first_name, last_name)').eq('practitioner_id', user.id).order('uploaded_at', { ascending: false }).limit(100),
    ])

    if (pRes.data) setPatients(pRes.data)
    if (dRes.data) setDocuments(dRes.data as unknown as PatientDoc[])
    setLoading(false)
  }

  async function handleUpload() {
    if (!uploadPatient || !uploadFile) { setMsg('Select patient and file.'); return }
    setUploading(true); setMsg('')

    const ext = uploadFile.name.split('.').pop() || 'bin'
    const storagePath = `documents/${userId}/${uploadPatient}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('patient-documents')
      .upload(storagePath, uploadFile, { contentType: uploadFile.type })

    if (uploadError) {
      // If bucket doesn't exist, try the general bucket
      const { error: uploadError2 } = await supabase.storage
        .from('documents')
        .upload(storagePath, uploadFile, { contentType: uploadFile.type })
      if (uploadError2) {
        setMsg('Upload failed: ' + uploadError2.message)
        setUploading(false)
        return
      }
    }

    const { data, error } = await supabase.from('patient_documents').insert({
      practitioner_id: userId,
      patient_id: uploadPatient,
      file_name: uploadFile.name,
      file_type: uploadFile.type,
      file_size: uploadFile.size,
      storage_path: storagePath,
      category: uploadCategory,
      description: uploadDescription.trim() || null,
    }).select('*, human_patients(first_name, last_name)').single()

    setUploading(false)
    if (error) { setMsg('Failed to save document record.'); return }
    if (data) {
      setDocuments(prev => [data as unknown as PatientDoc, ...prev])
      logAudit({ action: 'create', resourceType: 'human_patient', resourceId: data.id, details: { type: 'document_upload' } })
    }
    setShowUpload(false)
    setUploadFile(null)
    setUploadDescription('')
  }

  async function handleDelete(doc: PatientDoc) {
    if (!confirm(`Delete ${doc.file_name}?`)) return
    await supabase.storage.from('patient-documents').remove([doc.storage_path])
    await supabase.from('patient_documents').delete().eq('id', doc.id)
    setDocuments(prev => prev.filter(d => d.id !== doc.id))
    logAudit({ action: 'delete', resourceType: 'human_patient', resourceId: doc.id, details: { type: 'document_delete' } })
  }

  async function downloadDoc(doc: PatientDoc) {
    const { data } = await supabase.storage.from('patient-documents').createSignedUrl(doc.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const filtered = documents.filter(d =>
    (!filterPatient || d.patient_id === filterPatient) &&
    (!filterCategory || d.category === filterCategory)
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081120]">
        <p className="text-white/60 text-sm animate-pulse">Loading documents...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#081120] text-white">
      <div className="border-b border-[#1a3358] bg-[#0d1b30] px-4 py-6 md:px-8">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">Documents & Imaging</h1>
            <p className="text-sm text-blue-300/70 mt-0.5">{documents.length} document{documents.length !== 1 ? 's' : ''} stored</p>
          </div>
          <Link href="/human/dashboard" className="rounded-xl border border-white/20 px-3 py-2 text-sm text-white/70 hover:bg-white/10 transition">Dashboard</Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setShowUpload(true)} className="rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition">+ Upload Document</button>
          <select value={filterPatient} onChange={e => setFilterPatient(e.target.value)} className="rounded-xl border border-[#1a3358] bg-[#081120] px-3 py-2 text-sm text-white outline-none">
            <option value="">All Patients</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>)}
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="rounded-xl border border-[#1a3358] bg-[#081120] px-3 py-2 text-sm text-white outline-none">
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-8 text-center">
            <p className="text-white/50">No documents uploaded yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(doc => (
              <div key={doc.id} className="flex items-center justify-between rounded-xl bg-[#0d1b30] border border-[#1a3358] px-4 py-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-lg">{fileIcon(doc.file_type)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <p className="text-xs text-white/40">
                      {doc.human_patients ? `${doc.human_patients.first_name} ${doc.human_patients.last_name}` : ''} · {categoryLabel(doc.category)} · {formatSize(doc.file_size)} · {new Date(doc.uploaded_at).toLocaleDateString()}
                    </p>
                    {doc.description && <p className="text-xs text-white/30 mt-0.5">{doc.description}</p>}
                  </div>
                </div>
                <div className="flex gap-2 ml-3">
                  <button onClick={() => downloadDoc(doc)} className="text-xs text-blue-300 hover:underline">View</button>
                  <button onClick={() => handleDelete(doc)} className="text-xs text-red-400 hover:underline">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6 space-y-4">
            <h2 className="text-lg font-bold">Upload Document</h2>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">Patient</label>
              <select value={uploadPatient} onChange={e => setUploadPatient(e.target.value)} className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white outline-none focus:border-[#c9a227]">
                <option value="">-- Select patient --</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">Category</label>
              <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white outline-none focus:border-[#c9a227]">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">Description (optional)</label>
              <input value={uploadDescription} onChange={e => setUploadDescription(e.target.value)} className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white outline-none focus:border-[#c9a227]" placeholder="e.g., Lumbar X-ray AP view" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">File</label>
              <input type="file" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="text-sm text-white/70" />
            </div>
            {msg && <p className="text-sm text-red-400">{msg}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowUpload(false)} className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10">Cancel</button>
              <button onClick={handleUpload} disabled={uploading} className="rounded-xl bg-[#c9a227] px-6 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] disabled:opacity-50">
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
