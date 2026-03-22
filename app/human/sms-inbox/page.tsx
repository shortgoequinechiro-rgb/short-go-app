'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

type Patient = { id: string; first_name: string; last_name: string; phone: string | null }

type SmsMessage = {
  id: string
  patient_id: string | null
  direction: string
  phone_number: string
  body: string
  status: string
  created_at: string
}

type Conversation = {
  phone: string
  patientName: string
  patientId: string | null
  lastMessage: string
  lastAt: string
  unread: number
}

export default function SmsInboxPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<Patient[]>([])
  const [messages, setMessages] = useState<SmsMessage[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activePhone, setActivePhone] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  // New conversation
  const [showNew, setShowNew] = useState(false)
  const [newPatient, setNewPatient] = useState('')
  const [newPhone, setNewPhone] = useState('')

  useEffect(() => {
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, activePhone])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const [pRes, mRes] = await Promise.all([
      supabase.from('human_patients').select('id, first_name, last_name, phone').eq('practitioner_id', user.id).eq('archived', false).order('last_name'),
      supabase.from('sms_messages').select('*').eq('practitioner_id', user.id).order('created_at', { ascending: false }).limit(500),
    ])

    if (pRes.data) setPatients(pRes.data)
    if (mRes.data) {
      setMessages(mRes.data)
      buildConversations(mRes.data, pRes.data || [])
    }
    setLoading(false)
  }

  function buildConversations(msgs: SmsMessage[], pts: Patient[]) {
    const phoneMap = new Map<string, Patient>()
    for (const p of pts) {
      if (p.phone) {
        const clean = p.phone.replace(/\D/g, '')
        phoneMap.set(clean, p)
      }
    }

    const convMap = new Map<string, Conversation>()
    for (const msg of msgs) {
      const clean = msg.phone_number.replace(/\D/g, '')
      if (!convMap.has(clean)) {
        const patient = phoneMap.get(clean)
        convMap.set(clean, {
          phone: msg.phone_number,
          patientName: patient ? `${patient.first_name} ${patient.last_name}` : msg.phone_number,
          patientId: patient?.id || msg.patient_id,
          lastMessage: msg.body,
          lastAt: msg.created_at,
          unread: 0,
        })
      }
      if (msg.direction === 'inbound' && msg.status !== 'read') {
        const conv = convMap.get(clean)
        if (conv) conv.unread++
      }
    }

    const sorted = Array.from(convMap.values()).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
    setConversations(sorted)
  }

  function selectConversation(phone: string) {
    setActivePhone(phone.replace(/\D/g, ''))
  }

  const activeMessages = messages
    .filter(m => m.phone_number.replace(/\D/g, '') === activePhone)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const activeConv = conversations.find(c => c.phone.replace(/\D/g, '') === activePhone)

  async function handleSend() {
    if (!newMessage.trim() || !activePhone) return
    setSending(true)

    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practitionerId: userId,
          to: activePhone,
          body: newMessage.trim(),
          patientId: activeConv?.patientId || null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const newMsg: SmsMessage = {
          id: data.id || Date.now().toString(),
          patient_id: activeConv?.patientId || null,
          direction: 'outbound',
          phone_number: activePhone,
          body: newMessage.trim(),
          status: 'sent',
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [newMsg, ...prev])
        setNewMessage('')
      }
    } catch {
      // silently fail
    }
    setSending(false)
  }

  function startNewConversation() {
    if (newPatient) {
      const pt = patients.find(p => p.id === newPatient)
      if (pt?.phone) {
        setActivePhone(pt.phone.replace(/\D/g, ''))
        setShowNew(false)
        return
      }
    }
    if (newPhone.trim()) {
      setActivePhone(newPhone.replace(/\D/g, ''))
      setShowNew(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081120]">
        <p className="text-white/60 text-sm animate-pulse">Loading inbox...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#081120] text-white flex flex-col">
      <div className="border-b border-[#1a3358] bg-[#0d1b30] px-4 py-4 md:px-8">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">SMS Inbox</h1>
            <p className="text-xs text-blue-300/70">{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowNew(true)} className="rounded-xl bg-[#c9a227] px-3 py-1.5 text-xs font-semibold text-[#0f2040] hover:bg-[#b89020]">+ New Message</button>
            <Link href="/human/dashboard" className="rounded-xl border border-white/20 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10">Dashboard</Link>
          </div>
        </div>
      </div>

      <div className="flex-1 flex mx-auto max-w-6xl w-full">
        {/* Conversation list */}
        <div className="w-72 border-r border-[#1a3358] overflow-y-auto">
          {conversations.map(conv => {
            const clean = conv.phone.replace(/\D/g, '')
            return (
              <button
                key={clean}
                onClick={() => selectConversation(conv.phone)}
                className={`w-full text-left px-4 py-3 border-b border-[#1a3358] hover:bg-[#0d1b30] transition ${clean === activePhone ? 'bg-[#0d1b30] border-l-2 border-l-[#c9a227]' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{conv.patientName}</span>
                  {conv.unread > 0 && (
                    <span className="bg-[#c9a227] text-[#0f2040] text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{conv.unread}</span>
                  )}
                </div>
                <p className="text-xs text-white/40 truncate mt-0.5">{conv.lastMessage}</p>
                <p className="text-[10px] text-white/20 mt-0.5">{new Date(conv.lastAt).toLocaleString()}</p>
              </button>
            )
          })}
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {!activePhone ? (
            <div className="flex-1 flex items-center justify-center text-white/30">
              Select a conversation or start a new one
            </div>
          ) : (
            <>
              <div className="border-b border-[#1a3358] px-4 py-3 bg-[#0d1b30]">
                <p className="text-sm font-semibold">{activeConv?.patientName || activePhone}</p>
                <p className="text-xs text-white/40">{activePhone}</p>
              </div>
              <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {activeMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${msg.direction === 'outbound' ? 'bg-[#c9a227] text-[#0f2040]' : 'bg-[#1a3358] text-white'}`}>
                      <p className="text-sm">{msg.body}</p>
                      <p className={`text-[10px] mt-1 ${msg.direction === 'outbound' ? 'text-[#0f2040]/50' : 'text-white/30'}`}>
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#1a3358] p-3 flex gap-2">
                <input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  className="flex-1 rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#c9a227]"
                  placeholder="Type a message..."
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !newMessage.trim()}
                  className="rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020] disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#1a3358] bg-[#0d1b30] p-6 space-y-4">
            <h2 className="text-lg font-bold">New Conversation</h2>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">Patient</label>
              <select value={newPatient} onChange={e => setNewPatient(e.target.value)} className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white outline-none focus:border-[#c9a227]">
                <option value="">-- Select patient --</option>
                {patients.filter(p => p.phone).map(p => <option key={p.id} value={p.id}>{p.last_name}, {p.first_name} ({p.phone})</option>)}
              </select>
            </div>
            <p className="text-xs text-white/30 text-center">or</p>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1.5">Phone Number</label>
              <input value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full rounded-xl border border-[#1a3358] bg-[#081120] px-4 py-2.5 text-sm text-white outline-none focus:border-[#c9a227]" placeholder="+15551234567" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowNew(false)} className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10">Cancel</button>
              <button onClick={startNewConversation} className="rounded-xl bg-[#c9a227] px-6 py-2 text-sm font-semibold text-[#0f2040] hover:bg-[#b89020]">Start</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
