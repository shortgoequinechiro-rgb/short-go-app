'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Invoice = {
  id: string
  invoice_number: string
  date: string
  owner_name: string
  horse_name: string
  total: number
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  due_date: string | null
}

type FilterState = {
  status: 'all' | 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  dateFrom: string | null
  dateTo: string | null
}

type SummaryStats = {
  totalOutstanding: number
  overdueCount: number
  paidThisMonth: number
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 border border-slate-200',
  sent: 'bg-blue-100 text-blue-700 border border-blue-200',
  paid: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  overdue: 'bg-amber-100 text-amber-700 border border-amber-200',
  cancelled: 'bg-red-100 text-red-700 border border-red-200',
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([])
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    dateFrom: null,
    dateTo: null,
  })
  const [summaryStats, setSummaryStats] = useState<SummaryStats>({
    totalOutstanding: 0,
    overdueCount: 0,
    paidThisMonth: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch invoices
  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        setLoading(true)
        const { data: session } = await supabase.auth.getSession()

        if (!session?.session?.access_token) {
          setError('Not authenticated')
          return
        }

        const res = await fetch('/api/invoices?status=all', {
          headers: { Authorization: `Bearer ${session.session.access_token}` },
        })

        if (!res.ok) {
          throw new Error('Failed to fetch invoices')
        }

        const data = await res.json()
        setInvoices(data.invoices || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invoices')
      } finally {
        setLoading(false)
      }
    }

    fetchInvoices()
  }, [])

  // Apply filters and calculate stats
  useEffect(() => {
    let filtered = invoices

    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter((inv) => inv.status === filters.status)
    }

    // Filter by date range
    if (filters.dateFrom) {
      filtered = filtered.filter((inv) => new Date(inv.date) >= new Date(filters.dateFrom!))
    }
    if (filters.dateTo) {
      filtered = filtered.filter((inv) => new Date(inv.date) <= new Date(filters.dateTo!))
    }

    setFilteredInvoices(filtered)

    // Calculate summary stats
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const outstanding = invoices
      .filter((inv) => inv.status !== 'paid' && inv.status !== 'cancelled')
      .reduce((sum, inv) => sum + inv.total, 0)

    const overdue = invoices.filter((inv) => {
      if (inv.status === 'paid' || inv.status === 'cancelled') return false
      if (!inv.due_date) return false
      return new Date(inv.due_date) < now
    }).length

    const paidThisMonth = invoices
      .filter((inv) => {
        if (inv.status !== 'paid') return false
        const invDate = new Date(inv.date)
        return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear
      })
      .reduce((sum, inv) => sum + inv.total, 0)

    setSummaryStats({
      totalOutstanding: outstanding,
      overdueCount: overdue,
      paidThisMonth: paidThisMonth,
    })
  }, [invoices, filters])

  const handleMarkPaid = async (invoiceId: string) => {
    try {
      const { data: session } = await supabase.auth.getSession()
      if (!session?.session?.access_token) return

      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({ status: 'paid' }),
      })

      if (!res.ok) throw new Error('Failed to update invoice')

      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? { ...inv, status: 'paid' } : inv))
      )
    } catch (err) {
      console.error('Error marking invoice as paid:', err)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="text-center py-12">
          <p className="text-slate-500">Loading invoices...</p>
        </div>
      </div>
    )
  }

  const hasInvoices = invoices.length > 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Invoices</h1>
        <Link
          href="/invoices/create"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Create Invoice
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Summary Stats */}
      {hasInvoices && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-slate-600 text-sm font-medium">Total Outstanding</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              ${summaryStats.totalOutstanding.toFixed(2)}
            </p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-slate-600 text-sm font-medium">Overdue Count</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{summaryStats.overdueCount}</p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-slate-600 text-sm font-medium">Paid This Month</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              ${summaryStats.paidThisMonth.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      {hasInvoices && (
        <div className="rounded-3xl bg-white p-5 shadow-sm mb-6">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      status: e.target.value as FilterState['status'],
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">From Date</label>
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || null })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">To Date</label>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || null })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoices List */}
      {hasInvoices ? (
        <div className="space-y-4">
          {filteredInvoices.length > 0 ? (
            filteredInvoices.map((invoice) => (
              <div key={invoice.id} className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* Invoice Info */}
                  <div className="md:col-span-3">
                    <p className="text-slate-500 text-xs font-semibold uppercase">Invoice</p>
                    <p className="text-slate-900 font-semibold">{invoice.invoice_number}</p>
                    <p className="text-slate-600 text-sm">
                      {new Date(invoice.date).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Owner & Horse */}
                  <div className="md:col-span-3">
                    <p className="text-slate-500 text-xs font-semibold uppercase">Owner</p>
                    <p className="text-slate-900 font-semibold">{invoice.owner_name}</p>
                    <p className="text-slate-600 text-sm">{invoice.horse_name}</p>
                  </div>

                  {/* Total */}
                  <div className="md:col-span-2">
                    <p className="text-slate-500 text-xs font-semibold uppercase">Total</p>
                    <p className="text-slate-900 font-semibold text-lg">
                      ${invoice.total.toFixed(2)}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div className="md:col-span-2 flex justify-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[invoice.status]}`}
                    >
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="md:col-span-2 flex gap-2">
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      View
                    </Link>
                    {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                      <button
                        onClick={() => handleMarkPaid(invoice.id)}
                        className="px-3 py-1 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        Mark Paid
                      </button>
                    )}
                    <a
                      href={`/api/invoices/${invoice.id}/pdf`}
                      className="px-3 py-1 text-sm font-medium text-slate-600 hover:text-slate-700"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      PDF
                    </a>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl bg-white p-8 shadow-sm text-center">
              <p className="text-slate-600">
                No invoices match your filters. Try adjusting your search.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-3xl bg-white p-12 shadow-sm text-center">
          <p className="text-slate-600 mb-4">No invoices yet.</p>
          <p className="text-slate-500 text-sm mb-6">
            Create your first invoice after a visit.
          </p>
          <Link
            href="/invoices/create"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Create Invoice
          </Link>
        </div>
      )}
    </div>
  )
}
