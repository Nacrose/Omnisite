'use client'

import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePresence } from '@/lib/use-presence'

/**
 * Live collaborator cursors — powered by the real WebSocket presence service.
 * Renders remote users' cursors on the Gantt canvas. The local user's cursor
 * position is broadcast to other connected clients via sendCursor().
 */
export function CollaboratorCursors() {
  const { cursors, sendCursor, stopCursor, isConnected } = usePresence()
  const containerRef = useRef<HTMLDivElement>(null)
  const lastSentRef = useRef<number>(0)

  // Track local mouse movement and broadcast cursor position.
  // The container has pointer-events:none, so we attach the listener to
  // window and check whether the mouse is within the container's rect.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      // Ignore moves outside the container's bounds.
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        return
      }
      const now = Date.now()
      if (now - lastSentRef.current < 50) return // throttle to 20fps for sending
      lastSentRef.current = now
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      sendCursor(x, y, 'gantt')
    }

    const handleLeave = (e: MouseEvent) => {
      // `mouseout` fires when the pointer leaves any element; only stop the
      // cursor when it leaves the container's bounds (or leaves the window).
      const rect = container.getBoundingClientRect()
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        stopCursor()
      }
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseout', handleLeave)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseout', handleLeave)
    }
  }, [sendCursor, stopCursor])

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none z-30">
      {/* Connection indicator */}
      {!isConnected && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[9px] text-amber-700 dark:text-amber-300">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Simulated presence
        </div>
      )}
      {isConnected && cursors.length === 0 && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[9px] text-emerald-700 dark:text-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Live · move your mouse to share cursor
        </div>
      )}

      {/* Remote cursors */}
      <AnimatePresence>
        {cursors.map(c => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.15 }}
            className="absolute transition-all duration-75 ease-out"
            style={{ left: `${c.x}%`, top: `${c.y}%` }}
          >
            {/* Cursor pointer SVG */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
            >
              <path
                d="M2 2L14 8L8 9L6 14L2 2Z"
                fill={c.color}
                stroke="white"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
            {/* Name label */}
            <div
              className="absolute top-4 left-3 px-1.5 py-0.5 rounded text-[9px] text-white font-medium whitespace-nowrap shadow-sm flex items-center gap-1"
              style={{ background: c.color }}
            >
              {c.initials} · {c.name.split(' ')[0]}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
