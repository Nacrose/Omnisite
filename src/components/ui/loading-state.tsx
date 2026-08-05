'use client'

import { motion } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import {
  SPEED,
  typeIntervalMs,
  cellDelay,
  rowDelay,
  flyInDuration,
  getLayout,
  type SkeletonColumn,
} from './skeleton-config'

// ─── useTypewriter ──────────────────────────────────────────────────────────
//
// rAF-based typewriter — frame-rate independent, interruptible.
// Types out `text` at `typeCps` characters per second. When the component
// unmounts (data loaded), the rAF is cancelled and the skeleton disappears
// immediately — no waiting for the animation to finish.

function useTypewriter(text: string) {
  const [count, setCount] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const startTime = performance.now()
    const interval = typeIntervalMs()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const chars = Math.floor(elapsed / interval)
      setCount(Math.min(chars, text.length))
      if (chars < text.length) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [text])

  return text.slice(0, count)
}

// ─── TypingText ─────────────────────────────────────────────────────────────
//
// Renders text that types out char by char. Shows a blinking cursor
// while typing. When done, the cursor disappears.

function TypingText({ text, className }: { text: string; className?: string }) {
  const displayed = useTypewriter(text)
  const done = displayed.length >= text.length
  return (
    <span className={cn('font-mono', className)}>
      {displayed}
      {!done && <span className="ml-px inline-block w-px animate-pulse bg-current">&nbsp;</span>}
    </span>
  )
}

// ─── ShimmerBar ─────────────────────────────────────────────────────────────

function ShimmerBar({
  width,
  delay,
  className,
}: {
  width: string
  delay: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0.2 }}
      animate={{ opacity: [0.2, 0.5, 0.2] }}
      transition={{ duration: 1.2 / SPEED.multiplier, delay, repeat: Infinity, ease: 'easeInOut' }}
      className={cn('bg-muted/50 h-3 rounded', width, className)}
    />
  )
}

// ─── SkeletonHeader ─────────────────────────────────────────────────────────
//
// A header row where each column name types out with a stagger.

function SkeletonHeader({ columns }: { columns: SkeletonColumn[] }) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--pane-divider)] px-3 py-2">
      {columns.map((col, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: cellDelay(i), duration: flyInDuration() / 1000, ease: 'easeOut' }}
          className={cn(
            'text-muted-foreground truncate text-[10px] font-semibold tracking-wider uppercase',
            col.width,
            col.align === 'right' && 'text-right',
            col.align === 'center' && 'text-center'
          )}
        >
          <TypingText text={col.label} />
        </motion.div>
      ))}
    </div>
  )
}

// ─── SkeletonRow ────────────────────────────────────────────────────────────
//
// A data row with shimmer bars. Slides in from the left with a stagger
// based on row index.

function SkeletonRow({ columns, rowIndex }: { columns: SkeletonColumn[]; rowIndex: number }) {
  const rDelay = rowDelay(rowIndex)
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rDelay / 1000, duration: flyInDuration() / 1000, ease: 'easeOut' }}
      className="flex items-center gap-2 border-b border-[var(--pane-divider)] px-3 py-2"
    >
      {columns.map((col, j) => (
        <div
          key={j}
          className={cn('flex items-center', col.width, col.align === 'right' && 'justify-end')}
        >
          <ShimmerBar
            width="w-full"
            delay={rDelay / 1000 + cellDelay(j) / 1000}
            className={cn(
              col.align === 'right' && 'ml-auto',
              // First column is shorter (like a code/ID), description is longer
              j === 0 && 'w-3/4',
              j === 1 && 'w-full'
            )}
          />
        </div>
      ))}
    </motion.div>
  )
}

// ─── SkeletonTable ──────────────────────────────────────────────────────────

function SkeletonTable({ columns, rows }: { columns: SkeletonColumn[]; rows: number }) {
  return (
    <div className="flex flex-col">
      <SkeletonHeader columns={columns} />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} columns={columns} rowIndex={i + 1} />
      ))}
    </div>
  )
}

// ─── SkeletonInspector ──────────────────────────────────────────────────────
//
// Right pane placeholder — shows a header that types, then shimmer fields.

function SkeletonInspector({ label, fields }: { label: string; fields: number }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--pane-divider)] px-4 py-3">
        <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          <TypingText text={label} />
        </div>
      </div>
      <div className="flex-1 space-y-3 p-4">
        {Array.from({ length: fields }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: rowDelay(i) / 1000 + 0.1, duration: flyInDuration() / 1000 }}
            className="space-y-1.5"
          >
            <ShimmerBar width="w-20" delay={rowDelay(i) / 1000} className="h-2.5" />
            <ShimmerBar width="w-full" delay={rowDelay(i) / 1000 + 0.05} />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ─── SkeletonGantt ──────────────────────────────────────────────────────────
