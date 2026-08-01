'use client'

import { Fragment } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, GripVertical, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useDraggable, useDroppable,
} from '@dnd-kit/core'
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
  /** Column visibility checker. If provided, cells whose key returns false are hidden. */
  isVisible?: (key: string) => boolean
}

/**
 * Recursive BOQ grid renderer (formerly `renderRows` inside BoqModule).
 * Renders each item as a row, and recursively renders children when expanded.
 */
export function BoqGrid(props: BoqGridProps & { depth?: number }) {
  const { items, depth = 0, expanded, selectedId, draggedItem, dragOverHeading } = props
  return (
    <>
      {items.map(item => {
        const isHeading = item.type === 'Heading'
        const isExpanded = expanded.has(item.id)
        const hasChildren = item.children && item.children.length > 0
        const isSelected = item.id === selectedId

        return (
          <Fragment key={item.id}>
            <BoqDndRow
              item={item}
              isHeading={isHeading}
              isDragged={draggedItem?.id === item.id}
              isDragOver={dragOverHeading === item.id && !!draggedItem}
            >
              <BoqRow item={item} depth={depth} isHeading={isHeading} isSelected={isSelected} hasChildren={!!hasChildren} isExpanded={isExpanded} props={props} />
            </BoqDndRow>
            {hasChildren && isExpanded && (
              <BoqGrid {...props} items={item.children!} depth={depth + 1} />
            )}
          </Fragment>
        )
      })}
    </>
  )
}

