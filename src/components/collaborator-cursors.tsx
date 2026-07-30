'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface Cursor {
  id: string
  name: string
  initials: string
  color: string
  x: number
  y: number
  targetX: number
  targetY: number
  message?: string
}

const INITIAL_CURSORS: Cursor[] = [
  { id: 'c1', name: 'Bikash Rai', initials: 'BR', color: '#3b82f6', x: 30, y: 20, targetX: 30, targetY: 20, message: 'reviewing T-203' },
  { id: 'c2', name: 'Sita Gurung', initials: 'SG', color: '#10b981', x: 60, y: 50, targetX: 60, targetY: 50, message: 'editing DSR' },
  { id: 'c3', name: 'Ram Bahadur', initials: 'RB', color: '#8b5cf6', x: 45, y: 75, targetX: 45, targetY: 75 },
]

/**
 * Simulated live collaborator cursors — represents WebSocket presence.
 * Cursors wander randomly within a bounded area, simulating other users
 * interacting with the same canvas in real-time.
 */
export function CollaboratorCursors() {
  const [cursors, setCursors] = useState<Cursor[]>(INITIAL_CURSORS)

  // Every 3-5 seconds, pick a new random target for each cursor
  useEffect(() => {
    const interval = setInterval(() => {
      setCursors(prev => prev.map(c => ({
        ...c,
        targetX: 15 + Math.random() * 70, // 15%-85% width
        targetY: 10 + Math.random() * 80, // 10%-90% height
      })))
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  // Animate towards target every 50ms
  useEffect(() => {
    const tick = setInterval(() => {
      setCursors(prev => prev.map(c => ({
        ...c,
        x: c.x + (c.targetX - c.x) * 0.08,
        y: c.y + (c.targetY - c.y) * 0.08,
      })))
    }, 50)
    return () => clearInterval(tick)
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {cursors.map(c => (
        <div
          key={c.id}
          className="absolute transition-all duration-100 ease-out"
          style={{ left: `${c.x}%`, top: `${c.y}%` }}
        >
          {/* Cursor pointer SVG */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            style={{ filter: `drop-shadow(0 1px 2px rgba(0,0,0,0.3))` }}
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
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-4 left-3 px-1.5 py-0.5 rounded text-[9px] text-white font-medium whitespace-nowrap shadow-sm flex items-center gap-1"
            style={{ background: c.color }}
          >
            {c.initials} · {c.name.split(' ')[0]}
            {c.message && <span className="opacity-70">— {c.message}</span>}
          </motion.div>
        </div>
      ))}
    </div>
  )
}
