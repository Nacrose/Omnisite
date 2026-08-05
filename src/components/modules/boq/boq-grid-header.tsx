'use client'

import {
  ColumnToggle,
  ColumnResizeHandle,
  StickyTableHeader,
  type ColumnDef,
} from '@/components/ui/table-utils'

interface BoqGridHeaderProps {
  /** Column definitions (BOQ_COLS, declared at module scope). */
  columns: ColumnDef[]
  /** Column visibility set (keys of visible columns). */
  visible: Set<string>
  isVisible: (key: string) => boolean
  onToggleCol: (key: string) => void
  /** Column widths (px). */
  widths: Record<string, number>
  onResizeStart: (key: string, e: React.MouseEvent, width: number) => void
}

/**
 * Sticky column header for the BOQ grid.
 *
 * Renders the checkbox, expand, code, description, qty, uom, rate, amount,
 * type, RA columns with resize handles. The ColumnToggle (show/hide columns)
 * lives at the right edge.
 *
 * Extracted from `BoqModule` so the component body focuses on layout.
 */
export function BoqGridHeader({
  columns,
  visible,
  isVisible,
  onToggleCol,
  widths,
  onResizeStart,
}: BoqGridHeaderProps) {
  const w = (key: string, fallback: number) => widths[key] || fallback
  return (
    <StickyTableHeader>
      <div className="w-6" />
      <div className="w-7" />
      {isVisible('code') && (
        <div className="relative px-2" style={{ width: `${w('code', 64)}px` }}>
          Code
          <ColumnResizeHandle
            columnKey="code"
            currentWidth={w('code', 64)}
            onDragStart={onResizeStart}
          />
        </div>
      )}
      <div className="flex-1 px-2">Description</div>
      {isVisible('qty') && (
        <div className="relative px-2 text-right" style={{ width: `${w('qty', 96)}px` }}>
          Qty
          <ColumnResizeHandle
            columnKey="qty"
            currentWidth={w('qty', 96)}
            onDragStart={onResizeStart}
          />
        </div>
      )}
      {isVisible('uom') && (
        <div className="relative px-2" style={{ width: `${w('uom', 56)}px` }}>
          UOM
          <ColumnResizeHandle
            columnKey="uom"
            currentWidth={w('uom', 56)}
            onDragStart={onResizeStart}
          />
        </div>
      )}
      {isVisible('rate') && (
        <div className="relative px-2 text-right" style={{ width: `${w('rate', 112)}px` }}>
          Rate (NPR)
          <ColumnResizeHandle
            columnKey="rate"
            currentWidth={w('rate', 112)}
            onDragStart={onResizeStart}
          />
        </div>
      )}
      {isVisible('amount') && (
        <div className="relative px-2 text-right" style={{ width: `${w('amount', 112)}px` }}>
          Amount (NPR)
          <ColumnResizeHandle
            columnKey="amount"
            currentWidth={w('amount', 112)}
            onDragStart={onResizeStart}
          />
        </div>
      )}
      {isVisible('type') && (
        <div className="relative px-2" style={{ width: `${w('type', 96)}px` }}>
          Type
          <ColumnResizeHandle
            columnKey="type"
            currentWidth={w('type', 96)}
            onDragStart={onResizeStart}
          />
        </div>
      )}
      {isVisible('ra') && (
        <div className="relative text-center" style={{ width: `${w('ra', 40)}px` }}>
          RA
          <ColumnResizeHandle
            columnKey="ra"
            currentWidth={w('ra', 40)}
            onDragStart={onResizeStart}
          />
        </div>
      )}
      <div className="flex-shrink-0 pr-2">
        <ColumnToggle columns={columns} visible={visible} onToggle={onToggleCol} />
      </div>
    </StickyTableHeader>
  )
}
