import { toast } from 'sonner'
import type React from 'react'
import { produce } from 'immer'
import { undoableToast } from '@/components/ui/confirm-dialog'
import { BOQ_DATA, type BoqItem } from './types'
import {
  flattenTree,
  rebuildTreeFromRows,
  findItemAndParent,
  updateLevels,
} from '@/lib/tree-utils'

// Deep-clone helper using immer (replaces deepClone())
const deepClone = <T>(obj: T): T => produce(obj, () => {})

// ─── BOQ-specific tree helpers ────────────────────────────────────────────
//
// These wrap the generic tree-utils functions for the BoqItem shape:
// id field is `id`, parent field is `parentId`, children field is `children`.
// They also handle the snake_case → camelCase field normalization that the
// DB layer (useSyncedState) may return.

function normalizeBoqRow(row: Record<string, unknown>): BoqItem {
  return {
    id: row.id as string,
    code: row.code as string,
    desc: (row.desc || row.description) as string,
    type: (row.type as BoqItem['type']) || 'Priced',
    qty: Number(row.qty) || 0,
    uom: (row.uom as string) || '',
    rate: Number(row.rate) || 0,
    hasRA: Boolean(row.hasRA ?? row.has_ra),
    level: Number(row.level) || 0,
  }
}

/**
 * Rebuild a BoqItem tree from flat rows. Rows may be DB rows (with snake_case
 * field names like `parent_id`, `has_ra`) or already-normalized BoqItems.
 *
 * Falls back to a deep clone of BOQ_DATA when rows is empty or yields no
 * roots, so the UI always has something to render.
 */
export function rebuildBoqTree(rows: BoqItem[] | null | undefined): BoqItem[] {
  if (!rows || rows.length === 0) return deepClone(BOQ_DATA)
  const hasChildren = rows.some((r) => Array.isArray((r as BoqItem).children) && (r as BoqItem).children!.length > 0)
  if (hasChildren) return rows
  // Normalize DB column names → app fields, then rebuild the tree using the
  // shared tree-utils helper.
  const normalized = (rows as unknown as Record<string, unknown>[]).map(normalizeBoqRow) as unknown as Record<string, any>[]
  const tree = rebuildTreeFromRows(normalized, 'id', 'parentId')
  return tree.length > 0 ? (tree as unknown as BoqItem[]) : deepClone(BOQ_DATA)
}

/**
 * Flatten a BoqItem tree for DB storage. Strips `children` and sets
 * `parentId` on each row.
 */
export function flattenBoqTree(items: BoqItem[], parentId: string | null = null): BoqItem[] {
  return flattenTree(items as unknown as Record<string, any>[], parentId) as unknown as BoqItem[]
}

// ─── Handler context ──────────────────────────────────────────────────────
//
// Plain functions (not hooks) that operate on the BOQ tree. Each takes a
// `BoqHandlerCtx` capturing the state + setters the component owns, so the
// functions themselves are pure with respect to React and can be extracted
// out of the component body.

export interface BoqHandlerCtx {
  /** Current tree (post-rebuild from boqRows). */
  boqData: BoqItem[]
  /** Flattened view of boqData (used for lookups by id). */
  allFlat: BoqItem[]
  setBoqRows: React.Dispatch<React.SetStateAction<BoqItem[]>>
  setUndoStack: React.Dispatch<React.SetStateAction<BoqItem[][]>>
  setRedoStack: React.Dispatch<React.SetStateAction<BoqItem[][]>>
  setExpandedArr: React.Dispatch<React.SetStateAction<string[]>>
  setSelectedId: (id: string) => void
  undoStack: BoqItem[][]
  redoStack: BoqItem[][]
  /** Ref to the latest `undo` closure — used by undoableToast to invoke the
   *  current undo (not the stale one captured when the toast was shown). */
  undoRef: React.MutableRefObject<() => void>
}

/**
 * Commit a new boqData state, pushing the current state to the undo stack
 * and clearing the redo stack.
 *
 * Uses a functional update on setBoqRows so the latest committed state is
 * used (avoids stale-closure bugs when multiple edits land in the same
 * React batch). Pushes to undoStack and clears redoStack via functional
 * updates so the side effects don't run inside the setBoqRows updater
 * (which would double-fire under StrictMode).
 */
