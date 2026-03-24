'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  owner_name: string;
  owner_email?: string;
  owner_phone?: string;
  horse_name: string;
  line_items: LineItem[];
  subtotal_cents: number;
  tax_cents?: number;
  total_cents: number;
  notes?: string;
  payment_method?: string;
  paid_at?: string;
  payment_reference?: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-500 text-white',
  sent: 'bg-blue-500 text-white',
  paid: 'bg-emerald-500 text-white',
  overdue: 'bg-amber-500 text-white',
  cancelled: 'bg-red-500 text-white',
};

const statusLabels: Record<string, string> = {
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
  const [successMessage, setSuccessMessage] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [smsSending, setSmsSending] = useState(false);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setShowSuccessBanner(true);
    setTimeout(() => setShowSuccessBanner(false), 5000);
  };

  useEffect(() => {
    if (searchParams.get('paid') === 'true') {
      showSuccess('Payment received!');
    }
  }, [searchParams]);

  const fetchInvoice = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(`/api/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch invoice');

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

  const handleSendEmail = async () => {
    try {
      setEmailSending(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(`/api/invoices/${invoiceId}/email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send email');

      showSuccess(`Email sent to ${data.sentTo || invoice?.owner_email}`);
      await fetchInvoice();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setEmailSending(false);
    }
  };

  const handleSendSms = async () => {
    try {
      setSmsSending(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(`/api/invoices/${invoiceId}/sms`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send text');

      showSuccess(`Text sent to ${data.sentTo || invoice?.owner_phone}`);
      await fetchInvoice();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send text');
    } finally {
      setSmsSending(false);
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
          payment_method: paymentMethod,
          payment_reference: paymentReference || undefined
        })
      });

      if (!res.ok) throw new Error('Failed to mark invoice as paid');

      setShowMarkPaidModal(false);
      showSuccess('Invoice marked as paid!');
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
      showSuccess('Payment link copied!');
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

  if (!invoice) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-red-600">{error || 'Invoice not found'}</p>
        </div>
      </div>
    );
  }

  const canSend = invoice.status !== 'paid' && invoice.status !== 'cancelled';

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {showSuccessBanner && (
        <div className="mb-6 rounded-3xl bg-emerald-50 border border-emerald-200 p-4">
          <p className="text-emerald-700 font-medium">{successMessage}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-3xl bg-red-50 border border-red-200 p-4">
          <p className="text-red-700 font-medium">{error}</p>
          <button onClick={() => setError(null)} className="text-red-500 text-sm mt-1 underline">Dismiss</button>
        </div>
      )}

      {/* Invoice Header */}
      <div className="rounded-3xl bg-white p-5 shadow-sm mb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{invoice.invoice_number}</h1>
            <p className="text-slate-600 mt-1">
              Date: {new Date(invoice.invoice_date).toLocaleDateString()}
            </p>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-semibold ${statusColors[invoice.status]}`}>
            {statusLabels[invoice.status]}
          </span>
        </div>
        {invoice.due_date && (
          <p className="text-slate-600">
            Due: {new Date(invoice.due_date).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Owner & Patient Info */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-600 mb-3 uppercase">Owner</h3>
          <p className="text-lg font-medium text-slate-900">{invoice.owner_name}</p>
          {invoice.owner_email && <p className="text-slate-600 text-sm">{invoice.owner_email}</p>}
          {invoice.owner_phone && <p className="text-slate-600 text-sm">{invoice.owner_phone}</p>}
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-600 mb-3 uppercase">Horse/Patient</h3>
          <p className="text-lg font-medium text-slate-900">{invoice.horse_name}</p>
        </div>
      </div>

      {/* Send Invoice — Email & Text */}
      {canSend && (
        <div className="rounded-3xl bg-white p-5 shadow-sm mb-4">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Send Invoice</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleSendEmail}
              disabled={emailSending || !invoice.owner_email}
              className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {emailSending ? (
                'Sending...'
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  Email Invoice
                </>
              )}
            </button>
            <button
              onClick={handleSendSms}
              disabled={smsSending || !invoice.owner_phone}
              className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {smsSending ? (
                'Sending...'
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  Text Invoice
                </>
              )}
            </button>
          </div>
          {!invoice.owner_email && !invoice.owner_phone && (
            <p className="text-amber-600 text-sm mt-3">No contact info on file for this owner. Please add email or phone.</p>
          )}
          {!invoice.owner_email && invoice.owner_phone && (
            <p className="text-slate-500 text-sm mt-3">No email on file — text only.</p>
          )}
          {invoice.owner_email && !invoice.owner_phone && (
            <p className="text-slate-500 text-sm mt-3">No phone on file — email only.</p>
          )}
        </div>
      )}

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
              {invoice.line_items?.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-3 px-0 text-slate-700">{item.description}</td>
                  <td className="py-3 px-2 text-right text-slate-700">{item.quantity}</td>
                  <td className="py-3 px-2 text-right text-slate-700">${(item.unit_price_cents / 100).toFixed(2)}</td>
                  <td className="py-3 px-0 text-right font-medium text-slate-900">
                    ${((item.quantity * item.unit_price_cents) / 100).toFixed(2)}
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
            <span>${(invoice.subtotal_cents / 100).toFixed(2)}</span>
          </div>
          {(invoice.tax_cents ?? 0) > 0 && (
            <div className="flex justify-between text-slate-700">
              <span>Tax</span>
              <span>${((invoice.tax_cents ?? 0) / 100).toFixed(2)}</span>
            </div>
          )}
          <div className="border-t border-slate-200 pt-3 flex justify-between text-lg font-semibold text-slate-900">
            <span>{invoice.status === 'paid' ? 'Total Paid' : 'Total Due'}</span>
            <span>${(invoice.total_cents / 100).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Payment Details (if paid) */}
      {invoice.status === 'paid' && (
        <div className="rounded-3xl bg-emerald-50 border border-emerald-200 p-5 mb-4">
          <h3 className="text-lg font-semibold text-emerald-900 mb-3">Payment Details</h3>
          <div className="space-y-2 text-emerald-800">
            <p>
              <span className="font-medium">Method:</span>{' '}
              <span className="capitalize">{invoice.payment_method || 'N/A'}</span>
            </p>
            {invoice.paid_at && (
              <p>
                <span className="font-medium">Date:</span> {new Date(invoice.paid_at).toLocaleDateString()}
              </p>
            )}
            {invoice.payment_reference && (
              <p>
                <span className="font-medium">Reference:</span> {invoice.payment_reference}
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

      {/* Other Actions */}
      <div className="rounded-3xl bg-white p-5 shadow-sm mb-6">
        <div className="space-y-3">
          {canSend && (
            <>
              <button
                onClick={handleGetPaymentLink}
                disabled={paymentLinkLoading}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
              >
                {paymentLinkLoading ? 'Generating...' : 'Get Stripe Payment Link'}
              </button>
              <button
                onClick={() => setShowMarkPaidModal(true)}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl transition"
              >
                Mark as Paid
              </button>
            </>
          )}

          {invoice.status === 'paid' && (
            <a
              href={`/api/invoices/${invoiceId}/pdf`}
              download={`${invoice.invoice_number}.pdf`}
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
                    onClick={() => { handleSendEmail(); setShowPaymentLinkModal(false); }}
                    className="w-full px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white font-semibold rounded-xl transition"
                  >
                    Send via Email
                  </button>
                  <button
                    onClick={() => { handleSendSms(); setShowPaymentLinkModal(false); }}
                    className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition"
                  >
                    Send via Text
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
