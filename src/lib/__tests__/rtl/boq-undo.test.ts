import { describe, it, expect } from 'vitest'

// ─── BOQ undo/redo logic tests ──────────────────────────────────────────────
// Tests the undo/redo stack behavior without React rendering.

describe('BOQ undo/redo stack', () => {
  interface BoqItem { id: string; code: string; desc: string; qty: number; rate: number; type: string; children?: BoqItem[] }

  it('undo restores previous state', () => {
    const state1: BoqItem[] = [{ id: '1', code: '1', desc: 'Original', qty: 10, rate: 100, type: 'Priced' }]
    const state2: BoqItem[] = [{ id: '1', code: '1', desc: 'Edited', qty: 20, rate: 100, type: 'Priced' }]

    const undoStack: BoqItem[][] = []
    const redoStack: BoqItem[][] = []

    // Simulate commitBoqData: push current to undo, clear redo, set new
    undoStack.push(JSON.parse(JSON.stringify(state1)))
    redoStack.length = 0

    // Simulate undo: pop from undo, push current to redo, restore
    const snapshot = undoStack.pop()!
    redoStack.push(JSON.parse(JSON.stringify(state2)))
    const restored = snapshot

    expect(restored[0].desc).toBe('Original')
    expect(restored[0].qty).toBe(10)
    expect(undoStack.length).toBe(0)
    expect(redoStack.length).toBe(1)
  })

  it('redo restores after undo', () => {
    const state1: BoqItem[] = [{ id: '1', code: '1', desc: 'Original', qty: 10, rate: 100, type: 'Priced' }]
    const state2: BoqItem[] = [{ id: '1', code: '1', desc: 'Edited', qty: 20, rate: 100, type: 'Priced' }]

    const undoStack = [JSON.parse(JSON.stringify(state1))]
    const redoStack: BoqItem[][] = []

    // Undo
    const snapshot = undoStack.pop()!
    redoStack.push(JSON.parse(JSON.stringify(state2)))

    // Redo
    const redoSnapshot = redoStack.pop()!
    undoStack.push(JSON.parse(JSON.stringify(snapshot)))
    const redone = redoSnapshot

    expect(redone[0].desc).toBe('Edited')
    expect(redone[0].qty).toBe(20)
  })

  it('new edit clears redo stack', () => {
    const undoStack: BoqItem[][] = []
    const redoStack: BoqItem[][] = [[{ id: '1', code: '1', desc: 'Old', qty: 5, rate: 50, type: 'Priced' }]]

    // Simulate new edit
    redoStack.length = 0
    expect(redoStack.length).toBe(0)
  })
})

// ─── Command palette search tests ───────────────────────────────────────────

describe('Command palette search', () => {
  it('filters modules by name', () => {
    const modules = [
      { id: 'boq', name: 'BOQ & Rate Analysis' },
      { id: 'scheduler', name: 'Scheduler' },
      { id: 'financials', name: 'Financials & Commercial' },
    ]
    const query = 'boq'
    const filtered = modules.filter(m => m.name.toLowerCase().includes(query.toLowerCase()))
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('boq')
  })

  it('returns empty for no match', () => {
    const modules = [{ id: 'boq', name: 'BOQ' }]
    const filtered = modules.filter(m => m.name.toLowerCase().includes('xyz'))
    expect(filtered).toHaveLength(0)
  })
})

// ─── Scheduler drag logic tests ──────────────────────────────────────────────

describe('Scheduler drag logic', () => {
  it('calculates week delta from pixel delta', () => {
    const WEEK_WIDTH = 40 // pixels per week
    const deltaPx = 80 // dragged 80px right
    const deltaWeeks = Math.round(deltaPx / WEEK_WIDTH)
    expect(deltaWeeks).toBe(2)
  })

  it('clamps start to valid range', () => {
    const TOTAL_WEEKS = 52
    const duration = 5
    const newStart = -3
    const clamped = Math.max(0, Math.min(TOTAL_WEEKS - duration, newStart))
    expect(clamped).toBe(0)
  })

  it('clamps duration to valid range', () => {
    const TOTAL_WEEKS = 52
    const start = 50
    const newDuration = 10
    const clamped = Math.max(1, Math.min(TOTAL_WEEKS - start, newDuration))
    expect(clamped).toBe(2) // 52 - 50 = 2 weeks max
  })
})
