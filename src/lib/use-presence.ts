'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useApp } from '@/lib/app-store'
import { supabase } from '@/lib/supabase'

export interface PresenceUser {
  id: string
  name: string
  initials: string
  color: string
  module: string
  hasCursor?: boolean
  lastSeen?: number
}

export interface RemoteCursor {
  id: string
  name: string
  initials: string
  color: string
  x: number
  y: number
  canvas: string
}

const SIMULATED_USERS: PresenceUser[] = [
  { id: 'sim-br', name: 'Bikash Rai', initials: 'BR', color: '#3b82f6', module: 'scheduler', hasCursor: false },
  { id: 'sim-sg', name: 'Sita Gurung', initials: 'SG', color: '#10b981', module: 'daily-ops', hasCursor: false },
  { id: 'sim-rb', name: 'Ram Bahadur', initials: 'RB', color: '#8b5cf6', module: 'boq', hasCursor: false },
]

const SIMULATED_CURSORS: RemoteCursor[] = [
  { id: 'sim-br', name: 'Bikash Rai', initials: 'BR', color: '#3b82f6', x: 30, y: 20, canvas: 'gantt' },
  { id: 'sim-sg', name: 'Sita Gurung', initials: 'SG', color: '#10b981', x: 60, y: 50, canvas: 'gantt' },
]

const CURRENT_USER: PresenceUser = {
  id: 'local',
  name: 'You',
  initials: 'YO',
  color: '#f97316',
  module: 'dashboard',
  hasCursor: false,
}

let connectionCount = 0
let fallbackActive = false

/**
 * Simulated presence — shows fake collaborators.
 *
 * Originally this had a socket.io WebSocket path that was never wired up.
 * That code has been removed. The hook now always uses simulated users.
 *
 * To wire up real presence: replace this with Supabase Realtime Presence
 * (supabase.channel('presence').on('presence', { event: 'sync' }, ...)).
 */
export function usePresence() {
  const { activeModule } = useApp()
  const [users, setUsers] = useState<PresenceUser[]>([])
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({})
  const [isConnected, setIsConnected] = useState(false)
  const [usingFallback, setUsingFallback] = useState(fallbackActive)
  const fallbackCursorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    connectionCount++

    if (!fallbackActive) {
      fallbackActive = true
      setUsingFallback(true)
      // Try real Supabase Realtime Presence; fall back to simulated if unavailable
      if (supabase) {
        try {
          const channel = supabase.channel('presence', {
            config: { presence: { key: CURRENT_USER.id } },
          })
          channel
            .on('presence', { event: 'sync' }, () => {
              const state = channel.presenceState()
              const remoteUsers: PresenceUser[] = []
              for (const [key, presences] of Object.entries(state)) {
                if (key === CURRENT_USER.id) continue
                for (const p of presences) {
                  const pu = p as unknown as PresenceUser
                  if (pu.id) remoteUsers.push(pu)
                }
              }
              if (remoteUsers.length > 0) {
                setUsers(remoteUsers)
                setIsConnected(true)
                setUsingFallback(false)
              }
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
              if (key === CURRENT_USER.id) return
              for (const p of newPresences) {
                const pu = p as unknown as PresenceUser
                if (pu.id) {
                  setUsers(prev => prev.find(u => u.id === pu.id) ? prev : [...prev, pu])
                }
              }
            })
            .subscribe((status: string) => {
              if (status === 'SUBSCRIBED') {
                setIsConnected(true)
                channel.track({ ...CURRENT_USER, module: activeModule })
              } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                setIsConnected(false)
                // Fall back to simulated
                if (!fallbackActive) {
                  fallbackActive = true
                  setUsingFallback(true)
                  setUsers(SIMULATED_USERS)
                }
              }
            })
        } catch {
          // Supabase not configured or error — use simulated
          setUsers(SIMULATED_USERS)
        }
      } else {
        setUsers(SIMULATED_USERS)
      }
    }

    // Simulated cursor movement — updates every 3.5 seconds
    const cursorInterval = setInterval(() => {
      setCursors(prev => {
        const next = { ...prev }
        for (const key of Object.keys(next)) {
          next[key] = {
            ...next[key],
            x: 15 + Math.random() * 70,
            y: 10 + Math.random() * 80,
          }
        }
        return next
      })
    }, 3500)
    fallbackCursorIntervalRef.current = cursorInterval

    return () => {
      connectionCount--
      if (fallbackCursorIntervalRef.current) {
        clearInterval(fallbackCursorIntervalRef.current)
        fallbackCursorIntervalRef.current = null
      }
      if (connectionCount === 0) {
        fallbackActive = false
      }
    }
  }, [])

  const sendCursor = useCallback((_x: number, _y: number, _canvas: string) => {
    // No-op — cursors feature was deleted; this stub keeps the API
    // compatible in case status-bar.tsx or other callers still reference it.
  }, [])

  const stopCursor = useCallback(() => {
    // No-op
  }, [])

  return {
    users,
    cursors: Object.values(cursors),
    isConnected,
    usingFallback,
    sendCursor,
    stopCursor,
  }
}
