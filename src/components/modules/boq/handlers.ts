import { toast } from 'sonner'
import type React from 'react'
import { produce } from 'immer'
import { undoableToast } from '@/components/ui/confirm-dialog'
import type { BoqItem } from './types'
import { findItemAndParent, updateLevels } from '@/lib/tree-utils'
// BOQ-specific tree helpers (deepClone, normalizeBoqRow, rebuildBoqTree,
// flattenBoqTree, recomputeSiblingCodes) — extracted to ./tree-utils.ts so
// this file can focus on mutation handlers.
import { deepClone, rebuildBoqTree, flattenBoqTree, recomputeSiblingCodes } from './tree-utils'

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
export function commitBoqData(updater: (prev: BoqItem[]) => BoqItem[], ctx: BoqHandlerCtx): void {
  // NOTE: ctx.boqData is read from the render closure, not a functional update.
  // This is safe as long as commitBoqData is not called twice in the same tick
  // (current usage guarantees this). If that invariant is ever broken — e.g.
  // a future batch action calls commitBoqData in a loop — the undo stack would
  // capture the same pre-mutation snapshot multiple times and the second call
  // would mutate an already-mutated tree.
  //
  // Guard: prevent pushing the same snapshot twice in the same tick. If
  // commitBoqData is called twice before React commits the state update (e.g.
  // a batch action, or two separate keystrokes landing in the same batch),
  // both calls would otherwise read the same `ctx.boqData` from the render
  // closure and push two identical deep clones onto the undo stack.
  //
  // The previous guard used JSON.stringify(lastSnapshot) === JSON.stringify
  // (currentTree) which is O(n) in the size of the tree on EVERY commit —
  // expensive for large BOQs (1000+ items). Replaced with a reference check:
  // ctx.boqData is a useMemo result, so its identity only changes when
  // boqRows changes. If the last snapshot was taken from the SAME boqData
  // reference, the snapshot is identical and we skip the push. We track
  // this via a WeakMap from snapshot → source-tree-reference (audit B4-5).
  const currentTree = ctx.boqData
  const lastSnapshot = ctx.undoStack[ctx.undoStack.length - 1]
  const lastSource = lastSnapshot ? snapshotSources.get(lastSnapshot) : undefined
  const isSameAsLast = lastSource === currentTree
  if (!isSameAsLast) {
    const snapshot = deepClone(currentTree)
    snapshotSources.set(snapshot, currentTree)
    ctx.setUndoStack((u) => [...u, snapshot])
  }
  ctx.setRedoStack([])
  ctx.setBoqRows((prevRows) => {
    // Rebuild the tree from the previous flat rows, apply the updater,
    // then flatten the result for storage.
    const prevTree = rebuildBoqTree(prevRows)
    const next = updater(prevTree)
    return flattenBoqTree(next) as unknown as BoqItem[]
  })
}

// WeakMap tracking which boqData reference each undo snapshot was cloned
// from. Used by commitBoqData's dedup guard to avoid the O(n) JSON.stringify
// comparison. WeakMap entries are GC'd when the snapshot is no longer
// referenced (i.e. after it's popped from the undo stack). (audit B4-5)
const snapshotSources = new WeakMap<object, object>()

export function undo(ctx: BoqHandlerCtx): void {
  if (ctx.undoStack.length === 0) return
  // Pull the snapshot to restore and the current tree to push to redo,
  // then apply via functional setBoqRows. Side effects are pulled out of
  // the updater so they don't double-fire under StrictMode.
  const snapshot = ctx.undoStack[ctx.undoStack.length - 1]
  const currentTree = ctx.boqData
  // After this undo, the undo stack will have length - 1 items. Capture
  // that count for the toast (ctx.undoStack is the pre-pop closure value,
  // so length - 1 is the post-pop count — audit B3-2).
  const remainingAfter = ctx.undoStack.length - 1
  ctx.setUndoStack((u) => u.slice(0, -1))
  ctx.setRedoStack((r) => [...r, deepClone(currentTree)])
  ctx.setBoqRows(flattenBoqTree(snapshot) as unknown as BoqItem[])
  toast.success('Undo', {
    description: `${remainingAfter} action${remainingAfter === 1 ? '' : 's'} left`,
  })
}

