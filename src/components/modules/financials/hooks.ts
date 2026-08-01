import { CBS, type CbsNode } from './types'
import { undoableToast } from '@/components/ui/confirm-dialog'

// Flatten tree for saving — strips children and sets parentCode on each node.
// This is the "save" flattener (as opposed to the display flattener in types.ts
// which preserves the tree structure in its output).
export function flattenForSave(items: CbsNode[], parentCode: string | null = null): CbsNode[] {
  const out: CbsNode[] = []
  for (const item of items) {
    out.push({ ...item, parentCode: parentCode || undefined, children: undefined })
    if (item.children) out.push(...flattenForSave(item.children, item.code))
  }
  return out
}

// Rebuild a tree from flat rows (which may have parentCode set).
// If rows already have children arrays, returns them as-is.
// Falls back to the CBS constant if rows is empty or yields no roots.
export function rebuildTreeFromRows(rows: CbsNode[]): CbsNode[] {
  if (!rows || rows.length === 0) return JSON.parse(JSON.stringify(CBS))
  const hasChildren = rows.some((r) => Array.isArray(r.children) && r.children!.length > 0)
  if (hasChildren) return rows
  const map = new Map<string, CbsNode>()
  const roots: CbsNode[] = []
  for (const row of rows as unknown as Record<string, unknown>[]) {
    const node: CbsNode = {
      code: row.code as string,
      name: row.name as string,
      budget: Number(row.budget) || 0,
      committed: Number(row.committed) || 0,
      actual: Number(row.actual) || 0,
      forecast: Number(row.forecast) || 0,
      marginPct: Number(row.marginPct ?? row.margin_pct) || 0,
      level: Number(row.level) || 0,
    }
    map.set(node.code, node)
  }
  for (const row of rows as unknown as Record<string, unknown>[]) {
    const node = map.get(row.code as string)!
    const parentCode = (row.parentCode || row.parent_code) as string | null
    if (parentCode && map.has(parentCode)) {
      const parent = map.get(parentCode)!
      if (!parent.children) parent.children = []
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots.length > 0 ? roots : JSON.parse(JSON.stringify(CBS))
}

// Factory: wraps setCbsRows so any updater receives a rebuilt tree and the
// result is flattened before being persisted.
// Uses a functional update on setCbsRows so the latest committed state
// is used (avoids stale-closure bugs when multiple edits land in the
// same React batch).
export function createSetCbsData(
  setCbsRows: (updater: (prev: CbsNode[]) => CbsNode[]) => void
): (updater: (prev: CbsNode[]) => CbsNode[]) => void {
  return (updater) => {
    setCbsRows(prevRows => {
      const prevTree = rebuildTreeFromRows(prevRows)
      const next = updater(prevTree)
      return flattenForSave(next) as unknown as CbsNode[]
    })
  }
}

// Factory: creates an updateNode handler that mutates a single leaf's
// committed/actual/forecast and re-aggregates parent totals on the way
// back up the tree. Shows an undoable toast with the previous value.
//
// `flat` is the current flattened view of the tree (used to look up the
// previous value for the undo toast). Because the factory captures `flat`
// at call time, callers should re-invoke on each render so the latest
// state is reflected — mirroring the original inline definition.
export function createUpdateNode(
  flat: CbsNode[],
  setCbsData: (updater: (prev: CbsNode[]) => CbsNode[]) => void,
) {
  const updateNode = (code: string, field: 'committed' | 'actual' | 'forecast', value: number) => {
    // Capture the previous value so we can offer an undo. Walk the current
    // tree (before the setState commit) to find the leaf being edited.
    const prevNode = flat.find(c => c.code === code)
    const oldValue = prevNode ? prevNode[field] : 0
    setCbsData(prev => {
      const updated = JSON.parse(JSON.stringify(prev)) as CbsNode[]
      // walk() returns true if the target was found in this subtree, so the
      // caller can re-aggregate the parent on the way back up the recursion.
      const walk = (items: CbsNode[]): boolean => {
        for (const n of items) {
          if (n.code === code) {
            n[field] = Math.max(0, value)
            // Recalculate margin: (budget - forecast) / budget * 100
            n.marginPct = n.budget > 0 ? ((n.budget - n.forecast) / n.budget) * 100 : 0
            return true
          }
          if (n.children && walk(n.children)) {
            // Re-aggregate this parent from its children after a child changed.
            n.actual = n.children.reduce((s, c) => s + c.actual, 0)
            n.committed = n.children.reduce((s, c) => s + c.committed, 0)
            n.forecast = n.children.reduce((s, c) => s + c.forecast, 0)
            n.budget = n.children.reduce((s, c) => s + c.budget, 0)
            n.marginPct = n.budget > 0 ? ((n.budget - n.forecast) / n.budget) * 100 : 0
            return true
          }
        }
        return false
      }
      walk(updated)
      return updated
    })
    undoableToast(
      `${field[0].toUpperCase()}${field.slice(1)} updated`,
      `${code}: ${oldValue} → ${Math.max(0, value)}. Click Undo to revert.`,
      () => updateNode(code, field, oldValue),
    )
  }
  return updateNode
}
