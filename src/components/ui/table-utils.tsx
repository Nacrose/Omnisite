'use client'

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Columns3, ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Hook: useColumnVisibility ──────────────────────────────────────────────

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

// ─── Hook: useColumnWidths ──────────────────────────────────────────────────

/**
 * Manages drag-to-resize column widths. Persists to localStorage.
 * Returns a width map { columnKey: pixels } and a drag handler factory.
 */
export function useColumnWidths(
  storageKey: string,
  defaultWidths: Record<string, number> = {},
) {
  const loadWidths = (): Record<string, number> => {
    if (typeof window === 'undefined') return defaultWidths
    try {
      const stored = window.localStorage.getItem(`dt-widths-${storageKey}`)
      if (stored) return { ...defaultWidths, ...JSON.parse(stored) }
    } catch { /* ignore */ }
    return defaultWidths
  }

  const [widths, setWidths] = useState<Record<string, number>>(loadWidths)
  const dragRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(`dt-widths-${storageKey}`, JSON.stringify(widths))
    } catch { /* ignore */ }
  }, [widths, storageKey])

  const startDrag = useCallback((key: string, e: React.MouseEvent, currentWidth: number) => {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { key, startX: e.clientX, startWidth: currentWidth }

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const delta = ev.clientX - dragRef.current.startX
      const newWidth = Math.max(40, dragRef.current.startWidth + delta) // min 40px
      setWidths(prev => ({ ...prev, [dragRef.current!.key]: newWidth }))
    }

    const onUp = () => {
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  return { widths, startDrag }
}

// ─── ColumnToggle button + popover ──────────────────────────────────────────

export interface ColumnDef {
  key: string
  label: string
  hideable?: boolean
}

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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
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

// ─── ColumnResizeHandle — drag to resize a column ───────────────────────────

export function ColumnResizeHandle({
  columnKey,
  currentWidth,
  onDragStart,
}: {
  columnKey: string
  currentWidth: number
  onDragStart: (key: string, e: React.MouseEvent, width: number) => void
}) {
  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group/resizer hover:bg-primary/40 transition-colors z-20"
      onMouseDown={(e) => onDragStart(columnKey, e, currentWidth)}
      title="Drag to resize"
    >
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-4 bg-[var(--pane-divider)] group-hover/resizer:bg-primary/60" />
    </div>
  )
}

// ─── StickyTableShell — wraps header + body in a single scroll container ────

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
    <div className={cn('flex-1 min-h-0 overflow-auto omnisite-table', className)}>
      <div style={minWidth ? { minWidth: `${minWidth}px` } : undefined}>
        {children}
      </div>
    </div>
  )
}

/**
 * A sticky table header row with subtle column separators.
 * Place inside <StickyTableShell>.
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
      'flex items-center h-8 border-b border-[var(--pane-divider)] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/30 sticky top-0 z-10 omnisite-table-header',
      className,
    )}>
      {children}
    </div>
  )
}

/**
 * Table body wrapper with subtle row separators.
 */
export function StickyTableBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('omnisite-table-body', className)}>{children}</div>
}
