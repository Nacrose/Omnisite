'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
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
  x: number  // percentage 0-100
  y: number  // percentage 0-100
  canvas?: string
}

// Current user identity — in production this would come from auth
const CURRENT_USER = {
  name: 'Arjun Sharma',
  initials: 'AS',
  color: '#f97316', // orange-500 (matches the avatar in the top bar)
}

// Simulated collaborators — used as fallback when WebSocket is unavailable
const SIMULATED_USERS: PresenceUser[] = [
  { id: 'sim-br', name: 'Bikash Rai', initials: 'BR', color: '#3b82f6', module: 'scheduler', hasCursor: false },
  { id: 'sim-sg', name: 'Sita Gurung', initials: 'SG', color: '#10b981', module: 'daily-ops', hasCursor: false },
  { id: 'sim-rb', name: 'Ram Bahadur', initials: 'RB', color: '#8b5cf6', module: 'boq', hasCursor: false },
]

const SIMULATED_CURSORS: RemoteCursor[] = [
  { id: 'sim-br', name: 'Bikash Rai', initials: 'BR', color: '#3b82f6', x: 30, y: 20, canvas: 'gantt' },
  { id: 'sim-sg', name: 'Sita Gurung', initials: 'SG', color: '#10b981', x: 60, y: 50, canvas: 'gantt' },
]

// Singleton socket — shared across all hook instances
let socket: Socket | null = null
let connectionCount = 0
let fallbackActive = false // module-level so all hook instances share it

/**
 * usePresence — connects to the OmniSite presence WebSocket service.
 * Falls back to simulated collaborators if the WebSocket is unavailable
 * (e.g. in local dev where the browser can't reach the presence service).
 * Returns the list of online users, remote cursors, and the connection status.
 */
