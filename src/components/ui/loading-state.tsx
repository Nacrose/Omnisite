'use client'

import { motion } from 'framer-motion'
import { useEffect, useState, useRef, useMemo } from 'react'
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

// ─── Matrix Rain ────────────────────────────────────────────────────────────
//
// Full-screen canvas of falling characters (Matrix-style) using the site's
// theme colors (blue/violet) instead of the classic green. Layered behind
// the module-specific skeleton structure for depth.
//
// Characters are a mix of construction symbols + katakana + digits:
//   ▓░│┤┐└─┌├┬┴┼═║╒╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡╢╣╤╥╦╧╨╩╪╫╬
//   0123456789
//   アイウエオカキクケコサシスセソタチツテトナニヌネノ
//   ABCDEFGHIJKLMNOPQRSTUVWXYZ
//   ╬╬╬ BOQ RF GRN RA NPR CBS CPM FIDIC ╬╬╬

const MATRIX_CHARS =
  '▓░│┤┐└─┌├┬┴┼═║╒╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡╢╣╤╥╦╧╨╩╪╫╬0123456789アイウエオカキクケコサシスセソタチツテトナニヌネノABCDEFGHIJKLMNOPQRSTUVWXYZ'

function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = (canvas.width = canvas.offsetWidth)
    let height = (canvas.height = canvas.offsetHeight)
    const fontSize = 14
    let columns = Math.floor(width / fontSize)
    let drops: number[] = Array(columns)
      .fill(0)
      .map(() => Math.random() * -height)

    const handleResize = () => {
      width = canvas.width = canvas.offsetWidth
      height = canvas.height = canvas.offsetHeight
      columns = Math.floor(width / fontSize)
      drops = Array(columns)
        .fill(0)
        .map(() => Math.random() * -height)
    }
    window.addEventListener('resize', handleResize)

    // Read theme colors from CSS variables
    const style = getComputedStyle(document.documentElement)
    const primaryColor = style.getPropertyValue('--primary').trim() || '#3b82f6'
    const fgColor = style.getPropertyValue('--foreground').trim() || '#1e293b'

    let frame = 0
    let rafId: number

    const draw = () => {
      rafId = requestAnimationFrame(draw)
      frame++

      // Trail effect — semi-transparent black fill creates the fading trail
      ctx.fillStyle = 'rgba(0, 0, 0, 0.04)'
      ctx.fillRect(0, 0, width, height)

      ctx.font = `${fontSize}px monospace`

      for (let i = 0; i < drops.length; i++) {
        const char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]
        const x = i * fontSize
        const y = drops[i]

        // Head character — bright (primary color)
        ctx.fillStyle = primaryColor
        ctx.fillText(char, x, y)

        // Trail characters — dimmer (foreground with low opacity)
        ctx.fillStyle = fgColor
        ctx.globalAlpha = 0.08
        ctx.fillText(char, x, y - fontSize)
        ctx.fillText(char, x, y - fontSize * 2)
        ctx.globalAlpha = 1

        if (y > height && Math.random() > 0.975) {
          drops[i] = 0
        }
        drops[i] += fontSize * 0.6
      }
    }
    draw()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ opacity: 0.12 }} />
  )
}

// ─── useTypewriter ──────────────────────────────────────────────────────────

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
      animate={{ opacity: [0.2, 0.6, 0.2] }}
      transition={{ duration: 1.2 / SPEED.multiplier, delay, repeat: Infinity, ease: 'easeInOut' }}
      className={cn('bg-primary/20 h-3 rounded', width, className)}
    />
  )
}

// ─── SkeletonHeader ─────────────────────────────────────────────────────────

function SkeletonHeader({ columns }: { columns: SkeletonColumn[] }) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--pane-divider)] px-3 py-2 backdrop-blur-sm">
      {columns.map((col, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: cellDelay(i) / 1000,
            duration: flyInDuration() / 1000,
            ease: 'easeOut',
          }}
          className={cn(
            'text-primary truncate text-[10px] font-semibold tracking-wider uppercase',
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

function SkeletonRow({ columns, rowIndex }: { columns: SkeletonColumn[]; rowIndex: number }) {
  const rDelay = rowDelay(rowIndex)
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rDelay / 1000, duration: flyInDuration() / 1000, ease: 'easeOut' }}
      className="flex items-center gap-2 border-b border-[var(--pane-divider)] px-3 py-2 backdrop-blur-sm"
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

function SkeletonInspector({ label, fields }: { label: string; fields: number }) {
  return (
    <div className="flex h-full flex-col backdrop-blur-sm">
      <div className="border-b border-[var(--pane-divider)] px-4 py-3">
        <div className="text-primary text-xs font-semibold tracking-wider uppercase">
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

function SkeletonGantt({ barCount }: { barCount: number }) {
  return (
    <div className="relative flex-1 overflow-hidden backdrop-blur-sm">
      <div className="absolute inset-0 flex">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="flex-1 border-r border-[var(--pane-divider)]/50" />
        ))}
      </div>
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
                i % 4 === 0 ? 'bg-primary/30' : i % 3 === 0 ? 'bg-amber-500/20' : 'bg-muted/40'
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
          className="bg-background/60 rounded-lg border border-[var(--pane-divider)] p-3 backdrop-blur-sm"
        >
          <div className="text-primary mb-2 text-[10px] font-semibold tracking-wider uppercase">
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
    <div className="flex gap-1 border-b border-[var(--pane-divider)] px-3 py-2 backdrop-blur-sm">
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
    <div className="flex h-full flex-col backdrop-blur-sm">
      <div className="border-b border-[var(--pane-divider)] px-3 py-2">
        <div className="text-primary text-xs font-semibold tracking-wider uppercase">
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

  return (
    <div className="relative h-full overflow-hidden">
      {/* Layer 1: Matrix rain background (site theme colors) */}
      <MatrixRain />
      {/* Layer 2: Module-specific skeleton structure */}
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
          <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 md:grid-cols-2">
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
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: i % 2 === 0 ? -12 : 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: rowDelay(i) / 1000, duration: flyInDuration() / 1000 }}
                className={cn(
                  'bg-background/60 max-w-md space-y-1.5 rounded-lg border border-[var(--pane-divider)] p-3 backdrop-blur-sm',
                  i % 2 === 0 ? '' : 'ml-auto'
                )}
              >
                <ShimmerBar width="w-20" delay={rowDelay(i) / 1000} className="h-2.5" />
                <ShimmerBar width="w-full" delay={rowDelay(i) / 1000 + 0.05} />
                <ShimmerBar width="w-3/4" delay={rowDelay(i) / 1000 + 0.1} />
              </motion.div>
            ))}
          </div>
          <div className="border-t border-[var(--pane-divider)] p-3 backdrop-blur-sm">
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

// ─── SkeletonBox ────────────────────────────────────────────────────────────

function SkeletonBox({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: flyInDuration() / 1000 }}
      className="bg-background/60 flex flex-col rounded-lg border border-[var(--pane-divider)] p-3 backdrop-blur-sm"
    >
      <div className="text-primary mb-3 text-[10px] font-semibold tracking-wider uppercase">
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
            className="bg-primary/20 flex-1 rounded-t"
          />
        ))}
      </div>
    </motion.div>
  )
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function LoadingState({ label }: { label?: string }) {
  return <ModuleSkeleton label={label} />
}

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
