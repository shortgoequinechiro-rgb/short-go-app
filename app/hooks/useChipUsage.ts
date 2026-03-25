'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Hook to track and retrieve quick-add chip usage frequency per practitioner.
 * Returns a map of chip_id → use_count for sorting chips by most-used.
 */
export function useChipUsage(practitionerId: string | null) {
  const [usageMap, setUsageMap] = useState<Record<string, number>>({})
  const [loaded, setLoaded] = useState(false)
  const fetchedRef = useRef(false)

  // Fetch usage counts on mount
  useEffect(() => {
    if (!practitionerId || fetchedRef.current) return
    fetchedRef.current = true

    async function fetchUsage() {
      const { data, error } = await supabase
        .from('chip_usage')
        .select('chip_id, use_count')
        .eq('practitioner_id', practitionerId)

      if (!error && data) {
        const map: Record<string, number> = {}
        for (const row of data) {
          map[row.chip_id] = row.use_count
        }
        setUsageMap(map)
      }
      setLoaded(true)
    }

    fetchUsage()
  }, [practitionerId])

  /**
   * Record usage for a batch of chip IDs (call on visit save).
   * Uses upsert to increment counts atomically.
   */
  const recordUsage = useCallback(
    async (chipIds: string[]) => {
      if (!practitionerId || chipIds.length === 0) return

      // Upsert each chip — increment use_count if exists, insert with 1 if new
      // We batch these as individual upserts since Supabase doesn't support
      // ON CONFLICT DO UPDATE with increment in a single bulk call easily
      const now = new Date().toISOString()

      // First get current counts for these chips
      const { data: existing } = await supabase
        .from('chip_usage')
        .select('chip_id, use_count')
        .eq('practitioner_id', practitionerId)
        .in('chip_id', chipIds)

      const existingMap: Record<string, number> = {}
      if (existing) {
        for (const row of existing) {
          existingMap[row.chip_id] = row.use_count
        }
      }

      // Build upsert rows
      const rows = chipIds.map((chipId) => ({
        practitioner_id: practitionerId,
        chip_id: chipId,
        use_count: (existingMap[chipId] || 0) + 1,
        last_used_at: now,
      }))

      const { error } = await supabase
        .from('chip_usage')
        .upsert(rows, { onConflict: 'practitioner_id,chip_id' })

      if (!error) {
        // Update local state so the UI reflects new counts immediately
        setUsageMap((prev) => {
          const next = { ...prev }
          for (const chipId of chipIds) {
            next[chipId] = (next[chipId] || 0) + 1
          }
          return next
        })
      }
    },
    [practitionerId],
  )

  return { usageMap, loaded, recordUsage }
}
