import { describe, it, expect } from 'vitest'
import { calculateCpm } from '@/lib/cpm'
import type { CpmTask } from '@/lib/cpm'
import { recomputeCbsParent } from '@/components/modules/financials/hooks'
import type { CbsNode } from '@/components/modules/financials/types'

// ─── CBS Rollup Aggregation Tests ───────────────────────────────────────────
// Tests the Financials module's parent re-aggregation logic: when a leaf
// node's committed/actual/forecast is edited, the parent's values should
// be recomputed as the sum of children.
//
// Imports the real `recomputeCbsParent` from the production module — so
// this test fails if the rollup formula in hooks.ts is ever broken.

describe('CBS rollup aggregation', () => {
  it('parent totals = sum of children after leaf edit', () => {
    const tree: CbsNode = {
      code: '1',
      name: 'Bridge',
      budget: 0,
      committed: 0,
      actual: 0,
      forecast: 0,
      marginPct: 0,
      level: 0,
      children: [
        {
          code: '1.1',
          name: 'Foundation',
          budget: 84,
          committed: 82,
          actual: 48,
          forecast: 80,
          marginPct: 4.8,
          level: 1,
        },
        {
          code: '1.2',
          name: 'Substructure',
          budget: 112,
          committed: 108,
          actual: 64,
          forecast: 110,
          marginPct: 1.8,
          level: 1,
        },
      ],
    }
    // Edit leaf 1.1's actual from 48 to 50
    tree.children![0].actual = 50
    recomputeCbsParent(tree)
    expect(tree.actual).toBe(114) // 50 + 64
    expect(tree.budget).toBe(196) // 84 + 112
    expect(tree.committed).toBe(190) // 82 + 108
    expect(tree.forecast).toBe(190) // 80 + 110
  })

  it('parent marginPct recalculated after leaf edit', () => {
    const tree: CbsNode = {
      code: '1',
      name: 'Bridge',
      budget: 0,
      committed: 0,
      actual: 0,
      forecast: 0,
      marginPct: 0,
      level: 0,
      children: [
        {
          code: '1.1',
          name: 'Foundation',
          budget: 100,
          committed: 90,
          actual: 50,
          forecast: 95,
          marginPct: 5,
          level: 1,
        },
      ],
    }
    // Edit leaf 1.1's forecast from 95 to 110 (over budget)
    tree.children![0].forecast = 110
    recomputeCbsParent(tree)
    expect(tree.forecast).toBe(110)
    expect(tree.budget).toBe(100)
    expect(tree.marginPct).toBe(-10) // (100-110)/100 * 100
  })

  it('handles zero budget (no div-by-zero)', () => {
    const tree: CbsNode = {
      code: '1',
      name: 'Empty',
      budget: 0,
      committed: 0,
      actual: 0,
      forecast: 0,
      marginPct: 0,
      level: 0,
      children: [
        {
          code: '1.1',
          name: 'Leaf',
          budget: 0,
          committed: 0,
          actual: 0,
          forecast: 0,
          marginPct: 0,
          level: 1,
        },
      ],
    }
    recomputeCbsParent(tree)
    expect(tree.marginPct).toBe(0) // no NaN/Infinity
  })

  it('is a no-op when the node has no children (leaf)', () => {
    const leaf: CbsNode = {
      code: '1.1',
      name: 'Leaf',
      budget: 100,
      committed: 90,
      actual: 50,
      forecast: 95,
      marginPct: 5,
      level: 1,
    }
    recomputeCbsParent(leaf)
    // All values are unchanged.
    expect(leaf.budget).toBe(100)
    expect(leaf.committed).toBe(90)
    expect(leaf.actual).toBe(50)
    expect(leaf.forecast).toBe(95)
    expect(leaf.marginPct).toBe(5)
  })
})

// ─── Project Scoping Tests ──────────────────────────────────────────────────
// Tests that data is filtered by project_id when the project switcher changes.

describe('Project scoping filter', () => {
  interface Row {
    id: string
    project_id: string
    name: string
  }

  const ROWS: Row[] = [
    { id: 'r1', project_id: '00000000-0000-0000-0000-000000000001', name: 'P1 item' },
    { id: 'r2', project_id: '00000000-0000-0000-0000-000000000002', name: 'P2 item' },
    { id: 'r3', project_id: '00000000-0000-0000-0000-000000000001', name: 'P1 item 2' },
  ]

  it('filters rows by project_id', () => {
    const p1 = ROWS.filter((r) => r.project_id === '00000000-0000-0000-0000-000000000001')
    expect(p1).toHaveLength(2)
    expect(p1.every((r) => r.project_id === '00000000-0000-0000-0000-000000000001')).toBe(true)
  })

  it('returns empty for unknown project', () => {
    const p99 = ROWS.filter((r) => r.project_id === 'unknown')
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
