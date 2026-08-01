'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { usePersistentState } from '@/lib/use-persistent-state'
import { fetchAll, upsertOne } from '@/lib/api-client'
import { useApp } from '@/lib/app-store'

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

/**
 * Convert a snake_case string to camelCase.
 * e.g. 'has_ra' → 'hasRa', 'parent_id' → 'parentId', 'created_at' → 'createdAt'
 */
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

/**
 * Convert a camelCase string to snake_case.
 * e.g. 'hasRa' → 'has_ra', 'parentId' → 'parent_id'
 */
function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())
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
  // Read the active project ID from the app store so data is scoped per-project.
  // When the user switches projects, this hook re-fetches with the new project_id.
  const { activeProjectId } = useApp()

  const pk = config?.primaryKey || 'id'
  const fmap = config?.fieldMap || {}
  const apiEndpoint = endpointFor(supabaseTable)

  // ─── Transform: DB row → app object ───────────────────────────────────────
  // Reverse-map: for each {appField: dbCol} in fmap, copy row[dbCol] → obj[appField].
  // For unmapped fields, convert snake_case → camelCase automatically so
  // e.g. `has_ra`, `parent_id`, `created_at` become `hasRa`, `parentId`, `createdAt`.
  const fromDb = useCallback((row: Record<string, unknown>): Record<string, unknown> => {
    const obj: Record<string, unknown> = {}
    const mappedDbCols = new Set(Object.values(fmap))

    // First pass: apply explicit fieldMap (appField ← row[dbCol])
    for (const [appField, dbCol] of Object.entries(fmap)) {
      if (row[dbCol] !== undefined) {
        obj[appField] = row[dbCol]
      }
    }

    // Second pass: copy unmapped fields, converting snake_case → camelCase
    for (const key of Object.keys(row)) {
      if (mappedDbCols.has(key)) continue // already handled by fieldMap
      // Skip DB metadata columns that don't belong in app objects
      if (key === 'created_at' || key === 'updated_at') continue
      const appKey = snakeToCamel(key)
      // Don't overwrite an explicit fieldMap entry
      if (!(appKey in obj)) {
        obj[appKey] = row[key]
      }
    }

    return obj
  }, [fmap])

  // ─── Transform: app object → DB row ───────────────────────────────────────
  // Forward-map: for each app field, look up the DB column via fieldMap.
  // If not in fieldMap, convert camelCase → snake_case automatically.
  const toDb = useCallback((item: Record<string, unknown>): Record<string, unknown> => {
    const row: Record<string, unknown> = {}
    for (const key of Object.keys(item)) {
      // Explicit fieldMap takes precedence
      const dbCol = fmap[key] || camelToSnake(key)

      // Complex fields that don't exist as DB columns — serialize as JSON
      if (key === 'children' || key === 'baseline') {
        row[dbCol] = JSON.stringify(item[key])
        continue
      }

      row[dbCol] = item[key]
    }
    return row
  }, [fmap])

  useEffect(() => {
    if (!useSupabase || !supabase) return

    let mounted = true

    const load = async () => {
      try {
        // Pass the active project_id as a query param so the API route
        // can filter data per-project.
        const rows = await fetchAll<Record<string, unknown>>(apiEndpoint, activeProjectId ? { project_id: activeProjectId } : undefined)
        if (!mounted) return
        if (rows.length > 0) {
          const transformed = rows.map(row => fromDb(row))
          setSupabaseState(transformed as unknown as T)
        } else {
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

    // Real-time subscription — re-fetch through the API client on change.
    const channel = supabase
      .channel(`${supabaseTable}-rt`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: supabaseTable },
        async () => {
          try {
            const rows = await fetchAll<Record<string, unknown>>(apiEndpoint, activeProjectId ? { project_id: activeProjectId } : undefined)
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
  }, [supabaseTable, activeProjectId])

  // ─── State setter — race-condition-free ───────────────────────────────────
  // Uses a FUNCTIONAL setSupabaseState(prev => ...) so the updater always
  // receives the latest committed state, even if multiple setState calls
  // fire in the same React batch. The diff + upsert logic also runs inside
  // the functional update so it sees the true `prev`, not a stale closure.
  const stateRef = useRef(supabaseState)
  useEffect(() => { stateRef.current = supabaseState }, [supabaseState])

  const setState = (value: T | ((prev: T) => T)) => {
    if (!useSupabase) {
      setLocalState(value)
      return
    }

    // Use functional update so we always read the latest state.
    setSupabaseState(prev => {
      const newValue = typeof value === 'function'
        ? (value as (prev: T) => T)(prev ?? (typeof initial === 'function' ? (initial as () => T)() : initial))
        : value

      // Diff + upsert inside the updater so we use the true `prev`.
      if (Array.isArray(newValue)) {
        const prevArr = Array.isArray(prev) ? (prev as unknown[]) : []
        const prevById = new Map<string, unknown>()
        for (const p of prevArr) {
          const pid = (p as Record<string, unknown>)[pk] as string | undefined
          if (pid) prevById.set(pid, p)
        }
        for (const item of newValue) {
          const row = toDb(item as Record<string, unknown>)
          const id = (item as Record<string, unknown>)[pk] as string | undefined
          if (!id) continue
          const prevItem = prevById.get(id)
          if (prevItem !== undefined && JSON.stringify(prevItem) === JSON.stringify(item)) {
            continue
          }
          upsertOne(apiEndpoint, { ...row, id, project_id: activeProjectId }).catch(e => {
            console.warn(`[useSyncedState] upsert failed for ${supabaseTable}:${id}`, e)
          })
        }
      }

      // Also save to localStorage as backup
      setLocalState(newValue)

      return newValue
    })
  }

  const currentState = useSupabase
    ? (supabaseState !== null ? supabaseState : (typeof initial === 'function' ? (initial as () => T)() : initial))
    : localState

  return [currentState, setState, loading]
}
