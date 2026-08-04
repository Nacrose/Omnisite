import { produce } from 'immer'
import { CBS, type CbsNode } from './types'
import { undoableToast } from '@/components/ui/confirm-dialog'
import { flattenTree, createTreeRebuilder } from '@/lib/tree-utils'

// Deep-clone helper using immer's produce() with a no-op recipe.
// Intentionally used instead of structuredClone() for undo/redo snapshots:
// immer's structural sharing means that for large trees where only a few
// leaves changed, the clone is much cheaper (shares unchanged subtrees by
// reference) than structuredClone which deep-copies everything.
const deepClone = <T>(obj: T): T => produce(obj, () => {})

// ─── CBS margin_pct formula ─────────────────────────────────────────────────
//
// The SINGLE source of truth for the margin_pct computation. Used by both
// `recomputeCbsParent` (parent roll-up) and `createUpdateNode` (leaf edit)
// so the two paths can NEVER drift apart.
//
// Standard formula:
//   margin_pct = (budget - forecast) / budget * 100
//
// `forecast` (Estimated At Completion) is used — NOT `actual` — because
// forecast is the best estimate of final cost (it includes actuals + the
// remaining budget to complete). `actual` alone under-reports cost on
// in-progress nodes and would over-state margin.
//
// This MUST match the DB trigger `recompute_cbs_subtree` in
// `supabase/migrations/00000000000009_audit_project_id_indexes_constraints.sql`
// (and the equivalent definitions in `00000000000000_schema.sql` and
// `00000000000004_cbs_subtree_trigger.sql`). Both client and server use
// the forecast-based formula.
//
// Exported so the regression test can exercise it directly.
export function computeMarginPct(budget: number, forecast: number): number {
  return budget > 0 ? ((budget - forecast) / budget) * 100 : 0
}

// ─── CBS parent re-aggregation ──────────────────────────────────────────────
// When a leaf's committed/actual/forecast is edited, the parent's totals
// must be recomputed as the sum of its children. This is the shared
// aggregation step used by both the walk-back-up logic in createUpdateNode
// and any caller that needs to recompute a parent after mutating leaves.
//
// Exported so the regression test can exercise it without reimplementing
// the formula locally.
export function recomputeCbsParent(node: CbsNode): void {
  if (!node.children || node.children.length === 0) return
  node.budget = node.children.reduce((s, c) => s + c.budget, 0)
  node.committed = node.children.reduce((s, c) => s + c.committed, 0)
  node.actual = node.children.reduce((s, c) => s + c.actual, 0)
  node.forecast = node.children.reduce((s, c) => s + c.forecast, 0)
  node.marginPct = computeMarginPct(node.budget, node.forecast)
}

// ─── Field normalization ──────────────────────────────────────────────────
//
// The DB layer (useSyncedState) may return rows with snake_case column
// names (`margin_pct`, `parent_code`). Normalize them into the app-side
// CbsNode shape BEFORE rebuilding the tree — the shared tree-utils helpers
// only handle tree structure, not field-name mapping.

function normalizeCbsRow(row: Record<string, unknown>): CbsNode {
  return {
    code: row.code as string,
    name: row.name as string,
    budget: Number(row.budget) || 0,
    committed: Number(row.committed) || 0,
    actual: Number(row.actual) || 0,
    forecast: Number(row.forecast) || 0,
    marginPct: Number(row.marginPct ?? row.margin_pct) || 0,
    level: Number(row.level) || 0,
    // Preserve parentCode (with snake_case fallback) so rebuildTreeFromRows
    // can re-attach children after a flatten→rebuild round-trip. Without
    // this, every row would become a root after the first edit (audit F1-6).
    parentCode: (row.parentCode ?? row.parent_code ?? undefined) as string | undefined,
  }
}

// Flatten tree for saving — strips children and sets parentCode on each node.
// This is the "save" flattener (as opposed to the display flattener in types.ts
// which preserves the tree structure in its output).
//
// Delegates to the shared `flattenTree` helper, configured for the CbsNode
// shape: id field is `code`, parent field is `parentCode`.
export function flattenForSave(items: CbsNode[], parentCode: string | null = null): CbsNode[] {
  return flattenTree(items as unknown as Record<string, unknown>[], parentCode, {
    idKey: 'code',
    parentKey: 'parentCode',
  }) as unknown as CbsNode[]
}

// Rebuild a tree from flat rows (which may have parentCode set).
// If rows already have children arrays, returns them as-is.
// Falls back to the CBS constant if rows is empty or yields no roots.
//
// Implemented via the shared `createTreeRebuilder` factory so the
// rebuild-or-fallback pattern is identical to the BOQ module.
export const rebuildTreeFromRows = createTreeRebuilder<CbsNode>({
  seed: CBS,
  cloneSeed: deepClone,
  idKey: 'code',
  parentKey: 'parentCode',
  normalize: normalizeCbsRow,
})

// Factory: wraps setCbsRows so any updater receives a rebuilt tree and the
// result is flattened before being persisted.
// Uses a functional update on setCbsRows so the latest committed state
// is used (avoids stale-closure bugs when multiple edits land in the
// same React batch).
export function createSetCbsData(
  setCbsRows: (updater: (prev: CbsNode[]) => CbsNode[]) => void
): (updater: (prev: CbsNode[]) => CbsNode[]) => void {
  return (updater) => {
    setCbsRows((prevRows) => {
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
  setCbsData: (updater: (prev: CbsNode[]) => CbsNode[]) => void
) {
  const updateNode = (code: string, field: 'committed' | 'actual' | 'forecast', value: number) => {
    // Capture the previous value so we can offer an undo. Walk the current
    // tree (before the setState commit) to find the leaf being edited.
    const prevNode = flat.find((c) => c.code === code)
    const oldValue = prevNode ? prevNode[field] : 0
    setCbsData((prev) => {
      return produce(prev, (draft) => {
        const walk = (items: CbsNode[]): boolean => {
          for (const n of items) {
            if (n.code === code) {
              n[field] = Math.max(0, value)
              n.marginPct = computeMarginPct(n.budget, n.forecast)
              return true
            }
            if (n.children && walk(n.children)) {
              recomputeCbsParent(n)
              return true
            }
          }
          return false
        }
        walk(draft as CbsNode[])
      })
    })
    // Only show the undo toast when the value actually changes (not on every
    // keystroke that produces the same parsed number, e.g. typing "4" then
    // "45" then "450" would fire 3 toasts for 3 different values — that's
    // correct behavior, but previously the toast also fired for no-op
    // keystrokes like typing "0" when the value was already 0). Also format
    // the numbers with toLocaleString so they're readable (audit F2-1, F2-2).
    if (oldValue !== Math.max(0, value)) {
      undoableToast(
        `${field[0].toUpperCase()}${field.slice(1)} updated`,
        `${code}: ${oldValue.toLocaleString('en-IN')} → ${Math.max(0, value).toLocaleString('en-IN')}. Click Undo to revert.`,
        () => updateNode(code, field, oldValue)
      )
    }
  }
  return updateNode
}
