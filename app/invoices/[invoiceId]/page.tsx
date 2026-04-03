'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

interface LineItem {
  id: string;
  service_id?: string;
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
  horse_names?: string[];
  line_items: LineItem[];
  subtotal_cents: number;
  tax_cents?: number;
  total_cents: number;
  notes?: string;
  payment_method?: string;
  paid_at?: string;
  payment_reference?: string;
  venmo_handle?: string;
  paypal_email?: string;
  zelle_info?: string;
  cash_app_handle?: string;
  qb_payment_url?: string;
  qb_sync_status?: string;
  qb_sync_error?: string;
  qb_invoice_id?: string;
  qb_synced_at?: string;
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
  const router = useRouter();
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

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editLineItems, setEditLineItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // QB sync state
  const [syncingToQb, setSyncingToQb] = useState(false);

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

  const startEditing = () => {
    if (!invoice) return;
    setEditNotes(invoice.notes || '');
    setEditDueDate(invoice.due_date ? invoice.due_date.split('T')[0] : '');
    setEditStatus(invoice.status);
    setEditLineItems(invoice.line_items.map(item => ({ ...item })));
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleUpdateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    setEditLineItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveLineItem = (index: number) => {
    setEditLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddLineItem = () => {
    setEditLineItems(prev => [...prev, { id: `new-${Date.now()}`, description: '', quantity: 1, unit_price_cents: 0 }]);
  };

  const handleSaveEdits = async () => {
    try {
      setSaving(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();

      // Validate line items
      if (editLineItems.length === 0) {
        setError('Invoice must have at least one line item.');
        setSaving(false);
        return;
      }
      for (const item of editLineItems) {
        if (!item.description.trim()) {
          setError('All line items must have a description.');
          setSaving(false);
          return;
        }
        if (item.quantity <= 0) {
          setError('Quantity must be greater than zero.');
          setSaving(false);
          return;
        }
      }

      const body: Record<string, unknown> = {};
      if (editNotes !== (invoice?.notes || '')) body.notes = editNotes;
      if (editDueDate !== (invoice?.due_date ? invoice.due_date.split('T')[0] : '')) body.due_date = editDueDate || null;
      if (editStatus !== invoice?.status) body.status = editStatus;

      // Always send line items so totals recalculate
      body.line_items = editLineItems.map(item => ({
        service_id: item.service_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
      }));

      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update invoice');
      }

      setIsEditing(false);
      showSuccess('Invoice updated!');
      await fetchInvoice();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncToQb = async () => {
    try {
      setSyncingToQb(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch('/api/quickbooks/sync-invoice', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoiceId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sync to QuickBooks');

      showSuccess('Invoice synced to QuickBooks!');
      fetchInvoice(); // Refresh to show updated QB status
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync to QuickBooks');
    } finally {
      setSyncingToQb(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete invoice');
      }

      router.push('/invoices');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete invoice');
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
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
          <div className="flex items-center gap-2">
            {isEditing ? (
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="px-3 py-2 rounded-full text-sm font-semibold border border-slate-300 text-slate-900"
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
            ) : (
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${statusColors[invoice.status]}`}>
                {statusLabels[invoice.status]}
              </span>
            )}
          </div>
        </div>

        {isEditing ? (
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Due Date</label>
            <input
              type="date"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-slate-900 text-sm"
            />
          </div>
        ) : (
          invoice.due_date && (
            <p className="text-slate-600">
              Due: {new Date(invoice.due_date).toLocaleDateString()}
            </p>
          )
        )}

        {/* Edit / Delete buttons */}
        {!isEditing && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
              Edit Invoice
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
              Delete
            </button>
          </div>
        )}

        {/* Save / Cancel bar when editing */}
        {isEditing && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
            <button
              onClick={handleSaveEdits}
              disabled={saving}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 rounded-xl transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={cancelEditing}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold py-2.5 rounded-xl transition"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* QuickBooks Sync Status */}
      {invoice.qb_sync_status && invoice.qb_sync_status !== 'none' && (
        <div className={`rounded-3xl p-4 shadow-sm mb-4 ${
          invoice.qb_sync_status === 'synced' ? 'bg-emerald-50 border border-emerald-200' :
          invoice.qb_sync_status === 'failed' ? 'bg-red-50 border border-red-200' :
          'bg-blue-50 border border-blue-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#2CA01C] text-white font-bold text-xs">QB</span>
              <div>
                <p className={`text-sm font-semibold ${
                  invoice.qb_sync_status === 'synced' ? 'text-emerald-700' :
                  invoice.qb_sync_status === 'failed' ? 'text-red-700' :
                  'text-blue-700'
                }`}>
                  {invoice.qb_sync_status === 'synced' ? 'Synced to QuickBooks' :
                   invoice.qb_sync_status === 'failed' ? 'QuickBooks sync failed' :
                   'Syncing to QuickBooks...'}
                </p>
                {invoice.qb_sync_status === 'synced' && invoice.qb_synced_at && (
                  <p className="text-xs text-emerald-600">
                    Synced {new Date(invoice.qb_synced_at).toLocaleString()}
                  </p>
                )}
                {invoice.qb_sync_status === 'failed' && invoice.qb_sync_error && (
                  <p className="text-xs text-red-600 mt-0.5">{invoice.qb_sync_error}</p>
                )}
              </div>
            </div>
            {(invoice.qb_sync_status === 'failed' || !invoice.qb_invoice_id) && (
              <button
                onClick={handleSyncToQb}
                disabled={syncingToQb}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#2CA01C] rounded-lg hover:bg-[#249016] transition disabled:opacity-50"
              >
                {syncingToQb ? 'Syncing...' : 'Retry Sync'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sync to QB button (shown when no sync has been attempted) */}
      {(!invoice.qb_sync_status || invoice.qb_sync_status === 'none') && (
        <div className="rounded-3xl bg-white p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#2CA01C] text-white font-bold text-xs">QB</span>
              <p className="text-sm text-slate-600">Sync this invoice to QuickBooks</p>
            </div>
            <button
              onClick={handleSyncToQb}
              disabled={syncingToQb}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-[#2CA01C] rounded-lg hover:bg-[#249016] transition disabled:opacity-50"
            >
              {syncingToQb ? 'Syncing...' : 'Sync to QuickBooks'}
            </button>
          </div>
        </div>
      )}

      {/* Owner & Patient Info */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-600 mb-3 uppercase">Owner</h3>
          <p className="text-lg font-medium text-slate-900">{invoice.owner_name}</p>
          {invoice.owner_email && <p className="text-slate-600 text-sm">{invoice.owner_email}</p>}
          {invoice.owner_phone && <p className="text-slate-600 text-sm">{invoice.owner_phone}</p>}
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-600 mb-3 uppercase">
            {invoice.horse_names && invoice.horse_names.length > 1 ? 'Patients' : 'Patient'}
          </h3>
          <p className="text-lg font-medium text-slate-900">
            {invoice.horse_names && invoice.horse_names.length > 0
              ? invoice.horse_names.join(', ')
              : invoice.horse_name}
          </p>
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
        {isEditing ? (
          <div className="space-y-3">
            {editLineItems.map((item, index) => (
              <div key={item.id} className="p-3 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Item {index + 1}</span>
                  {editLineItems.length > 1 && (
                    <button
                      onClick={() => handleRemoveLineItem(index)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => handleUpdateLineItem(index, 'description', e.target.value)}
                  placeholder="Description"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleUpdateLineItem(index, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Unit Price ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={(item.unit_price_cents / 100).toFixed(2)}
                      onChange={(e) => handleUpdateLineItem(index, 'unit_price_cents', Math.round(parseFloat(e.target.value || '0') * 100))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                </div>
                <p className="text-right text-sm font-medium text-slate-700">
                  Subtotal: ${((item.quantity * item.unit_price_cents) / 100).toFixed(2)}
                </p>
              </div>
            ))}
            <button
              onClick={handleAddLineItem}
              className="w-full py-2 border-2 border-dashed border-slate-300 rounded-xl text-sm font-medium text-slate-500 hover:text-blue-600 hover:border-blue-300 transition"
            >
              + Add Line Item
            </button>
            <div className="pt-2 border-t border-slate-200 text-right">
              <p className="text-lg font-semibold text-slate-900">
                New Total: ${(editLineItems.reduce((sum, item) => sum + item.quantity * item.unit_price_cents, 0) / 100).toFixed(2)}
              </p>
            </div>
          </div>
        ) : (
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
        )}
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

      {/* Payment Options (Venmo / PayPal / Zelle / Cash App / QuickBooks) */}
      {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (invoice.venmo_handle || invoice.paypal_email || invoice.zelle_info || invoice.cash_app_handle || invoice.qb_payment_url) && (
        <div className="rounded-3xl bg-white p-5 shadow-sm mb-4">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Payment Options</h3>
          <div className="space-y-3">
            {invoice.venmo_handle && (
              <a
                href={`https://venmo.com/${invoice.venmo_handle.replace('@', '')}?txn=pay&amount=${(invoice.total_cents / 100).toFixed(2)}&note=Invoice%20${encodeURIComponent(invoice.invoice_number)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full rounded-xl border border-slate-200 px-4 py-3 hover:bg-blue-50 hover:border-blue-300 transition"
              >
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[#008CFF] text-white font-bold text-sm">V</span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Pay with Venmo</p>
                  <p className="text-xs text-slate-500">{invoice.venmo_handle}</p>
                </div>
              </a>
            )}
            {invoice.paypal_email && (
              <a
                href={`https://paypal.me/${invoice.paypal_email}/${(invoice.total_cents / 100).toFixed(2)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full rounded-xl border border-slate-200 px-4 py-3 hover:bg-blue-50 hover:border-blue-300 transition"
              >
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[#003087] text-white font-bold text-sm">P</span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Pay with PayPal</p>
                  <p className="text-xs text-slate-500">{invoice.paypal_email}</p>
                </div>
              </a>
            )}
            {invoice.zelle_info && (
              <div className="flex items-center gap-3 w-full rounded-xl border border-slate-200 px-4 py-3 bg-purple-50/30">
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[#6D1ED4] text-white font-bold text-sm">Z</span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Pay with Zelle</p>
                  <p className="text-xs text-slate-500">Send to: {invoice.zelle_info}</p>
                </div>
              </div>
            )}
            {invoice.cash_app_handle && (
              <a
                href={`https://cash.app/${invoice.cash_app_handle.replace('$', '')}/${(invoice.total_cents / 100).toFixed(2)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full rounded-xl border border-slate-200 px-4 py-3 hover:bg-green-50 hover:border-green-300 transition"
              >
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[#00D632] text-white font-bold text-sm">$</span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Pay with Cash App</p>
                  <p className="text-xs text-slate-500">{invoice.cash_app_handle}</p>
                </div>
              </a>
            )}
            {invoice.qb_payment_url && (
              <a
                href={invoice.qb_payment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full rounded-xl border border-slate-200 px-4 py-3 hover:bg-green-50 hover:border-green-300 transition"
              >
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[#2CA01C] text-white font-bold text-sm">QB</span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Pay with QuickBooks</p>
                  <p className="text-xs text-slate-500">Pay securely via QuickBooks</p>
                </div>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Notes Section */}
      {isEditing ? (
        <div className="rounded-3xl bg-white p-5 shadow-sm mb-4">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Notes</h3>
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={3}
            placeholder="Add notes to this invoice..."
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ) : (
        invoice.notes && (
          <div className="rounded-3xl bg-white p-5 shadow-sm mb-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">Notes</h3>
            <p className="text-slate-700 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )
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
            <button
              onClick={async () => {
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  const res = await fetch(`/api/invoices/${invoiceId}/pdf`, {
                    headers: { Authorization: `Bearer ${session?.access_token}` }
                  });
                  if (!res.ok) throw new Error('Failed to generate PDF');
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${invoice.invoice_number}.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } catch {
                  setError('Failed to download PDF');
                }
              }}
              className="w-full bg-slate-500 hover:bg-slate-600 text-white font-semibold py-3 rounded-xl transition"
            >
              Download PDF
            </button>
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
              {['cash', 'check', 'venmo', 'cash_app', 'other'].map((method) => (
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

            {(paymentMethod === 'check' || paymentMethod === 'venmo' || paymentMethod === 'cash_app' || paymentMethod === 'other') && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Reference {paymentMethod === 'check' ? '(Check #)' : paymentMethod === 'venmo' ? '(Venmo ID)' : paymentMethod === 'cash_app' ? '(Cash App ID)' : '(Optional)'}
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="rounded-3xl bg-white p-6 shadow-lg max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900">Delete Invoice</h2>
            </div>

            <p className="text-slate-600 mb-2">
              Are you sure you want to delete invoice <span className="font-semibold">{invoice.invoice_number}</span>?
            </p>
            {invoice.status === 'paid' && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800 font-medium">This invoice is marked as paid (${(invoice.total_cents / 100).toFixed(2)}). Deleting it will remove it from your records permanently.</p>
              </div>
            )}
            <p className="text-sm text-red-600 mb-6">
              This action cannot be undone. All line items and communication history for this invoice will also be deleted.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
