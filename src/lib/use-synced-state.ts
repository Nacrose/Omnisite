'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { usePersistentState } from '@/lib/use-persistent-state'

/**
 * useSyncedState — a hybrid storage hook.
 *
 * - If Supabase is configured (NEXT_PUBLIC_SUPABASE_URL is set):
 *   → Loads initial data from Supabase table
 *   → Saves changes to Supabase
 *   → Subscribes to real-time updates (other users' changes appear instantly)
 * - If Supabase is NOT configured (development/demo):
 *   → Falls back to localStorage via usePersistentState
 *
 * This allows the app to work immediately (localStorage) and
 * seamlessly upgrade to multi-user (Supabase) when env vars are added.
 */
export function useSyncedState<T>(
  localStorageKey: string,
  supabaseTable: string,
  initial: T | (() => T)
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const useSupabase = isSupabaseConfigured()
  const [localState, setLocalState] = usePersistentState(localStorageKey, initial)
  const [supabaseState, setSupabaseState] = useState<T | null>(null)
  const [loading, setLoading] = useState(useSupabase)

  // Load from Supabase and subscribe to real-time
  useEffect(() => {
    if (!useSupabase) return

    let mounted = true

    // Load initial data
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from(supabaseTable)
          .select('*')
          .order('created_at', { ascending: true })

        if (error) {
          console.warn(`[useSyncedState] Failed to load ${supabaseTable}:`, error)
          // Fall back to localStorage data
          if (mounted) setSupabaseState(localState)
        } else if (data && data.length > 0) {
          // Transform DB rows to the expected type
          // The data from Supabase is an array of rows; we store the whole array
          if (mounted) setSupabaseState(data as unknown as T)
        } else {
          // No data in DB — seed with initial data
          const initialData = typeof initial === 'function' ? (initial as () => T)() : initial
          if (mounted) setSupabaseState(initialData)
          // Seed the database
          if (Array.isArray(initialData)) {
            for (const item of initialData) {
              await supabase.from(supabaseTable).insert(item)
            }
          }
        }
        if (mounted) setLoading(false)
      } catch (e) {
        console.warn(`[useSyncedState] Error loading ${supabaseTable}, using localStorage:`, e)
        if (mounted) {
          setSupabaseState(localState)
          setLoading(false)
        }
      }
    }

    load()

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`${supabaseTable}-changes`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: supabaseTable },
        async () => {
          // Reload all data when any change occurs
          const { data } = await supabase
            .from(supabaseTable)
            .select('*')
            .order('created_at', { ascending: true })
          if (data && mounted) {
            setSupabaseState(data as unknown as T)
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [supabaseTable])

  // State setter — writes to Supabase or localStorage
  const setState = (value: T | ((prev: T) => T)) => {
    if (useSupabase && supabaseState !== null) {
      const newValue = typeof value === 'function'
        ? (value as (prev: T) => T)(supabaseState)
        : value
      setSupabaseState(newValue)

      // Sync to Supabase (upsert all items if array)
      if (Array.isArray(newValue)) {
        // For arrays, we do a bulk sync — delete all and re-insert
        // This is simple but works for development. In production, use diff-based updates.
        supabase.from(supabaseTable).delete().neq('id', '00000000-0000-0000-0000-000000000000')
          .then(() => {
            for (const item of newValue) {
              supabase.from(supabaseTable).upsert(item)
            }
          })
      } else {
        supabase.from(supabaseTable).upsert(newValue as Record<string, unknown>)
      }

      // Also save to localStorage as backup
      setLocalState(newValue)
    } else {
      setLocalState(value)
    }
  }

  // Return appropriate state
  const currentState = useSupabase
    ? (supabaseState !== null ? supabaseState : (typeof initial === 'function' ? (initial as () => T)() : initial))
    : localState

  return [currentState, setState, loading]
}