export function commitBoqData(
  updater: (prev: BoqItem[]) => BoqItem[],
  ctx: BoqHandlerCtx,
): void {
  // Capture the current tree for the undo stack BEFORE applying the updater.
  const currentTree = ctx.boqData
  ctx.setUndoStack(u => [...u, deepClone(currentTree)])
  ctx.setRedoStack([])
  ctx.setBoqRows(prevRows => {
    // Rebuild the tree from the previous flat rows, apply the updater,
    // then flatten the result for storage.
    const prevTree = rebuildBoqTree(prevRows)
    const next = updater(prevTree)
    return flattenBoqTree(next) as unknown as BoqItem[]
  })
}

export function undo(ctx: BoqHandlerCtx): void {
  if (ctx.undoStack.length === 0) return
  // Pull the snapshot to restore and the current tree to push to redo,
  // then apply via functional setBoqRows. Side effects are pulled out of
  // the updater so they don't double-fire under StrictMode.
  const snapshot = ctx.undoStack[ctx.undoStack.length - 1]
  const currentTree = ctx.boqData
  ctx.setUndoStack(u => u.slice(0, -1))
  ctx.setRedoStack(r => [...r, deepClone(currentTree)])
  ctx.setBoqRows(flattenBoqTree(snapshot) as unknown as BoqItem[])
  toast.success('Undo', { description: `Reverted (${ctx.undoStack.length - 1} actions left)` })
}

export function redo(ctx: BoqHandlerCtx): void {
  if (ctx.redoStack.length === 0) return
  const snapshot = ctx.redoStack[ctx.redoStack.length - 1]
  const currentTree = ctx.boqData
  ctx.setRedoStack(r => r.slice(0, -1))
  ctx.setUndoStack(u => [...u, deepClone(currentTree)])
  ctx.setBoqRows(flattenBoqTree(snapshot) as unknown as BoqItem[])
  toast.success('Redo', { description: `${ctx.redoStack.length - 1} actions left` })
}

/** Update a single BOQ item's qty or rate. */
export function updateItem(
  id: string,
  field: 'qty' | 'rate',
  value: number,
  ctx: BoqHandlerCtx,
): void {
  commitBoqData(prev => {
    const updated = deepClone(prev) as BoqItem[]
    const walk = (items: BoqItem[]): boolean => {
      for (const it of items) {
        if (it.id === id) {
          it[field] = Math.max(0, value)
          return true
        }
        if (it.children && walk(it.children)) return true
      }
      return false
    }
    walk(updated)
    return updated
  }, ctx)
}

/** Duplicate an item — inserts a copy immediately below the original. */
export function duplicateItem(id: string, ctx: BoqHandlerCtx): void {
  commitBoqData(prev => {
    const updated = deepClone(prev) as BoqItem[]
    const walk = (items: BoqItem[]): BoqItem[] => {
      const result: BoqItem[] = []
      for (const it of items) {
        result.push(it)
        if (it.id === id) {
          const copy = deepClone(it) as BoqItem
          copy.id = `${it.id}-copy-${Date.now().toString(36)}`
          copy.code = `${it.code}-copy`
          copy.desc = `${it.desc} (Copy)`
          result.push(copy)
        }
        if (it.children) it.children = walk(it.children)
      }
      return result
    }
    return walk(updated)
  }, ctx)
  toast.success('Item duplicated', { description: `Copy created below ${id}` })
}

/** Delete an item (and its subtree). Shows an undoable toast. */
export function deleteItem(id: string, ctx: BoqHandlerCtx): void {
  const item = ctx.allFlat.find(i => i.id === id)
  commitBoqData(prev => {
    const updated = deepClone(prev) as BoqItem[]
    const walk = (items: BoqItem[]): BoqItem[] => {
      return items.filter(it => {
        if (it.id === id) return false
        if (it.children) it.children = walk(it.children)
        return true
      })
    }
    return walk(updated)
  }, ctx)
  undoableToast('Item deleted', `${item?.code || id} removed from BOQ. Click Undo to restore.`, () => ctx.undoRef.current())
}

/** Add a new child item under the given parent. Auto-expands the parent
 *  and selects the new item. */
