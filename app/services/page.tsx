'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { ChevronUp, ChevronDown, Trash2, Plus, X, Pencil } from 'lucide-react'

interface Service {
  id: string
  name: string
  description: string | null
  price_cents: number
  is_active: boolean
  sort_order: number
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ name: '', description: '', price: '' })
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
  })

  useEffect(() => {
    fetchServices()
  }, [])

  const fetchServices = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setError('Not authenticated')
        return
      }

      const res = await fetch('/api/services', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })

      if (!res.ok) throw new Error('Failed to fetch services')
      const data = await res.json()
      const list = Array.isArray(data) ? data : (data.services || [])
      setServices(list.sort((a: Service, b: Service) => a.sort_order - b.sort_order))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading services')
    } finally {
      setLoading(false)
    }
  }

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Service name is required')
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const priceInCents = Math.round(parseFloat(formData.price || '0') * 100)

      const res = await fetch('/api/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          price_cents: priceInCents,
        })
      })

      if (!res.ok) throw new Error('Failed to add service')
      await fetchServices()
      setFormData({ name: '', description: '', price: '' })
      setShowAddForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding service')
    }
  }

  const handleUpdateService = async (id: string, updates: Partial<Service>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(`/api/services/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(updates)
      })

      if (!res.ok) throw new Error('Failed to update service')
      await fetchServices()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating service')
    }
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await handleUpdateService(id, { is_active: !isActive })
  }

  const handleDeleteService = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(`/api/services/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      })

      if (!res.ok) throw new Error('Failed to delete service')
      await fetchServices()
      setDeleteConfirm(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting service')
    }
  }

  const startEditing = (service: Service) => {
    setEditingId(service.id)
    setEditData({
      name: service.name,
      description: service.description || '',
      price: (service.price_cents / 100).toFixed(2),
    })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditData({ name: '', description: '', price: '' })
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editData.name.trim()) {
      setError('Service name is required')
      return
    }

    try {
      setSaving(true)
      const priceInCents = Math.round(parseFloat(editData.price || '0') * 100)
      if (priceInCents < 0) {
        setError('Price cannot be negative')
        return
      }

      await handleUpdateService(editingId, {
        name: editData.name.trim(),
        description: editData.description.trim() || null,
        price_cents: priceInCents,
      } as Partial<Service>)

      setEditingId(null)
      setEditData({ name: '', description: '', price: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving changes')
    } finally {
      setSaving(false)
    }
  }

  const handleReorder = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = services.findIndex(s => s.id === id)
    if ((direction === 'up' && currentIndex === 0) ||
        (direction === 'down' && currentIndex === services.length - 1)) {
      return
    }

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const updates = [
      { id: services[currentIndex].id, sort_order: services[newIndex].sort_order },
      { id: services[newIndex].id, sort_order: services[currentIndex].sort_order }
    ]

    try {
      const { data: { session } } = await supabase.auth.getSession()

      for (const update of updates) {
        const res = await fetch(`/api/services/${update.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ sort_order: update.sort_order })
        })
        if (!res.ok) throw new Error('Failed to reorder')
      }
      await fetchServices()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error reordering services')
    }
  }

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/account"
            className="text-sm text-slate-600 hover:text-slate-900 mb-4 inline-block"
          >
            ← Back to Account
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Service Menu</h1>
          <p className="text-slate-600 mt-2">Manage your service offerings and pricing</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-3xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Add Service Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 inline-flex items-center gap-2"
          >
            <Plus size={16} />
            Add Service
          </button>
        </div>

        {/* Add Service Form */}
        {showAddForm && (
          <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900">New Service</h2>
              <button
                onClick={() => {
                  setShowAddForm(false)
                  setFormData({ name: '', description: '', price: '' })
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddService} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Service Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Massage Therapy"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., 60-minute therapeutic massage"
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:border-slate-900 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Price
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-sm text-slate-600">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-300 pl-8 pr-4 py-3 text-sm focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Add Service
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    setFormData({ name: '', description: '', price: '' })
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Services List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-600">Loading services...</p>
          </div>
        ) : services.length === 0 ? (
          <div className="rounded-3xl bg-white p-12 shadow-sm text-center">
            <p className="text-slate-600">No services yet. Add your first service to start invoicing.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service, index) => (
              <div
                key={service.id}
                className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Reorder Controls */}
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleReorder(service.id, 'up')}
                      disabled={index === 0}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Move service up"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      onClick={() => handleReorder(service.id, 'down')}
                      disabled={index === services.length - 1}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Move service down"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>

                  {/* Service Details */}
                  <div className="flex-1">
                    {editingId === service.id ? (
                      /* ── Edit Mode ── */
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
                          <input
                            type="text"
                            value={editData.name}
                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                          <input
                            type="text"
                            value={editData.description}
                            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                            placeholder="Optional description"
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Price</label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-sm text-slate-600">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editData.price}
                              onChange={(e) => setEditData({ ...editData, price: e.target.value })}
                              className="w-full rounded-xl border border-slate-300 pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-slate-900"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={handleSaveEdit}
                            disabled={saving}
                            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="rounded-xl border border-slate-300 px-4 py-2 text-xs hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Display Mode ── */
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900">{service.name}</h3>
                          {service.description && (
                            <p className="text-sm text-slate-600 mt-1">{service.description}</p>
                          )}
                          <p className="text-lg font-semibold text-slate-900 mt-2">
                            {formatPrice(service.price_cents)}
                          </p>
                        </div>

                        {/* Status and Actions */}
                        <div className="flex flex-col items-end gap-3">
                          <div className="flex items-center gap-3">
                            {/* Edit Button */}
                            <button
                              onClick={() => startEditing(service)}
                              className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                              aria-label="Edit service"
                            >
                              <Pencil size={18} />
                            </button>

                            {/* Active Toggle */}
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={service.is_active}
                                onChange={() => handleToggleActive(service.id, service.is_active)}
                                className="rounded"
                              />
                              <span className="text-sm text-slate-600">
                                {service.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </label>

                            {/* Delete Button */}
                            {deleteConfirm === service.id ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleDeleteService(service.id)}
                                  className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(service.id)}
                                className="text-slate-400 hover:text-red-600 transition-colors p-1"
                                aria-label="Delete service"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
