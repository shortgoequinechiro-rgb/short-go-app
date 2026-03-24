'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface ReportData {
  totalRevenue: number
  revenueThisMonth: number
  totalVisits: number
  visitsThisMonth: number
  activePatients: number
  outstandingBalance: number
  monthlyRevenue: Array<{
    month: string
    amount: number
  }>
  topServices: Array<{
    serviceId: string
    serviceName: string
    timesUsed: number
    totalRevenue: number
  }>
  recentActivity: Array<{
    id: string
    date: string
    type: 'invoice' | 'payment' | 'visit'
    description: string
  }>
  busiestDays: Array<{
    dayOfWeek: string
    visitCount: number
  }>
}

const statusColors: Record<string, string> = {
  invoice: 'bg-blue-100 text-blue-700',
  payment: 'bg-emerald-100 text-emerald-700',
  visit: 'bg-purple-100 text-purple-700',
}

const statusIcons: Record<string, string> = {
  invoice: '📄',
  payment: '💰',
  visit: '🐴',
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true)
        const { data: session } = await supabase.auth.getSession()

        if (!session?.session?.access_token) {
          setError('Not authenticated')
          return
        }

        const res = await fetch('/api/reports', {
          headers: { Authorization: `Bearer ${session.session.access_token}` },
        })

        if (!res.ok) {
          throw new Error('Failed to fetch reports')
        }

        const reportData = await res.json()
        setData(reportData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reports')
      } finally {
        setLoading(false)
      }
    }

    fetchReports()
  }, [])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-center py-12">
          <p className="text-slate-500">Loading reports...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-center py-12">
          <p className="text-slate-500">No data available</p>
        </div>
      </div>
    )
  }

  // Calculate max value for chart scaling
  const maxMonthlyRevenue = Math.max(...data.monthlyRevenue.map((m) => m.amount), 1)
  const maxDayVisits = Math.max(...data.busiestDays.map((d) => d.visitCount), 1)

  return (
    <div className="bg-gradient-to-b from-orange-50 to-white min-h-screen">
      {/* Header */}
      <div className="bg-slate-900 text-white py-6 px-4 mb-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold">Business Reports</h1>
          <p className="text-slate-400 text-sm mt-1">Analytics and insights for your practice</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-12">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Total Revenue */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">Total Revenue</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">
                  ${(data.totalRevenue / 100).toFixed(2)}
                </p>
                <p className="text-slate-500 text-xs mt-2">All time</p>
              </div>
              <div className="text-3xl">💵</div>
            </div>
          </div>

          {/* Revenue This Month */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">Revenue This Month</p>
                <p className="text-3xl font-bold text-emerald-600 mt-2">
                  ${(data.revenueThisMonth / 100).toFixed(2)}
                </p>
                <p className="text-slate-500 text-xs mt-2">Current month</p>
              </div>
              <div className="text-3xl">📈</div>
            </div>
          </div>

          {/* Total Visits */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">Total Visits</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{data.totalVisits}</p>
                <p className="text-slate-500 text-xs mt-2">All time</p>
              </div>
              <div className="text-3xl">🐴</div>
            </div>
          </div>

          {/* Visits This Month */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">Visits This Month</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{data.visitsThisMonth}</p>
                <p className="text-slate-500 text-xs mt-2">Current month</p>
              </div>
              <div className="text-3xl">📅</div>
            </div>
          </div>

          {/* Active Patients */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">Active Patients</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">{data.activePatients}</p>
                <p className="text-slate-500 text-xs mt-2">Last 90 days</p>
              </div>
              <div className="text-3xl">⭐</div>
            </div>
          </div>

          {/* Outstanding Balance */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">Outstanding Balance</p>
                <p className="text-3xl font-bold text-amber-600 mt-2">
                  ${(data.outstandingBalance / 100).toFixed(2)}
                </p>
                <p className="text-slate-500 text-xs mt-2">Unpaid invoices</p>
              </div>
              <div className="text-3xl">⚠️</div>
            </div>
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm mb-8">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Revenue Last 6 Months</h2>
          <div className="space-y-4">
            {data.monthlyRevenue.map((item, idx) => {
              const barWidth = (item.amount / maxMonthlyRevenue) * 100
              return (
                <div key={idx}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-700">{item.month}</span>
                    <span className="text-sm font-bold text-slate-900">
                      ${(item.amount / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-8 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-orange-400 to-orange-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${barWidth || 5}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Top Services */}
          <div className="lg:col-span-2 rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Top Services</h2>
            {data.topServices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Service</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">Times Used</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topServices.map((service, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-900 font-medium">{service.serviceName}</td>
                        <td className="text-right py-3 px-4 text-slate-700">{service.timesUsed}</td>
                        <td className="text-right py-3 px-4 text-slate-900 font-semibold">
                          ${(service.totalRevenue / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No service data available</p>
            )}
          </div>

          {/* Busiest Days */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Busiest Days</h2>
            <div className="space-y-3">
              {data.busiestDays.map((day, idx) => {
                const barWidth = (day.visitCount / maxDayVisits) * 100
                return (
                  <div key={idx}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-slate-700">{day.dayOfWeek}</span>
                      <span className="text-sm font-bold text-slate-900">{day.visitCount}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-6 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-400 to-blue-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${barWidth || 5}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm mt-8">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Recent Activity</h2>
          {data.recentActivity.length > 0 ? (
            <div className="space-y-4">
              {data.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4 pb-4 border-b border-slate-100 last:border-b-0 last:pb-0">
                  <div className={`text-2xl flex-shrink-0`}>
                    {statusIcons[activity.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${statusColors[activity.type]}`}
                      >
                        {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                      </span>
                    </div>
                    <p className="text-slate-900 font-medium break-words">{activity.description}</p>
                    <p className="text-slate-500 text-xs mt-1">
                      {new Date(activity.date).toLocaleDateString()} at{' '}
                      {new Date(activity.date).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  )
}
