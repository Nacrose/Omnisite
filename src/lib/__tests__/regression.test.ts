import { describe, it, expect } from 'vitest'
import { calculateCpm } from '@/lib/cpm'
import type { CpmTask } from '@/lib/cpm'

// ─── CBS Rollup Aggregation Tests ───────────────────────────────────────────
// Tests the Financials module's parent re-aggregation logic: when a leaf
// node's committed/actual/forecast is edited, the parent's values should
// be recomputed as the sum of children.

describe('CBS rollup aggregation', () => {
  // Simulate the walk-back-up re-aggregation logic from financials.tsx updateNode
  interface CbsNode {
    code: string
    name: string
    budget: number
    committed: number
    actual: number
    forecast: number
    marginPct: number
    level: number
    children?: CbsNode[]
  }

  function recomputeParent(node: CbsNode): void {
    if (!node.children || node.children.length === 0) return
    node.budget = node.children.reduce((s, c) => s + c.budget, 0)
    node.committed = node.children.reduce((s, c) => s + c.committed, 0)
    node.actual = node.children.reduce((s, c) => s + c.actual, 0)
    node.forecast = node.children.reduce((s, c) => s + c.forecast, 0)
    node.marginPct = node.budget > 0 ? ((node.budget - node.forecast) / node.budget) * 100 : 0
  }

  it('parent totals = sum of children after leaf edit', () => {
    const tree: CbsNode = {
      code: '1', name: 'Bridge', budget: 0, committed: 0, actual: 0, forecast: 0, marginPct: 0, level: 0,
      children: [
        { code: '1.1', name: 'Foundation', budget: 84, committed: 82, actual: 48, forecast: 80, marginPct: 4.8, level: 1 },
        { code: '1.2', name: 'Substructure', budget: 112, committed: 108, actual: 64, forecast: 110, marginPct: 1.8, level: 1 },
      ],
    }
    // Edit leaf 1.1's actual from 48 to 50
    tree.children![0].actual = 50
    recomputeParent(tree)
    expect(tree.actual).toBe(114) // 50 + 64
    expect(tree.budget).toBe(196) // 84 + 112
    expect(tree.committed).toBe(190) // 82 + 108
    expect(tree.forecast).toBe(190) // 80 + 110
  })

  it('parent marginPct recalculated after leaf edit', () => {
    const tree: CbsNode = {
      code: '1', name: 'Bridge', budget: 0, committed: 0, actual: 0, forecast: 0, marginPct: 0, level: 0,
      children: [
        { code: '1.1', name: 'Foundation', budget: 100, committed: 90, actual: 50, forecast: 95, marginPct: 5, level: 1 },
      ],
    }
    // Edit leaf 1.1's forecast from 95 to 110 (over budget)
    tree.children![0].forecast = 110
    recomputeParent(tree)
    expect(tree.forecast).toBe(110)
    expect(tree.budget).toBe(100)
    expect(tree.marginPct).toBe(-10) // (100-110)/100 * 100
  })

  it('handles zero budget (no div-by-zero)', () => {
    const tree: CbsNode = {
      code: '1', name: 'Empty', budget: 0, committed: 0, actual: 0, forecast: 0, marginPct: 0, level: 0,
      children: [
        { code: '1.1', name: 'Leaf', budget: 0, committed: 0, actual: 0, forecast: 0, marginPct: 0, level: 1 },
      ],
    }
    recomputeParent(tree)
    expect(tree.marginPct).toBe(0) // no NaN/Infinity
  })
})

// ─── Project Scoping Tests ──────────────────────────────────────────────────
// Tests that data is filtered by project_id when the project switcher changes.

describe('Project scoping filter', () => {
  interface Row { id: string; project_id: string; name: string }

  const ROWS: Row[] = [
    { id: 'r1', project_id: '00000000-0000-0000-0000-000000000001', name: 'P1 item' },
    { id: 'r2', project_id: '00000000-0000-0000-0000-000000000002', name: 'P2 item' },
    { id: 'r3', project_id: '00000000-0000-0000-0000-000000000001', name: 'P1 item 2' },
  ]

  it('filters rows by project_id', () => {
    const p1 = ROWS.filter(r => r.project_id === '00000000-0000-0000-0000-000000000001')
    expect(p1).toHaveLength(2)
    expect(p1.every(r => r.project_id === '00000000-0000-0000-0000-000000000001')).toBe(true)
  })

  it('returns empty for unknown project', () => {
    const p99 = ROWS.filter(r => r.project_id === 'unknown')
    expect(p99).toHaveLength(0)
  })

  it('returns all when no project_id filter', () => {
    expect(ROWS).toHaveLength(3)
  })
})

// ─── CPM Critical Path Tests (existing, extended) ───────────────────────────

describe('CPM with predecessors', () => {
  it('computes critical path with real dependencies', () => {
    const tasks: CpmTask[] = [
      { id: 'A', duration: 5, predecessors: [] },
      { id: 'B', duration: 3, predecessors: ['A'] },
      { id: 'C', duration: 4, predecessors: ['A'] },
      { id: 'D', duration: 2, predecessors: ['B', 'C'] },
    ]
    const result = calculateCpm(tasks)
    // A(5) → C(4) → D(2) = 11 days is the critical path (longer than A→B→D = 10)
    expect(result.projectDuration).toBe(11)
    expect(result.criticalPath).toContain('A')
    expect(result.criticalPath).toContain('C')
    expect(result.criticalPath).toContain('D')
    expect(result.criticalPath).not.toContain('B')
  })
})
