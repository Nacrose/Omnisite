'use client'

import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { usePersistentState } from '@/lib/use-persistent-state'
import { fetchAll, upsertOne } from '@/lib/api-client'

/**
 * useSyncedState — hybrid storage hook.
 *
 * If Supabase is configured →
 *   - Reads go through the REST API client (`GET /api/{endpoint}`).
 *   - Writes go through the REST API client (`POST /api/{endpoint}`).
 *   - Real-time notifications arrive via the Supabase client's postgres_changes
 *     channel (read-only); on each notification we re-fetch through the API
 *     client so the read path is also server-validated.
 *
 * If not → falls back to localStorage (no network traffic at all).
 *
 * The hook handles the mapping between app objects and DB rows via optional
 * transform functions. The DB row ↔ API JSON shape is identical, so the same
 * `fieldMap` / `primaryKey` config works for both the legacy direct-Supabase
 * path and the new API path.
 */

interface SyncConfig {
  /** Map app field names to DB column names. e.g., { desc: 'description', hasRA: 'has_ra' } */
  fieldMap?: Record<string, string>
  /** The primary key column name in the DB (default: 'id') */
  primaryKey?: string
}

/**
 * Map a Supabase table name to its REST API endpoint slug.
 * e.g. `boq_items` → `boq` (so we hit `/api/boq`).
 * Falls back to the table name itself if no mapping is registered, so new
 * tables work automatically once a matching `/api/{table}` route exists.
 */
const TABLE_TO_ENDPOINT: Record<string, string> = {
  boq_items: 'boq',
  tasks: 'tasks',
  workers: 'workers',
  equipment: 'equipment',
  cbs_nodes: 'cbs-nodes',
  qs_items: 'qs-items',
  chat_messages: 'chat-messages',
}

function endpointFor(table: string): string {
  return TABLE_TO_ENDPOINT[table] ?? table
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
  const apiEndpoint = endpointFor(supabaseTable)

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
        // Initial read goes through the API client (server-side validated).
        const rows = await fetchAll<Record<string, unknown>>(apiEndpoint)
        if (!mounted) return
        if (rows.length > 0) {
          const transformed = rows.map(row => fromDb(row))
          setSupabaseState(transformed as unknown as T)
        } else {
          // No data — use initial (don't seed, the SQL seed already ran)
          const initialData = typeof initial === 'function' ? (initial as () => T)() : initial
          setSupabaseState(initialData)
        }
        setLoading(false)
      } catch (e) {
        console.warn(`[useSyncedState] Error for ${supabaseTable}, using localStorage:`, e)
        if (mounted) {
          setSupabaseState(localState)
          setLoading(false)
        }
      }
    }

    load()

    // Real-time subscription — uses the Supabase client ONLY to receive
    // change notifications. When a notification arrives, we re-fetch through
    // the API client (the read path), keeping the write/read paths consistent
    // and server-validated.
    const channel = supabase
      .channel(`${supabaseTable}-rt`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: supabaseTable },
        async () => {
          try {
            const rows = await fetchAll<Record<string, unknown>>(apiEndpoint)
            if (rows && mounted) {
              const transformed = rows.map(row => fromDb(row))
              setSupabaseState(transformed as unknown as T)
            }
          } catch (e) {
            console.warn(`[useSyncedState] Realtime refetch failed for ${supabaseTable}:`, e)
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase!.removeChannel(channel)
    }
  }, [supabaseTable])

  // State setter — writes to API (when Supabase configured) or localStorage
  const setState = (value: T | ((prev: T) => T)) => {
    if (useSupabase && supabaseState !== null) {
      const newValue = typeof value === 'function'
        ? (value as (prev: T) => T)(supabaseState)
        : value
      setSupabaseState(newValue)

      // Sync to API — upsert each item that has a primary key.
      // We diff against the previous state so unchanged rows don't generate
      // spurious POSTs (the original implementation upserted every row on
      // every keystroke, which was wasteful).
      if (Array.isArray(newValue)) {
        const prevArr = Array.isArray(supabaseState) ? (supabaseState as unknown[]) : []
        const prevById = new Map<string, unknown>()
        for (const p of prevArr) {
          const pid = (p as Record<string, unknown>)[pk] as string | undefined
          if (pid) prevById.set(pid, p)
        }
        for (const item of newValue) {
          const row = toDb(item as Record<string, unknown>)
          const id = (item as Record<string, unknown>)[pk] as string | undefined
          if (!id) continue
          // Skip rows that haven't changed since the previous render.
          const prevItem = prevById.get(id)
          if (prevItem !== undefined && JSON.stringify(prevItem) === JSON.stringify(item)) {
            continue
          }
          // Fire-and-forget; the realtime channel will notify us when the
          // write lands, and per-item failures are logged without blocking
          // subsequent writes.
          upsertOne(apiEndpoint, { ...row, id }).catch(e => {
            console.warn(`[useSyncedState] upsert failed for ${supabaseTable}:${id}`, e)
          })
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