export function redo(ctx: BoqHandlerCtx): void {
  if (ctx.redoStack.length === 0) return
  const snapshot = ctx.redoStack[ctx.redoStack.length - 1]
  const currentTree = ctx.boqData
  // After this redo, the redo stack will have length - 1 items. Capture
  // that count for the toast (ctx.redoStack is the pre-pop closure value,
  // so length - 1 is the post-pop count — audit B3-3).
  const remainingAfter = ctx.redoStack.length - 1
  ctx.setRedoStack((r) => r.slice(0, -1))
  ctx.setUndoStack((u) => [...u, deepClone(currentTree)])
  ctx.setBoqRows(flattenBoqTree(snapshot) as unknown as BoqItem[])
  toast.success('Redo', {
    description: `${remainingAfter} action${remainingAfter === 1 ? '' : 's'} left`,
  })
}

/** Update a single BOQ item's qty or rate.
 *
 *  `skipUndo` (default false) suppresses the undo snapshot — used by the
 *  grid's debounced keystroke handler so rapid edits to the same field
 *  collapse into a single undo entry instead of one per keystroke. The
 *  first keystroke of a burst pushes a snapshot; subsequent ones within
 *  ~1s update the row directly without polluting the undo stack. */
export function updateItem(
  id: string,
  field: 'qty' | 'rate',
  value: number,
  ctx: BoqHandlerCtx,
  skipUndo = false
): void {
  // The mutation recipe is identical for both branches; only the undo
  // bookkeeping differs. Keeping the recipe in one closure avoids drift
  // between the undo-pushing and direct-update code paths.
  const mutate = (prev: BoqItem[]) =>
    produce(prev, (draft) => {
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
      walk(draft as BoqItem[])
    })

  if (skipUndo) {
    // Skip the undo stack — just apply the mutation directly so the user's
    // undo history isn't polluted with one entry per keystroke.
    ctx.setRedoStack([])
    ctx.setBoqRows((prevRows) => {
      const prevTree = rebuildBoqTree(prevRows)
      const next = mutate(prevTree)
      return flattenBoqTree(next) as unknown as BoqItem[]
    })
  } else {
    commitBoqData(mutate, ctx)
  }
}

/** Duplicate an item — inserts a copy immediately below the original. */
export function duplicateItem(id: string, ctx: BoqHandlerCtx): void {
  commitBoqData(
    (prev) =>
      produce(prev, (draft) => {
        const walk = (items: BoqItem[]): boolean => {
          for (let i = 0; i < items.length; i++) {
            const it = items[i]
            if (it.id === id) {
              // Deep-clone the matched item (with its subtree) and stamp a new
              // id/code/desc, then splice it in immediately after the original.
              // Use crypto.randomUUID() for collision-free IDs — Date.now()
              // can collide if two duplicates are created in the same ms.
              const copy = produce(it, (d) => {
                d.id = `${it.id}-copy-${crypto.randomUUID()}`
                // Append a short Date.now() suffix so the code stays unique
                // even when the same item is duplicated twice in the same
                // second. The previous `-copy` suffix collided: a second
                // duplicate of the same item produced an identical code.
                d.code = `${it.code}-copy-${Date.now().toString(36).slice(-4)}`
                d.desc = `${it.desc} (Copy)`
                // Clear hasRA on the copy — the original's RA data is local
                // to the inspector (not persisted to the item), so the copy
                // has no RA. Without this, the grid would show the green lock
                // icon on the copy, misleading the user into thinking it has
                // a rate analysis (audit B5-2).
                d.hasRA = false
              }) as BoqItem
              items.splice(i + 1, 0, copy)
              // Recompute sibling codes so the copy follows the parent.N
              // pattern. Without this, the copy keeps its `-copy-xxxx` code
              // forever, and subsequent add/remove operations don't renumber
              // it (audit B5-1 — addChildItem and reparentItem both call
              // recomputeSiblingCodes, but duplicateItem didn't).
              const parentCode = it.code.split('.').slice(0, -1).join('.')
              recomputeSiblingCodes(items, parentCode || null)
              return true
            }
            if (it.children && walk(it.children)) return true
          }
          return false
        }
        walk(draft as BoqItem[])
      }),
    ctx
  )
  toast.success('Item duplicated', {
    description: `Copy of ${ctx.allFlat.find((i) => i.id === id)?.code ?? id} created below`,
  })
}

