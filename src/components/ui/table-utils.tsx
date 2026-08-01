'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Columns3, ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Hook: useColumnVisibility ──────────────────────────────────────────────

/**
 * Manages column visibility state for a table.
 * Persists to localStorage when a `storageKey` is provided.
 *
 * @param allKeys  All column keys in display order.
 * @param hiddenByDefault  Keys that start hidden (optional). Defaults to none.
 * @param storageKey  If provided, visibility is persisted to localStorage.
 */
export function useColumnVisibility(
  allKeys: string[],
  hiddenByDefault: string[] = [],
  storageKey?: string,
) {
  const loadVisible = (): Set<string> => {
    const defaults = new Set(allKeys.filter(k => !hiddenByDefault.includes(k)))
    if (!storageKey || typeof window === 'undefined') return defaults
    try {
      const stored = window.localStorage.getItem(`dt-cols-${storageKey}`)
      if (stored) {
        const hidden = JSON.parse(stored) as string[]
        return new Set(allKeys.filter(k => !hidden.includes(k)))
      }
    } catch { /* ignore */ }
    return defaults
  }

  const [visible, setVisible] = useState<Set<string>>(loadVisible)

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return
    try {
      const hidden = allKeys.filter(k => !visible.has(k))
      window.localStorage.setItem(`dt-cols-${storageKey}`, JSON.stringify(hidden))
    } catch { /* ignore */ }
  }, [visible, storageKey, allKeys])

  const toggle = (key: string) => {
    setVisible(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const isVisible = (key: string) => visible.has(key)

  return { visible, isVisible, toggle }
}

// ─── ColumnToggle button + popover ──────────────────────────────────────────

export interface ColumnDef {
  key: string
  label: string
  hideable?: boolean
}

/**
 * A "Columns" button with a popover that lets users toggle column visibility.
 * Drop this into any table header bar.
 */
export function ColumnToggle({
  columns,
  visible,
  onToggle,
}: {
  columns: ColumnDef[]
  visible: Set<string>
  onToggle: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const hideable = columns.filter(c => c.hideable !== false)
  if (hideable.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-[10px] gap-1"
        onClick={() => setOpen(o => !o)}
        title="Toggle column visibility"
      >
        <Columns3 className="w-3 h-3" />
        <ChevronDown className="w-2.5 h-2.5" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 pane border border-[var(--pane-divider)] rounded-lg shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-[var(--pane-divider)]">
            Toggle columns
          </div>
          <div className="max-h-60 overflow-y-auto">
            {hideable.map(col => {
              const isVisible = visible.has(col.key)
              return (
                <button
                  key={col.key}
                  onClick={() => onToggle(col.key)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-left"
                >
                  <div className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                    isVisible
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-[var(--pane-divider)]'
                  )}>
                    {isVisible && <Check className="w-3 h-3" />}
                  </div>
                  <span className="truncate">{col.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── StickyTableShell — wraps header + body in a single scroll container ────

/**
 * Wraps a table header and body rows in a single `overflow-auto` container
 * so that:
 *  - Vertical scroll: header stays pinned (position: sticky; top: 0)
 *  - Horizontal scroll: header scrolls with body (columns stay aligned)
 *
 * Usage:
 * <StickyTableShell minWidth={900}>
 *   <StickyTableHeader>
 *     {col1 && <div className="w-32 px-2">Col 1</div>}
 *     ...
 *     <ColumnToggle ... />
 *   </StickyTableHeader>
 *   <StickyTableBody>
 *     {rows.map(...)}
 *   </StickyTableBody>
 * </StickyTableShell>
 */
export function StickyTableShell({
  children,
  minWidth,
  className,
}: {
  children: ReactNode
  minWidth?: number
  className?: string
}) {
  return (
    <div className={cn('flex-1 min-h-0 overflow-auto', className)}>
      <div style={minWidth ? { minWidth: `${minWidth}px` } : undefined}>
        {children}
      </div>
    </div>
  )
}

/**
 * A sticky table header row. Place inside <StickyTableShell>.
 * Stays pinned during vertical scroll, moves with horizontal scroll.
 */
export function StickyTableHeader({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn(
      'flex items-center h-8 border-b border-[var(--pane-divider)] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/30 sticky top-0 z-10',
      className,
    )}>
      {children}
    </div>
  )
}

/**
 * Table body wrapper. Just a plain container for rows.
 */
export function StickyTableBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={className}>{children}</div>
}
