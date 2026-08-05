'use client'

import { Edit3, Copy, FilePlus, FileSpreadsheet, Link2, History, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ContextMenuItem } from './boq-grid'
import type { BoqItem } from './types'
import { exportRa } from './export-ra'
import { duplicateItem, addChildItem, deleteItem, type BoqHandlerCtx } from './handlers'

interface BoqContextMenuProps {
  /** Context menu position + target item ID. */
  menu: { x: number; y: number; itemId: string }
  /** Flattened BOQ items (for looking up the target item). */
  allFlat: BoqItem[]
  /** Handler context (for duplicate, add child, delete). */
  ctx: BoqHandlerCtx
  /** Callback to select an item (for "Edit item"). */
  onSelectId: (id: string) => void
  /** Callback to set the editing state (for "Edit item"). */
  onSetEditing: (id: string, field: 'qty' | 'rate') => void
  /** Callback to open the audit log viewer. */
  onOpenAudit: (recordId: string, label: string) => void
  /** Callback to close the menu. */
  onClose: () => void
}

/**
 * Right-click context menu for BOQ grid rows.
 *
 * Actions: Edit item, Duplicate, Add child item, Export RA (DoR), Link to
 * Schedule (coming soon), View audit log, Delete.
 *
 * Extracted from `BoqModule` so the component body focuses on layout.
 */
export function BoqContextMenu({
  menu,
  allFlat,
  ctx,
  onSelectId,
  onSetEditing,
  onOpenAudit,
  onClose,
}: BoqContextMenuProps) {
  return (
    <div
      className="pane animate-in fade-in zoom-in-95 fixed z-50 w-52 overflow-hidden rounded-lg border border-[var(--pane-divider)] py-1 shadow-2xl duration-100"
      style={{
        left: Math.min(menu.x, window.innerWidth - 220),
        top: Math.min(menu.y, window.innerHeight - 280),
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <ContextMenuItem
        icon={<Edit3 className="h-3.5 w-3.5" />}
        label="Edit item"
        onClick={() => {
          // Inline editing IS implemented (qty/rate inputs in the grid).
          // Selecting this menu item selects the row and focuses the qty
          // input so the user can start typing immediately. Previously
          // this showed a "coming soon" toast even though inline editing
          // was already wired up (audit B3-8).
          onSelectId(menu.itemId)
          onSetEditing(menu.itemId, 'qty')
          onClose()
        }}
      />
      <ContextMenuItem
        icon={<Copy className="h-3.5 w-3.5" />}
        label="Duplicate"
        onClick={() => {
          duplicateItem(menu.itemId, ctx)
          onClose()
        }}
      />
      <ContextMenuItem
        icon={<FilePlus className="h-3.5 w-3.5" />}
        label="Add child item"
        onClick={() => {
          addChildItem(menu.itemId, ctx)
          onClose()
        }}
      />
      <div className="my-1 h-px bg-[var(--pane-divider)]" />
      <ContextMenuItem
        icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
        label="Export RA (DoR)"
        onClick={() => {
          const item = allFlat.find((i) => i.id === menu.itemId)
          // Check hasRA before exporting — without this, the context menu
          // would export a DoR default RA for items that don't have Rate
          // Analysis enabled, producing a misleading CSV (audit B6-4).
          if (item?.hasRA) {
            exportRa(item)
          } else {
            toast.error('This item does not have Rate Analysis enabled.', {
              description: 'Select a BOQ item with the RA lock icon.',
            })
          }
          onClose()
        }}
      />
      <ContextMenuItem
        icon={<Link2 className="h-3.5 w-3.5" />}
        label="Link to Schedule"
        onClick={() => {
          toast.info('Task linking coming soon', {
            description: 'Assign BOQ items to scheduler tasks from the Task Inspector.',
          })
          onClose()
        }}
      />
      <ContextMenuItem
        icon={<History className="h-3.5 w-3.5" />}
        label="View audit log"
        onClick={() => {
          const item = allFlat.find((i) => i.id === menu.itemId)
          onOpenAudit(menu.itemId, item ? `${item.code} · ${item.desc}` : menu.itemId)
          onClose()
        }}
      />
      <div className="my-1 h-px bg-[var(--pane-divider)]" />
      <ContextMenuItem
        icon={<Trash2 className="h-3.5 w-3.5" />}
        label="Delete"
        danger
        onClick={() => {
          deleteItem(menu.itemId, ctx)
          onClose()
        }}
      />
    </div>
  )
}