export function usePresence() {
  const { activeModule } = useApp()
  const [users, setUsers] = useState<PresenceUser[]>([])
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({})
  const [isConnected, setIsConnected] = useState(false)
  const [usingFallback, setUsingFallback] = useState(fallbackActive)
  const cursorThrottleRef = useRef<number>(0)
  const fallbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fallbackCursorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Connect once
  useEffect(() => {
    connectionCount++
    let connectionFailed = false

    if (!socket) {
      const isLocalDev = typeof window !== 'undefined'
        && window.location.hostname === 'localhost'
        && window.location.port === '3000'
      // In production (Vercel, VPS, etc.), skip WebSocket connection entirely
      // and use simulated fallback. The WebSocket service runs separately.
      const isProduction = typeof window !== 'undefined'
        && !isLocalDev
        && !window.location.hostname.includes('localhost')

      if (isProduction) {
        // Immediately use fallback in production without a WebSocket service
        connectionFailed = true
        fallbackActive = true
        setUsingFallback(true)
        setUsers(SIMULATED_USERS)
        setCursors({
          'sim-br': { ...SIMULATED_CURSORS[0] },
          'sim-sg': { ...SIMULATED_CURSORS[1] },
        })
        console.info('[OmniSite Presence] Production mode — using simulated collaborators (WebSocket service not configured)')
      } else {
        // Local dev — try to connect to the local WebSocket service
        const socketUrl = isLocalDev ? 'http://localhost:3003' : undefined

      socket = io(socketUrl ?? '/', {
        path: isLocalDev ? '/socket.io/' : '/',
        query: isLocalDev ? undefined : { XTransformPort: '3003' },
        transports: ['polling', 'websocket'],
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 3, // try 3 times, then fall back
        reconnectionDelay: 1000,
        timeout: 5000,
      })

      // If connection fails after 3 attempts, switch to simulated fallback
      const fallbackTimer = setTimeout(() => {
        if (!socket?.connected) {
          connectionFailed = true
          fallbackActive = true
          setUsingFallback(true)
          setUsers(SIMULATED_USERS)
          // Seed initial cursors
          setCursors({
            'sim-br': { ...SIMULATED_CURSORS[0] },
            'sim-sg': { ...SIMULATED_CURSORS[1] },
          })
          console.warn('[OmniSite Presence] WebSocket unavailable — using simulated collaborators')
        }
      }, 8000) // give it 8 seconds to connect

      socket.on('connect_error', () => {
        // Will trigger fallback if it keeps failing
      })

      socket.on('connect', () => {
        clearTimeout(fallbackTimer)
        if (connectionFailed) return
        setIsConnected(true)
        setUsingFallback(false)
        socket!.emit('presence:join', {
          ...CURRENT_USER,
          module: activeModule,
        })
      })

      socket.on('disconnect', () => {
        setIsConnected(false)
      })
      } // end else (local dev WebSocket)
    } // end if (!socket)

    const onPresenceList = (data: { users: PresenceUser[]; count: number }) => {
      if (connectionFailed) return
      setUsers(data.users.filter(u => u.initials !== CURRENT_USER.initials))
    }

    const onPresenceJoin = (user: PresenceUser) => {
      if (connectionFailed || user.initials === CURRENT_USER.initials) return
      setUsers(prev => prev.find(u => u.id === user.id) ? prev : [...prev, user])
    }

    const onPresenceLeave = (data: { id: string }) => {
      if (connectionFailed) return
      setUsers(prev => prev.filter(u => u.id !== data.id))
      setCursors(prev => {
        const next = { ...prev }
        delete next[data.id]
        return next
      })
    }

    const onPresenceModule = (data: { id: string; module: string }) => {
      if (connectionFailed) return
      setUsers(prev => prev.map(u => u.id === data.id ? { ...u, module: data.module } : u))
    }

    const onPresenceCursor = (cursor: RemoteCursor) => {
      if (connectionFailed || cursor.initials === CURRENT_USER.initials) return
      setCursors(prev => ({ ...prev, [cursor.id]: cursor }))
    }

    const onPresenceCursorStop = (data: { id: string }) => {
      if (connectionFailed) return
      setCursors(prev => {
        const next = { ...prev }
        delete next[data.id]
        return next
      })
    }

    socket.on('presence:list', onPresenceList)
    socket.on('presence:join', onPresenceJoin)
    socket.on('presence:leave', onPresenceLeave)
    socket.on('presence:module', onPresenceModule)
    socket.on('presence:cursor', onPresenceCursor)
    socket.on('presence:cursor-stop', onPresenceCursorStop)

    // Heartbeat
    const heartbeat = setInterval(() => {
      if (socket?.connected) socket.emit('presence:ping')
    }, 20000)

    // Fallback: simulate cursor movement when not connected
    // This runs in every hook instance so all see the cursors
    fallbackCursorIntervalRef.current = setInterval(() => {
      if (!fallbackActive) return
      setCursors(prev => {
        const next = { ...prev }
        for (const sc of SIMULATED_CURSORS) {
          // Random walk — only update if this instance has the cursor
          const existing = next[sc.id] || sc
          next[sc.id] = {
            ...existing,
            x: Math.max(10, Math.min(90, existing.x + (Math.random() - 0.5) * 8)),
            y: Math.max(10, Math.min(90, existing.y + (Math.random() - 0.5) * 8)),
          }
        }
        return next
      })
    }, 2000)

    // If fallback is already active (set by another instance), seed users + cursors immediately
    if (fallbackActive) {
      setUsers(SIMULATED_USERS)
      if (Object.keys(cursors).length === 0) {
        setCursors({
          'sim-br': { ...SIMULATED_CURSORS[0] },
          'sim-sg': { ...SIMULATED_CURSORS[1] },
        })
      }
    }

    return () => {
      connectionCount--
      socket?.off('presence:list', onPresenceList)
      socket?.off('presence:join', onPresenceJoin)
      socket?.off('presence:leave', onPresenceLeave)
      socket?.off('presence:module', onPresenceModule)
      socket?.off('presence:cursor', onPresenceCursor)
      socket?.off('presence:cursor-stop', onPresenceCursorStop)
      clearInterval(heartbeat)
      if (fallbackCursorIntervalRef.current) clearInterval(fallbackCursorIntervalRef.current)
      if (connectionCount === 0 && socket) {
        socket.disconnect()
        socket = null
      }
    }
  }, [])

  // When the active module changes, notify the server (if connected)
  useEffect(() => {
    if (socket?.connected) {
      socket.emit('presence:module', { module: activeModule })
    }
  }, [activeModule])

  // Broadcast cursor position (throttled)
  const sendCursor = useCallback((x: number, y: number, canvas?: string) => {
    if (fallbackActive) return // don't send in fallback mode
    const now = Date.now()
    if (now - cursorThrottleRef.current < 50) return
    cursorThrottleRef.current = now
    socket?.emit('presence:cursor', { x, y, canvas })
  }, [])

  const stopCursor = useCallback(() => {
    if (fallbackActive) return
    socket?.emit('presence:cursor-stop')
  }, [])

  return {
    users,
    cursors: Object.values(cursors),
    isConnected,
    usingFallback,
    sendCursor,
    stopCursor,
    currentUser: CURRENT_USER,
  }
}

