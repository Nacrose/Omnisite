import { describe, it, expect } from 'vitest'
import {
  TABLE_TO_ENDPOINT,
  endpointFor,
  snakeToCamel,
  camelToSnake,
  shallowEqualRecords,
} from '@/lib/use-synced-state-helpers'

// ─── endpointFor / TABLE_TO_ENDPOINT ────────────────────────────────────────
//
// The endpoint mapping is security-relevant: a wrong entry means POSTs
// silently 404 and data round-trips only to localStorage, never reaching
// the server's audit trail. These tests lock down every known mapping.

describe('endpointFor', () => {
  it('maps known snake_case table names to kebab-case API endpoints', () => {
    expect(endpointFor('cbs_nodes')).toBe('cbs-nodes')
    expect(endpointFor('qs_items')).toBe('qs-items')
    expect(endpointFor('chat_messages')).toBe('chat-messages')
    expect(endpointFor('drawing_annotations')).toBe('drawing-annotations')
    expect(endpointFor('purchase_orders')).toBe('purchase-orders')
    expect(endpointFor('stock_items')).toBe('stock-items')
    expect(endpointFor('project_locations')).toBe('project-locations')
    expect(endpointFor('user_projects')).toBe('user-projects')
    expect(endpointFor('dsr_entries')).toBe('dsr-entries')
    expect(endpointFor('boq_items')).toBe('boq')
  })

  it('passes through table names that match their endpoint verbatim', () => {
    expect(endpointFor('tasks')).toBe('tasks')
    expect(endpointFor('workers')).toBe('workers')
    expect(endpointFor('equipment')).toBe('equipment')
    expect(endpointFor('letters')).toBe('letters')
    expect(endpointFor('grns')).toBe('grns')
    expect(endpointFor('vendors')).toBe('vendors')
    expect(endpointFor('requisitions')).toBe('requisitions')
    expect(endpointFor('drawings')).toBe('drawings')
    expect(endpointFor('subcontractors')).toBe('subcontractors')
  })

  it('falls back to the table name verbatim for unknown tables', () => {
    expect(endpointFor('unknown_table')).toBe('unknown_table')
    expect(endpointFor('')).toBe('')
  })

  it('TABLE_TO_ENDPOINT has no duplicate values (every slug is unique)', () => {
    const values = Object.values(TABLE_TO_ENDPOINT)
    const dupes = values.filter((v, i) => values.indexOf(v) !== i)
    expect(dupes).toEqual([])
  })
})

// ─── snakeToCamel / camelToSnake ────────────────────────────────────────────

describe('snakeToCamel', () => {
  it('converts simple snake_case', () => {
    expect(snakeToCamel('has_ra')).toBe('hasRa')
    expect(snakeToCamel('parent_id')).toBe('parentId')
    expect(snakeToCamel('project_id')).toBe('projectId')
  })

  it('converts multi-word snake_case', () => {
    expect(snakeToCamel('created_at')).toBe('createdAt')
    expect(snakeToCamel('baseline_finish')).toBe('baselineFinish')
    expect(snakeToCamel('license_expiry')).toBe('licenseExpiry')
  })

  it('passes through already-camelCase', () => {
    expect(snakeToCamel('hasRa')).toBe('hasRa')
    expect(snakeToCamel('parentId')).toBe('parentId')
  })

  it('passes through simple lowercase', () => {
    expect(snakeToCamel('code')).toBe('code')
    expect(snakeToCamel('name')).toBe('name')
  })
})

describe('camelToSnake', () => {
  it('converts simple camelCase', () => {
    expect(camelToSnake('hasRa')).toBe('has_ra')
    expect(camelToSnake('parentId')).toBe('parent_id')
    expect(camelToSnake('projectId')).toBe('project_id')
  })

  it('converts multi-word camelCase', () => {
    expect(camelToSnake('createdAt')).toBe('created_at')
    expect(camelToSnake('baselineFinish')).toBe('baseline_finish')
    expect(camelToSnake('licenseExpiry')).toBe('license_expiry')
  })

  it('passes through already-snake_case', () => {
    expect(camelToSnake('has_ra')).toBe('has_ra')
    expect(camelToSnake('parent_id')).toBe('parent_id')
  })
})

describe('snake ↔ camel round-trip', () => {
  it('snake → camel → snake preserves the original', () => {
    const cases = [
      'has_ra',
      'parent_id',
      'project_id',
      'created_at',
      'baseline_finish',
      'code',
      'name',
    ]
    for (const s of cases) {
      expect(camelToSnake(snakeToCamel(s))).toBe(s)
    }
  })

  it('camel → snake → camel preserves the original', () => {
    const cases = ['hasRa', 'parentId', 'projectId', 'createdAt', 'baselineFinish', 'code', 'name']
    for (const s of cases) {
      expect(snakeToCamel(camelToSnake(s))).toBe(s)
    }
  })
})

// ─── shallowEqualRecords ────────────────────────────────────────────────────

describe('shallowEqualRecords', () => {
  it('returns true for identical objects', () => {
    expect(shallowEqualRecords({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true)
  })

  it('returns false for different values', () => {
    expect(shallowEqualRecords({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false)
  })

  it('returns false for different key counts', () => {
    expect(shallowEqualRecords({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })

  it('returns false for different keys', () => {
    expect(shallowEqualRecords({ a: 1 }, { b: 1 })).toBe(false)
  })

  it('returns true for empty objects', () => {
    expect(shallowEqualRecords({}, {})).toBe(true)
  })

  it('compares nested objects by reference (not deep equality)', () => {
    const nested = { x: 1 }
    expect(shallowEqualRecords({ data: nested }, { data: nested })).toBe(true)
    expect(shallowEqualRecords({ data: { x: 1 } }, { data: { x: 1 } })).toBe(false)
  })

  it('compares arrays by reference (not deep equality)', () => {
    const arr = [1, 2, 3]
    expect(shallowEqualRecords({ items: arr }, { items: arr })).toBe(true)
    expect(shallowEqualRecords({ items: [1, 2, 3] }, { items: [1, 2, 3] })).toBe(false)
  })
})
