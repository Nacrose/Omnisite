'use client'

import { Fragment, useRef, useMemo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, GripVertical, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { BoqItem } from './types'

export interface BoqEditingState {
  id: string
  field: 'qty' | 'rate'
}

export interface BoqGridProps {
  items: BoqItem[]
  expanded: Set<string>
  selectedId: string
  selected: Set<string>
  editing: BoqEditingState | null
  draggedItem: BoqItem | null
  dragOverHeading: string | null
  onSelectId: (id: string) => void
  onContextMenu: (e: { x: number; y: number; itemId: string }) => void
  onToggleExpand: (id: string) => void
  onToggleSelect: (id: string, value: boolean) => void
  onUpdateItem: (id: string, field: 'qty' | 'rate', value: number) => void
  onSetEditing: (e: BoqEditingState | null) => void
  isVisible?: (key: string) => boolean
  colWidths?: Record<string, number>
}

// ─── Flatten the tree into a visible-rows list (respecting expand state) ────

interface FlatRow {
  item: BoqItem
  depth: number
  hasChildren: boolean
  isExpanded: boolean
  isHeading: boolean
  isSelected: boolean
}

function flattenVisible(
  items: BoqItem[],
  depth: number,
  expanded: Set<string>,
  selectedId: string
): FlatRow[] {
  const out: FlatRow[] = []
  for (const item of items) {
    const hasChildren = !!(item.children && item.children.length > 0)
    const isExpanded = expanded.has(item.id)
    out.push({
      item,
      depth,
      hasChildren,
      isExpanded,
      isHeading: item.type === 'Heading',
      isSelected: item.id === selectedId,
    })
    if (hasChildren && isExpanded) {
      out.push(...flattenVisible(item.children!, depth + 1, expanded, selectedId))
    }
  }
  return out
}

// ─── Virtualized BOQ grid ───────────────────────────────────────────────────

const ROW_HEIGHT = 36 // h-9 = 36px

export function BoqGrid(props: BoqGridProps) {
  const { items, expanded, selectedId } = props
  const scrollRef = useRef<HTMLDivElement>(null)

  const flatRows = useMemo(
    () => flattenVisible(items, 0, expanded, selectedId),
    [items, expanded, selectedId]
  )

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
      <div
        style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = flatRows[virtualRow.index]
          return (
            <div
              key={row.item.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <BoqDndRow
                item={row.item}
                isHeading={row.isHeading}
                isDragged={props.draggedItem?.id === row.item.id}
                isDragOver={props.dragOverHeading === row.item.id && !!props.draggedItem}
              >
                <BoqRow
                  item={row.item}
                  depth={row.depth}
                  isHeading={row.isHeading}
                  isSelected={row.isSelected}
                  hasChildren={row.hasChildren}
                  isExpanded={row.isExpanded}
                  props={props}
                />
              </BoqDndRow>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Row components (unchanged from original) ───────────────────────────────

function BoqRow({
  item,
  depth,
  isHeading,
  isSelected,
  hasChildren,
  isExpanded,
  props,
}: {
  item: BoqItem
  depth: number
  isHeading: boolean
  isSelected: boolean
  hasChildren: boolean
  isExpanded: boolean
  props: BoqGridProps
}) {
  const {
    selected,
    editing,
    onSelectId,
    onContextMenu,
    onToggleExpand,
    onToggleSelect,
    onUpdateItem,
    onSetEditing,
  } = props
  const vis = props.isVisible ?? (() => true)
  const cw = props.colWidths || {}

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Mirror onClick behaviour for keyboard users. Stop propagation so the
    // toggle/checkbox inputs inside the row don't double-fire.
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      onSelectId(item.id)
    }
  }

  return (
    <div
      role="row"
      tabIndex={0}
      aria-selected={isSelected}
      onClick={() => onSelectId(item.id)}
      onKeyDown={handleKeyDown}
      onContextMenu={(e) => {
        e.preventDefault()
        onSelectId(item.id)
        onContextMenu({ x: e.clientX, y: e.clientY, itemId: item.id })
      }}
      className={cn(
        'row-hover focus-visible:ring-primary flex h-9 cursor-pointer items-center border-b border-[var(--pane-divider)] text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none',
        isSelected && 'bg-accent',
        isHeading && !isSelected && 'bg-secondary/20'
      )}
    >
      <div className="flex w-6 flex-shrink-0 items-center justify-center">
        {!isHeading && (
          <Checkbox
            checked={selected.has(item.id)}
            onCheckedChange={(v) => onToggleSelect(item.id, !!v)}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>
      <div className="flex w-7 flex-shrink-0 items-center justify-center">
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand(item.id)
            }}
            className="hover:bg-accent-foreground/10 rounded p-0.5"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
      {vis('code') && (
        <div
          className={cn(
            'flex-shrink-0 px-2 font-mono',
            !cw.code && 'w-16',
            isHeading ? 'text-foreground font-semibold' : 'text-muted-foreground'
          )}
          style={cw.code ? { width: `${cw.code}px` } : undefined}
        >
          {item.code}
        </div>
      )}
      <div
        className={cn('min-w-0 flex-1 truncate px-2', isHeading && 'font-semibold')}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {item.desc}
      </div>
      {vis('qty') && (
        <div
          className={cn('flex-shrink-0 pr-2', !cw.qty && 'w-24')}
          style={cw.qty ? { width: `${cw.qty}px` } : undefined}
        >
          {isHeading || item.type === 'Provisional Sum' ? (
            <span className="text-muted-foreground block text-right">
              {item.qty > 0 ? item.qty.toLocaleString() : '—'}
            </span>
          ) : (
            <input
              type="number"
              value={item.qty ?? ''}
              onChange={(e) => onUpdateItem(item.id, 'qty', parseFloat(e.target.value) || 0)}
              onFocus={() => onSetEditing({ id: item.id, field: 'qty' })}
              onBlur={() => onSetEditing(null)}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'h-6 w-full rounded border bg-transparent px-1.5 text-right font-mono text-xs transition-colors',
                editing?.id === item.id && editing.field === 'qty'
                  ? 'border-primary bg-background ring-primary/30 ring-1'
                  : 'hover:bg-accent/50 border-transparent hover:border-[var(--pane-divider)]'
              )}
            />
          )}
        </div>
      )}
      {vis('uom') && (
        <div
          className={cn('text-muted-foreground flex-shrink-0', !cw.uom && 'w-14')}
          style={cw.uom ? { width: `${cw.uom}px` } : undefined}
        >
          {item.uom || '—'}
        </div>
      )}
      {vis('rate') && (
        <div
          className={cn('flex-shrink-0 pr-2', !cw.rate && 'w-28')}
          style={cw.rate ? { width: `${cw.rate}px` } : undefined}
        >
          {isHeading ? (
            <span className="text-muted-foreground block text-right font-mono">—</span>
          ) : item.type === 'Provisional Sum' ? (
            <div className="text-muted-foreground flex items-center justify-end gap-1">
              <Lock className="h-2.5 w-2.5" />
              <span className="font-mono">{item.rate.toLocaleString()}</span>
            </div>
          ) : (
            <input
              type="number"
              value={item.rate ?? ''}
              onChange={(e) => onUpdateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
              onFocus={() => onSetEditing({ id: item.id, field: 'rate' })}
              onBlur={() => onSetEditing(null)}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'h-6 w-full rounded border bg-transparent px-1.5 text-right font-mono text-xs transition-colors',
                editing?.id === item.id && editing.field === 'rate'
                  ? 'border-primary bg-background ring-primary/30 ring-1'
                  : 'hover:bg-accent/50 border-transparent hover:border-[var(--pane-divider)]'
              )}
            />
          )}
        </div>
      )}
      {vis('amount') && (
        <div
          className={cn(
            'flex-shrink-0 pr-3 text-right font-mono font-medium tabular-nums',
            !cw.amount && 'w-28'
          )}
          style={cw.amount ? { width: `${cw.amount}px` } : undefined}
        >
          {/* Amount cell — distinguishes "explicitly zero" (qty or rate is 0)
              from "missing" (NaN / undefined, which is theoretical here since
              qty/rate are typed `number`). Showing 0 as `0` (rather than `—`)
              makes a freshly added zero-qty item look intentional rather than
              unloaded. */}
          {(() => {
            const amount = item.qty * item.rate
            if (amount == null || Number.isNaN(amount)) return '—'
            return amount === 0 ? '0' : amount.toLocaleString()
          })()}
        </div>
      )}
      {vis('type') && (
        <div
          className={cn('flex-shrink-0 pr-2', !cw.type && 'w-24')}
          style={cw.type ? { width: `${cw.type}px` } : undefined}
        >
          {isHeading ? (
            <Badge variant="outline" className="text-[10px]">
              Heading
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className={cn(
                'text-[10px]',
                item.type === 'Provisional Sum' &&
                  'bg-amber-500/15 text-amber-700 dark:text-amber-300',
                item.type === 'Daywork' && 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
              )}
            >
              {item.type}
            </Badge>
          )}
        </div>
      )}
      {vis('ra') && (
        <div
          className={cn('flex flex-shrink-0 justify-center', !cw.ra && 'w-10')}
          style={cw.ra ? { width: `${cw.ra}px` } : undefined}
        >
          {!isHeading && item.hasRA && <Lock className="h-3 w-3 text-emerald-500" />}
        </div>
      )}
    </div>
  )
}

