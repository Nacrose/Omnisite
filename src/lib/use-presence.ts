'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useApp } from '@/lib/app-store'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export interface PresenceUser {
  id: string
  name: string
  initials: string
  color: string
  module: string
  hasCursor?: boolean
  lastSeen?: number
  /** The record this user is currently editing (e.g. 'boq_items:1.1.3').
   *  Undefined/null when the user isn't focused on a specific record. */
  activeRecord?: string | null
  /** Remote cursor position in viewport coordinates (px). Undefined when the
   *  user isn't moving their pointer (e.g. idle, typing, or on a touch
   *  device). */
  cursor?: { x: number; y: number } | null
}

const CURRENT_USER: PresenceUser = {
  id: 'local',
  name: 'You',
  initials: 'YO',
  color: '#f97316',
  module: 'dashboard',
  hasCursor: false,
  activeRecord: null,
}

type RealtimeChannel = ReturnType<NonNullable<typeof supabase>['channel']>

/**
 * Real Supabase Realtime Presence.
 *
 * Subscribes to the `presence` channel, tracks the current user (including
 * their active module and the record they're currently editing), and mirrors
 * remote joins/leaves into local state.
 *
 * Behavior:
 * - No simulated users. When Supabase is not configured (env vars missing,
 *   demo mode) or the subscription fails, `users` is empty and
 *   `usingFallback` is true.
 * - The channel is captured in a ref and properly unsubscribed + untracked
 *   on unmount (no leak).
 * - `activeModule` is read through a ref so the SUBSCRIBED callback always
 *   broadcasts the latest module, and a separate effect re-tracks on change
 *   without tearing the channel down.
 * - `trackRecord(recordId)` updates the active record being edited and
 *   re-tracks presence so other users see what we're working on.
 *   `getUsersOnRecord(recordId)` filters the remote users list by the same
 *   field — used by editors to show "user X is also editing this row".
 * - `usingFallback` only flips to true when subscription actually fails
 *   (CHANNEL_ERROR / TIMED_OUT) or when Supabase is not configured — never
 *   synchronously at mount.
 */