/** Delete an item (and its subtree). Shows an undoable toast.
 *
 *  When the item has children, prompt for confirmation first — undoing a
 *  cascading delete is possible but confusing (the toast undoes the entire
 *  subtree at once), and a heading typically carries many descendants that
 *  the user might not intend to lose. */
export function deleteItem(id: string, ctx: BoqHandlerCtx): void {
  const item = ctx.allFlat.find((i) => i.id === id)
  // Confirm before cascading — counts descendants recursively so the user
  // sees the true blast radius (not just direct children).
  if (item?.children && item.children.length > 0) {
    const countDescendants = (nodes: BoqItem[] | undefined): number =>
      nodes?.reduce((sum, n) => sum + 1 + countDescendants(n.children), 0) ?? 0
    const descCount = countDescendants(item.children)
    if (!confirm(`Delete "${item.code} — ${item.desc}" and its ${descCount} descendant item(s)?`)) {
      return
    }
  }
  // Capture the deleted item's code so we can find its parent's sibling group
  // and recompute codes after the splice. Without this, deleting item 1.1.2
  // leaves 1.1.1, 1.1.3, 1.1.4 instead of renumbering to 1.1.1, 1.1.2, 1.1.3
  // (audit B6-1 — addChildItem, reparentItem, and duplicateItem all recompute,
  // but deleteItem didn't).
  const deletedCode = item?.code
  commitBoqData(
    (prev) =>
      produce(prev, (draft) => {
        // Walk in reverse so splicing doesn't shift the indices we haven't
        // visited yet.
        const walk = (items: BoqItem[]): void => {
          for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i]
            if (it.id === id) {
              items.splice(i, 1)
              // Recompute sibling codes for the remaining siblings so they
              // stay contiguous (1.1.1, 1.1.2, ... instead of 1.1.1, 1.1.3, ...)
              // The parent code is the deleted item's code minus its last
              // segment (e.g. '1.1.2' → '1.1'). For root-level items, the
              // parent code is null (audit B6-1).
              if (deletedCode) {
                const parentCode = deletedCode.includes('.')
                  ? deletedCode.split('.').slice(0, -1).join('.')
                  : null
                recomputeSiblingCodes(items, parentCode)
              }
            } else if (it.children) {
              walk(it.children)
            }
          }
        }
        walk(draft as BoqItem[])
      }),
    ctx
  )
  undoableToast(
    'Item deleted',
    `${item?.code || id} removed from BOQ. Click Undo to restore.`,
    () => ctx.undoRef.current()
  )
}

/** Add a new child item under the given parent. Auto-expands the parent
 *  and selects the new item.
 *
 *  Only Heading items may have children — allowing children under Priced /
 *  Provisional Sum / Daywork items would double-count them in the contract
 *  total (parents and their children would both contribute qty × rate). */