export function ContextMenuItem({
  icon,
  label,
  shortcut,
  onClick,
  danger,
}: {
  icon: React.ReactNode
  label: string
  shortcut?: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'hover:bg-accent flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors',
        danger && 'text-red-600 hover:bg-red-500/10 dark:text-red-400'
      )}
    >
      <span className={cn('text-muted-foreground', danger && 'text-red-500')}>{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <kbd className="bg-secondary text-muted-foreground rounded px-1 py-0.5 font-mono text-[9px]">
          {shortcut}
        </kbd>
      )}
    </button>
  )
}

export function BoqDndRow({
  item,
  isHeading,
  isDragged,
  isDragOver,
  children,
}: {
  item: BoqItem
  isHeading: boolean
  isDragged: boolean
  isDragOver: boolean
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    disabled: false,
  })
  const droppable = useDroppable({ id: item.id, disabled: !isHeading })
  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        if (isHeading) droppable.setNodeRef(node)
      }}
      {...attributes}
      {...listeners}
      className={cn(
        'group/dnd relative',
        isDragging && 'opacity-40',
        isHeading && isDragOver && !isDragged && 'ring-primary bg-primary/5 ring-2 ring-inset',
        droppable.isOver && isHeading && 'bg-primary/10'
      )}
    >
      {children}
      <div
        className={cn(
          'absolute top-0 bottom-0 left-0 flex w-5 cursor-grab items-center justify-center opacity-0 transition-opacity group-hover/dnd:opacity-100',
          isDragging && 'cursor-grabbing'
        )}
      >
        <GripVertical className="text-muted-foreground/60 h-3 w-3" />
      </div>
    </div>
  )
}
