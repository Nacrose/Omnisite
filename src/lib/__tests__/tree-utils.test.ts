import { describe, it, expect } from 'vitest'
import { flattenTree, rebuildTreeFromRows, findItemAndParent, updateLevels } from '@/lib/tree-utils'

// Use a permissive row shape so the helpers' dynamic key writes (parentKey,
// childrenKey) don't trip TS strict checks on object literals.
type Row = Record<string, any>

// ─── flattenTree ────────────────────────────────────────────────────────────

describe('flattenTree', () => {
  it('returns an empty array for empty input', () => {
    expect(flattenTree([])).toEqual([])
  })

  it('flattens a flat (no-children) list — sets parentKey to undefined for roots', () => {
    const items: Row[] = [
      { id: '1', name: 'a' },
      { id: '2', name: 'b' },
    ]
    const flat = flattenTree(items)
    expect(flat).toHaveLength(2)
    expect(flat[0].parentId).toBeUndefined()
    expect(flat[1].parentId).toBeUndefined()
    // Children arrays are stripped (set to undefined).
    expect(flat[0].children).toBeUndefined()
    expect(flat[1].children).toBeUndefined()
  })

  it('flattens a simple two-level tree', () => {
    const items: Row[] = [
      {
        id: '1',
        name: 'parent',
        children: [
          { id: '1.1', name: 'child-a' },
          { id: '1.2', name: 'child-b' },
        ],
      },
    ]
    const flat = flattenTree(items)
    expect(flat.map((r) => r.id)).toEqual(['1', '1.1', '1.2'])
    expect(flat[0].parentId).toBeUndefined()
    expect(flat[1].parentId).toBe('1')
    expect(flat[2].parentId).toBe('1')
  })

  it('flattens a deeply nested tree (4+ levels)', () => {
    const items: Row[] = [
      {
        id: '1',
        children: [
          {
            id: '1.1',
            children: [
              {
                id: '1.1.1',
                children: [{ id: '1.1.1.1', children: [] as Row[] }],
              },
            ],
          },
        ],
      },
    ]
    const flat = flattenTree(items)
    expect(flat.map((r) => r.id)).toEqual(['1', '1.1', '1.1.1', '1.1.1.1'])
    expect(flat[0].parentId).toBeUndefined()
    expect(flat[1].parentId).toBe('1')
    expect(flat[2].parentId).toBe('1.1')
    expect(flat[3].parentId).toBe('1.1.1')
  })

  it('respects custom idKey / parentKey / childrenKey', () => {
    const items: Row[] = [
      {
        code: 'A',
        children: [{ code: 'A.1', children: [] as Row[] }],
      },
    ]
    const flat = flattenTree(items, null, {
      idKey: 'code',
      parentKey: 'parentCode',
      childrenKey: 'children',
    })
    expect(flat.map((r) => r.code)).toEqual(['A', 'A.1'])
    expect(flat[0].parentCode).toBeUndefined()
    expect(flat[1].parentCode).toBe('A')
  })

  it('preserves extra fields on each row', () => {
    const items: Row[] = [
      {
        id: '1',
        name: 'parent',
        budget: 100,
        children: [{ id: '1.1', name: 'child', budget: 50, children: [] as Row[] }],
      },
    ]
    const flat = flattenTree(items)
    expect(flat[0]).toMatchObject({ id: '1', name: 'parent', budget: 100 })
    expect(flat[1]).toMatchObject({ id: '1.1', name: 'child', budget: 50 })
  })
})

// ─── rebuildTreeFromRows ────────────────────────────────────────────────────

describe('rebuildTreeFromRows', () => {
  it('returns [] for null / undefined / empty input', () => {
    expect(rebuildTreeFromRows(null, 'id', 'parentId')).toEqual([])
    expect(rebuildTreeFromRows(undefined, 'id', 'parentId')).toEqual([])
    expect(rebuildTreeFromRows([], 'id', 'parentId')).toEqual([])
  })

  it('returns rows as-is if they already have children arrays', () => {
    const rows: Row[] = [
      {
        id: '1',
        name: 'parent',
        children: [{ id: '1.1', name: 'child', children: undefined }],
      },
    ]
    const tree = rebuildTreeFromRows(rows, 'id', 'parentId')
    // Should return the same input — no rebuild.
    expect(tree).toBe(rows)
  })

  it('rebuilds a simple parent-child structure from flat rows', () => {
    const rows: Row[] = [
      { id: '1', name: 'parent', parentId: undefined },
      { id: '1.1', name: 'child-a', parentId: '1' },
      { id: '1.2', name: 'child-b', parentId: '1' },
    ]
    const tree = rebuildTreeFromRows(rows, 'id', 'parentId')
    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('1')
    expect(tree[0].children).toHaveLength(2)
    expect(tree[0].children.map((c: Row) => c.id)).toEqual(['1.1', '1.2'])
  })

  it('rebuilds a deep tree (3+ levels)', () => {
    const rows: Row[] = [
      { id: '1', parentId: undefined },
      { id: '1.1', parentId: '1' },
      { id: '1.1.1', parentId: '1.1' },
      { id: '1.1.1.1', parentId: '1.1.1' },
    ]
    const tree = rebuildTreeFromRows(rows, 'id', 'parentId')
    expect(tree).toHaveLength(1)
    expect(tree[0].children[0].children[0].children[0].id).toBe('1.1.1.1')
  })

  it('treats rows whose parent is missing (orphan) as roots', () => {
    const rows: Row[] = [
      { id: '1', parentId: undefined },
      { id: 'orphan', parentId: 'does-not-exist' },
    ]
    const tree = rebuildTreeFromRows(rows, 'id', 'parentId')
    expect(tree).toHaveLength(2)
    const ids = tree.map((r) => r.id).sort()
    expect(ids).toEqual(['1', 'orphan'])
  })

  it('treats rows with empty-string / null parent values as roots', () => {
    const rows: Row[] = [
      { id: 'a', parentId: '' },
      { id: 'b', parentId: null as unknown as undefined },
    ]
    const tree = rebuildTreeFromRows(rows, 'id', 'parentId')
    expect(tree).toHaveLength(2)
  })

  it('respects custom idKey / parentKey / childrenKey', () => {
    const rows: Row[] = [
      { code: 'A', parentCode: undefined as undefined },
      { code: 'A.1', parentCode: 'A' },
    ]
    const tree = rebuildTreeFromRows(rows, 'code', 'parentCode', 'children')
    expect(tree).toHaveLength(1)
    expect(tree[0].code).toBe('A')
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].code).toBe('A.1')
  })
})

