'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

type PatientInfo = {
  first_name: string
  last_name: string
  date_of_birth: string | null
  chief_complaint: string | null
  practitioners?: { practice_name: string | null; logo_url: string | null; full_name: string | null } | null
}

type Visit = {
  id: string
  visit_date: string
  reason_for_visit: string | null
  assessment: string | null
  plan: string | null
  treated_areas: string | null
  recommendations: string | null
  follow_up: string | null
}

type Appointment = {
  id: string
  appointment_date: string
  appointment_time: string | null
  location: string | null
  reason: string | null
  status: string
}

function fmtTime(t: string | null): string {
  if (!t) return ''
  const [h, min] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(min).padStart(2, '0')} ${ampm}`
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function PatientPortalWrapper() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-400 text-sm animate-pulse">Loading your portal...</p>
      </div>
    }>
      <PatientPortalPage />
    </Suspense>
  )
}

function PatientPortalPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const patientId = params.patientId as string
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [patient, setPatient] = useState<PatientInfo | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null)

  useEffect(() => {
    loadPortal()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadPortal() {
    if (!token) {
      setError('Invalid portal link. Please contact your care provider for a new link.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/portal/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, patientId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Unable to access portal.')
        setLoading(false)
        return
      }

      setPatient(data.patient as unknown as PatientInfo)
      setVisits(data.visits || [])
      setAppointments(data.appointments || [])
    } catch {
      setError('Unable to connect. Please try again later.')
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-400 text-sm animate-pulse">Loading your portal...</p>
      </div>
    )
  }

  if (error || !patient) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">Access Required</h1>
          <p className="text-sm text-slate-500">{error || 'Something went wrong.'}</p>
          <p className="text-xs text-slate-400 mt-4">If you believe this is an error, please contact your care provider.</p>
        </div>
      </div>
    )
  }

  const prac = patient.practitioners as any
  const practiceName = prac?.practice_name || 'Your Care Provider'
  const logoUrl = prac?.logo_url
  const providerName = prac?.full_name || ''

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-6">
        <div className="mx-auto max-w-2xl text-center">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo" className="h-12 mx-auto mb-3 object-contain" />
          )}
          <h1 className="text-xl font-bold text-slate-900">{practiceName}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Patient Portal for {patient.first_name} {patient.last_name}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">

        {/* Upcoming Appointments */}
        {appointments.length > 0 && (
          <section className="rounded-2xl bg-white border border-slate-200 p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">Upcoming Appointments</h2>
            <div className="space-y-3">
              {appointments.map(a => (
                <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{fmtDate(a.appointment_date)}</p>
                    <p className="text-xs text-slate-500">
                      {a.appointment_time && fmtTime(a.appointment_time)}
                      {a.location && ` \u00b7 ${a.location}`}
                      {a.reason && ` \u00b7 ${a.reason}`}
                    </p>
                  </div>
                  <span className={`text-[10px] uppercase font-semibold px-2 py-1 rounded-full
                    ${a.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Visit History */}
        <section className="rounded-2xl bg-white border border-slate-200 p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">
            Visit Summaries ({visits.length})
          </h2>
          {visits.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No visits recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {visits.map(v => (
                <div key={v.id} className="rounded-xl border border-slate-100 overflow-hidden">
                  <button
                    onClick={() => setExpandedVisitId(expandedVisitId === v.id ? null : v.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{fmtDate(v.visit_date)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{v.reason_for_visit || 'General visit'}</p>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg"
                      className={`h-4 w-4 text-slate-400 transition-transform ${expandedVisitId === v.id ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedVisitId === v.id && (
                    <div className="border-t border-slate-100 px-4 py-4 space-y-3 bg-slate-50/50">
                      {v.assessment && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Assessment</p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{v.assessment}</p>
                        </div>
                      )}
                      {v.treated_areas && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Areas Treated</p>
                          <p className="text-sm text-slate-700">{v.treated_areas}</p>
                        </div>
                      )}
                      {v.plan && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Treatment Plan</p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{v.plan}</p>
                        </div>
                      )}
                      {v.recommendations && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Home Recommendations</p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{v.recommendations}</p>
                        </div>
                      )}
                      {v.follow_up && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Follow-up</p>
                          <p className="text-sm text-slate-700">{v.follow_up}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <p className="text-[11px] text-slate-400 text-center">
          {providerName && <>{providerName} &middot; </>}{practiceName}
          <br />Powered by STRIDE
          <br />Your health information is protected and encrypted.
        </p>
      </div>
    </div>
  )
}
