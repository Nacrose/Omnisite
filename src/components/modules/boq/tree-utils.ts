import { produce } from 'immer'
import { flattenTree, createTreeRebuilder } from '@/lib/tree-utils'
import { BOQ_DATA, type BoqItem } from './types'

/**
 * Deep-clone helper using immer's `produce()` with a no-op recipe.
 *
 * Intentionally used instead of `structuredClone()` for undo/redo snapshots:
 * immer's structural sharing means that for large trees where only a few
 * leaves changed, the clone is much cheaper (shares unchanged subtrees by
 * reference) than `structuredClone` which deep-copies everything.
 *
 * Also used by `rebuildBoqTree` to clone the seed `BOQ_DATA` when falling
 * back after an empty row set.
 */
export const deepClone = <T>(obj: T): T => produce(obj, () => {})

// ─── BOQ-specific tree helpers ────────────────────────────────────────────
//
// These wrap the generic tree-utils functions for the BoqItem shape:
// id field is `id`, parent field is `parentId`, children field is `children`.
// They also handle the snake_case → camelCase field normalization that the
// DB layer (useSyncedState) may return.

/**
 * Normalize a raw DB row (which may have snake_case field names like
 * `parent_id`, `has_ra`) into a typed `BoqItem`.
 *
 * Used by `rebuildBoqTree` so the tree-rebuild path handles both DB rows
 * and already-normalized BoqItems.
 */
export function normalizeBoqRow(row: Record<string, unknown>): BoqItem {
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
    // Preserve locationId (with snake_case fallback) so the LocationPicker
    // in RaInspector shows the correct selection after tree rebuilds.
    locationId: (row.locationId ?? row.location_id ?? undefined) as string | undefined,
  }
}

/**
 * Rebuild a BoqItem tree from flat rows. Rows may be DB rows (with snake_case
 * field names like `parent_id`, `has_ra`) or already-normalized BoqItems.
 *
 * Falls back to a deep clone of `BOQ_DATA` when rows is empty or yields no
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
export function recomputeSiblingCodes(items: BoqItem[], parentCode: string | null): void {
  items.forEach((it, idx) => {
    const prefix = parentCode ? `${parentCode}.` : ''
    it.code = `${prefix}${idx + 1}`
    if (it.children && it.children.length > 0) {
      recomputeSiblingCodes(it.children, it.code)
    }
  })
}
