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
 *
 * Type safety: every generic helper is constrained to
 * `T extends Record<string, unknown>` (not `any`) so that downstream
 * callers get strict typing on field access. The `readChildrenArray`
 * helper narrows the `unknown` value at the children-key to `T[] | undefined`
 * without resorting to `as unknown as T[]` casts.
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
 * Narrow the value at `childrenKey` on a `Record<string, unknown>` to
 * `T[] | undefined`. Returns `undefined` when the value isn't an array —
 * so callers can use `readChildrenArray(row)?.length ?? 0` without any
 * `as unknown as T[]` casts.
 *
 * This is the type-safe replacement for the inline pattern
 * `item[childrenKey] as T[] | undefined` that the shared helpers
 * previously used.
 */
export function readChildrenArray<T>(
  obj: Record<string, unknown>,
  childrenKey: string = 'children'
): T[] | undefined {
  const v = obj[childrenKey]
  return Array.isArray(v) ? (v as T[]) : undefined
}

/**
 * Flatten a tree into a flat array, setting the parent-id field on each row
 * and stripping the children array. The output is suitable for persisting
 * to a flat table (DB rows, CSV, etc.).
 *
 * Mirrors the per-module `flattenTree` (BOQ) and `flattenForSave`
 * (Financials) helpers that previously lived inline in each module.
 */
export function flattenTree<T extends Record<string, unknown>>(
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
    const children = readChildrenArray<T>(item, childrenKey)
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
 * fallback default (e.g. `BOQ_DATA` / `CBS`) should handle that themselves,
 * or use the `createTreeRebuilder` factory which captures the fallback
 * pattern.
 */
export function rebuildTreeFromRows<T extends Record<string, unknown>>(
  rows: T[] | null | undefined,
  idKey: string,
  parentKey: string,
  childrenKey: string = 'children'
): T[] {
  if (!rows || rows.length === 0) return []
  const hasChildren = rows.some((r) => {
    const c = readChildrenArray<T>(r, childrenKey)
    return c !== undefined && c.length > 0
  })
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
      const parent = map.get(parentId)! as Record<string, unknown>
      // Use the typed narrowing helper to avoid `as unknown as T[]` casts.
      let childrenArr = readChildrenArray<T>(parent, childrenKey)
      if (!childrenArr) {
        childrenArr = [] as T[]
        parent[childrenKey] = childrenArr
      }
      childrenArr.push(item)
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
export function findItemAndParent<T extends Record<string, unknown>>(
  items: T[],
  id: string,
  idKey: string = 'id',
  childrenKey: string = 'children',
  parent: T | null = null,
  depth = 0
): { item: T; parent: T | null; depth: number } | null {
  for (const it of items) {
    if (String(it[idKey]) === id) return { item: it, parent, depth }
    const children = readChildrenArray<T>(it, childrenKey)
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
export function updateLevels<T extends Record<string, unknown>>(
  item: T,
  newLevel: number,
  childrenKey: string = 'children',
  levelKey: string = 'level'
): T {
  const children = readChildrenArray<T>(item, childrenKey)
  return {
    ...item,
    [levelKey]: newLevel,
    [childrenKey]: children?.map((c) => updateLevels(c, newLevel + 1, childrenKey, levelKey)),
  }
}

/**
 * Factory that captures the shared rebuild-or-fallback pattern used by the
 * BOQ and Financials modules.
 *
 * The resulting `rebuild` function:
 *   1. If `rows` is empty/null → return a deep clone of `seed`.
 *   2. If any row already has a non-empty `children` array → return rows as-is
 *      (already a tree, no rebuild needed).
 *   3. Otherwise normalize each row via `normalize`, then rebuild via
 *      `rebuildTreeFromRows` using `idKey` / `parentKey`.
 *   4. If the rebuild yields no roots → fall back to a deep clone of `seed`.
 *
 * The `cloneSeed` parameter is required (rather than using structuredClone
 * internally) because the BOQ and Financials modules both use immer's
 * `produce()` for structural sharing — cheaper than structuredClone for
 * large trees where only a few leaves change.
 *
 * Type note: `T` is constrained to `object` (rather than
 * `Record<string, unknown>`) so callers can pass domain interfaces like
 * `BoqItem` / `CbsNode` that don't declare an index signature. Internally
 * we cast to `Record<string, unknown>` to access dynamic keys (id/parent/
 * children) — this is safe because `normalize` produces well-shaped rows
 * and the casts are confined to this factory.
 *
 * Example:
 * ```ts
 * const rebuildBoqTree = createTreeRebuilder<BoqItem>({
 *   seed: BOQ_DATA,
 *   cloneSeed: deepClone,
 *   idKey: 'id',
 *   parentKey: 'parentId',
 *   normalize: normalizeBoqRow,
 * })
 * ```
 */
export function createTreeRebuilder<T extends object>(opts: {
  /** Seed tree returned when rows is empty or rebuild yields no roots. */
  seed: T[]
  /** Deep-clone function used to clone the seed on every fallback. */
  cloneSeed: (seed: T[]) => T[]
  /** Key whose value uniquely identifies a node. */
  idKey: string
  /** Key whose value holds the parent's id. */
  parentKey: string
  /** Key whose value is the children array. Default: `children`. */
  childrenKey?: string
  /** Normalizes a DB row (possibly snake_case) into the app-side T shape. */
  normalize: (row: Record<string, unknown>) => T
}): (rows: T[] | null | undefined) => T[] {
  const { seed, cloneSeed, idKey, parentKey, normalize } = opts
  const childrenKey = opts.childrenKey ?? 'children'
  return (rows) => {
    if (!rows || rows.length === 0) return cloneSeed(seed)
    const hasChildren = rows.some((r) => {
      const c = readChildrenArray<T>(r as Record<string, unknown>, childrenKey)
      return c !== undefined && c.length > 0
    })
    if (hasChildren) return rows
    const normalized = rows.map((r) => normalize(r as unknown as Record<string, unknown>))
    const tree = rebuildTreeFromRows(
      normalized as unknown as Record<string, unknown>[],
      idKey,
      parentKey,
      childrenKey
    )
    return (tree as unknown as T[]).length > 0 ? (tree as unknown as T[]) : cloneSeed(seed)
  }
}
