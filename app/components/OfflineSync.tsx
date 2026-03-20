'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { syncPendingData, getPendingCount, refreshOfflineCache } from '../lib/offlineDb'

export default function OfflineSync() {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [justSynced, setJustSynced] = useState(false)

  // Sync pending spine assessments stored in localStorage
  const syncPendingSpineAssessments = useCallback(async () => {
    try {
      const pending = JSON.parse(localStorage.getItem('pendingSpineAssessments') || '[]')
      if (pending.length === 0) return
      const { data: { user } } = await supabase.auth.getUser()
      const synced: string[] = []
      for (const item of pending) {
        const { error } = await supabase.from('spine_assessments').insert({
          horse_id: item.horse_id,
          visit_id: item.visit_id,
          findings: item.findings,
          notes: item.notes,
          assessed_at: item.assessed_at,
          practitioner_id: user?.id,
        })
        if (!error || error.code === '23505') synced.push(item.localId)
      }
      const remaining = pending.filter((p: { localId: string }) => !synced.includes(p.localId))
      localStorage.setItem('pendingSpineAssessments', JSON.stringify(remaining))
    } catch { /* ignore */ }
  }, [])

  const runSync = useCallback(async () => {
    const count = await getPendingCount()
    const spineCount = JSON.parse(localStorage.getItem('pendingSpineAssessments') || '[]').length
    if (count === 0 && spineCount === 0) return
    setSyncing(true)
    await syncPendingData(supabase)
    await syncPendingSpineAssessments()
    const remaining = await getPendingCount()
    const spineRemaining = JSON.parse(localStorage.getItem('pendingSpineAssessments') || '[]').length
    setPendingCount(remaining + spineRemaining)
    setSyncing(false)
    if (remaining === 0 && spineRemaining === 0) {
      setJustSynced(true)
      setTimeout(() => setJustSynced(false), 4000)
    }
  }, [syncPendingSpineAssessments])

  // Check initial state, refresh cache, and sync pending
  useEffect(() => {
    setIsOnline(navigator.onLine)
    getPendingCount().then(c => {
      const spineCount = JSON.parse(localStorage.getItem('pendingSpineAssessments') || '[]').length
      setPendingCount(c + spineCount)
    })

    // Refresh offline cache in the background when online
    if (navigator.onLine) {
      refreshOfflineCache(supabase).catch(() => {})
      // Also sync any pending items from a previous offline session
      runSync()
    }
  }, [runSync])

  // Listen for connectivity changes
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
      // When coming back online: sync pending data then refresh cache
      runSync().then(() => refreshOfflineCache(supabase).catch(() => {}))
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
  }, [runSync])

  // Poll pending count periodically so the badge stays accurate
  useEffect(() => {
    const interval = setInterval(async () => {
      const count = await getPendingCount()
      const spineCount = JSON.parse(localStorage.getItem('pendingSpineAssessments') || '[]').length
      setPendingCount(count + spineCount)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  // Offline banner
  if (!isOnline) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
        <span className="h-2 w-2 rounded-full bg-white opacity-80 animate-pulse" />
        Offline mode — data saved locally
        {pendingCount > 0 && (
          <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">
            {pendingCount} pending
          </span>
        )}
      </div>
    )
  }

  // Just synced confirmation
  if (justSynced) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
        ✓ Offline data synced
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
            Tap to sync offline data
          </>
        )}
      </div>
    )
  }

  return null
}
