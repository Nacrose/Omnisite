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
  createTreeRebuilder,
} from '@/lib/tree-utils'
import { exportToCsv } from '@/lib/csv-export'

// Deep-clone helper using immer's produce() with a no-op recipe.
// Intentionally used instead of structuredClone() for undo/redo snapshots:
// immer's structural sharing means that for large trees where only a few
// leaves changed, the clone is much cheaper (shares unchanged subtrees by
// reference) than structuredClone which deep-copies everything.
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
    // Preserve parentId (with snake_case fallback) so rebuildTreeFromRows can
    // re-attach children after a flatten→rebuild round-trip. Without this,
    // every row would become a root after the first edit.
    parentId: (row.parentId ?? row.parent_id ?? undefined) as string | undefined,
  }
}

/**
 * Rebuild a BoqItem tree from flat rows. Rows may be DB rows (with snake_case
 * field names like `parent_id`, `has_ra`) or already-normalized BoqItems.
 *
 * Falls back to a deep clone of BOQ_DATA when rows is empty or yields no
 * roots, so the UI always has something to render.
 *
 * Implemented via the shared `createTreeRebuilder` factory so the
 * rebuild-or-fallback pattern is identical to the Financials module.
 */
export const rebuildBoqTree = createTreeRebuilder<BoqItem>({
  seed: BOQ_DATA,
  cloneSeed: deepClone,
  idKey: 'id',
  parentKey: 'parentId',
  normalize: normalizeBoqRow,
})

/**
 * Flatten a BoqItem tree for DB storage. Strips `children` and sets
 * `parentId` on each row.
 */
export function flattenBoqTree(items: BoqItem[], parentId: string | null = null): BoqItem[] {
  return flattenTree(
    items as unknown as Record<string, unknown>[],
    parentId
  ) as unknown as BoqItem[]
}

/**
 * Renumber sibling codes as `<parentCode>.1`, `<parentCode>.2`, … recursively
 * down the subtree. Used by `addChildItem` and `reparentItem` so codes stay
 * consistent with tree structure after additions/removals/moves.
 *
 * `parentCode` is `null` for root-level siblings (codes become `1`, `2`, …).
 */
function recomputeSiblingCodes(items: BoqItem[], parentCode: string | null): void {
  items.forEach((it, idx) => {
    const prefix = parentCode ? `${parentCode}.` : ''
    it.code = `${prefix}${idx + 1}`
    if (it.children && it.children.length > 0) {
      recomputeSiblingCodes(it.children, it.code)
    }
  })
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
  // closure and push two identical deep clones onto the undo stack. The
  // second snapshot is then a no-op when undone. Comparing the JSON-serialized
  // form against the last pushed snapshot skips the redundant push.
  //
  // Capture the current tree for the undo stack BEFORE applying the updater.
  const currentTree = ctx.boqData
  const lastSnapshot = ctx.undoStack[ctx.undoStack.length - 1]
  const isSameAsLast =
    !!lastSnapshot && JSON.stringify(lastSnapshot) === JSON.stringify(currentTree)
  if (!isSameAsLast) {
    ctx.setUndoStack((u) => [...u, deepClone(currentTree)])
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

export function undo(ctx: BoqHandlerCtx): void {
  if (ctx.undoStack.length === 0) return
  // Pull the snapshot to restore and the current tree to push to redo,
  // then apply via functional setBoqRows. Side effects are pulled out of
  // the updater so they don't double-fire under StrictMode.
  const snapshot = ctx.undoStack[ctx.undoStack.length - 1]
  const currentTree = ctx.boqData
  ctx.setUndoStack((u) => u.slice(0, -1))
  ctx.setRedoStack((r) => [...r, deepClone(currentTree)])
  ctx.setBoqRows(flattenBoqTree(snapshot) as unknown as BoqItem[])
  toast.success('Undo', { description: `Reverted (${ctx.undoStack.length - 1} actions left)` })
}

export function redo(ctx: BoqHandlerCtx): void {
  if (ctx.redoStack.length === 0) return
  const snapshot = ctx.redoStack[ctx.redoStack.length - 1]
  const currentTree = ctx.boqData
  ctx.setRedoStack((r) => r.slice(0, -1))
  ctx.setUndoStack((u) => [...u, deepClone(currentTree)])
  ctx.setBoqRows(flattenBoqTree(snapshot) as unknown as BoqItem[])
  toast.success('Redo', { description: `${ctx.redoStack.length - 1} actions left` })
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
              }) as BoqItem
              items.splice(i + 1, 0, copy)
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
  toast.success('Item duplicated', { description: `Copy created below ${id}` })
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
                uom: 'cum',
                rate: 0,
                level: it.level + 1,
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
  toast.success('Child item added', { description: `New item under ${parentId}` })
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

      // Step 1: Remove the dragged item from its current location
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
  toast.success('Item reparented', {
    description: `${draggedCode} moved under ${targetHeadingId}`,
  })
}

/**
 * Export a Rate Analysis sheet for a BOQ item as a CSV file (DoR format).
 *
 * Generates a CSV with the item's code/desc/UOM as a header, followed by
 * the standard material / labour / equipment resource rows with their
 * default coefficients, and a computed direct cost + margins section.
 *
 * The CSV is downloaded as `RA-<code>.csv` in the browser. The caller passes
 * the BoqItem (looked up from allFlat) so we can include its metadata.
 *
 * Delegates to `exportToCsv` so the file picks up the BOM (Excel UTF-8
 * compatibility) and CSV-injection mitigation that the hand-rolled writer
 * was missing.
 */
