'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface LineItem {
  id: string
  description: string
  quantity: number
  unit_price_cents: number
}

interface InvoiceData {
  invoice: {
    id: string
    invoice_number: string
    invoice_date: string
    due_date: string | null
    status: string
    total_cents: number
    subtotal_cents: number
    tax_cents: number | null
    stripe_payment_url: string | null
    line_items: LineItem[]
  }
  owner_name: string
  horse_name: string
  practice_name: string
  practitioner_name: string
  location: string
  payment_options: {
    stripe_url: string | null
    venmo_handle: string | null
    paypal_email: string | null
    zelle_info: string | null
    cash_app_handle: string | null
  }
}

export default function PayInvoicePage() {
  const params = useParams()
  const invoiceId = params.invoiceId as string
  const [data, setData] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!invoiceId) return
    fetch(`/api/public/invoices/${invoiceId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Invoice not found')
        return res.json()
      })
      .then(setData)
      .catch(() => setError('Invoice not found or no longer available.'))
      .finally(() => setLoading(false))
  }, [invoiceId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Invoice Not Found</h1>
          <p className="text-gray-500">{error || 'This invoice may have been removed or the link is invalid.'}</p>
        </div>
      </div>
    )
  }

  const { invoice, owner_name, horse_name, practice_name, practitioner_name, location, payment_options } = data
  const total = (invoice.total_cents / 100).toFixed(2)
  const subtotal = (invoice.subtotal_cents / 100).toFixed(2)
  const tax = ((invoice.tax_cents || 0) / 100).toFixed(2)
  const isPaid = invoice.status === 'paid'

  // Build payment links
  const venmoUrl = payment_options.venmo_handle
    ? `https://venmo.com/${payment_options.venmo_handle.replace('@', '')}?txn=pay&amount=${total}&note=Invoice%20${encodeURIComponent(invoice.invoice_number)}`
    : null
  const cashAppUrl = payment_options.cash_app_handle
    ? `https://cash.app/$${payment_options.cash_app_handle.replace('$', '')}/${total}`
    : null
  const paypalUrl = payment_options.paypal_email
    ? `https://paypal.me/${payment_options.paypal_email}/${total}`
    : null

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900">{practice_name}</h1>
          {practitioner_name && <p className="text-sm text-gray-500">{practitioner_name}</p>}
          {location && <p className="text-sm text-gray-500">{location}</p>}
        </div>

        {/* Invoice Card */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Status Banner */}
          {isPaid && (
            <div className="bg-green-50 border-b border-green-100 px-6 py-3 text-center">
              <span className="text-green-700 font-semibold text-sm">✓ Paid</span>
            </div>
          )}

          {/* Invoice Info */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Invoice</p>
                <p className="text-lg font-semibold text-gray-900">{invoice.invoice_number}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Amount Due</p>
                <p className="text-2xl font-bold text-gray-900">${total}</p>
              </div>
            </div>

            <div className="flex gap-6 text-sm text-gray-500 mb-4">
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-wide block">For</span>
                {horse_name && <span className="text-gray-700">{horse_name}</span>}
                {horse_name && owner_name && <span className="text-gray-400"> · </span>}
                <span className="text-gray-700">{owner_name}</span>
              </div>
              {invoice.due_date && (
                <div>
                  <span className="text-xs text-gray-400 uppercase tracking-wide block">Due</span>
                  <span className="text-gray-700">{new Date(invoice.due_date).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="border-t border-gray-100 px-6 py-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left pb-2 font-medium">Service</th>
                  <th className="text-right pb-2 font-medium">Qty</th>
                  <th className="text-right pb-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.line_items.map((item) => (
                  <tr key={item.id} className="border-t border-gray-50">
                    <td className="py-2 text-gray-700">{item.description}</td>
                    <td className="py-2 text-right text-gray-500">{item.quantity}</td>
                    <td className="py-2 text-right text-gray-700">
                      ${((item.unit_price_cents * item.quantity) / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-gray-100 mt-2 pt-3 space-y-1">
              {Number(tax) > 0 && (
                <>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Subtotal</span>
                    <span>${subtotal}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Tax</span>
                    <span>${tax}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-base font-semibold text-gray-900 pt-1">
                <span>Total</span>
                <span>${total}</span>
              </div>
            </div>
          </div>

          {/* Payment Options */}
          {!isPaid && (
            <div className="border-t border-gray-100 px-6 py-5 space-y-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Pay Now</p>

              {payment_options.stripe_url && (
                <a
                  href={payment_options.stripe_url}
                  className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Pay with Card — ${total}
                </a>
              )}

              {venmoUrl && (
                <a
                  href={venmoUrl}
                  className="block w-full text-center bg-[#008CFF] hover:bg-[#0070cc] text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Pay with Venmo
                </a>
              )}

              {cashAppUrl && (
                <a
                  href={cashAppUrl}
                  className="block w-full text-center bg-[#00D632] hover:bg-[#00b82b] text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Pay with Cash App
                </a>
              )}

              {paypalUrl && (
                <a
                  href={paypalUrl}
                  className="block w-full text-center bg-[#003087] hover:bg-[#00266b] text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Pay with PayPal
                </a>
              )}

              {payment_options.zelle_info && (
                <div className="text-center bg-[#6D1ED4] text-white font-semibold py-3 px-4 rounded-lg">
                  <span>Zelle: {payment_options.zelle_info}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by Chiro Stride
        </p>
      </div>
    </div>
  )
}
