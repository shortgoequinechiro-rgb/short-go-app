'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

type Communication = {
  id: string
  channel: 'email' | 'sms'
  message_type: string
  recipient: string
  subject: string | null
  body_preview: string | null
  status: 'sent' | 'delivered' | 'failed' | 'bounced'
  created_at: string
  owner_id: string | null
  owner_name: string
}

type Owner = {
  id: string
  full_name: string
}

const statusColors: Record<string, { bg: string; text: string }> = {
  sent: { bg: 'bg-blue-100', text: 'text-blue-700' },
  delivered: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  failed: { bg: 'bg-red-100', text: 'text-red-700' },
  bounced: { bg: 'bg-amber-100', text: 'text-amber-700' },
}

export default function CommunicationsPage() {
  const [communications, setCommunications] = useState<Communication[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [selectedChannel, setSelectedChannel] = useState<'all' | 'email' | 'sms'>('all')
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch communications
  useEffect(() => {
    const fetchCommunications = async () => {
      try {
        setLoading(true)
        setError(null)
        const { data: session } = await supabase.auth.getSession()

        if (!session?.session?.access_token) {
          setError('Not authenticated')
          return
        }

        let url = '/api/communications?channel=' + selectedChannel
        if (selectedOwner) {
          url += '&owner_id=' + selectedOwner
        }

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${session.session.access_token}` },
        })

        if (!res.ok) {
          throw new Error('Failed to fetch communications')
        }

        const data = await res.json()
        setCommunications(Array.isArray(data) ? data : [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load communications')
      } finally {
        setLoading(false)
      }
    }

    fetchCommunications()
  }, [selectedChannel, selectedOwner])

  // Fetch owners for filter dropdown
  useEffect(() => {
    const fetchOwners = async () => {
      try {
        const { data: session } = await supabase.auth.getSession()
        if (!session?.session?.access_token) return

        const { data, error } = await supabase
          .from('owners')
          .select('id, full_name')
          .order('full_name', { ascending: true })

        if (!error && data) {
          setOwners(data)
        }
      } catch (err) {
        console.error('Failed to fetch owners:', err)
      }
    }

    fetchOwners()
  }, [])

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined })
  }

  const getChannelIcon = (channel: 'email' | 'sms') => {
    if (channel === 'email') {
      return (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
          </svg>
        </div>
      )
    }
    return (
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773c.25 1.694.85 4.33 3.49 6.97.14.142.286.278.428.406l1.033-1.034a1 1 0 011.41 0l1.884 1.883a1 1 0 01-1.414 1.415L10.586 10a1 1 0 00-1.414 0L8.16 11.414a1 1 0 01-1.41 0l-1.034-1.033a1 1 0 01.003-1.445l.906-.905a1 1 0 01.974-.102l1.516.757a1 1 0 01.54 1.06l-.739 4.436a1 1 0 01-.986.836H4a1 1 0 01-1-1V3z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-orange-600 hover:text-orange-700 font-medium text-sm mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Communication Log</h1>
          <p className="text-gray-600">Track all emails and SMS messages sent to owners</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Channel Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Channel</label>
              <div className="flex gap-2">
                {(['all', 'email', 'sms'] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setSelectedChannel(ch)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                      selectedChannel === ch
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {ch.charAt(0).toUpperCase() + ch.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Owner Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Owner</label>
              <select
                value={selectedOwner || ''}
                onChange={(e) => setSelectedOwner(e.target.value || null)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
              >
                <option value="">All Owners</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.full_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Stats */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Total</label>
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 text-center">
                <p className="text-2xl font-bold text-orange-600">{communications.length}</p>
                <p className="text-xs text-orange-700">communications</p>
              </div>
            </div>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-red-700">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            </div>
            <p className="text-gray-600">Loading communications...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && communications.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="mb-4">
              <svg className="w-12 h-12 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No communications yet</h3>
            <p className="text-gray-600">Messages will appear here once you start sending emails and SMS to owners.</p>
          </div>
        )}

        {/* Communications List */}
        {!loading && communications.length > 0 && (
          <div className="space-y-4">
            {communications.map((comm) => (
              <div
                key={comm.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex gap-4">
                  {/* Icon */}
                  {getChannelIcon(comm.channel)}

                  {/* Content */}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {comm.owner_name}
                        </h3>
                        <p className="text-sm text-gray-500">{comm.recipient}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColors[comm.status].bg} ${statusColors[comm.status].text}`}
                        >
                          {comm.status.charAt(0).toUpperCase() + comm.status.slice(1)}
                        </span>
                      </div>
                    </div>

                    {/* Message details */}
                    <div className="mb-3">
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {comm.subject || comm.message_type}
                      </p>
                      {comm.body_preview && (
                        <p className="text-sm text-gray-600 line-clamp-2">{comm.body_preview}</p>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 6H6.28l-.31-1.243A1 1 0 005 4H3z" />
                          </svg>
                          {comm.message_type}
                        </span>
                        <span>via {comm.channel === 'email' ? 'Email' : 'SMS'}</span>
                      </div>
                      <time className="text-xs text-gray-400">
                        {formatDate(comm.created_at)}
                      </time>
                    </div>
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
