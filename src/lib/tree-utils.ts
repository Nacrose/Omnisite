/**
 * Shared tree manipulation utilities used by BOQ, Financials, and Scheduler.
 *
 * These functions operate on generic tree shapes — callers specify the key
 * names for the id field, parent-id field, children field, and (where
 * relevant) the level field. Defaults are `id`, `parentId`, `children`,
 * and `level` so the BOQ tree (which uses those exact names) can call
 * without passing any key overrides.
 *
 * NOTE: callers that persist rows to a DB with snake_case column names
 * (e.g. `parent_id`, `has_ra`, `margin_pct`) should normalize their rows
 * into the app-side field names BEFORE calling these helpers. The shared
 * utilities only handle tree structure, not field-name mapping.
 */

export interface TreeKeys {
  /** Key whose value uniquely identifies a node. Default: `id`. */
  idKey?: string
  /** Key whose value holds the parent's id (set by `flattenTree`). Default: `parentId`. */
  parentKey?: string
  /** Key whose value is the children array. Default: `children`. */
  childrenKey?: string
  /** Key whose value is the depth/level. Default: `level`. */
  levelKey?: string
}

/**
 * Flatten a tree into a flat array, setting the parent-id field on each row
 * and stripping the children array. The output is suitable for persisting
 * to a flat table (DB rows, CSV, etc.).
 *
 * Mirrors the per-module `flattenTree` (BOQ) and `flattenForSave`
 * (Financials) helpers that previously lived inline in each module.
 */
export function flattenTree<T extends Record<string, any>>(
  items: T[],
  parentId: string | null = null,
  keys: TreeKeys = {}
): T[] {
  const idKey = keys.idKey ?? 'id'
  const parentKey = keys.parentKey ?? 'parentId'
  const childrenKey = keys.childrenKey ?? 'children'
  const out: T[] = []
  for (const item of items) {
    out.push({ ...item, [parentKey]: parentId ?? undefined, [childrenKey]: undefined })
    const children = item[childrenKey] as T[] | undefined
    if (children && children.length > 0) {
      out.push(...flattenTree(children, String(item[idKey]), keys))
    }
  }
  return out
}

/**
 * Rebuild a tree from flat rows. If any row already has a non-empty children
 * array, the rows are returned as-is (already a tree).
 *
 * Returns an empty array when `rows` is null/empty — callers that need a
 * fallback default (e.g. `BOQ_DATA` / `CBS`) should handle that themselves.
 */
export function rebuildTreeFromRows<T extends Record<string, any>>(
  rows: T[] | null | undefined,
  idKey: string,
  parentKey: string,
  childrenKey: string = 'children'
): T[] {
  if (!rows || rows.length === 0) return []
  const hasChildren = rows.some(
    (r) => Array.isArray(r[childrenKey]) && (r[childrenKey] as T[]).length > 0
  )
  if (hasChildren) return rows
  const map = new Map<string, T>()
  const roots: T[] = []
  for (const row of rows) {
    // Strip any existing children key so we don't end up with stale arrays
    // attached to nodes that are about to be re-parented.
    map.set(String(row[idKey]), { ...row, [childrenKey]: undefined })
  }
  for (const row of rows) {
    const item = map.get(String(row[idKey]))!
    const parentVal = row[parentKey]
    const parentId = parentVal != null && parentVal !== '' ? String(parentVal) : null
    if (parentId && map.has(parentId)) {
      const parent = map.get(parentId)! as Record<string, any>
      if (!parent[childrenKey]) parent[childrenKey] = [] as T[]
      ;(parent[childrenKey] as T[]).push(item)
    } else {
      roots.push(item)
    }
  }
  return roots
}

/**
 * Find an item and its parent in a tree. Returns the item, its parent
 * (or null if it's a root), and the depth (0 for roots).
 */
export function findItemAndParent<T extends Record<string, any>>(
  items: T[],
  id: string,
  idKey: string = 'id',
  childrenKey: string = 'children',
  parent: T | null = null,
  depth = 0
): { item: T; parent: T | null; depth: number } | null {
  for (const it of items) {
    if (String(it[idKey]) === id) return { item: it, parent, depth }
    const children = it[childrenKey] as T[] | undefined
    if (children) {
      const found = findItemAndParent(children, id, idKey, childrenKey, it, depth + 1)
      if (found) return found
    }
  }
  return null
}

/**
 * Recursively update the level of an item and its children. Returns a new
 * item (shallow clone) with the updated level and recursively updated
 * children — the input is not mutated.
 */
export function updateLevels<T extends Record<string, any>>(
  item: T,
  newLevel: number,
  childrenKey: string = 'children',
  levelKey: string = 'level'
): T {
  const children = item[childrenKey] as T[] | undefined
  return {
    ...item,
    [levelKey]: newLevel,
    [childrenKey]: children?.map((c) => updateLevels(c, newLevel + 1, childrenKey, levelKey)),
  }
}
