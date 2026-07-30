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
  x: number
  y: number
  canvas?: string
}

const CURRENT_USER = {
  name: 'Arjun Sharma',
  initials: 'AS',
  color: '#f97316',
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

let socket: Socket | null = null
let connectionCount = 0
let fallbackActive = false

export function usePresence() {
  const { activeModule } = useApp()
  const [users, setUsers] = useState<PresenceUser[]>([])
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({})
  const [isConnected, setIsConnected] = useState(false)
  const [usingFallback, setUsingFallback] = useState(fallbackActive)
  const cursorThrottleRef = useRef<number>(0)
  const fallbackCursorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    connectionCount++

    if (!socket && !fallbackActive) {
      const isLocalDev = typeof window !== 'undefined'
        && window.location.hostname === 'localhost'
        && window.location.port === '3000'

      const isProduction = typeof window !== 'undefined'
        && !isLocalDev
        && !window.location.hostname.includes('localhost')

      if (isProduction) {
        // Production (Vercel/VPS) — immediately use fallback
        // WebSocket service runs separately; if not configured, use simulated presence
        fallbackActive = true
        setUsingFallback(true)
        setUsers(SIMULATED_USERS)
        setCursors({
          'sim-br': { ...SIMULATED_CURSORS[0] },
          'sim-sg': { ...SIMULATED_CURSORS[1] },
        })
        console.info('[OmniSite Presence] Production mode — simulated collaborators')
      } else if (isLocalDev) {
        // Local dev — try to connect to the local WebSocket service on port 3003
        try {
          socket = io('http://localhost:3003', {
            path: '/socket.io/',
            transports: ['polling', 'websocket'],
            forceNew: true,
            reconnection: true,
            reconnectionAttempts: 3,
            reconnectionDelay: 1000,
            timeout: 5000,
          })

          const fallbackTimer = setTimeout(() => {
            if (!socket?.connected && !fallbackActive) {
              fallbackActive = true
              setUsingFallback(true)
              setUsers(SIMULATED_USERS)
              setCursors({
                'sim-br': { ...SIMULATED_CURSORS[0] },
                'sim-sg': { ...SIMULATED_CURSORS[1] },
              })
              console.warn('[OmniSite Presence] WebSocket unavailable — using simulated collaborators')
            }
          }, 8000)

          socket.on('connect_error', () => {
            // Will trigger fallback via the timer if it keeps failing
          })

          socket.on('connect', () => {
            clearTimeout(fallbackTimer)
            if (fallbackActive) return
            setIsConnected(true)
            setUsingFallback(false)
            socket?.emit('presence:join', {
              ...CURRENT_USER,
              module: activeModule,
            })
          })

          socket.on('disconnect', () => {
            setIsConnected(false)
          })
        } catch (e) {
          console.warn('[OmniSite Presence] Failed to create socket, using fallback', e)
          fallbackActive = true
          setUsingFallback(true)
          setUsers(SIMULATED_USERS)
          setCursors({
            'sim-br': { ...SIMULATED_CURSORS[0] },
            'sim-sg': { ...SIMULATED_CURSORS[1] },
          })
        }
      }
    }

    // Event handlers for real WebSocket events (only active if connected)
    const onPresenceList = (data: { users: PresenceUser[] }) => {
      if (fallbackActive) return
      setUsers(data.users.filter(u => u.initials !== CURRENT_USER.initials))
    }

    const onPresenceJoin = (user: PresenceUser) => {
      if (fallbackActive || user.initials === CURRENT_USER.initials) return
      setUsers(prev => prev.find(u => u.id === user.id) ? prev : [...prev, user])
    }

    const onPresenceLeave = (data: { id: string }) => {
      if (fallbackActive) return
      setUsers(prev => prev.filter(u => u.id !== data.id))
      setCursors(prev => {
        const next = { ...prev }
        delete next[data.id]
        return next
      })
    }

    const onPresenceModule = (data: { id: string; module: string }) => {
      if (fallbackActive) return
      setUsers(prev => prev.map(u => u.id === data.id ? { ...u, module: data.module } : u))
    }

    const onPresenceCursor = (cursor: RemoteCursor) => {
      if (fallbackActive || cursor.initials === CURRENT_USER.initials) return
      setCursors(prev => ({ ...prev, [cursor.id]: cursor }))
    }

    const onPresenceCursorStop = (data: { id: string }) => {
      if (fallbackActive) return
      setCursors(prev => {
        const next = { ...prev }
        delete next[data.id]
        return next
      })
    }

    if (socket && !fallbackActive) {
      socket.on('presence:list', onPresenceList)
      socket.on('presence:join', onPresenceJoin)
      socket.on('presence:leave', onPresenceLeave)
      socket.on('presence:module', onPresenceModule)
      socket.on('presence:cursor', onPresenceCursor)
      socket.on('presence:cursor-stop', onPresenceCursorStop)
    }

    // Heartbeat
    const heartbeat = setInterval(() => {
      if (socket?.connected) socket.emit('presence:ping')
    }, 20000)

    // Fallback cursor simulation
    fallbackCursorIntervalRef.current = setInterval(() => {
      if (!fallbackActive) return
      setCursors(prev => {
        const next = { ...prev }
        for (const sc of SIMULATED_CURSORS) {
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

    // If fallback is already active from another instance, seed immediately
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
      if (socket && !fallbackActive) {
        socket.off('presence:list', onPresenceList)
        socket.off('presence:join', onPresenceJoin)
        socket.off('presence:leave', onPresenceLeave)
        socket.off('presence:module', onPresenceModule)
        socket.off('presence:cursor', onPresenceCursor)
        socket.off('presence:cursor-stop', onPresenceCursorStop)
      }
      clearInterval(heartbeat)
      if (fallbackCursorIntervalRef.current) clearInterval(fallbackCursorIntervalRef.current)
      if (connectionCount === 0 && socket) {
        socket.disconnect()
        socket = null
      }
    }
  }, [])

  // Notify server when active module changes (only if connected)
  useEffect(() => {
    if (socket?.connected && !fallbackActive) {
      socket.emit('presence:module', { module: activeModule })
    }
  }, [activeModule])

  const sendCursor = useCallback((x: number, y: number, canvas?: string) => {
    if (fallbackActive) return
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