export function addChildItem(parentId: string, ctx: BoqHandlerCtx): void {
  // Guard: refuse to add children under non-Heading items. This prevents
  // the double-counting bug where a Priced parent + its child Priced rows
  // would both be summed into the contract total.
  const parentItem = ctx.allFlat.find((i) => i.id === parentId)
  if (!parentItem) {
    toast.error('Cannot add child item', { description: 'Parent item not found.' })
    return
  }
  if (parentItem.type !== 'Heading') {
    toast.error('Children can only be added under Heading items', {
      description: `${parentItem.code} is a ${parentItem.type} item.`,
    })
    return
  }
  // crypto.randomUUID() is collision-free across rapid successive calls,
  // whereas Date.now() can return the same ms when addChildItem is invoked
  // twice in quick succession (e.g. user double-clicking the menu item).
  const newId = `${parentId}.${crypto.randomUUID()}`
  commitBoqData(
    (prev) =>
      produce(prev, (draft) => {
        const walk = (items: BoqItem[]): boolean => {
          for (const it of items) {
            if (it.id === parentId) {
              if (!it.children) it.children = []
              it.children.push({
                id: newId,
                // Placeholder code — renumbered below by recomputeSiblingCodes
                // so the new child gets `parent.N` where N is its 1-indexed
                // position among its siblings.
                code: `${it.code}.${it.children.length + 1}`,
                desc: 'New BOQ item',
                type: 'Priced',
                qty: 0,
                // Default UOM is empty — the user should pick the right unit
                // for their item. Previously defaulted to 'cum' (cubic
                // meters) which is only correct for volume-based items; a
                // 'rmt', 'sqm', 'no', or 'MT' item would show a misleading
                // unit until the user noticed and changed it (audit B3-6).
                uom: '',
                rate: 0,
                level: it.level + 1,
                // hasRA is intentionally NOT set — new items don't have a
                // rate analysis until the user builds one in the RA
                // Inspector. The grid's RA column shows the lock icon only
                // when hasRA is truthy, so omitting it is correct (audit
                // B3-5 — previously the field wasn't set either, but the
                // comment documents the intent so future contributors
                // don't add hasRA: true as a "sensible default").
              })
              // Renumber all sibling codes as parent.1, parent.2, ... so
              // additions/removals keep codes consistent with tree structure.
              // Mirrors the same pattern used by reparentItem.
              recomputeSiblingCodes(it.children, it.code)
              return true
            }
            if (it.children && walk(it.children)) return true
          }
          return false
        }
        walk(draft as BoqItem[])
      }),
    ctx
  )
  ctx.setExpandedArr((prev) => (prev.includes(parentId) ? prev : [...prev, parentId]))
  ctx.setSelectedId(newId)
  // Show the parent's code (not the raw id) so the user knows where the
  // new item landed without looking back at the grid (audit B4-8).
  toast.success('Child item added', {
    description: `New item under ${parentItem.code} — ${parentItem.desc}`,
  })
}

// ─── Drag-and-drop reparenting ────────────────────────────────────────────

/**
 * Reparent an item: remove from its current location and add it under the
 * target heading. Rejects no-op drops (drop on self) and cycle-creating
 * drops (drop into own subtree).
 */