export function addChildItem(parentId: string, ctx: BoqHandlerCtx): void {
  const newId = `${parentId}.${Date.now().toString(36)}`
  commitBoqData(prev => {
    const updated = deepClone(prev) as BoqItem[]
    const walk = (items: BoqItem[]): boolean => {
      for (const it of items) {
        if (it.id === parentId) {
          if (!it.children) it.children = []
          it.children.push({
            id: newId,
            code: `${it.code}.new`,
            desc: 'New BOQ item',
            type: 'Priced',
            qty: 0,
            uom: 'cum',
            rate: 0,
            level: it.level + 1,
          })
          return true
        }
        if (it.children && walk(it.children)) return true
      }
      return false
    }
    walk(updated)
    return updated
  }, ctx)
  ctx.setExpandedArr(prev => prev.includes(parentId) ? prev : [...prev, parentId])
  ctx.setSelectedId(newId)
  toast.success('Child item added', { description: `New item under ${parentId}` })
}

// ─── Drag-and-drop reparenting ────────────────────────────────────────────

/**
 * Reparent an item: remove from its current location and add it under the
 * target heading. Rejects no-op drops (drop on self) and cycle-creating
 * drops (drop into own subtree).
 */
export function reparentItem(
  draggedId: string,
  targetHeadingId: string,
  ctx: BoqHandlerCtx,
): void {
  if (draggedId === targetHeadingId) return // can't drop on self

  // Find the dragged item — primarily for the cycle check below.
  const dragInfo = findItemAndParent(ctx.boqData as unknown as Record<string, any>[], draggedId, 'id')
  if (!dragInfo) return

  // Cycle check: is targetHeadingId a descendant of draggedId?
  const isDescendant = (items: BoqItem[] | undefined, ancestorId: string, targetId: string): boolean => {
    if (!items) return false
    for (const it of items) {
      if (it.id === ancestorId) {
        const checkSubtree = (node: BoqItem): boolean => {
          if (node.id === targetId) return true
          return node.children?.some(c => checkSubtree(c)) || false
        }
        if (checkSubtree(it)) return true
      }
      if (it.children && isDescendant(it.children, ancestorId, targetId)) return true
    }
    return false
  }
  if (isDescendant(ctx.boqData, draggedId, targetHeadingId)) {
    toast.error('Cannot reparent', { description: 'Cannot move a heading into its own subtree' })
    return
  }

  commitBoqData(prev => {
    const updated = deepClone(prev) as BoqItem[]
    let movedItem: BoqItem | null = null

    // Step 1: Remove the dragged item from its current location.
    const removeFromTree = (items: BoqItem[]): BoqItem[] => {
      return items.filter(it => {
        if (it.id === draggedId) {
          movedItem = it
          return false
        }
        if (it.children) it.children = removeFromTree(it.children)
        return true
      })
    }
    const cleaned = removeFromTree(updated)

    // Step 2: Find the target heading and add the item to its children,
    // re-leveling the moved subtree so depths stay consistent.
    if (movedItem) {
      const target = findItemAndParent(cleaned as unknown as Record<string, any>[], targetHeadingId, 'id')
      const targetLevel = target?.depth ?? 0
      movedItem = updateLevels(movedItem as unknown as Record<string, any>, targetLevel + 1) as unknown as BoqItem
      const addToTarget = (items: BoqItem[]): boolean => {
        for (const it of items) {
          if (it.id === targetHeadingId) {
            if (!it.children) it.children = []
            it.children.push(movedItem!)
            return true
          }
          if (it.children && addToTarget(it.children)) return true
        }
        return false
      }
      addToTarget(cleaned)
    }

    return cleaned
  }, ctx)

  // Auto-expand the target heading
  ctx.setExpandedArr(prev => prev.includes(targetHeadingId) ? prev : [...prev, targetHeadingId])
  ctx.setSelectedId(draggedId)
  const draggedCode = ctx.allFlat.find(i => i.id === draggedId)?.code ?? draggedId
  toast.success('Item reparented', {
    description: `${draggedCode} moved under ${targetHeadingId}`,
  })
}

/** Placeholder for the RA export feature — shows a "not yet built" toast. */
export function exportRa(_id: string): void {
  toast.info('Not yet implemented', { description: 'This feature is planned but not yet built.' })
}