export function usePresence() {
  const { activeModule } = useApp()
  const [users, setUsers] = useState<PresenceUser[]>([])
  const [isConnected, setIsConnected] = useState(false)
  // Initialize from isSupabaseConfigured() so we never have to synchronously
  // call setUsingFallback(true) inside the mount effect — when Supabase isn't
  // configured, fallback is a static fact, not a transient state.
  const [usingFallback, setUsingFallback] = useState(() => !isSupabaseConfigured())

  const channelRef = useRef<RealtimeChannel | null>(null)
  const userIdRef = useRef<string>(CURRENT_USER.id)
  const activeModuleRef = useRef<string>(activeModule)
  // The record currently being edited by us. Kept in a ref so the SUBSCRIBED
  // callback (which closes over the ref, not the value) always broadcasts
  // the latest record id.
  const activeRecordRef = useRef<string | null>(null)
  // The latest cursor position we want to broadcast. Throttling is enforced
  // inside `trackCursor` (50ms) so we never flood the Realtime channel; the
  // ref just stores the freshest value so the next track() (whenever it
  // fires — on module change, on record change, on the throttle tick) sees
  // the most recent position rather than a stale snapshot.
  const cursorRef = useRef<{ x: number; y: number } | null>(null)

  // Keep the latest activeModule in a ref so the SUBSCRIBED callback (which
  // closes over the ref, not the value) always broadcasts the current module.
  useEffect(() => {
    activeModuleRef.current = activeModule
  }, [activeModule])

  // Set up the channel once on mount; tear down on unmount.
  useEffect(() => {
    // If Supabase isn't configured, `usingFallback` already started true
    // (lazy initial state) and there's no channel to set up.
    if (!supabase) return

    const channel = supabase.channel('presence', {
      config: { presence: { key: userIdRef.current } },
    })
    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const remoteUsers: PresenceUser[] = []
        for (const [key, presences] of Object.entries(state)) {
          if (key === userIdRef.current) continue
          for (const p of presences) {
            const pu = p as unknown as PresenceUser
            if (pu?.id) remoteUsers.push(pu)
          }
        }
        setUsers(remoteUsers)
        setIsConnected(true)
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (key === userIdRef.current) return
        setUsers((prev) => {
          const additions: PresenceUser[] = []
          for (const p of newPresences) {
            const pu = p as unknown as PresenceUser
            if (pu?.id && !prev.some((u) => u.id === pu.id)) {
              additions.push(pu)
            }
          }
          return additions.length ? [...prev, ...additions] : prev
        })
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        if (key === userIdRef.current) return
        const leavingIds = new Set(
          leftPresences
            .map((p) => (p as unknown as PresenceUser)?.id)
            .filter((id): id is string => typeof id === 'string')
        )
        setUsers((prev) => prev.filter((u) => !leavingIds.has(u.id)))
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          channel
            .track({
              ...CURRENT_USER,
              module: activeModuleRef.current,
              activeRecord: activeRecordRef.current,
              cursor: cursorRef.current,
            })
            .catch(() => {
              /* track failures are non-fatal; sync will still receive our presence */
            })
          setIsConnected(true)
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false)
          setUsingFallback(true)
        }
      })

    return () => {
      // Tear down: stop tracking, unsubscribe, drop the ref.
      try {
        channel.untrack().catch(() => {})
        channel.unsubscribe()
      } catch {
        // Channel may already be closed — safe to ignore.
      }
      if (channelRef.current === channel) {
        channelRef.current = null
      }
      setIsConnected(false)
    }
  }, [])

  // Re-track presence when the active module changes, without tearing down
  // the channel. Other users see our presence module update in real time.
  // The track() call is debounced by 300ms so rapid module switches (e.g.
  // mashing ⌘+1..⌘+9) coalesce into a single broadcast — Supabase Realtime
  // rate-limits presence updates and would otherwise drop intermediate ones.
  useEffect(() => {
    const channel = channelRef.current
    if (!channel) return
    const handle = setTimeout(() => {
      channel
        .track({
          ...CURRENT_USER,
          module: activeModule,
          activeRecord: activeRecordRef.current,
          cursor: cursorRef.current,
        })
        .catch(() => {
          /* ignore — best-effort re-track */
        })
    }, 300)
    return () => clearTimeout(handle)
  }, [activeModule])

  // Update the record we're currently editing and re-track presence so other
  // users see our focus change. Pass null to clear the active record.
  const trackRecord = useCallback((recordId: string | null) => {
    activeRecordRef.current = recordId
    const channel = channelRef.current
    if (!channel) return
    channel
      .track({
        ...CURRENT_USER,
        module: activeModuleRef.current,
        activeRecord: recordId,
        cursor: cursorRef.current,
      })
      .catch(() => {
        /* ignore — best-effort re-track */
      })
  }, [])

  // Broadcast the latest cursor position. Throttled to 50ms (20 Hz) — fast
  // enough for smooth remote-cursor motion, slow enough to stay under
  // Supabase Realtime's presence broadcast rate limit. We keep the latest
  // point in `cursorRef` so the next non-throttled track() (module change,
  // record change) still sees the freshest position.
  const lastCursorTrackRef = useRef<number>(0)
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const trackCursor = useCallback((x: number, y: number) => {
    cursorRef.current = { x, y }
    const channel = channelRef.current
    if (!channel) return

    const now = Date.now()
    const elapsed = now - lastCursorTrackRef.current
    if (elapsed >= 50) {
      lastCursorTrackRef.current = now
      channel
        .track({
          ...CURRENT_USER,
          module: activeModuleRef.current,
          activeRecord: activeRecordRef.current,
          cursor: { x, y },
        })
        .catch(() => {
          /* ignore — best-effort re-track */
        })
    } else {
      // Schedule a trailing-edge track so the final position of a burst is
      // always broadcast (a leading-edge-only throttle would drop the last
      // sample and leave remote cursors 50ms stale at rest).
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current)
      cursorTimerRef.current = setTimeout(() => {
        lastCursorTrackRef.current = Date.now()
        channel
          .track({
            ...CURRENT_USER,
            module: activeModuleRef.current,
            activeRecord: activeRecordRef.current,
            cursor: cursorRef.current,
          })
          .catch(() => {
            /* ignore — best-effort re-track */
          })
      }, 50 - elapsed)
    }
  }, [])

  // Return the remote users currently focused on a specific record id.
  // Callers use this to show "user X is also editing this row" indicators.
  const getUsersOnRecord = useCallback(
    (recordId: string): PresenceUser[] => {
      return users.filter((u) => u.activeRecord === recordId)
    },
    [users]
  )

  return {
    users,
    isConnected,
    usingFallback,
    trackRecord,
    trackCursor,
    getUsersOnRecord,
  }
}
