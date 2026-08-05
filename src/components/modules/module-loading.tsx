'use client'

import { motion } from 'framer-motion'
import {
  HardHat,
  ClipboardList,
  Calculator,
  GanttChart,
  Package,
  Truck,
  FileStack,
  Mail,
  ShieldCheck,
  Users,
  MessageSquare,
} from 'lucide-react'
import { useState, useEffect } from 'react'

/**
 * Per-module loading fallback shown by `next/dynamic` while the module
 * chunk is being fetched.
 *
 * Instead of a boring spinner, this shows a construction-themed animation:
 *   - A hard-hat icon with a gentle bob animation
 *   - Skeleton table rows that "build" from top to bottom (like a table
 *     being constructed row by row)
 *   - A cycling status message that types out
 *
 * The animation is purely cosmetic — it doesn't indicate real progress
 * (that would require module-level loading state). It just makes the
 * ~100ms chunk-fetch delay feel intentional and polished rather than
 * like the app is thinking.
 */

// ─── Module-specific icons + messages ───────────────────────────────────────
//
// Each module gets its own icon and a set of status messages that cycle
// through the "typing" animation. This makes the loading feel contextual
// rather than generic.

const MODULE_THEMES: Record<string, { icon: typeof HardHat; messages: string[] }> = {
  default: {
    icon: HardHat,
    messages: ['Building workspace…', 'Fetching data…', 'Almost there…'],
  },
  boq: {
    icon: Calculator,
    messages: ['Loading BOQ items…', 'Computing rate analysis…', 'Summing contract totals…'],
  },
  scheduler: {
    icon: GanttChart,
    messages: ['Loading tasks…', 'Computing critical path…', 'Leveling resources…'],
  },
  'daily-ops': {
    icon: ClipboardList,
    messages: ['Loading DSR entries…', 'Checking RFIs…', 'Syncing site data…'],
  },
  procurement: {
    icon: Package,
    messages: ['Loading requisitions…', 'Checking PO approvals…', 'Matching GRNs…'],
  },
  equipment: {
    icon: Truck,
    messages: ['Loading fleet…', 'Checking fuel logs…', 'Counting hours…'],
  },
  financials: {
    icon: Calculator,
    messages: ['Loading CBS…', 'Rolling up costs…', 'Computing EAC…'],
  },
  vendors: {
    icon: Users,
    messages: ['Loading vendors…', 'Checking compliance…', 'Reconciling materials…'],
  },
  drawings: {
    icon: FileStack,
    messages: ['Loading drawing register…', 'Fetching revisions…', 'Opening annotations…'],
  },
  correspondence: {
    icon: Mail,
    messages: ['Loading letters…', 'Checking overdue replies…', 'Sorting by date…'],
  },
  qs: {
    icon: ShieldCheck,
    messages: ['Loading NCRs…', 'Checking billing holds…', 'Reviewing ITRs…'],
  },
  chat: {
    icon: MessageSquare,
    messages: ['Connecting…', 'Loading messages…', 'Syncing presence…'],
  },
}

/**
 * Detect the module from the current URL pathname. Each module lives at
 * /<module-id> (e.g. /boq, /scheduler).
 */
function useModuleTheme() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
  const segment = pathname.split('/').filter(Boolean)[0] ?? ''
  return MODULE_THEMES[segment] ?? MODULE_THEMES.default
}

export function ModuleLoadingFallback({ label }: { label?: string }) {
  const theme = useModuleTheme()
  const Icon = theme.icon

  // Cycle through status messages every 1.8s. If a label prop is passed,
  // use that instead of the cycling messages.
  const messages = label ? [label] : theme.messages
  const [msgIndex, setMsgIndex] = useState(0)
  useEffect(() => {
    if (messages.length <= 1) return
    const t = setInterval(() => {
      setMsgIndex((i) => (i + 1) % messages.length)
    }, 1800)
    return () => clearInterval(t)
  }, [messages.length])
  const currentMessage = messages[msgIndex] ?? messages[0]

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden p-6">
      {/* Blueprint grid background — subtle, fades at edges */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--foreground) 1px, transparent 1px),
            linear-gradient(to bottom, var(--foreground) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)',
        }}
      />

      <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
        {/* Icon with bob animation */}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="bg-primary/10 flex h-14 w-14 items-center justify-center rounded-2xl"
        >
          <Icon className="text-primary h-7 w-7" strokeWidth={1.8} />
        </motion.div>

        {/* Typing status message */}
        <motion.div
          key={currentMessage}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="text-muted-foreground flex h-4 items-center text-xs font-medium tracking-wide"
        >
          {currentMessage}
          <span className="ml-0.5 inline-block w-2 animate-pulse">▎</span>
        </motion.div>

        {/* Skeleton table rows — "building" from top to bottom */}
        <div className="bg-secondary/20 w-full overflow-hidden rounded-lg border border-[var(--pane-divider)]">
          {/* Header row */}
          <div className="border-b border-[var(--pane-divider)] px-3 py-2">
            <div className="flex gap-2">
              <SkeletonBar width="w-12" delay={0} />
              <SkeletonBar width="flex-1" delay={0.1} />
              <SkeletonBar width="w-16" delay={0.2} />
            </div>
          </div>
          {/* Data rows — each slides in from the left with a stagger */}
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.12, duration: 0.3, ease: 'easeOut' }}
              className="border-b border-[var(--pane-divider)] px-3 py-2 last:border-b-0"
            >
              <div className="flex gap-2">
                <SkeletonBar width="w-10" delay={0.2 + i * 0.12} />
                <SkeletonBar width="flex-1" delay={0.25 + i * 0.12} />
                <SkeletonBar width="w-14" delay={0.3 + i * 0.12} />
                <SkeletonBar width="w-12" delay={0.35 + i * 0.12} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton bar ───────────────────────────────────────────────────────────
//
// A shimmering placeholder bar. The `delay` staggers the shimmer so the
// rows feel like they're being "filled in" sequentially.

function SkeletonBar({ width, delay }: { width: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0.3 }}
      animate={{ opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 1.4, delay, repeat: Infinity, ease: 'easeInOut' }}
      className={`bg-muted/60 h-3 rounded ${width}`}
    />
  )
}

export default ModuleLoadingFallback
