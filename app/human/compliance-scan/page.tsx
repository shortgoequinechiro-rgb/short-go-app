'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'

type Visit = {
  id: string
  visit_date: string
  reason_for_visit: string | null
  patient_id: string
  human_patients: { first_name: string; last_name: string } | null
}

type Superbill = {
  id: string
  date_of_service: string
  patient_name: string
  status: string
  total_fee: number
  diagnosis_codes: { code: string; description: string }[]
  procedure_codes: { code: string; description: string; units: number; fee: number }[]
}

type Issue = {
  type: string
  severity: string
  message: string
  suggestion: string
}

type ScanResult = {
  score: number
  risk_level: string
  summary: string
  issues: Issue[]
  scanId: string | null
}

type PastScan = {
  id: string
  scan_date: string
  risk_level: string
  score: number
  summary: string
  issues: Issue[]
  visit_id: string | null
  superbill_id: string | null
}

const severityColors: Record<string, string> = {
  info: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  warning: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  error: 'bg-red-500/20 text-red-300 border-red-500/30',
  critical: 'bg-red-700/30 text-red-200 border-red-600/40',
}

const riskColors: Record<string, string> = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
}

const scoreColor = (score: number) => {
  if (score >= 90) return 'text-green-400'
  if (score >= 70) return 'text-yellow-400'
  if (score >= 50) return 'text-orange-400'
  return 'text-red-400'
}

export default function ComplianceScanPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)

  const [visits, setVisits] = useState<Visit[]>([])
  const [superbills, setSuperbills] = useState<Superbill[]>([])
  const [pastScans, setPastScans] = useState<PastScan[]>([])

  const [selectedVisitId, setSelectedVisitId] = useState('')
  const [selectedSuperbillId, setSelectedSuperbillId] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const [visitsRes, superbillsRes, scansRes] = await Promise.all([
      supabase
        .from('human_visits')
        .select('id, visit_date, reason_for_visit, patient_id, human_patients(first_name, last_name)')
        .eq('practitioner_id', user.id)
        .order('visit_date', { ascending: false })
        .limit(50),
      supabase
        .from('superbills')
        .select('id, date_of_service, patient_name, status, total_fee, diagnosis_codes, procedure_codes')
        .eq('practitioner_id', user.id)
        .order('date_of_service', { ascending: false })
        .limit(50),
      supabase
        .from('compliance_scans')
        .select('*')
        .eq('practitioner_id', user.id)
        .order('scan_date', { ascending: false })
        .limit(20),
    ])

    if (visitsRes.data) setVisits(visitsRes.data as unknown as Visit[])
    if (superbillsRes.data) setSuperbills(superbillsRes.data as unknown as Superbill[])
    if (scansRes.data) setPastScans(scansRes.data as PastScan[])
    setLoading(false)
  }

  async function runScan() {
    if (!selectedVisitId && !selectedSuperbillId) {
      setError('Select at least a visit or superbill to scan.')
      return
    }
    setScanning(true)
    setError('')
    setScanResult(null)

    try {
      const res = await fetch('/api/compliance-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitId: selectedVisitId || null,
          superbillId: selectedSuperbillId || null,
          practitionerId: userId,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Scan failed')
      } else {
        setScanResult(data)
        logAudit({ action: 'scan', resourceType: 'compliance_scan', resourceId: data.scanId })
        // Refresh past scans
        const { data: scans } = await supabase
          .from('compliance_scans')
          .select('*')
          .eq('practitioner_id', userId)
          .order('scan_date', { ascending: false })
          .limit(20)
        if (scans) setPastScans(scans as PastScan[])
      }
    } catch {
      setError('Network error. Please try again.')
    }

    setScanning(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081120]">
        <p className="text-white/60 text-sm animate-pulse">Loading compliance scanner...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#081120] text-white">
      <div className="border-b border-[#1a3358] bg-[#0d1b30] px-4 py-6 md:px-8">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">AI Compliance Scan</h1>
            <p className="text-sm text-blue-300/70 mt-0.5">
              Cross-reference SOAP notes against billing codes to flag audit risks
            </p>
          </div>
          <Link
            href="/human/dashboard"
            className="rounded-xl border border-white/20 px-3 py-2 text-sm text-white/70 hover:bg-white/10 transition"
          >
            Dashboard
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 space-y-6">
        {/* Scan Form */}
        <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6">
          <h2 className="text-lg font-semibold mb-4">Run New Scan</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">
                Visit (SOAP Note)
              </label>
              <select
                value={selectedVisitId}
                onChange={e => setSelectedVisitId(e.target.value)}
                className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white outline-none focus:border-[#c9a227]"
              >
                <option value="">-- Select visit --</option>
                {visits.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.visit_date} — {v.human_patients ? `${v.human_patients.first_name} ${v.human_patients.last_name}` : 'Unknown'} {v.reason_for_visit ? `(${v.reason_for_visit})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">
                Superbill (Billing Codes)
              </label>
              <select
                value={selectedSuperbillId}
                onChange={e => setSelectedSuperbillId(e.target.value)}
                className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white outline-none focus:border-[#c9a227]"
              >
                <option value="">-- Select superbill --</option>
                {superbills.map(sb => (
                  <option key={sb.id} value={sb.id}>
                    {sb.date_of_service} — {sb.patient_name} (${sb.total_fee}) [{sb.status}]
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          <button
            onClick={runScan}
            disabled={scanning}
            className="mt-4 rounded-xl bg-[#c9a227] px-6 py-2.5 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition disabled:opacity-50"
          >
            {scanning ? 'Scanning...' : 'Run AI Compliance Scan'}
          </button>
        </div>

        {/* Scan Result */}
        {scanResult && (
          <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Scan Results</h2>
              <div className="flex items-center gap-4">
                <span className={`text-3xl font-bold ${scoreColor(scanResult.score)}`}>
                  {scanResult.score}/100
                </span>
                <span className={`text-sm font-semibold uppercase ${riskColors[scanResult.risk_level] || 'text-white'}`}>
                  {scanResult.risk_level} risk
                </span>
              </div>
            </div>

            <p className="text-sm text-white/70">{scanResult.summary}</p>

            {scanResult.issues.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider">Issues Found ({scanResult.issues.length})</h3>
                {scanResult.issues.map((issue, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border p-4 ${severityColors[issue.severity] || 'bg-white/5 border-white/10 text-white/70'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase">{issue.severity}</span>
                      <span className="text-xs opacity-70">({issue.type.replace(/_/g, ' ')})</span>
                    </div>
                    <p className="text-sm font-medium">{issue.message}</p>
                    <p className="text-xs mt-1 opacity-80">Suggestion: {issue.suggestion}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Past Scans */}
        {pastScans.length > 0 && (
          <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6">
            <h2 className="text-lg font-semibold mb-4">Scan History</h2>
            <div className="space-y-2">
              {pastScans.map(scan => (
                <div key={scan.id} className="flex items-center justify-between rounded-xl bg-[#081120] border border-[#1a3358] px-4 py-3">
                  <div>
                    <span className="text-sm text-white/80">{new Date(scan.scan_date).toLocaleDateString()}</span>
                    <span className="text-xs text-white/50 ml-2">{scan.summary?.slice(0, 60)}...</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${scoreColor(scan.score)}`}>{scan.score}</span>
                    <span className={`text-xs font-semibold uppercase ${riskColors[scan.risk_level] || 'text-white'}`}>
                      {scan.risk_level}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
