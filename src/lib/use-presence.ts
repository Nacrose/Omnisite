'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useApp } from '@/lib/app-store'

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
      setIsConnected(true) // simulated presence is "connected"
      setUsers(SIMULATED_USERS)
      setCursors({
        'sim-br': { ...SIMULATED_CURSORS[0] },
        'sim-sg': { ...SIMULATED_CURSORS[1] },
      })
      console.info('[OmniSite Presence] Simulated collaborators active')
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
