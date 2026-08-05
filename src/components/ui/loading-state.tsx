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
  Building2,
  FileBarChart,
  Fingerprint,
  Settings,
} from 'lucide-react'
import { useState, useEffect } from 'react'

/**
 * Themed loading animation for OmniSite.
 *
 * Instead of a boring spinner, this shows:
 *   - A blueprint grid background (subtle, fades at edges)
 *   - A module-specific icon with a gentle bob animation
 *   - Cycling status messages that fade in/out
 *   - Skeleton table rows that "build" from top to bottom with a stagger
 *
 * Used by:
 *   - `LoadingState` — shown inside each module while useSyncedState fetches
 *     data from Supabase/localStorage (the main loading screen users see
 *     when switching tabs)
 *   - `ModuleLoadingFallback` — shown by next/dynamic while the JS chunk
 *     loads (~100ms)
 */

// ─── Module themes ───────────────────────────────────────────────────────────

const MODULE_THEMES: Record<string, { icon: typeof HardHat; messages: string[] }> = {
  default: {
    icon: HardHat,
    messages: ['Building workspace…', 'Fetching data…', 'Almost there…'],
  },
  dashboard: {
    icon: Building2,
    messages: ['Loading dashboard…', 'Computing KPIs…', 'Gathering urgent actions…'],
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
  reports: {
    icon: FileBarChart,
    messages: ['Loading report designer…', 'Fetching widgets…', 'Rendering layout…'],
  },
  'time-attendance': {
    icon: Fingerprint,
    messages: ['Loading workers…', 'Computing payroll…', 'Checking attendance…'],
  },
  admin: {
    icon: Settings,
    messages: ['Loading admin panel…', 'Fetching users…', 'Loading master data…'],
  },
  chat: {
    icon: MessageSquare,
    messages: ['Connecting…', 'Loading messages…', 'Syncing presence…'],
  },
}

/**
 * Detect the module from the current URL pathname.
 * Uses a lazy initializer so it runs once on the client (after hydration)
 * without triggering a cascading render via setState-in-effect.
 */
function useModuleTheme() {
  const [theme, setTheme] = useState(() => {
    // SSR-safe: window doesn't exist on the server, so return the default.
    // On the client, the lazy initializer runs once during the first render
    // (after hydration), reading the current pathname.
    if (typeof window === 'undefined') return MODULE_THEMES.default
    const pathname = window.location.pathname
    const segment = pathname.split('/').filter(Boolean)[0] ?? ''
    return MODULE_THEMES[segment] ?? MODULE_THEMES.default
  })
  // Re-check on pathname changes (when navigating between modules without
  // a full page reload). Uses useEffect + popstate + a manual check rather
  // than next/navigation's usePathname (which would add a client-side
  // dependency to this otherwise-isolated UI component).
  useEffect(() => {
    const check = () => {
      const pathname = window.location.pathname
      const segment = pathname.split('/').filter(Boolean)[0] ?? ''
      const next = MODULE_THEMES[segment] ?? MODULE_THEMES.default
      setTheme((prev) => (prev === next ? prev : next))
    }
    check()
    window.addEventListener('popstate', check)
    return () => window.removeEventListener('popstate', check)
  }, [])
  return theme
}

/**
 * Themed loading animation — the main component.
 *
 * Shows a blueprint grid, a module-specific bobbing icon, cycling status
 * messages, and skeleton table rows that "build" from top to bottom.
 */
export function LoadingState({ label }: { label?: string }) {
  const theme = useModuleTheme()
  const Icon = theme.icon

  // Cycle through status messages every 1.8s. If a label prop is passed,
  // use that instead of the cycling messages (backwards compat for modules
  // that pass specific labels like "Loading BOQ items…").
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

        {/* Cycling status message */}
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

/**
 * Skeleton bar — a shimmering placeholder.
 */
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

/**
 * Skeleton rows — shown in place of table data while loading.
 * Renders `count` shimmering placeholder rows.
 * Kept for backwards compat with modules that use <TableSkeleton />.
 */
export function TableSkeleton({ count = 5, cols = 6 }: { count?: number; cols?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex h-9 items-center gap-2 border-b border-[var(--pane-divider)] px-2"
        >
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="bg-secondary/60 h-4 animate-pulse rounded"
              style={{
                width: j === 0 ? '60px' : j === 1 ? 'flex: 1' : `${60 + (j % 3) * 20}px`,
                flex: j === 1 ? 1 : 'none',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
