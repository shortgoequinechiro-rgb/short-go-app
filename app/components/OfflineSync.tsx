'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { secureStorage } from '../lib/secureStorage'
import { syncPendingData, getPendingCount, refreshOfflineCache } from '../lib/offlineDb'

export default function OfflineSync() {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [justSynced, setJustSynced] = useState(false)
  const userIdRef = useRef<string | null>(null)

  // Helper to get the current user ID (cached in ref)
  const getUserId = useCallback(async (): Promise<string | null> => {
    if (userIdRef.current) return userIdRef.current
    const { data: { user } } = await supabase.auth.getUser()
    if (user) userIdRef.current = user.id
    return user?.id || null
  }, [])

  // Helper to get pending spine count (encrypted)
  const getSpinePendingCount = useCallback(async (): Promise<number> => {
    const uid = await getUserId()
    if (!uid) return 0
    const pending = await secureStorage.getItem<any[]>('pendingSpineAssessments', uid)
    return pending?.length || 0
  }, [getUserId])

  // Sync pending spine assessments stored in encrypted localStorage
  const syncPendingSpineAssessments = useCallback(async () => {
    try {
      const uid = await getUserId()
      if (!uid) return
      const pending = await secureStorage.getItem<any[]>('pendingSpineAssessments', uid) || []
      if (pending.length === 0) return
      const synced: string[] = []
      for (const item of pending) {
        const { error } = await supabase.from('spine_assessments').insert({
          horse_id: item.horse_id,
          visit_id: item.visit_id,
          findings: item.findings,
          notes: item.notes,
          assessed_at: item.assessed_at,
          practitioner_id: uid,
        })
        if (!error || error.code === '23505') synced.push(item.localId)
      }
      const remaining = pending.filter((p: { localId: string }) => !synced.includes(p.localId))
      await secureStorage.setItem('pendingSpineAssessments', remaining, uid)
    } catch { /* ignore */ }
  }, [getUserId])

  const runSync = useCallback(async () => {
    const count = await getPendingCount()
    const spineCount = await getSpinePendingCount()
    if (count === 0 && spineCount === 0) return
    setSyncing(true)
    await syncPendingData(supabase)
    await syncPendingSpineAssessments()
    const remaining = await getPendingCount()
    const spineRemaining = await getSpinePendingCount()
    setPendingCount(remaining + spineRemaining)
    setSyncing(false)
    if (remaining === 0 && spineRemaining === 0) {
      setJustSynced(true)
      setTimeout(() => setJustSynced(false), 4000)
    }
  }, [syncPendingSpineAssessments, getSpinePendingCount])

  // Check initial state, refresh cache, and sync pending
  useEffect(() => {
    setIsOnline(navigator.onLine)
    getPendingCount().then(async c => {
      const spineCount = await getSpinePendingCount()
      setPendingCount(c + spineCount)
    })

    // Refresh offline cache in the background when online
    if (navigator.onLine) {
      refreshOfflineCache(supabase).catch(() => {})
      // Also sync any pending items from a previous offline session
      runSync()
    }
  }, [runSync, getSpinePendingCount])

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
      const spineCount = await getSpinePendingCount()
      setPendingCount(count + spineCount)
    }, 5000)
    return () => clearInterval(interval)
  }, [getSpinePendingCount])

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
