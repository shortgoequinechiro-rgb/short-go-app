'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'

type Patient = { id: string; first_name: string; last_name: string }

type Invoice = {
  id: string
  patient_id: string
  invoice_number: string
  date_issued: string
  due_date: string | null
  line_items: { description: string; qty: number; rate: number; amount: number }[]
  subtotal: number
  tax: number
  total: number
  amount_paid: number
  balance_due: number
  status: string
  notes: string | null
  human_patients?: { first_name: string; last_name: string; email: string | null } | null
}

const statusColors: Record<string, string> = {
  draft: 'text-white/50',
  sent: 'text-blue-300',
  viewed: 'text-purple-300',
  paid: 'text-green-400',
  partial: 'text-yellow-400',
  overdue: 'text-red-400',
  void: 'text-white/30',
}

const inputClass = 'w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227] focus:ring-1 focus:ring-[#c9a227]/40 transition'
const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5'

export default function InvoicesPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<Patient[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [filterStatus, setFilterStatus] = useState('')

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [invPatient, setInvPatient] = useState('')
  const [invDueDate, setInvDueDate] = useState('')
  const [invNotes, setInvNotes] = useState('')
  const [lineItems, setLineItems] = useState<{ description: string; qty: number; rate: number }[]>([
    { description: '', qty: 1, rate: 0 }
  ])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // Payment modal
  const [showPayment, setShowPayment] = useState(false)
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null)
  const [payAmount, setPayAmount] = useState('')

  useEffect(() => {
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const [pRes, iRes] = await Promise.all([
      supabase.from('human_patients').select('id, first_name, last_name').eq('practitioner_id', user.id).eq('archived', false).order('last_name'),
      supabase.from('patient_invoices').select('*, human_patients(first_name, last_name, email)').eq('practitioner_id', user.id).order('date_issued', { ascending: false }).limit(100),
    ])

    if (pRes.data) setPatients(pRes.data)
    if (iRes.data) setInvoices(iRes.data as unknown as Invoice[])
    setLoading(false)
  }

  function addLineItem() {
    setLineItems(prev => [...prev, { description: '', qty: 1, rate: 0 }])
  }

  function removeLineItem(idx: number) {
    setLineItems(prev => prev.filter((_, i) => i !== idx))
  }

  function updateLineItem(idx: number, field: string, value: string | number) {
    setLineItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const subtotal = lineItems.reduce((sum, li) => sum + (li.qty * li.rate), 0)

  async function handleCreate() {
    if (!invPatient) { setMsg('Select a patient.'); return }
    if (lineItems.every(li => !li.description.trim())) { setMsg('Add at least one line item.'); return }
    setSaving(true); setMsg('')

    // Generate invoice number
    const invNumber = `INV-${Date.now().toString(36).toUpperCase()}`

    const items = lineItems.filter(li => li.description.trim()).map(li => ({
      description: li.description.trim(),
      qty: li.qty,
      rate: li.rate,
      amount: Math.round(li.qty * li.rate * 100) / 100,
    }))

    const total = items.reduce((s, li) => s + li.amount, 0)

    const { data, error } = await supabase.from('patient_invoices').insert({
      practitioner_id: userId,
      patient_id: invPatient,
      invoice_number: invNumber,
      date_issued: new Date().toISOString().split('T')[0],
      due_date: invDueDate || null,
      line_items: items,
      subtotal: total,
      tax: 0,
      total,
      amount_paid: 0,
      balance_due: total,
      status: 'draft',
      notes: invNotes.trim() || null,
    }).select('*, human_patients(first_name, last_name, email)').single()

    setSaving(false)
    if (error) { setMsg('Failed to create.'); return }
    if (data) {
      setInvoices(prev => [data as unknown as Invoice, ...prev])
      logAudit({ action: 'create', resourceType: 'superbill', resourceId: data.id, details: { type: 'invoice' } })
    }
    setShowCreate(false)
    setLineItems([{ description: '', qty: 1, rate: 0 }])
    setInvNotes('')
    setInvDueDate('')
  }

  async function markSent(inv: Invoice) {
    await supabase.from('patient_invoices').update({ status: 'sent' }).eq('id', inv.id)
    setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'sent' } : i))
  }

  function openPayment(inv: Invoice) {
    setPayInvoice(inv)
    setPayAmount(inv.balance_due.toString())
    setShowPayment(true)
  }

  async function recordPayment() {
    if (!payInvoice) return
    const amount = parseFloat(payAmount)
    if (isNaN(amount) || amount <= 0) return

    const newPaid = payInvoice.amount_paid + amount
    const newBalance = Math.max(0, payInvoice.total - newPaid)
    const newStatus = newBalance <= 0 ? 'paid' : 'partial'

    await supabase.from('patient_invoices').update({
      amount_paid: Math.round(newPaid * 100) / 100,
      balance_due: Math.round(newBalance * 100) / 100,
      status: newStatus,
    }).eq('id', payInvoice.id)

    setInvoices(prev => prev.map(i => i.id === payInvoice.id ? {
      ...i,
      amount_paid: Math.round(newPaid * 100) / 100,
      balance_due: Math.round(newBalance * 100) / 100,
      status: newStatus,
    } : i))

    setShowPayment(false)
  }

  async function downloadPdf(inv: Invoice) {
    const res = await fetch(`/api/invoices/${inv.id}/pdf`)
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${inv.invoice_number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const filtered = filterStatus ? invoices.filter(i => i.status === filterStatus) : invoices
  const totalOutstanding = invoices.filter(i => ['sent', 'partial', 'overdue'].includes(i.status)).reduce((s, i) => s + i.balance_due, 0)
  const totalCollected = invoices.reduce((s, i) => s + i.amount_paid, 0)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081120]">
        <p className="text-white/60 text-sm animate-pulse">Loading invoices...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#081120] text-white">
      <div className="border-b border-[#1a3358] bg-[#0d1b30] px-4 py-6 md:px-8">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">Patient Invoices</h1>
            <p className="text-sm text-blue-300/70 mt-0.5">
              ${totalCollected.toFixed(2)} collected · ${totalOutstanding.toFixed(2)} outstanding
            </p>
          </div>
          <Link href="/human/dashboard" className="rounded-xl border border-white/20 px-3 py-2 text-sm text-white/70 hover:bg-white/10 transition">Dashboard</Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setShowCreate(true)} className="rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] transition">+ New Invoice</button>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="rounded-xl border border-[#1a3358] bg-[#081120] px-3 py-2 text-sm text-white outline-none">
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-8 text-center">
            <p className="text-white/50">No invoices yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(inv => (
              <div key={inv.id} className="rounded-xl bg-[#0d1b30] border border-[#1a3358] px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold">{inv.invoice_number}</span>
                  <span className="text-xs text-white/40 ml-2">
                    {inv.human_patients ? `${inv.human_patients.first_name} ${inv.human_patients.last_name}` : ''}
                  </span>
                  <span className="text-xs text-white/40 ml-2">{inv.date_issued}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold">${inv.total.toFixed(2)}</span>
                  {inv.balance_due > 0 && inv.balance_due < inv.total && (
                    <span className="text-xs text-yellow-400">bal: ${inv.balance_due.toFixed(2)}</span>
                  )}
                  <span className={`text-xs font-semibold uppercase ${statusColors[inv.status] || 'text-white/50'}`}>{inv.status}</span>
                  <div className="flex gap-1">
                    {inv.status === 'draft' && <button onClick={() => markSent(inv)} className="text-xs text-blue-300 hover:underline">Send</button>}
                    {['sent', 'partial', 'overdue'].includes(inv.status) && <button onClick={() => openPayment(inv)} className="text-xs text-green-400 hover:underline">Pay</button>}
                    <button onClick={() => downloadPdf(inv)} className="text-xs text-[#c9a227] hover:underline">PDF</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6 space-y-4">
            <h2 className="text-lg font-bold">New Invoice</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Patient</label>
                <select value={invPatient} onChange={e => setInvPatient(e.target.value)} className={inputClass}>
                  <option value="">-- Select --</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Due Date</label>
                <input type="date" value={invDueDate} onChange={e => setInvDueDate(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Line Items</label>
              {lineItems.map((li, i) => (
                <div key={i} className="flex gap-2 mb-2 items-end">
                  <input value={li.description} onChange={e => updateLineItem(i, 'description', e.target.value)} className={inputClass + ' flex-1'} placeholder="Description" />
                  <input type="number" value={li.qty} onChange={e => updateLineItem(i, 'qty', parseInt(e.target.value) || 1)} className={inputClass + ' w-16'} min={1} />
                  <input type="number" value={li.rate} onChange={e => updateLineItem(i, 'rate', parseFloat(e.target.value) || 0)} className={inputClass + ' w-24'} step="0.01" placeholder="Rate" />
                  <span className="text-sm text-white/50 w-20 text-right">${(li.qty * li.rate).toFixed(2)}</span>
                  {lineItems.length > 1 && <button onClick={() => removeLineItem(i)} className="text-red-400 text-xs hover:underline">×</button>}
                </div>
              ))}
              <button onClick={addLineItem} className="text-xs text-[#c9a227] hover:underline mt-1">+ Add line item</button>
              <div className="text-right text-sm font-bold text-[#c9a227] mt-2">Total: ${subtotal.toFixed(2)}</div>
            </div>

            <div>
              <label className={labelClass}>Notes</label>
              <textarea value={invNotes} onChange={e => setInvNotes(e.target.value)} className={inputClass + ' min-h-[60px]'} placeholder="Payment terms, thank you note, etc." />
            </div>

            {msg && <p className="text-sm text-red-400">{msg}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="rounded-xl bg-[#c9a227] px-6 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && payInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6 space-y-4">
            <h2 className="text-lg font-bold">Record Payment</h2>
            <p className="text-sm text-white/60">{payInvoice.invoice_number} — Balance: ${payInvoice.balance_due.toFixed(2)}</p>
            <div>
              <label className={labelClass}>Payment Amount</label>
              <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className={inputClass} step="0.01" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowPayment(false)} className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10">Cancel</button>
              <button onClick={recordPayment} className="rounded-xl bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-500">Record Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