//
// Gantt canvas placeholder — horizontal bars on a week grid.

function SkeletonGantt({ barCount }: { barCount: number }) {
  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Week grid lines */}
      <div className="absolute inset-0 flex">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="flex-1 border-r border-[var(--pane-divider)]/50" />
        ))}
      </div>
      {/* Gantt bars */}
      <div className="relative flex flex-col gap-2 p-3">
        {Array.from({ length: barCount }).map((_, i) => {
          const startWeek = (i * 2) % 12
          const duration = 3 + (i % 4)
          return (
            <motion.div
              key={i}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{
                delay: rowDelay(i) / 1000,
                duration: flyInDuration() / 1000,
                ease: 'easeOut',
              }}
              style={{
                marginLeft: `${(startWeek / 16) * 100}%`,
                width: `${(duration / 16) * 100}%`,
                transformOrigin: 'left',
              }}
              className={cn(
                'h-5 rounded',
                i % 4 === 0 ? 'bg-primary/20' : i % 3 === 0 ? 'bg-amber-500/15' : 'bg-muted/40'
              )}
            >
              <ShimmerBar width="w-full" delay={rowDelay(i) / 1000 + 0.1} className="h-full" />
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ─── SkeletonKPI ────────────────────────────────────────────────────────────

function SkeletonKPI({ cards }: { cards: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
      {cards.map((label, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: cellDelay(i) / 1000, duration: flyInDuration() / 1000 }}
          className="rounded-lg border border-[var(--pane-divider)] p-3"
        >
          <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
            <TypingText text={label} />
          </div>
          <ShimmerBar width="w-20" delay={cellDelay(i) / 1000 + 0.1} className="h-5" />
        </motion.div>
      ))}
    </div>
  )
}

// ─── SkeletonTabs ───────────────────────────────────────────────────────────

function SkeletonTabs({ tabs }: { tabs: string[] }) {
  return (
    <div className="flex gap-1 border-b border-[var(--pane-divider)] px-3 py-2">
      {tabs.map((tab, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: cellDelay(i) / 1000, duration: flyInDuration() / 1000 }}
          className={cn(
            'rounded-md px-3 py-1 text-xs',
            i === 0 ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
          )}
        >
          <TypingText text={tab} />
        </motion.div>
      ))}
    </div>
  )
}

// ─── SkeletonLeftPane ───────────────────────────────────────────────────────

function SkeletonLeftPane({ rows, label }: { rows: number; label: string }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--pane-divider)] px-3 py-2">
        <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          <TypingText text={label} />
        </div>
      </div>
      <div className="flex-1 py-2">
        {Array.from({ length: rows }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: rowDelay(i) / 1000, duration: flyInDuration() / 1000 }}
            className="flex items-center gap-2 px-3 py-1.5"
            style={{ paddingLeft: `${12 + (i % 3) * 12}px` }}
          >
            <ShimmerBar width="w-3" delay={rowDelay(i) / 1000} className="h-3" />
            <ShimmerBar width={`w-${20 + (i % 4) * 8}`} delay={rowDelay(i) / 1000 + 0.05} />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ─── ModuleSkeleton ─────────────────────────────────────────────────────────
//
// Renders the appropriate skeleton layout based on the current URL pathname.
// Auto-detects the module from the route.

function useModuleId(): string {
  const [id, setId] = useState<string>('')
  useEffect(() => {
    const check = () => {
      const segment = window.location.pathname.split('/').filter(Boolean)[0] ?? ''
      setId(segment)
    }
    check()
    window.addEventListener('popstate', check)
    return () => window.removeEventListener('popstate', check)
  }, [])
  return id
}

export function ModuleSkeleton({ label }: { label?: string }) {
  const moduleId = useModuleId()
  const layout = getLayout(moduleId)

  // Always render the full module-specific skeleton — ignore the label
  // prop (modules pass labels like "Loading BOQ items…" for backwards
  // compat, but we want the full animation, not a text fallback).
  // The label is used as a subtitle in the skeleton header if present.

  return (
    <div className="relative h-full overflow-hidden">
      <BlueprintGrid />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.1 }}
        className="relative h-full"
      >
        {renderLayout(layout, label)}
      </motion.div>
    </div>
  )
}

