'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Columns3, ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Column<T> {
  /** Unique key for this column. Used as React key and for visibility state. */
  key: string
  /** Header label. */
  header: ReactNode
  /** Tailwind width class, e.g. 'w-32', 'flex-1'. Defaults to 'flex-1'. */
  width?: string
  /** Render the cell content for a given row. */
  render: (row: T, index: number) => ReactNode
  /** Whether this column is visible by default. Defaults to true. */
  defaultVisible?: boolean
  /** Whether this column can be hidden by the user. Defaults to true. */
  hideable?: boolean
  /** Text alignment for the header label. */
  align?: 'left' | 'right' | 'center'
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T, index: number) => string
  onRowClick?: (row: T, index: number) => void
  /** Per-row className (e.g. for selected/critical highlighting). */
  rowClassName?: (row: T, index: number) => string | undefined
  /** Per-row data attributes (e.g. for DnD). */
  rowProps?: (row: T, index: number) => Record<string, unknown>
  /** Optional content rendered above the header bar (e.g. filter tabs). */
  headerExtra?: ReactNode
  /** Optional footer row rendered below the body (sticky at bottom). */
  footer?: ReactNode
  /** Minimum width for the table content (enables horizontal scroll). */
  minWidth?: number
  /** Empty-state message when rows.length === 0. */
  emptyMessage?: string
  /** Storage key for persisting column visibility. If omitted, visibility is per-session. */
  persistKey?: string
  /** className on the outer container. */
  className?: string
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  rowClassName,
  rowProps,
  headerExtra,
  footer,
  minWidth,
  emptyMessage = 'No data.',
  persistKey,
  className,
}: DataTableProps<T>) {
  // ─── Column visibility state ──────────────────────────────────────────────
  const loadVisible = (): Set<string> => {
    const defaults = new Set(
      columns.filter(c => c.defaultVisible !== false).map(c => c.key)
    )
    if (!persistKey || typeof window === 'undefined') return defaults
    try {
      const stored = window.localStorage.getItem(`dt-cols-${persistKey}`)
      if (stored) {
        const arr = JSON.parse(stored) as string[]
        // Only keep keys that still exist in the current column set.
        const validKeys = new Set(columns.map(c => c.key))
        const filtered = new Set(arr.filter(k => validKeys.has(k)))
        // Add any new columns that aren't in storage yet.
        for (const c of columns) {
          if (c.defaultVisible !== false && !filtered.has(c.key) && !arr.includes(c.key)) {
            filtered.add(c.key)
          }
        }
        return filtered
      }
    } catch { /* ignore */ }
    return defaults
  }

  const [visibleCols, setVisibleCols] = useState<Set<string>>(loadVisible)
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)

  // Close column menu on outside click.
  useEffect(() => {
    if (!colMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setColMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [colMenuOpen])

  // Persist visibility to localStorage.
  useEffect(() => {
    if (!persistKey || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(`dt-cols-${persistKey}`, JSON.stringify(Array.from(visibleCols)))
    } catch { /* ignore */ }
  }, [visibleCols, persistKey])

  const toggleCol = (key: string) => {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const visibleColumns = columns.filter(c => visibleCols.has(c.key))
  const hideableColumns = columns.filter(c => c.hideable !== false)

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={cn('flex flex-col h-full overflow-hidden', className)}>
      {/* Header bar: column-toggle button + extra content */}
      {headerExtra && (
        <div className="flex-shrink-0">{headerExtra}</div>
      )}

      {/* Single scroll container for BOTH header and body.
          - overflow-auto gives both horizontal and vertical scroll.
          - Header is position:sticky top:0 so it stays pinned during vertical
            scroll but moves horizontally with the body (columns stay aligned). */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div style={minWidth ? { minWidth: `${minWidth}px` } : undefined}>
          {/* Sticky header row */}
          <div className="flex items-center h-8 border-b border-[var(--pane-divider)] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/30 sticky top-0 z-10">
            {visibleColumns.map(col => (
              <div
                key={col.key}
                className={cn(
                  'px-2 flex-shrink-0',
                  col.width || 'flex-1',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                )}
              >
                {col.header}
              </div>
            ))}
          </div>

          {/* Body rows */}
          {rows.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            rows.map((row, i) => (
              <div
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                className={cn(
                  'flex items-center h-9 border-b border-[var(--pane-divider)] text-xs',
                  onRowClick && 'cursor-pointer row-hover hover:bg-accent/50 transition-colors',
                  rowClassName?.(row, i),
                )}
                {...(rowProps?.(row, i) || {})}
              >
                {visibleColumns.map(col => (
                  <div
                    key={col.key}
                    className={cn(
                      'px-2 flex-shrink-0 truncate',
                      col.width || 'flex-1',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                    )}
                  >
                    {col.render(row, i)}
                  </div>
                ))}
              </div>
            ))
          )}

          {/* Optional sticky footer */}
          {footer && (
            <div className="sticky bottom-0 z-10 bg-secondary/30 border-t border-[var(--pane-divider)]">
              {footer}
            </div>
          )}
        </div>
      </div>

      {/* Column toggle popover — positioned at the bottom-right so it doesn't
          overlap with the header content. */}
      {hideableColumns.length > 0 && (
        <div ref={colMenuRef} className="absolute bottom-6 right-4 z-30">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1 shadow-md"
            onClick={() => setColMenuOpen(o => !o)}
          >
            <Columns3 className="w-3.5 h-3.5" />
            Columns
            <ChevronDown className="w-3 h-3" />
          </Button>
          {colMenuOpen && (
            <div className="absolute bottom-full right-0 mb-1 w-44 pane border border-[var(--pane-divider)] rounded-lg shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-[var(--pane-divider)]">
                Toggle columns
              </div>
              <div className="max-h-60 overflow-y-auto">
                {hideableColumns.map(col => {
                  const isVisible = visibleCols.has(col.key)
                  return (
                    <button
                      key={col.key}
                      onClick={() => toggleCol(col.key)}
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
                      <span className="truncate">{typeof col.header === 'string' ? col.header : col.key}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