// ─── findItemAndParent ──────────────────────────────────────────────────────

describe('findItemAndParent', () => {
  const tree: Row[] = [
    {
      id: '1',
      children: [
        {
          id: '1.1',
          children: [{ id: '1.1.1', children: [] as Row[] }],
        },
        { id: '1.2', children: [] as Row[] },
      ],
    },
    { id: '2', children: [] as Row[] },
  ]

  it('finds a root item with parent=null and depth=0', () => {
    const result = findItemAndParent(tree, '1')
    expect(result).not.toBeNull()
    expect(result!.item.id).toBe('1')
    expect(result!.parent).toBeNull()
    expect(result!.depth).toBe(0)
  })

  it('finds a deep child and returns its parent + depth', () => {
    const result = findItemAndParent(tree, '1.1.1')
    expect(result).not.toBeNull()
    expect(result!.item.id).toBe('1.1.1')
    expect(result!.parent!.id).toBe('1.1')
    expect(result!.depth).toBe(2)
  })

  it('returns null when the id is not present', () => {
    expect(findItemAndParent(tree, 'nope')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(findItemAndParent([], 'x')).toBeNull()
  })

  it('respects custom idKey + childrenKey', () => {
    const tree: Row[] = [
      {
        code: 'A',
        kids: [{ code: 'A.1', kids: [] as Row[] }],
      },
    ]
    const result = findItemAndParent(tree, 'A.1', 'code', 'kids')
    expect(result).not.toBeNull()
    expect(result!.item.code).toBe('A.1')
    expect(result!.parent!.code).toBe('A')
    expect(result!.depth).toBe(1)
  })
})

// ─── updateLevels ───────────────────────────────────────────────────────────

describe('updateLevels', () => {
  it('sets level on a leaf node', () => {
    const leaf: Row = { id: '1', level: 99 }
    const updated = updateLevels(leaf, 3)
    expect(updated.level).toBe(3)
  })

  it('recursively updates levels on a deep tree', () => {
    const tree: Row = {
      id: '1',
      level: -1,
      children: [
        { id: '1.1', level: -1, children: [] as Row[] },
        {
          id: '1.2',
          level: -1,
          children: [{ id: '1.2.1', level: -1, children: [] as Row[] }],
        },
      ],
    }
    const updated = updateLevels(tree, 0)
    expect(updated.level).toBe(0)
    expect(updated.children[0].level).toBe(1)
    expect(updated.children[1].level).toBe(1)
    expect(updated.children[1].children[0].level).toBe(2)
  })

  it('does NOT mutate the original input', () => {
    const tree: Row = {
      id: '1',
      level: 0,
      children: [{ id: '1.1', level: 0, children: [] as Row[] }],
    }
    const updated = updateLevels(tree, 5)
    expect(updated.level).toBe(5)
    // Original tree is unchanged.
    expect(tree.level).toBe(0)
    expect(tree.children[0].level).toBe(0)
  })

  it('respects custom childrenKey + levelKey', () => {
    const tree: Row = {
      code: 'A',
      depth: 0,
      subitems: [{ code: 'A.1', depth: 0, subitems: [] as Row[] }],
    }
    const updated = updateLevels(tree, 10, 'subitems', 'depth')
    expect(updated.depth).toBe(10)
    expect(updated.subitems[0].depth).toBe(11)
  })

  it('handles a node with no children key', () => {
    const leaf: Row = { id: '1', level: 0 }
    const updated = updateLevels(leaf, 4)
    expect(updated.level).toBe(4)
    expect(updated.children).toBeUndefined()
  })
})