export function exportRa(item: BoqItem | undefined): void {
  if (!item) {
    toast.error('Cannot export RA', { description: 'No item selected.' })
    return
  }

  // NOTE: exportRa uses DoR default PCC coefficients (the cement/sand/
  //  aggregate/labour/equipment constants below). These do NOT reflect the
  //  RA Inspector's user-editable resource rows — the inspector now seeds
  //  each item with an EMPTY resource list and the user adds their own. The
  //  export and the inspector will diverge until exportRa is wired to read
  //  from the inspector's state (or from a persisted RA column on boq_items).
  //
  //  Standard DoR resource rows (mirrors the INITIAL_* constants in
  //  ra-inspector). Kept here so the export works even without the RA
  //  inspector mounted.
  const materials = [
    { code: 'M-CEM-OPC', name: 'Cement OPC 53 Grade (Udaipur)', uom: 'Bag', qty: 4.5, rate: 920 },
    { code: 'M-SAND-R', name: 'River Sand (Trishuli)', uom: 'cum', qty: 0.45, rate: 3850 },
    { code: 'M-AGG-20', name: 'Coarse Aggregate 20mm', uom: 'cum', qty: 0.9, rate: 2950 },
    { code: 'M-WAT', name: 'Water (tanker)', uom: 'ltr', qty: 180, rate: 0.45 },
  ]
  const labour = [
    { code: 'L-MASN', name: 'Mason (Skilled Cat. I)', uom: 'day', qty: 0.6, rate: 1450 },
    { code: 'L-HEL', name: 'Mazdoor (Unskilled)', uom: 'day', qty: 1.4, rate: 950 },
    { code: 'L-MIX', name: 'Mixer Operator', uom: 'day', qty: 0.2, rate: 1200 },
  ]
  const equipment = [
    { code: 'E-MIX', name: 'Concrete Mixer 0.4 cum', uom: 'hr', qty: 1.8, rate: 285 },
    { code: 'E-VIB', name: 'Needle Vibrator 60mm', uom: 'hr', qty: 1.2, rate: 95 },
  ]

  const directCost = [...materials, ...labour, ...equipment].reduce((s, r) => s + r.qty * r.rate, 0)
  // Note: this uses DoR default 7.5% additions (2.5% + 1.5% + 3.5%). The RA
  // Inspector allows user-editable percentage costs — those edits are NOT
  // reflected in this export. When the inspector's user-editable coefficients
  // become the source of truth, swap this hardcoded 0.075 for a lookup
  // against the selected item's coefficient overrides.
  const pctAdd = directCost * 0.075 // 2.5+1.5+3.5% on direct
  const opCost = (directCost + pctAdd) * 0.15
  const totalCost = directCost + pctAdd + opCost
  const contractRate = item.rate
  const margin = contractRate - totalCost
  const marginPct = contractRate > 0 ? (margin / contractRate) * 100 : 0

  // Uniform 7-column table. The first column ("Section") disambiguates the
  // row kind: 'Item' for the BOQ item being analyzed, 'Material'/'Labour'/
  // 'Equipment' for resource rows, 'Summary' for the trailing computed
  // totals. The 'Code' column carries the summary label on Summary rows so
  // the file stays a single, parser-friendly table — no mixed-shape sections.
  const headers = ['Section', 'Code', 'Description', 'UOM', 'Qty', 'Rate (NPR)', 'Amount (NPR)']

  const rows: (string | number)[][] = [
    ['Item', item.code, item.desc, item.uom, item.qty, item.rate, item.qty * item.rate],
    ...materials.map((r) => [
      'Material',
      r.code,
      r.name,
      r.uom,
      r.qty,
      r.rate,
      (r.qty * r.rate).toFixed(2),
    ]),
    ...labour.map((r) => [
      'Labour',
      r.code,
      r.name,
      r.uom,
      r.qty,
      r.rate,
      (r.qty * r.rate).toFixed(2),
    ]),
    ...equipment.map((r) => [
      'Equipment',
      r.code,
      r.name,
      r.uom,
      r.qty,
      r.rate,
      (r.qty * r.rate).toFixed(2),
    ]),
    // Summary rows: label in the Code column, value in the Amount column.
    ['Summary', 'Direct Cost', '', '', '', '', directCost.toFixed(2)],
    ['Summary', 'Percentage Additions (7.5%)', '', '', '', '', pctAdd.toFixed(2)],
    ['Summary', 'Overhead (15%)', '', '', '', '', opCost.toFixed(2)],
    ['Summary', 'Total Cost', '', '', '', '', totalCost.toFixed(2)],
    ['Summary', 'Contract Rate', '', '', '', '', contractRate.toFixed(2)],
    ['Summary', 'Margin', '', '', '', '', margin.toFixed(2)],
    ['Summary', 'Margin %', '', '', '', '', marginPct.toFixed(2)],
  ]

  exportToCsv(`RA-${item.code.replace(/\./g, '-')}.csv`, headers, rows)

  toast.success('RA exported', { description: `RA-${item.code}.csv downloaded` })
}