function renderLayout(layout: ReturnType<typeof getLayout>, _label?: string) {
  switch (layout.pattern) {
    case 'kpi+charts':
      return (
        <div className="flex h-full flex-col">
          <SkeletonKPI cards={layout.kpiCards ?? []} />
          <div className="grid flex-1 grid-cols-2 gap-3 p-4">
            <SkeletonBox label="S-Curve" />
            <SkeletonBox label="Cash Flow" />
          </div>
        </div>
      )

    case '3-pane':
      return (
        <div className="flex h-full">
          <div className="hidden w-80 border-r border-[var(--pane-divider)] md:block">
            <SkeletonLeftPane
              rows={layout.leftPane?.rows ?? 6}
              label={layout.leftPane?.label ?? 'Outline'}
            />
          </div>
          <div className="flex flex-1 flex-col border-r border-[var(--pane-divider)]">
            <SkeletonHeader columns={layout.columns} />
            <SkeletonGantt barCount={layout.ganttBars ?? 6} />
          </div>
          <div className="hidden w-96 md:block">
            <SkeletonInspector
              label={layout.rightPane?.label ?? 'Inspector'}
              fields={layout.rightPane?.fields ?? 5}
            />
          </div>
        </div>
      )

    case 'tree+table':
      return (
        <div className="flex h-full">
          <div className="hidden w-72 border-r border-[var(--pane-divider)] md:block">
            <SkeletonLeftPane
              rows={layout.leftPane?.rows ?? 8}
              label={layout.leftPane?.label ?? 'Tree'}
            />
          </div>
          <div className="flex-1 overflow-x-auto">
            <SkeletonTable columns={layout.columns} rows={layout.rows} />
          </div>
        </div>
      )

    case 'table+inspector':
      return (
        <div className="flex h-full">
          <div className="flex-1 overflow-x-auto border-r border-[var(--pane-divider)]">
            <SkeletonTable columns={layout.columns} rows={layout.rows} />
          </div>
          <div className="hidden w-96 md:block">
            <SkeletonInspector
              label={layout.rightPane?.label ?? 'Inspector'}
              fields={layout.rightPane?.fields ?? 5}
            />
          </div>
        </div>
      )

    case 'tabs+table':
      return (
        <div className="flex h-full flex-col">
          {layout.tabs && <SkeletonTabs tabs={layout.tabs} />}
          <div className="flex flex-1">
            <div className="flex-1 overflow-x-auto border-r border-[var(--pane-divider)]">
              <SkeletonTable columns={layout.columns} rows={layout.rows} />
            </div>
            {layout.rightPane && (
              <div className="hidden w-96 md:block">
                <SkeletonInspector
                  label={layout.rightPane.label}
                  fields={layout.rightPane.fields}
                />
              </div>
            )}
          </div>
        </div>
      )

    case 'chat':
      return (
        <div className="flex h-full flex-col">
          <div className="flex-1 space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: i % 2 === 0 ? -12 : 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: rowDelay(i) / 1000, duration: flyInDuration() / 1000 }}
                className={cn('max-w-md space-y-1.5', i % 2 === 0 ? '' : 'ml-auto')}
              >
                <ShimmerBar width="w-20" delay={rowDelay(i) / 1000} className="h-2.5" />
                <ShimmerBar width="w-full" delay={rowDelay(i) / 1000 + 0.05} />
                <ShimmerBar width="w-3/4" delay={rowDelay(i) / 1000 + 0.1} />
              </motion.div>
            ))}
          </div>
          <div className="border-t border-[var(--pane-divider)] p-3">
            <ShimmerBar width="w-full" delay={0.5} className="h-8" />
          </div>
        </div>
      )

    case 'full-table':
    default:
      return (
        <div className="h-full overflow-x-auto">
          <SkeletonTable columns={layout.columns} rows={layout.rows} />
        </div>
      )
  }
}

// ─── SkeletonBox (generic chart placeholder) ────────────────────────────────

function SkeletonBox({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: flyInDuration() / 1000 }}
      className="flex flex-col rounded-lg border border-[var(--pane-divider)] p-3"
    >
      <div className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-wider uppercase">
        <TypingText text={label} />
      </div>
      <div className="flex flex-1 items-end gap-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: cellDelay(i) / 1000 + 0.2, duration: flyInDuration() / 1000 }}
            style={{ height: `${30 + (i % 5) * 15}%`, transformOrigin: 'bottom' }}
            className="bg-muted/40 flex-1 rounded-t"
          />
        ))}
      </div>
    </motion.div>
  )
}

// ─── BlueprintGrid (background) ─────────────────────────────────────────────

function BlueprintGrid() {
  return (
    <div
      className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
      style={{
        backgroundImage: `
          linear-gradient(to right, var(--foreground) 1px, transparent 1px),
          linear-gradient(to bottom, var(--foreground) 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px',
        maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 90%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 90%)',
      }}
    />
  )
}

// ─── Public API ─────────────────────────────────────────────────────────────
//
// LoadingState is the drop-in replacement for the old spinner. It renders
// the full-screen module-specific skeleton. The skeleton is NON-BLOCKING:
// it only shows while the module's `loading` flag is true, and unmounts
// the instant data arrives — no minimum display time, no waiting for the
// animation to finish.

export function LoadingState({ label }: { label?: string }) {
  return <ModuleSkeleton label={label} />
}

/**
 * Skeleton rows — shown in place of table data while loading.
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
