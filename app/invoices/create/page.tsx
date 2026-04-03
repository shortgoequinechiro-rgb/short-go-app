'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Owner = {
  id: string
  full_name: string
}

type Horse = {
  id: string
  name: string
  owner_id: string
}

type Service = {
  id: string
  name: string
  price_cents: number
  category?: string
}

type LineItem = {
  id: string
  description: string
  quantity: number
  unit_price_cents: number
  isCustom: boolean
}

type FormStep = 1 | 2 | 3 | 4 | 5

export default function CreateInvoicePage() {
  const router = useRouter()

  const [step, setStep] = useState<FormStep>(1)
  const [selectedOwner, setSelectedOwner] = useState<string>('')
  const [selectedHorses, setSelectedHorses] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')

  const [owners, setOwners] = useState<Owner[]>([])
  const [horses, setHorses] = useState<Horse[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [lineItems, setLineItems] = useState<LineItem[]>([])

  const [customDescription, setCustomDescription] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [customQuantity, setCustomQuantity] = useState(1)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch owners on mount
  useEffect(() => {
    const fetchOwners = async () => {
      try {
        const { data, error: err } = await supabase
          .from('owners')
          .select('id, full_name')
          .order('full_name')

        if (err) throw err
        setOwners(data || [])
      } catch (err) {
        console.error('Error fetching owners:', err)
      }
    }

    fetchOwners()
  }, [])

  // Fetch horses when owner is selected
  useEffect(() => {
    const fetchHorses = async () => {
      if (!selectedOwner) {
        setHorses([])
        setSelectedHorses(new Set())
        return
      }

      try {
        const { data, error: err } = await supabase
          .from('horses')
          .select('id, name, owner_id')
          .eq('owner_id', selectedOwner)
          .order('name')

        if (err) throw err
        setHorses(data || [])
        setSelectedHorses(new Set())
      } catch (err) {
        console.error('Error fetching horses:', err)
      }
    }

    fetchHorses()
  }, [selectedOwner])

  // Fetch services
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const { data: session } = await supabase.auth.getSession()
        if (!session?.session?.access_token) return

        const res = await fetch('/api/services', {
          headers: { Authorization: `Bearer ${session.session.access_token}` },
        })

        if (!res.ok) throw new Error('Failed to fetch services')

        const data = await res.json()
        setServices(data.services || [])
      } catch (err) {
        console.error('Error fetching services:', err)
      }
    }

    fetchServices()
  }, [])

  const handleAddService = (service: Service) => {
    const existingItem = lineItems.find((item) => item.id === service.id && !item.isCustom)
    if (existingItem) {
      setLineItems((prev) =>
        prev.map((item) =>
          item.id === service.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      )
    } else {
      setLineItems((prev) => [
        ...prev,
        {
          id: service.id,
          description: service.name,
          quantity: 1,
          unit_price_cents: service.price_cents,
          isCustom: false,
        },
      ])
    }
  }

  const handleAddCustomItem = () => {
    if (!customDescription.trim() || !customPrice) {
      setError('Please enter description and price')
      return
    }

    const price = parseFloat(customPrice)
    if (isNaN(price) || price < 0) {
      setError('Please enter a valid price')
      return
    }

    const id = `custom-${Date.now()}`
    setLineItems((prev) => [
      ...prev,
      {
        id,
        description: customDescription,
        quantity: customQuantity,
        unit_price_cents: Math.round(price * 100),
        isCustom: true,
      },
    ])

    setCustomDescription('')
    setCustomPrice('')
    setCustomQuantity(1)
    setError(null)
  }

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    if (quantity < 1) {
      handleRemoveLineItem(itemId)
      return
    }

    setLineItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantity } : item))
    )
  }

  const handleUpdatePrice = (itemId: string, priceDollars: string) => {
    const cents = Math.round(parseFloat(priceDollars || '0') * 100)
    if (cents < 0) return
    setLineItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, unit_price_cents: cents } : item))
    )
  }

  const handleUpdateDescription = (itemId: string, description: string) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, description } : item))
    )
  }

  const handleRemoveLineItem = (itemId: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== itemId))
  }

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0)
  }

  const handleCreateInvoice = async () => {
    try {
      if (!selectedOwner || selectedHorses.size === 0 || lineItems.length === 0) {
        setError('Please complete all required fields and add at least one line item')
        return
      }

      setLoading(true)
      const { data: session } = await supabase.auth.getSession()
      if (!session?.session?.access_token) {
        setError('Not authenticated')
        return
      }

      const horseIdsArray = Array.from(selectedHorses)

      const payload = {
        owner_id: selectedOwner,
        horse_id: horseIdsArray[0],
        horse_ids: horseIdsArray,
        notes,
        due_date: dueDate || null,
        line_items: lineItems.map((item) => ({
          service_id: item.isCustom ? null : item.id,
          description: item.description,
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
        })),
      }

      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || data.message || 'Failed to create invoice')
      }

      const data = await res.json()
      router.push(`/invoices/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice')
    } finally {
      setLoading(false)
    }
  }

  const total = calculateTotal()
  const ownerName = owners.find((o) => o.id === selectedOwner)?.full_name || ''
  const selectedHorseNames = horses
    .filter((h) => selectedHorses.has(h.id))
    .map((h) => h.name)
  const horseNamesDisplay = selectedHorseNames.join(', ') || ''

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <Link href="/invoices" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
          Back to Invoices
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 mt-2">Create Invoice</h1>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Step Indicator */}
      <div className="mb-8 flex gap-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`flex-1 h-2 rounded-full transition ${
              s <= step ? 'bg-blue-600' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>

      {/* Step 1: Select Owner */}
      {step === 1 && (
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Select Owner</h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Owner</label>
            <select
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900"
            >
              <option value="">Choose an owner...</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-4 mt-8">
            <button
              onClick={() => router.push('/invoices')}
              className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!selectedOwner}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition font-medium"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Select Patients */}
      {step === 2 && (
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Select Patients</h2>
          <p className="text-slate-600 text-sm mb-4">Owner: {ownerName}</p>

          {horses.length > 1 && (
            <button
              onClick={() => {
                if (selectedHorses.size === horses.length) {
                  setSelectedHorses(new Set())
                } else {
                  setSelectedHorses(new Set(horses.map((h) => h.id)))
                }
              }}
              className="mb-3 text-sm font-medium text-blue-600 hover:text-blue-700 transition"
            >
              {selectedHorses.size === horses.length ? 'Deselect All' : 'Select All'}
            </button>
          )}

          <div className="space-y-2">
            {horses.map((horse) => {
              const isSelected = selectedHorses.has(horse.id)
              return (
                <label
                  key={horse.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    isSelected
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {
                      setSelectedHorses((prev) => {
                        const next = new Set(prev)
                        if (next.has(horse.id)) {
                          next.delete(horse.id)
                        } else {
                          next.add(horse.id)
                        }
                        return next
                      })
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-900">{horse.name}</span>
                </label>
              )
            })}
            {horses.length === 0 && (
              <p className="text-sm text-slate-500">No patients found for this owner.</p>
            )}
          </div>

          <div className="flex gap-4 mt-8">
            <button
              onClick={() => setStep(1)}
              className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={selectedHorses.size === 0}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition font-medium"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Add Line Items */}
      {step === 3 && (
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Add Line Items</h2>
          <p className="text-slate-600 text-sm mb-6">
            {ownerName} — {horseNamesDisplay}
          </p>

          {/* Available Services */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Available Services</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => handleAddService(service)}
                  className="text-left p-3 border border-slate-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition"
                >
                  <p className="font-medium text-slate-900 text-sm">{service.name}</p>
                  <p className="text-slate-600 text-xs">${(service.price_cents / 100).toFixed(2)}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Item */}
          <div className="mb-8 pb-8 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Add Custom Item</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="e.g., Travel Fee"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Price</label>
                  <input
                    type="number"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={customQuantity}
                    onChange={(e) => setCustomQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <button
                onClick={handleAddCustomItem}
                className="w-full px-3 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium text-sm"
              >
                Add Custom Item
              </button>
            </div>
          </div>

          {/* Line Items Summary */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Line Items</h3>
            {lineItems.length > 0 ? (
              <div className="space-y-3">
                {lineItems.map((item) => (
                  <div key={item.id} className="p-3 bg-slate-50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleUpdateDescription(item.id, e.target.value)}
                        className="flex-1 font-medium text-slate-900 text-sm bg-white px-2 py-1 border border-slate-300 rounded mr-2"
                      />
                      <button
                        onClick={() => handleRemoveLineItem(item.id)}
                        className="text-red-600 hover:text-red-700 text-xs font-medium flex-shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-0.5">Price ($)</label>
                        <input
                          type="number"
                          value={(item.unit_price_cents / 100).toFixed(2)}
                          onChange={(e) => handleUpdatePrice(item.id, e.target.value)}
                          step="0.01"
                          min="0"
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-slate-900"
                        />
                      </div>
                      <div className="w-16">
                        <label className="block text-xs text-slate-500 mb-0.5">Qty</label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateQuantity(item.id, parseInt(e.target.value) || 1)
                          }
                          min="1"
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-slate-900"
                        />
                      </div>
                      <div className="w-20 text-right">
                        <label className="block text-xs text-slate-500 mb-0.5">Total</label>
                        <p className="text-sm font-semibold text-slate-900 py-1">
                          ${(item.unit_price_cents * item.quantity / 100).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Add services or custom items above</p>
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(2)}
              className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium"
            >
              Back
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={lineItems.length === 0}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition font-medium"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Additional Details */}
      {step === 4 && (
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Additional Details</h2>

          <div className="space-y-4 mb-8">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900"
              />
              <p className="text-xs text-slate-500 mt-1">Optional</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes for the invoice"
                rows={4}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(3)}
              className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium"
            >
              Back
            </button>
            <button
              onClick={() => setStep(5)}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Review
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Review */}
      {step === 5 && (
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Review Invoice</h2>

          <div className="space-y-6 mb-8">
            {/* Summary */}
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-600">Owner</p>
                  <p className="font-semibold text-slate-900">{ownerName}</p>
                </div>
                <div>
                  <p className="text-slate-600">{selectedHorses.size === 1 ? 'Patient' : 'Patients'}</p>
                  <p className="font-semibold text-slate-900">{horseNamesDisplay}</p>
                </div>
                {dueDate && (
                  <div>
                    <p className="text-slate-600">Due Date</p>
                    <p className="font-semibold text-slate-900">
                      {new Date(dueDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Line Items */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Items</h3>
              <div className="space-y-2">
                {lineItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-slate-900">
                      {item.description} × {item.quantity}
                    </span>
                    <span className="font-semibold text-slate-900">
                      ${(item.unit_price_cents * item.quantity / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="border-t border-slate-200 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-slate-900">Total</span>
                <span className="text-2xl font-bold text-blue-600">${(total / 100).toFixed(2)}</span>
              </div>
            </div>

            {notes && (
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Notes</p>
                <p className="text-slate-900 text-sm">{notes}</p>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(4)}
              className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium"
            >
              Back
            </button>
            <button
              onClick={handleCreateInvoice}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-300 transition font-medium"
            >
              {loading ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
