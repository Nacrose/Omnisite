'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { usePersistentState } from '@/lib/use-persistent-state'
import { fetchPaginated, upsertOne } from '@/lib/api-client'
import { useApp } from '@/lib/app-store'
// Pure helpers extracted to ./use-synced-state-helpers.ts (no side effects,
// no Supabase dependency — safe to unit-test in isolation).
import {
  TABLE_TO_ENDPOINT,
  endpointFor,
  snakeToCamel,
  camelToSnake,
  shallowEqualRecords,
  type SyncConfig,
} from './use-synced-state-helpers'

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
 *
 * @returns `[state, setState, loading, truncated, loadMore]`
 *   - `state`: the current data (Supabase or localStorage-backed)
 *   - `setState`: updater (value or function) — queues upserts for a drain
 *     effect to fire (NOT inside the React updater, so StrictMode-safe).
 *   - `loading`: true while the initial fetch is in flight
 *   - `truncated`: true if the dataset hit the 2000-row MAX_PAGES cap.
 *                  Use this to render a persistent "showing first N rows"
 *                  indicator. The hook also fires a one-shot toast when the
 *                  cap is hit; this flag lets callers show a persistent UI.
 *   - `loadMore`: fetch the next page when `truncated` is true. Deduplicates
 *     by PK and appends to state. No-op when there is no next cursor.
 */

// ─── Shared realtime channel cache ──────────────────────────────────────────
// Multiple useSyncedState instances for the same table (e.g. BOQ in two
// components) would create duplicate Supabase channels. This cache ensures
// only one channel per table exists, and refetch callbacks are multiplexed.

interface ChannelEntry {
  channel: ReturnType<NonNullable<typeof supabase>['channel']>
  callbacks: Set<(payload: { eventType: string; new: unknown; old: unknown }) => void>
  /** Timestamp of the last callback add/remove — used for GC. */
  lastActivity: number
}
const channelCache = new Map<string, ChannelEntry>()

// ─── Realtime channel cache GC ──────────────────────────────────────────────
// Channels are removed when callbacks.size === 0, but if a component unmounts
// without cleanup (e.g. error boundary swallows the cleanup), the channel
// leaks. This periodic GC sweeps channels with no callbacks that haven't
// been touched in CHANNEL_IDLE_MS. Runs every GC_INTERVAL_MS.
const CHANNEL_IDLE_MS = 5 * 60 * 1000 // 5 minutes
const GC_INTERVAL_MS = 2 * 60 * 1000 // check every 2 minutes

function sweepIdleChannels() {
  const now = Date.now()
  for (const [table, entry] of channelCache.entries()) {
    if (entry.callbacks.size === 0 && now - entry.lastActivity > CHANNEL_IDLE_MS) {
      try {
        entry.channel.unsubscribe()
      } catch {
        // already closed
      }
      channelCache.delete(table)
    }
  }
}

// Start the GC timer once on module load (Node.js + browser).
if (typeof globalThis !== 'undefined') {
  // Use setTimeout recursively instead of setInterval so we don't hold
  // the event loop open in Node.js serverless environments.
  const scheduleGc = () => {
    setTimeout(() => {
      sweepIdleChannels()
      scheduleGc()
    }, GC_INTERVAL_MS)
  }
  // Only schedule in browser (serverless functions shouldn't run long-lived timers)
  if (typeof window !== 'undefined') {
    scheduleGc()
  }
}

