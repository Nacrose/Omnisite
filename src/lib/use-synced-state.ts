'use client'

import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { usePersistentState } from '@/lib/use-persistent-state'

/**
 * useSyncedState — hybrid storage hook.
 *
 * If Supabase is configured → loads from DB, saves to DB, subscribes to real-time.
 * If not → falls back to localStorage.
 *
 * The hook handles the mapping between app objects and DB rows via optional
 * transform functions.
 */

interface SyncConfig {
  /** Map app field names to DB column names. e.g., { desc: 'description', hasRA: 'has_ra' } */
  fieldMap?: Record<string, string>
  /** The primary key column name in the DB (default: 'id') */
  primaryKey?: string
}

export function useSyncedState<T>(
  localStorageKey: string,
  supabaseTable: string,
  initial: T | (() => T),
  config?: SyncConfig
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const useSupabase = isSupabaseConfigured()
  const [localState, setLocalState] = usePersistentState(localStorageKey, initial)
  const [supabaseState, setSupabaseState] = useState<T | null>(null)
  const [loading, setLoading] = useState(useSupabase)

  const pk = config?.primaryKey || 'id'
  const fmap = config?.fieldMap || {}

  // Transform a DB row → app object (reverse map column names to field names)
  const fromDb = (row: Record<string, unknown>): Record<string, unknown> => {
    const obj: Record<string, unknown> = {}
    for (const [appField, dbCol] of Object.entries(fmap)) {
      if (row[dbCol] !== undefined) obj[appField] = row[dbCol]
    }
    // Copy unmapped fields directly
    for (const key of Object.keys(row)) {
      if (!Object.values(fmap).includes(key)) {
        // Convert snake_case to camelCase for known patterns
        if (key === 'created_at' || key === 'updated_at' || key === 'project_id') continue
        obj[key] = row[key]
      }
    }
    return obj
  }

  // Transform an app object → DB row (map field names to column names)
  const toDb = (item: Record<string, unknown>): Record<string, unknown> => {
    const row: Record<string, unknown> = {}
    for (const key of Object.keys(item)) {
      const dbCol = fmap[key] || key
      // Skip app-only fields that don't exist in DB (like 'children')
      if (key === 'children' || key === 'baseline') {
        // Serialize complex fields as JSON
        row[dbCol] = JSON.stringify(item[key])
        continue
      }
      row[dbCol] = item[key]
    }
    return row
  }

  useEffect(() => {
    if (!useSupabase || !supabase) return

    let mounted = true

    const load = async () => {
      try {
        const { data, error } = await supabase!
          .from(supabaseTable)
          .select('*')
          .order('created_at', { ascending: true })

        if (error) {
          console.warn(`[useSyncedState] Load failed for ${supabaseTable}:`, error.message)
          if (mounted) setSupabaseState(localState)
        } else if (data && data.length > 0) {
          // Transform DB rows to app objects
          const transformed = data.map(row => fromDb(row))
          if (mounted) setSupabaseState(transformed as unknown as T)
        } else {
          // No data — use initial (don't seed, the SQL seed already ran)
          const initialData = typeof initial === 'function' ? (initial as () => T)() : initial
          if (mounted) setSupabaseState(initialData)
        }
        if (mounted) setLoading(false)
      } catch (e) {
        console.warn(`[useSyncedState] Error for ${supabaseTable}, using localStorage:`, e)
        if (mounted) {
          setSupabaseState(localState)
          setLoading(false)
        }
      }
    }

    load()

    // Real-time subscription
    const channel = supabase
      .channel(`${supabaseTable}-rt`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: supabaseTable },
        async () => {
          const { data } = await supabase
            .from(supabaseTable)
            .select('*')
            .order('created_at', { ascending: true })
          if (data && mounted) {
            const transformed = data.map(row => fromDb(row))
            setSupabaseState(transformed as unknown as T)
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase!.removeChannel(channel)
    }
  }, [supabaseTable])

  // State setter — writes to Supabase or localStorage
  const setState = (value: T | ((prev: T) => T)) => {
    if (useSupabase && supabaseState !== null) {
      const newValue = typeof value === 'function'
        ? (value as (prev: T) => T)(supabaseState)
        : value
      setSupabaseState(newValue)

      // Sync to Supabase — upsert each item individually
      if (Array.isArray(newValue)) {
        for (const item of newValue) {
          const row = toDb(item as Record<string, unknown>)
          const id = (item as Record<string, unknown>)[pk === 'id' ? 'id' : pk] || (item as Record<string, unknown>).id
          if (id) {
            supabase!.from(supabaseTable).upsert({ ...row, id })
          }
        }
      }

      // Also save to localStorage as backup
      setLocalState(newValue)
    } else {
      setLocalState(value)
    }
  }

  const currentState = useSupabase
    ? (supabaseState !== null ? supabaseState : (typeof initial === 'function' ? (initial as () => T)() : initial))
    : localState

  return [currentState, setState, loading]
}
