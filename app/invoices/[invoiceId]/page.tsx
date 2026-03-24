'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  ownerName: string;
  ownerEmail: string;
  horseName: string;
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  paymentMethod?: string;
  paymentDate?: string;
  paymentReference?: string;
}

const statusColors = {
  draft: 'bg-slate-500 text-white',
  sent: 'bg-blue-500 text-white',
  paid: 'bg-emerald-500 text-white',
  overdue: 'bg-amber-500 text-white',
  cancelled: 'bg-red-500 text-white',
};

const statusLabels = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const invoiceId = params.invoiceId as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const [showPaymentLinkModal, setShowPaymentLinkModal] = useState(false);
  const [paymentLinkLoading, setPaymentLinkLoading] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  useEffect(() => {
    if (searchParams.get('paid') === 'true') {
      setShowSuccessBanner(true);
      const timer = setTimeout(() => setShowSuccessBanner(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const fetchInvoice = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(`/api/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch invoice');
      }

      const data = await res.json();
      setInvoice(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const handleSendInvoice = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });

      if (!res.ok) throw new Error('Failed to send invoice');

      await fetchInvoice();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invoice');
    }
  };

  const handleMarkAsPaid = async () => {
    try {
      setSubmitting(true);
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(`/api/invoices/${invoiceId}/mark-paid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          paymentMethod,
          paymentReference: paymentReference || undefined
        })
      });

      if (!res.ok) throw new Error('Failed to mark invoice as paid');

      setShowMarkPaidModal(false);
      await fetchInvoice();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as paid');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGetPaymentLink = async () => {
    try {
      setPaymentLinkLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(`/api/invoices/${invoiceId}/payment-link`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });

      if (!res.ok) throw new Error('Failed to generate payment link');

      const data = await res.json();
      setPaymentLinkUrl(data.url);
      setShowPaymentLinkModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get payment link');
    } finally {
      setPaymentLinkLoading(false);
    }
  };

  const handleCopyPaymentLink = () => {
    if (paymentLinkUrl) {
      navigator.clipboard.writeText(paymentLinkUrl);
    }
  };

  const handleResendInvoice = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(`/api/invoices/${invoiceId}/resend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });

      if (!res.ok) throw new Error('Failed to resend invoice');

      await fetchInvoice();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend invoice');
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="h-8 bg-slate-200 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-red-600">{error || 'Invoice not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {showSuccessBanner && (
        <div className="mb-6 rounded-3xl bg-emerald-50 border border-emerald-200 p-4">
          <p className="text-emerald-700 font-medium">Payment received!</p>
        </div>
      )}

      {/* Invoice Header */}
      <div className="rounded-3xl bg-white p-5 shadow-sm mb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{invoice.invoiceNumber}</h1>
            <p className="text-slate-600 mt-1">
              Date: {new Date(invoice.date).toLocaleDateString()}
            </p>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-semibold ${statusColors[invoice.status]}`}>
            {statusLabels[invoice.status]}
          </span>
        </div>
        <p className="text-slate-600">
          Due: {new Date(invoice.dueDate).toLocaleDateString()}
        </p>
      </div>

      {/* Owner & Patient Info */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-600 mb-3 uppercase">Owner</h3>
          <p className="text-lg font-medium text-slate-900">{invoice.ownerName}</p>
          <p className="text-slate-600">{invoice.ownerEmail}</p>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-600 mb-3 uppercase">Horse/Patient</h3>
          <p className="text-lg font-medium text-slate-900">{invoice.horseName}</p>
        </div>
      </div>

      {/* Line Items */}
      <div className="rounded-3xl bg-white p-5 shadow-sm mb-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Line Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-0 text-sm font-semibold text-slate-600">Description</th>
                <th className="text-right py-3 px-2 text-sm font-semibold text-slate-600">Qty</th>
                <th className="text-right py-3 px-2 text-sm font-semibold text-slate-600">Unit Price</th>
                <th className="text-right py-3 px-0 text-sm font-semibold text-slate-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-3 px-0 text-slate-700">{item.description}</td>
                  <td className="py-3 px-2 text-right text-slate-700">{item.quantity}</td>
                  <td className="py-3 px-2 text-right text-slate-700">${(item.unitPrice / 100).toFixed(2)}</td>
                  <td className="py-3 px-0 text-right font-medium text-slate-900">
                    ${((item.quantity * item.unitPrice) / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals Section */}
      <div className="rounded-3xl bg-white p-5 shadow-sm mb-4">
        <div className="space-y-3">
          <div className="flex justify-between text-slate-700">
            <span>Subtotal</span>
            <span>${(invoice.subtotal / 100).toFixed(2)}</span>
          </div>
          {invoice.tax > 0 && (
            <div className="flex justify-between text-slate-700">
              <span>Tax</span>
              <span>${(invoice.tax / 100).toFixed(2)}</span>
            </div>
          )}
          <div className="border-t border-slate-200 pt-3 flex justify-between text-lg font-semibold text-slate-900">
            <span>{invoice.status === 'paid' ? 'Total Paid' : 'Total Due'}</span>
            <span>${(invoice.total / 100).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Payment Details (if paid) */}
      {invoice.status === 'paid' && (
        <div className="rounded-3xl bg-emerald-50 border border-emerald-200 p-5 mb-4">
          <h3 className="text-lg font-semibold text-emerald-900 mb-3">Payment Details</h3>
          <div className="space-y-2 text-emerald-800">
            <p>
              <span className="font-medium">Method:</span> {invoice.paymentMethod || 'N/A'}
            </p>
            {invoice.paymentDate && (
              <p>
                <span className="font-medium">Date:</span> {new Date(invoice.paymentDate).toLocaleDateString()}
              </p>
            )}
            {invoice.paymentReference && (
              <p>
                <span className="font-medium">Reference:</span> {invoice.paymentReference}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Notes Section */}
      {invoice.notes && (
        <div className="rounded-3xl bg-white p-5 shadow-sm mb-4">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Notes</h3>
          <p className="text-slate-700 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="rounded-3xl bg-white p-5 shadow-sm mb-6">
        <div className="space-y-3">
          {invoice.status === 'draft' && (
            <>
              <button
                onClick={handleSendInvoice}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition"
              >
                Send Invoice
              </button>
              <button
                onClick={handleGetPaymentLink}
                disabled={paymentLinkLoading}
                className="w-full bg-slate-500 hover:bg-slate-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
              >
                {paymentLinkLoading ? 'Generating...' : 'Get Payment Link'}
              </button>
              <Link
                href={`/invoices/${invoiceId}/edit`}
                className="block w-full bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold py-3 rounded-xl transition text-center"
              >
                Edit
              </Link>
            </>
          )}

          {invoice.status === 'sent' && (
            <>
              <button
                onClick={() => setShowMarkPaidModal(true)}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl transition"
              >
                Mark as Paid
              </button>
              <button
                onClick={handleResendInvoice}
                className="w-full bg-slate-500 hover:bg-slate-600 text-white font-semibold py-3 rounded-xl transition"
              >
                Resend
              </button>
              <button
                onClick={handleGetPaymentLink}
                disabled={paymentLinkLoading}
                className="w-full bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold py-3 rounded-xl transition disabled:opacity-50"
              >
                {paymentLinkLoading ? 'Generating...' : 'Get Payment Link'}
              </button>
            </>
          )}

          {invoice.status === 'paid' && (
            <a
              href={`/api/invoices/${invoiceId}/pdf`}
              download={`${invoice.invoiceNumber}.pdf`}
              className="block w-full bg-slate-500 hover:bg-slate-600 text-white font-semibold py-3 rounded-xl transition text-center"
            >
              Download PDF
            </a>
          )}

          <Link
            href="/invoices"
            className="block w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold py-3 rounded-xl transition text-center"
          >
            Back to Invoices
          </Link>
        </div>
      </div>

      {/* Mark as Paid Modal */}
      {showMarkPaidModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="rounded-3xl bg-white p-6 shadow-lg max-w-sm w-full">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Mark as Paid</h2>

            <div className="space-y-3 mb-6">
              {['cash', 'check', 'venmo', 'other'].map((method) => (
                <label key={method} className="flex items-center p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method}
                    checked={paymentMethod === method}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-4 h-4 text-blue-500"
                  />
                  <span className="ml-3 text-slate-700 font-medium capitalize">{method}</span>
                </label>
              ))}
            </div>

            {(paymentMethod === 'check' || paymentMethod === 'venmo' || paymentMethod === 'other') && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Reference {paymentMethod === 'check' ? '(Check #)' : paymentMethod === 'venmo' ? '(Venmo ID)' : '(Optional)'}
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter reference"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowMarkPaidModal(false)}
                className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAsPaid}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition disabled:opacity-50"
              >
                {submitting ? 'Confirming...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Link Modal */}
      {showPaymentLinkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="rounded-3xl bg-white p-6 shadow-lg max-w-sm w-full">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Payment Link</h2>

            {paymentLinkUrl && (
              <>
                <div className="mb-4 p-3 bg-slate-100 rounded-xl break-all text-sm text-slate-700 font-mono">
                  {paymentLinkUrl}
                </div>

                <div className="space-y-3 mb-6">
                  <button
                    onClick={handleCopyPaymentLink}
                    className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition"
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={handleSendInvoice}
                    className="w-full px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white font-semibold rounded-xl transition"
                  >
                    Send via Email
                  </button>
                </div>
              </>
            )}

            <button
              onClick={() => setShowPaymentLinkModal(false)}
              className="w-full px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold rounded-xl transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