export function useSyncedState<T>(
  localStorageKey: string,
  supabaseTable: string,
  initial: T | (() => T),
  config?: SyncConfig
): [T, (value: T | ((prev: T) => T)) => void, boolean, boolean, () => Promise<void>] {
  const useSupabase = isSupabaseConfigured()
  const [localState, setLocalState] = usePersistentState(localStorageKey, initial)
  const [supabaseState, setSupabaseState] = useState<T | null>(null)
  const [loading, setLoading] = useState(useSupabase)
  const [truncated, setTruncated] = useState(false)
  // Read the active project's DB UUID from the app store so data is scoped per-project.
  // When the user switches projects, this hook re-fetches with the new project_id.
  const { activeProjectDbId } = useApp()

  // Pending upsert queue — populated by `setState` (inside the React updater,
  // which MUST stay pure) and drained by a separate useEffect that runs after
  // the state has committed. Side effects inside the updater would double-fire
  // under React StrictMode in dev, producing duplicate POST requests.
  const pendingUpsertsRef = useRef<Array<{ id: string; row: Record<string, unknown> }>>([])

  // Pagination cursor for `loadMore()`. When the initial fetch loop bails out
  // at the MAX_PAGES cap, the next cursor from the last successful page is
  // stashed here so `loadMore()` can pick up where the initial fetch left off.
  const nextCursorRef = useRef<string | null>(null)
  // Runtime flag for whether more pages are available. Mirrors `truncated`
  // initially, but flips to false as `loadMore()` exhausts the dataset.
  const [hasMore, setHasMore] = useState(false)

  const pk = config?.primaryKey || 'id'
  const fmap = config?.fieldMap || {}
  const apiEndpoint = endpointFor(supabaseTable)

  // ─── Transform: DB row → app object ───────────────────────────────────────
  // Reverse-map: for each {appField: dbCol} in fmap, copy row[dbCol] → obj[appField].
  // For unmapped fields, convert snake_case → camelCase automatically so
  // e.g. `has_ra`, `parent_id`, `created_at` become `hasRa`, `parentId`, `createdAt`.
  const fromDb = useCallback(
    (row: Record<string, unknown>): Record<string, unknown> => {
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

      // Scheduler: reconstruct the `baseline` tuple from the two INTEGER
      // columns `baseline_start` + `baseline_finish`. The tasks table has
      // no `baseline` JSONB column (the tuple is split on write by `toDb`
      // below). Safe to run unconditionally — only the tasks table defines
      // these columns, so other tables never populate them and the check
      // is a no-op for every other module.
      if (row['baseline_start'] !== undefined && row['baseline_finish'] !== undefined) {
        obj['baseline'] = [row['baseline_start'], row['baseline_finish']]
      }

      return obj
    },
    [fmap]
  )

  // ─── Transform: app object → DB row ───────────────────────────────────────
  // Forward-map: for each app field, look up the DB column via fieldMap.
  // If not in fieldMap, convert camelCase → snake_case automatically.
  const toDb = useCallback(
    (item: Record<string, unknown>): Record<string, unknown> => {
      const row: Record<string, unknown> = {}
      for (const key of Object.keys(item)) {
        const value = item[key]

        // Scheduler baseline tuple is split into the two INTEGER columns
        // `baseline_start` + `baseline_finish` — there is no `baseline`
        // JSONB column on the tasks table. The reverse mapping lives in
        // `fromDb` above. This MUST run before the generic JSON-stringify
        // branch below, otherwise the array would be serialized as a string
        // and PostgREST would reject the unknown `baseline` column (or
        // silently drop it, losing the data).
        if (key === 'baseline' && Array.isArray(value) && value.length === 2) {
          row['baseline_start'] = value[0]
          row['baseline_finish'] = value[1]
          continue
        }

        // Explicit fieldMap takes precedence
        const dbCol = fmap[key] || camelToSnake(key)

        // JSON-stringify arrays and plain objects for JSONB columns.
        // The Zod schemas declare these as z.string().optional() because
        // PostgREST expects a JSON string for JSONB columns via the REST API.
        // This is a universal type check (rather than a hardcoded
        // children/baseline/dependencies allowlist) so ANY future
        // JSONB-typed app field is handled automatically — the previous
        // allowlist missed e.g. `vendors.allocated`, `equipment.docs`,
        // `subcontractors.material_issues`, `vendors.materials_supplied`,
        // etc., all of which silently lost their contents on POST.
        if (
          Array.isArray(value) ||
          (typeof value === 'object' && value !== null && !(value instanceof Date))
        ) {
          row[dbCol] = JSON.stringify(value)
        } else {
          row[dbCol] = value
        }
      }
      return row
    },
    [fmap]
  )

  useEffect(() => {
    if (!useSupabase || !supabase) return

    let mounted = true

    const load = async () => {
      try {
        // Fetch all data for this table+project. For large tables (BOQ with
        // 1000+ items), we fetch in pages of 200 using cursor pagination.
        const baseQuery: Record<string, string> = {}
        if (activeProjectDbId) baseQuery.project_id = activeProjectDbId
        baseQuery.limit = '200'

        let allRows: Record<string, unknown>[] = []
        let cursor: string | null = null
        let page = 0
        // Default cap: 3 pages × 200 rows = 600 rows on initial load. Most
        // modules don't need more on first paint — the loadMore() callback
        // (returned as the 5th element of the hook's tuple) fetches the next
        // page on demand. Lowered from 10 (2000 rows) which was over-fetching
        // on every page load for projects with thousands of BOQ items.
        //
        // To override per-table (e.g. BOQ needs the full tree for tree
        // operations), pass `config.maxPages` — see SyncConfig.
        const MAX_PAGES = config?.maxPages ?? 3

        while (page < MAX_PAGES) {
          const query = { ...baseQuery }
          if (cursor) query.cursor = cursor
          // Use fetchPaginated so we get both the rows and the next cursor
          // (fetchAll would silently discard nextCursor).
          const { data: rows, nextCursor } = await fetchPaginated<Record<string, unknown>>(
            apiEndpoint,
            query
          )
          allRows = allRows.concat(rows)
          page++
          cursor = nextCursor
          if (!cursor || rows.length < 200) break
        }

        // If we hit the MAX_PAGES cap (cursor still has data), surface a
        // toast so the user knows the dataset is truncated — not silently
        // cut off. The cap is 2000 rows (10 pages × 200); large projects
        // with thousands of BOQ items will hit this.
        const wasTruncated = page >= MAX_PAGES && cursor
        if (wasTruncated) {
          setTruncated(true)
          // Stash the cursor so loadMore() can pick up where the initial
          // fetch left off (without re-walking the already-fetched pages).
          nextCursorRef.current = cursor
          setHasMore(true)
          try {
            const { toast } = await import('sonner')
            toast.warning('Dataset truncated', {
              description: `Showing first ${allRows.length} rows from ${supabaseTable}. Refine your filter or contact admin for full data.`,
              id: `truncated-${supabaseTable}`,
            })
          } catch {
            // sonner not available — the truncated flag is still set
          }
        } else {
          setTruncated(false)
          nextCursorRef.current = null
          setHasMore(false)
        }

        if (!mounted) return
        if (allRows.length > 0) {
          const transformed = allRows.map((row) => fromDb(row))
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

    // Real-time subscription — uses shared channel cache so multiple
    // useSyncedState instances for the same table share one channel.
    const rtCallback = (payload: { eventType: string; new: unknown; old: unknown }) => {
      if (!mounted) return
      try {
        const eventType = payload.eventType
        const newRow = payload.new as Record<string, unknown> | null
        const oldRow = payload.old as Record<string, unknown> | null

        setSupabaseState((prev) => {
          if (!Array.isArray(prev)) return prev
          const arr = prev as unknown as Record<string, unknown>[]

          if (eventType === 'INSERT' && newRow) {
            const itemId = newRow[pk]
            if (arr.some((it) => it[pk] === itemId)) return prev
            const transformed = fromDb(newRow)
            return [...arr, transformed] as unknown as T
          }

          if (eventType === 'UPDATE' && newRow) {
            const itemId = newRow[pk]
            const transformed = fromDb(newRow)
            const updated = arr.map((it) => (it[pk] === itemId ? { ...it, ...transformed } : it))
            return updated as unknown as T
          }

          if (eventType === 'DELETE' && oldRow) {
            const itemId = oldRow[pk]
            const filtered = arr.filter((it) => it[pk] !== itemId)
            return filtered as unknown as T
          }

          return prev
        })
      } catch (e) {
        console.warn(`[useSyncedState] Realtime patch failed for ${supabaseTable}:`, e)
      }
    }

    // Channel cache key includes the active project's DB UUID so switching
    // projects creates a new scoped channel (the old channel is left for the
    // GC sweep to retire once its callback count drops to zero). Without this,
    // multiple useSyncedState instances on the same table but different
    // projects would share one channel and receive cross-project notifications.
    const channelKey = activeProjectDbId ? `${supabaseTable}:${activeProjectDbId}` : supabaseTable

    // Realtime filter — only receive events for rows whose project_id matches
    // the active project. When there's no active project (e.g. admin views),
    // fall back to an unfiltered subscription so the hook still works for
    // cross-project tables (workers, equipment, etc.).
    //
    // Explicitly typed so the ternary collapses to a single object type with
    // an OPTIONAL `filter` — without this, TS widens to a union of two
    // distinct shapes and the `channel.on('postgres_changes', ...)` overload
    // can no longer be matched, falling back to the `system` overload and
    // producing an implicit-any on the callback payload.
    const filterConfig: {
      event: '*'
      schema: 'public'
      table: string
      filter?: string
    } = activeProjectDbId
      ? {
          event: '*',
          schema: 'public',
          table: supabaseTable,
          filter: `project_id=eq.${activeProjectDbId}`,
        }
      : { event: '*', schema: 'public', table: supabaseTable }

    // Register with shared channel cache
    let entry = channelCache.get(channelKey)
    if (!entry) {
      const channel = supabase
        .channel(`${channelKey}-rt`)
        .on('postgres_changes', filterConfig, (payload) => {
          const e = channelCache.get(channelKey)
          if (e) {
            e.callbacks.forEach((cb) =>
              cb({
                eventType: payload.eventType,
                new: payload.new,
                old: payload.old,
              })
            )
          }
        })
        .subscribe()
      entry = { channel, callbacks: new Set(), lastActivity: Date.now() }
      channelCache.set(channelKey, entry)
    }
    entry.callbacks.add(rtCallback)
    entry.lastActivity = Date.now()

    return () => {
      mounted = false
      const e = channelCache.get(channelKey)
      if (e) {
        e.callbacks.delete(rtCallback)
        e.lastActivity = Date.now()
        // Only remove the channel when no more callbacks are registered.
        // The GC sweep also catches channels that miss this cleanup
        // (e.g. error boundary swallows the unmount).
        if (e.callbacks.size === 0) {
          supabase!.removeChannel(e.channel)
          channelCache.delete(channelKey)
        }
      }
    }
    // Deps: supabaseTable + activeProjectDbId drive the fetch + realtime
    // subscription. `config?.maxPages` is read inside but intentionally
    // excluded — changing maxPages at runtime is not a supported use case
    // (it's a per-table constant set at mount). Including it would re-fetch
    // the entire dataset if a parent ever passed a dynamic value, which
    // would be a bug, not a feature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseTable, activeProjectDbId])

  // ─── State setter — race-condition-free, StrictMode-safe ─────────────────
  // Uses a FUNCTIONAL setSupabaseState(prev => ...) so the updater always
  // receives the latest committed state, even if multiple setState calls
  // fire in the same React batch.
  //
  // IMPORTANT: the updater function passed to setSupabaseState MUST stay
  // pure. Previously it called `upsertOne()` inline, which fired duplicate
  // POSTs under React StrictMode (which double-invokes updaters in dev).
  // Now the updater only pushes changed rows onto `pendingUpsertsRef`, and a
  // separate useEffect drains the queue after the state has committed.
  const stateRef = useRef(supabaseState)
  useEffect(() => {
    stateRef.current = supabaseState
  }, [supabaseState])

  const setState = (value: T | ((prev: T) => T)) => {
    if (!useSupabase) {
      setLocalState(value)
      return
    }

    // Use functional update so we always read the latest state.
    setSupabaseState((prev) => {
      const newValue =
        typeof value === 'function'
          ? (value as (prev: T) => T)(
              prev ?? (typeof initial === 'function' ? (initial as () => T)() : initial)
            )
          : value

      // Diff against prev using a Map + shallow field-by-field comparison,
      // then push changed rows onto the pending upsert queue. Side effects
      // (the actual `upsertOne` POST) are deferred to the drain effect
      // below — running them here would double-fire under StrictMode.
      if (Array.isArray(newValue)) {
        const prevArr = Array.isArray(prev) ? (prev as unknown[]) : []
        const prevById = new Map<string, Record<string, unknown>>()
        for (const p of prevArr) {
          const pid = (p as Record<string, unknown>)[pk] as string | undefined
          if (pid) prevById.set(pid, p as Record<string, unknown>)
        }
        for (const item of newValue) {
          const itemRecord = item as Record<string, unknown>
          const id = itemRecord[pk] as string | undefined
          if (!id) continue
          const prevItem = prevById.get(id)
          if (prevItem !== undefined && shallowEqualRecords(prevItem, itemRecord)) {
            continue
          }
          const row = toDb(itemRecord)
          // Use the table's actual primary key (pk), not a hardcoded 'id'.
          // This fixes CBS/Financials sync where cbs_nodes uses 'code' as PK
          // and has no 'id' column — the previous hardcoded { ...row, id }
          // was rejected by PostgREST for the unknown column.
          const dbRow = { ...row, [pk]: id, project_id: activeProjectDbId }
          pendingUpsertsRef.current.push({ id, row: dbRow })
        }
      }

      // Also save to localStorage as backup
      setLocalState(newValue)

      return newValue
    })
  }

  // Drain the pending upsert queue after `supabaseState` has committed.
  // Runs whenever `supabaseState` changes (so it sees the latest snapshot).
  // StrictMode-safe: the effect itself only fires once per commit, even in
  // dev — and we clear `pendingUpsertsRef.current` BEFORE firing the fetches
  // so a second drain during the same cycle finds an empty queue.
  useEffect(() => {
    if (!useSupabase) return
    const queue = pendingUpsertsRef.current
    if (queue.length === 0) return
    pendingUpsertsRef.current = []
    for (const { id, row } of queue) {
      upsertOne(apiEndpoint, row).catch((e) => {
        console.warn(`[useSyncedState] upsert failed for ${supabaseTable}:${id}`, e)
      })
    }
  }, [supabaseState, useSupabase, apiEndpoint, supabaseTable])

  // Fetch the next page when the initial fetch hit the MAX_PAGES cap.
  // Deduplicates by primary key (in case the server returned rows we already
  // have from a previous loadMore call) and appends to state.
  const loadMore = useCallback(async () => {
    if (!useSupabase || !supabase) return
    const cursor = nextCursorRef.current
    if (!cursor || !hasMore) return
    try {
      const query: Record<string, string> = { limit: '200', cursor }
      if (activeProjectDbId) query.project_id = activeProjectDbId
      const { data: rows, nextCursor } = await fetchPaginated<Record<string, unknown>>(
        apiEndpoint,
        query
      )
      if (rows.length === 0) {
        nextCursorRef.current = null
        setHasMore(false)
        setTruncated(false)
        return
      }
      const transformed = rows.map((row) => fromDb(row))
      setSupabaseState((prev) => {
        if (!Array.isArray(prev)) return prev
        const arr = prev as unknown as Record<string, unknown>[]
        const seenIds = new Set(arr.map((it) => (it as Record<string, unknown>)[pk] as string))
        const additions = transformed.filter(
          (t) => !seenIds.has((t as Record<string, unknown>)[pk] as string)
        )
        if (additions.length === 0) return prev
        return [...arr, ...additions] as unknown as T
      })
      nextCursorRef.current = nextCursor
      if (!nextCursor) {
        setHasMore(false)
        setTruncated(false)
      }
    } catch (e) {
      console.warn(`[useSyncedState] loadMore failed for ${supabaseTable}:`, e)
    }
  }, [useSupabase, apiEndpoint, supabaseTable, activeProjectDbId, pk, fromDb, hasMore])

  const currentState = useSupabase
    ? supabaseState !== null
      ? supabaseState
      : typeof initial === 'function'
        ? (initial as () => T)()
        : initial
    : localState

  return [currentState, setState, loading, truncated, loadMore]
}

// Re-export pure helpers for backwards compatibility. Existing imports from
// '@/lib/use-synced-state' keep working — new code should import from
// '@/lib/use-synced-state-helpers' directly.
export { snakeToCamel, camelToSnake, type SyncConfig }
