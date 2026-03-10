'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { syncPendingData, getPendingCount } from '../lib/offlineDb'

export default function OfflineSync() {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [justSynced, setJustSynced] = useState(false)

  // Check initial state and pending count
  useEffect(() => {
    setIsOnline(navigator.onLine)
    getPendingCount().then(setPendingCount)
  }, [])

  // Listen for connectivity changes
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
      runSync()
    }
    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  async function runSync() {
    const count = await getPendingCount()
    if (count === 0) return
    setSyncing(true)
    await syncPendingData(supabase)
    const remaining = await getPendingCount()
    setPendingCount(remaining)
    setSyncing(false)
    if (remaining === 0) {
      setJustSynced(true)
      setTimeout(() => setJustSynced(false), 4000)
    }
  }

  // Poll pending count periodically so the badge stays accurate
  useEffect(() => {
    const interval = setInterval(async () => {
      const count = await getPendingCount()
      setPendingCount(count)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  // Offline banner
  if (!isOnline) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
        <span className="h-2 w-2 rounded-full bg-white opacity-80 animate-pulse" />
        No signal — forms will save locally
      </div>
    )
  }

  // Just synced confirmation
  if (justSynced) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
        ✓ Offline forms synced
      </div>
    )
  }

  // Pending badge when online but still has queued items
  if (pendingCount > 0) {
    return (
      <div
        onClick={runSync}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex cursor-pointer items-center gap-2 rounded-2xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-slate-700 transition"
      >
        {syncing ? (
          <>
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            Syncing…
          </>
        ) : (
          <>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-slate-900">
              {pendingCount}
            </span>
            Tap to sync offline forms
          </>
        )}
      </div>
    )
  }

  return null
}
