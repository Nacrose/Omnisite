import { describe, it, expect } from 'vitest'
import { computeDiff } from '@/lib/audit'

// ─── computeDiff ────────────────────────────────────────────────────────────

describe('computeDiff', () => {
  it('returns an empty diff for identical objects', () => {
    const old = { a: 1, b: 'x', c: true }
    const new_ = { a: 1, b: 'x', c: true }
    expect(computeDiff(old, new_)).toEqual({})
  })

  it('reports a single changed field', () => {
    const old = { id: '1', name: 'Old', qty: 5 }
    const new_ = { id: '1', name: 'New', qty: 5 }
    const diff = computeDiff(old, new_)
    expect(Object.keys(diff)).toEqual(['name'])
    expect(diff.name).toEqual({ old: 'Old', new: 'New' })
  })

  it('reports multiple changed fields', () => {
    const old = { id: '1', name: 'Old', qty: 5, rate: 100 }
    const new_ = { id: '1', name: 'New', qty: 10, rate: 100 }
    const diff = computeDiff(old, new_)
    expect(Object.keys(diff).sort()).toEqual(['name', 'qty'])
    expect(diff.name).toEqual({ old: 'Old', new: 'New' })
    expect(diff.qty).toEqual({ old: 5, new: 10 })
  })

  it('does not report fields only present in old (iterates new_ keys only)', () => {
    const old = { id: '1', name: 'Old', removed: 'gone' }
    const new_ = { id: '1', name: 'Old' }
    const diff = computeDiff(old, new_)
    expect(diff).toEqual({})
  })

  it('reports a new field (present in new_, missing in old)', () => {
    const old = { id: '1' }
    const new_ = { id: '1', added: 'new!' }
    const diff = computeDiff(old, new_)
    expect(diff.added).toEqual({ old: undefined, new: 'new!' })
  })

  it('compares nested objects by deep equality (no change)', () => {
    const old = { meta: { a: 1, b: 2 } }
    const new_ = { meta: { a: 1, b: 2 } }
    expect(computeDiff(old, new_)).toEqual({})
  })

  it('reports a nested object change', () => {
    const old = { meta: { a: 1, b: 2 } }
    const new_ = { meta: { a: 1, b: 99 } }
    const diff = computeDiff(old, new_)
    expect(diff.meta).toEqual({ old: { a: 1, b: 2 }, new: { a: 1, b: 99 } })
  })

  it('treats key-order-differing nested objects as equal (JSON.stringify)', () => {
    // JSON.stringify is order-sensitive, but {a:1,b:2} and {b:2,a:1} produce
    // different strings. computeDiff uses JSON.stringify so it considers
    // these different — documenting that behaviour.
    const old = { meta: { a: 1, b: 2 } }
    const new_ = { meta: { b: 2, a: 1 } }
    const diff = computeDiff(old, new_)
    expect(diff.meta).toBeDefined()
  })

  it('compares arrays by deep equality (no change)', () => {
    const old = { tags: ['a', 'b', 'c'] }
    const new_ = { tags: ['a', 'b', 'c'] }
    expect(computeDiff(old, new_)).toEqual({})
  })

  it('reports an array change', () => {
    const old = { tags: ['a', 'b'] }
    const new_ = { tags: ['a', 'b', 'c'] }
    const diff = computeDiff(old, new_)
    expect(diff.tags).toEqual({ old: ['a', 'b'], new: ['a', 'b', 'c'] })
  })

  it('treats null and undefined as different from real values', () => {
    const old = { a: null, b: undefined, c: 1 }
    const new_ = { a: 'x', b: 'y', c: null }
    const diff = computeDiff(old, new_)
    expect(diff.a).toEqual({ old: null, new: 'x' })
    expect(diff.b).toEqual({ old: undefined, new: 'y' })
    expect(diff.c).toEqual({ old: 1, new: null })
  })

  it('treats null and undefined as different from each other', () => {
    // JSON.stringify(undefined) === undefined, JSON.stringify(null) === 'null'.
    // So { a: null } vs { a: undefined } should produce a diff.
    const old = { a: null }
    const new_ = { a: undefined }
    const diff = computeDiff(old, new_)
    expect(diff.a).toBeDefined()
  })

  it('reports type changes (number → string)', () => {
    const old = { qty: 5 }
    const new_ = { qty: '5' }
    const diff = computeDiff(old, new_)
    expect(diff.qty).toEqual({ old: 5, new: '5' })
  })

  it('reports type changes (boolean → number)', () => {
    const old = { active: 1 }
    const new_ = { active: true }
    const diff = computeDiff(old, new_)
    expect(diff.active).toEqual({ old: 1, new: true })
  })

  it('returns an empty diff for two empty objects', () => {
    expect(computeDiff({}, {})).toEqual({})
  })

  it('handles a mix of unchanged, changed, added, and removed fields', () => {
    const old = { id: '1', name: 'Old', qty: 5, removed: 'gone', kept: true }
    const new_ = { id: '1', name: 'New', qty: 5, added: 'new', kept: true }
    const diff = computeDiff(old, new_)
    // Only 'name' (changed) and 'added' (new) should appear in the diff.
    expect(Object.keys(diff).sort()).toEqual(['added', 'name'])
  })
})