export function reparentItem(draggedId: string, targetHeadingId: string, ctx: BoqHandlerCtx): void {
  if (draggedId === targetHeadingId) return // can't drop on self

  // Find the dragged item — primarily for the cycle check below.
  const dragInfo = findItemAndParent(
    ctx.boqData as unknown as Record<string, unknown>[],
    draggedId,
    'id'
  )
  if (!dragInfo) return

  // Guard: refuse to reparent under a non-Heading item. The BoqDndRow
  // component disables the droppable for non-Heading items, but this is a
  // defense-in-depth check — if the droppable is somehow enabled (e.g. a
  // bug in the disabled logic), allowing the reparent would create
  // children under a Priced/Provisional Sum/Daywork item, double-counting
  // them in the contract total (audit B3-9).
  const targetItem = ctx.allFlat.find((i) => i.id === targetHeadingId)
  if (!targetItem) return
  if (targetItem.type !== 'Heading') {
    toast.error('Cannot reparent', {
      description: `Target ${targetItem.code} is a ${targetItem.type} item — children can only be added under Heading items.`,
    })
    return
  }

  // Cycle check: is targetHeadingId a descendant of draggedId?
  const isDescendant = (
    items: BoqItem[] | undefined,
    ancestorId: string,
    targetId: string
  ): boolean => {
    if (!items) return false
    for (const it of items) {
      if (it.id === ancestorId) {
        const checkSubtree = (node: BoqItem): boolean => {
          if (node.id === targetId) return true
          return node.children?.some((c) => checkSubtree(c)) || false
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

  commitBoqData((prev) => {
    return produce(prev, (draft) => {
      let movedItem: BoqItem | null = null
      // Track the old parent's code so we can recompute its remaining
      // children's codes after the item is removed. Without this, moving
      // item 1.1.2 out of parent 1.1 leaves 1.1.1, 1.1.3, 1.1.4 instead
      // of renumbering to 1.1.1, 1.1.2, 1.1.3 (audit B6-2).
      let oldParentCode: string | null = null

      // Step 1: Remove the dragged item from its current location.
      // Also capture the old parent's code by finding the dragged item's
      // parent before the splice.
      const findOldParentCode = (items: BoqItem[], parentCode: string | null): boolean => {
        for (const it of items) {
          if (it.id === draggedId) {
            oldParentCode = parentCode
            return true
          }
          if (it.children && findOldParentCode(it.children, it.code)) return true
        }
        return false
      }
      findOldParentCode(draft as BoqItem[], null)

      const removeFromTree = (items: BoqItem[]): BoqItem[] => {
        return items.filter((it) => {
          if (it.id === draggedId) {
            movedItem = it
            return false
          }
          if (it.children) it.children = removeFromTree(it.children)
          return true
        })
      }
      const cleaned = removeFromTree(draft as BoqItem[])

      // Step 1b: Recompute sibling codes for the OLD parent's remaining
      // children so they stay contiguous (audit B6-2).
      if (oldParentCode !== null) {
        const recomputeOldSiblings = (items: BoqItem[]): boolean => {
          for (const it of items) {
            if (it.code === oldParentCode && it.children) {
              recomputeSiblingCodes(it.children, it.code)
              return true
            }
            if (it.children && recomputeOldSiblings(it.children)) return true
          }
          return false
        }
        recomputeOldSiblings(cleaned)
      } else {
        // Old parent was root level — renumber root items.
        recomputeSiblingCodes(cleaned, null)
      }

      // Step 2: Find target heading and add the moved item
      if (movedItem) {
        const target = findItemAndParent(
          cleaned as unknown as Record<string, unknown>[],
          targetHeadingId,
          'id'
        )
        const targetLevel = target?.depth ?? 0
        movedItem = updateLevels(
          movedItem as unknown as Record<string, unknown>,
          targetLevel + 1
        ) as unknown as BoqItem
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

        // Step 3: Recompute the moved item's code AND all sibling codes under
        // the new parent. Codes follow the parent.code + '.' + N pattern
        // (1-indexed), so adding/removing a child renumbers all siblings.
        // This keeps codes consistent with the tree structure after reparent.
        //
        // `recomputeSiblingCodes` is defined at module scope so addChildItem
        // can reuse the exact same renumbering logic.

        // Recompute codes for the target parent's entire children list
        // (now including the newly-added movedItem).
        const recomputeTargetChildren = (items: BoqItem[]): boolean => {
          for (const it of items) {
            if (it.id === targetHeadingId) {
              if (it.children) recomputeSiblingCodes(it.children, it.code)
              return true
            }
            if (it.children && recomputeTargetChildren(it.children)) return true
          }
          return false
        }
        recomputeTargetChildren(cleaned)
      }
    })
  }, ctx)

  // Auto-expand the target heading
  ctx.setExpandedArr((prev) => (prev.includes(targetHeadingId) ? prev : [...prev, targetHeadingId]))
  ctx.setSelectedId(draggedId)
  const draggedCode = ctx.allFlat.find((i) => i.id === draggedId)?.code ?? draggedId
  // Show the target's code and desc (not just the id) so the user knows
  // where the item landed without looking back at the grid (audit B3-10).
  const targetCode = targetItem.code
  const targetDesc = targetItem.desc
  toast.success('Item reparented', {
    description: `${draggedCode} moved under ${targetCode} — ${targetDesc}`,
  })
}

// exportRa() has been extracted to ./export-ra.ts for clarity (it is a pure
// CSV-generation function with no shared state, while the rest of this file
// is tree-mutation handlers). Re-exported here so existing imports from
// './handlers' keep working — but new code should import from './export-ra'
// directly.
export { exportRa } from './export-ra'

// Tree utilities (rebuildBoqTree, flattenBoqTree, deepClone,
// normalizeBoqRow, recomputeSiblingCodes) have been extracted to
// ./tree-utils.ts. Re-exported here so existing imports from './handlers'
// keep working — but new code should import from './tree-utils' directly.
export { rebuildBoqTree, flattenBoqTree } from './tree-utils'
