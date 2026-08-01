'use client'

import { useEffect, useRef, useState } from 'react'
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
}

const CURRENT_USER: PresenceUser = {
  id: 'local',
  name: 'You',
  initials: 'YO',
  color: '#f97316',
  module: 'dashboard',
  hasCursor: false,
}

type RealtimeChannel = ReturnType<NonNullable<typeof supabase>['channel']>

/**
 * Real Supabase Realtime Presence.
 *
 * Subscribes to the `presence` channel, tracks the current user (including
 * their active module), and mirrors remote joins/leaves into local state.
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
          channel.track({ ...CURRENT_USER, module: activeModuleRef.current }).catch(() => {
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
  useEffect(() => {
    const channel = channelRef.current
    if (!channel) return
    channel.track({ ...CURRENT_USER, module: activeModule }).catch(() => {
      /* ignore — best-effort re-track */
    })
  }, [activeModule])

  return {
    users,
    isConnected,
    usingFallback,
  }
}