function BoqRow({ item, depth, isHeading, isSelected, hasChildren, isExpanded, props }: {
  item: BoqItem
  depth: number
  isHeading: boolean
  isSelected: boolean
  hasChildren: boolean
  isExpanded: boolean
  props: BoqGridProps
}) {
  const { selected, editing, onSelectId, onContextMenu, onToggleExpand, onToggleSelect, onUpdateItem, onSetEditing } = props
  // Column visibility — defaults to always-visible if not provided.
  const vis = props.isVisible ?? (() => true)
  return (
    <div
      onClick={() => onSelectId(item.id)}
      onContextMenu={(e) => {
        e.preventDefault()
        onSelectId(item.id)
        onContextMenu({ x: e.clientX, y: e.clientY, itemId: item.id })
      }}
      className={cn(
        'flex items-center h-9 border-b border-[var(--pane-divider)] text-xs cursor-pointer row-hover transition-colors',
        isSelected && 'bg-accent',
        // Heading rows get a subtle background tint so they stand out
        // without needing indentation.
        isHeading && !isSelected && 'bg-secondary/20',
      )}
    >
      {/* Checkbox column — same position for all rows */}
      <div className="w-6 flex-shrink-0 flex items-center justify-center">
        {!isHeading && (
          <Checkbox
            checked={selected.has(item.id)}
            onCheckedChange={(v) => onToggleSelect(item.id, !!v)}
            onClick={e => e.stopPropagation()}
          />
        )}
      </div>
      {/* Expand/collapse — same position for all rows */}
      <div className="w-7 flex-shrink-0 flex items-center justify-center">
        {hasChildren && (
          <button onClick={(e) => { e.stopPropagation(); onToggleExpand(item.id) }} className="p-0.5 hover:bg-accent-foreground/10 rounded">
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
      {/* Code — same position for all rows; hierarchy shown by numbering (1, 1.1, 1.1.1) */}
      {vis('code') && <div className={cn('w-16 flex-shrink-0 px-2 font-mono', isHeading ? 'text-foreground font-semibold' : 'text-muted-foreground')}>{item.code}</div>}
      {/* Description — only the TEXT indents based on depth; the cell boundary stays aligned. */}
      <div
        className={cn('flex-1 min-w-0 truncate px-2', isHeading && 'font-semibold')}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {item.desc}
      </div>
      {/* Qty cell — inline editable for non-heading items */}
      {vis('qty') && <div className="w-24 flex-shrink-0 pr-2">
        {isHeading || item.type === 'Provisional Sum' ? (
          <span className="text-right block text-muted-foreground">{item.qty > 0 ? item.qty.toLocaleString() : '—'}</span>
        ) : (
          <input
            type="number"
            value={item.qty || ''}
            onChange={(e) => onUpdateItem(item.id, 'qty', parseFloat(e.target.value) || 0)}
            onFocus={() => onSetEditing({ id: item.id, field: 'qty' })}
            onBlur={() => onSetEditing(null)}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'w-full h-6 text-right text-xs font-mono px-1.5 rounded border transition-colors bg-transparent',
              editing?.id === item.id && editing.field === 'qty'
                ? 'border-primary bg-background ring-1 ring-primary/30'
                : 'border-transparent hover:border-[var(--pane-divider)] hover:bg-accent/50'
            )}
          />
        )}
      </div>}
      {vis('uom') && <div className="w-14 flex-shrink-0 text-muted-foreground">{item.uom || '—'}</div>}
      {/* Rate cell — inline editable for non-heading items (locked for Provisional Sum) */}
      {vis('rate') && <div className="w-28 flex-shrink-0 pr-2">
        {isHeading ? (
          <span className="text-right block font-mono text-muted-foreground">—</span>
        ) : item.type === 'Provisional Sum' ? (
          <div className="flex items-center justify-end gap-1 text-muted-foreground">
            <Lock className="w-2.5 h-2.5" />
            <span className="font-mono">{item.rate.toLocaleString()}</span>
          </div>
        ) : (
          <input
            type="number"
            value={item.rate || ''}
            onChange={(e) => onUpdateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
            onFocus={() => onSetEditing({ id: item.id, field: 'rate' })}
            onBlur={() => onSetEditing(null)}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'w-full h-6 text-right text-xs font-mono px-1.5 rounded border transition-colors bg-transparent',
              editing?.id === item.id && editing.field === 'rate'
                ? 'border-primary bg-background ring-1 ring-primary/30'
                : 'border-transparent hover:border-[var(--pane-divider)] hover:bg-accent/50'
            )}
          />
        )}
      </div>}
      {/* Amount cell — auto-calculated, live updates */}
      {vis('amount') && <div className="w-28 flex-shrink-0 text-right pr-3 font-mono font-medium tabular-nums">
        {item.qty * item.rate > 0 ? (item.qty * item.rate).toLocaleString() : '—'}
      </div>}
      {vis('type') && <div className="w-24 flex-shrink-0 pr-2">
        {isHeading ? (
          <Badge variant="outline" className="text-[10px]">Heading</Badge>
        ) : (
          <Badge
            variant="secondary"
            className={cn('text-[10px]', item.type === 'Provisional Sum' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300', item.type === 'Daywork' && 'bg-violet-500/15 text-violet-700 dark:text-violet-300')}
          >
            {item.type}
          </Badge>
        )}
      </div>}
      {vis('ra') && <div className="w-10 flex-shrink-0 flex justify-center">
        {!isHeading && item.hasRA && <Lock className="w-3 h-3 text-emerald-500" />}
      </div>}
    </div>
  )
}

export function ContextMenuItem({ icon, label, shortcut, onClick, danger }: {
  icon: React.ReactNode; label: string; shortcut?: string; onClick: () => void; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-accent text-left transition-colors',
        danger && 'text-red-600 hover:bg-red-500/10 dark:text-red-400'
      )}
    >
      <span className={cn('text-muted-foreground', danger && 'text-red-500')}>{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <kbd className="text-[9px] px-1 py-0.5 rounded bg-secondary text-muted-foreground font-mono">{shortcut}</kbd>}
    </button>
  )
}

/**
 * Draggable + Droppable wrapper for BOQ rows.
 * - All rows are draggable (useDraggable) so they can be moved.
 * - Heading rows are also droppable (useDroppable) so items can be reparented under them.
 * - Shows a drag handle (GripVertical) on hover.
 * - Highlights heading rows when another item is dragged over them.
 */
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

  const droppable = useDroppable({
    id: item.id,
    disabled: !isHeading,
  })

  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        if (isHeading) droppable.setNodeRef(node)
      }}
      {...attributes}
      {...listeners}
      className={cn(
        'relative group/dnd',
        isDragging && 'opacity-40',
        isHeading && isDragOver && !isDragged && 'ring-2 ring-primary ring-inset bg-primary/5',
        droppable.isOver && isHeading && 'bg-primary/10',
      )}
    >
      {children}
      {/* Drag handle — appears on hover */}
      <div className={cn(
        'absolute left-0 top-0 bottom-0 w-5 flex items-center justify-center cursor-grab opacity-0 group-hover/dnd:opacity-100 transition-opacity',
        isDragging && 'cursor-grabbing'
      )}>
        <GripVertical className="w-3 h-3 text-muted-foreground/60" />
      </div>
    </div>
  )
}
