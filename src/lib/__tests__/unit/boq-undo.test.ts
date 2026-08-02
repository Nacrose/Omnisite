import { describe, it, expect, vi, beforeEach } from 'vitest'
import type React from 'react'

// Mock sonner.toast so handler side-effects don't blow up in jsdom.
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}))

import { toast } from 'sonner'

// Mock undoableToast — it calls into sonner + Radix Dialog at runtime, which
// we don't need to exercise for the undo/redo stack logic.
vi.mock('@/components/ui/confirm-dialog', () => ({
  undoableToast: vi.fn(),
}))

import {
  commitBoqData,
  undo,
  redo,
  updateItem,
  duplicateItem,
  addChildItem,
  deleteItem,
  reparentItem,
  rebuildBoqTree,
  type BoqHandlerCtx,
} from '@/components/modules/boq/handlers'
import type { BoqItem } from '@/components/modules/boq/types'
import { BOQ_DATA } from '@/components/modules/boq/types'

// ─── Test harness ─────────────────────────────────────────────────────────
//
// A minimal in-memory React-setter substitute. Each "setter" mutates a
// `state` object that the test reads back via `ctx.boqData` after re-running
// `rebuildBoqTree` on the captured rows. This lets us exercise the real
// commitBoqData / undo / redo code paths (which call setBoqRows with either
// a value or an updater function) without mounting React.

interface HarnessState {
  rows: BoqItem[] // raw rows (post-flatten, what setBoqRows received)
  undoStack: BoqItem[][]
  redoStack: BoqItem[][]
  expanded: string[]
  selectedId: string | null
}

function applySetter<T>(cur: T, next: React.SetStateAction<T>): T {
  return typeof next === 'function' ? (next as (prev: T) => T)(cur) : next
}

function makeCtx(state: HarnessState): BoqHandlerCtx {
  const ctx: BoqHandlerCtx = {
    get boqData() {
      return rebuildBoqTree(state.rows)
    },
    get allFlat() {
      const tree = rebuildBoqTree(state.rows)
      const flat: BoqItem[] = []
      const walk = (items: BoqItem[]) => {
        for (const it of items) {
          flat.push(it)
          if (it.children) walk(it.children)
        }
      }
      walk(tree)
      return flat
    },
    setBoqRows: (next) => {
      state.rows = applySetter(state.rows, next) as BoqItem[]
    },
    setUndoStack: (next) => {
      state.undoStack = applySetter(state.undoStack, next) as BoqItem[][]
    },
    setRedoStack: (next) => {
      state.redoStack = applySetter(state.redoStack, next) as BoqItem[][]
    },
    setExpandedArr: (next) => {
      state.expanded = applySetter(state.expanded, next) as string[]
    },
    setSelectedId: (id) => {
      state.selectedId = id
    },
    get undoStack() {
      return state.undoStack
    },
    get redoStack() {
      return state.redoStack
    },
    undoRef: { current: () => {} },
  }
  return ctx
}

function freshState(): HarnessState {
  return {
    rows: structuredClone(BOQ_DATA) as BoqItem[],
    undoStack: [],
    redoStack: [],
    expanded: [],
    selectedId: null,
  }
}

// Recursive leaf updater — walks the tree and returns a new tree with the
// matching leaf's field replaced. (The real handlers use immer's `produce`
// with a walk; we use a plain recursive map to keep the test dependency-free
// and to make the updater's intent explicit.)
function setLeafField(
  items: BoqItem[],
  id: string,
  field: 'qty' | 'rate',
  value: number
): BoqItem[] {
  return items.map((it) => {
    if (it.id === id) {
      return { ...it, [field]: value }
    }
    if (it.children) {
      return { ...it, children: setLeafField(it.children, id, field, value) }
    }
    return it
  })
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('BOQ handlers — commitBoqData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pushes the pre-commit tree to the undo stack and clears redo', () => {
    const state = freshState()
    const ctx = makeCtx(state)

    commitBoqData((prev) => setLeafField(prev, '1.1.1', 'qty', 9999), ctx)

    expect(state.undoStack).toHaveLength(1)
    // The pushed snapshot must capture the pre-commit qty (1240, not 9999).
    expect(state.undoStack[0][0].id).toBe('1') // same root id
    expect(state.undoStack[0][0].children![0].children![0].qty).toBe(1240) // original qty
    // Redo stack must be cleared.
    expect(state.redoStack).toHaveLength(0)
    // The committed tree must reflect the edit.
    expect(ctx.boqData[0].children![0].children![0].qty).toBe(9999)
  })

  it('multiple commits accumulate on the undo stack in order', () => {
    const state = freshState()
    const ctx = makeCtx(state)

    commitBoqData((prev) => setLeafField(prev, '1.1.1', 'qty', 100), ctx)
    commitBoqData((prev) => setLeafField(prev, '1.1.1', 'qty', 200), ctx)
    commitBoqData((prev) => setLeafField(prev, '1.1.1', 'qty', 300), ctx)

    expect(state.undoStack).toHaveLength(3)
    // Oldest snapshot has the original qty; newest has 200 (state before the 3rd commit).
    expect(state.undoStack[0][0].children![0].children![0].qty).toBe(1240)
    expect(state.undoStack[1][0].children![0].children![0].qty).toBe(100)
    expect(state.undoStack[2][0].children![0].children![0].qty).toBe(200)
    // Live tree has the latest commit.
    expect(ctx.boqData[0].children![0].children![0].qty).toBe(300)
  })
})

describe('BOQ handlers — undo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('is a no-op when the undo stack is empty', () => {
    const state = freshState()
    const ctx = makeCtx(state)
    const rowsBefore = state.rows

    undo(ctx)

    expect(state.undoStack).toHaveLength(0)
    expect(state.redoStack).toHaveLength(0)
    // setBoqRows was not called, so rows ref is unchanged.
    expect(state.rows).toBe(rowsBefore)
  })

  it('pops the last snapshot, restores it, and pushes the current tree to redo', () => {
    const state = freshState()
    const ctx = makeCtx(state)

    // Commit one edit, then undo it.
    commitBoqData((prev) => setLeafField(prev, '1.1.1', 'qty', 9999), ctx)
    expect(ctx.boqData[0].children![0].children![0].qty).toBe(9999)

    undo(ctx)

    expect(state.undoStack).toHaveLength(0)
    expect(state.redoStack).toHaveLength(1)
    // The restored tree must have the ORIGINAL qty.
    expect(ctx.boqData[0].children![0].children![0].qty).toBe(1240)
    // The redo snapshot must capture the post-edit (pre-undo) tree.
    expect(state.redoStack[0][0].children![0].children![0].qty).toBe(9999)
  })
})

describe('BOQ handlers — redo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('is a no-op when the redo stack is empty', () => {
    const state = freshState()
    const ctx = makeCtx(state)
    const rowsBefore = state.rows

    redo(ctx)

    expect(state.redoStack).toHaveLength(0)
    expect(state.undoStack).toHaveLength(0)
    expect(state.rows).toBe(rowsBefore)
  })

  it('restores the redo snapshot and pushes the current tree back to undo', () => {
    const state = freshState()
    const ctx = makeCtx(state)

    commitBoqData((prev) => setLeafField(prev, '1.1.1', 'qty', 9999), ctx)
    undo(ctx) // Now live tree is back to original, redo stack has 1 entry.

    redo(ctx)

    expect(state.redoStack).toHaveLength(0)
    expect(state.undoStack).toHaveLength(1)
    // The redone tree must have the edited qty.
    expect(ctx.boqData[0].children![0].children![0].qty).toBe(9999)
    // The undo snapshot must capture the pre-redo (original) tree.
    expect(state.undoStack[0][0].children![0].children![0].qty).toBe(1240)
  })
})

describe('BOQ handlers — new commit clears redo stack', () => {
  beforeEach(() => vi.clearAllMocks())

  it('a fresh edit after undo wipes the redo stack', () => {
    const state = freshState()
    const ctx = makeCtx(state)

    commitBoqData((prev) => setLeafField(prev, '1.1.1', 'qty', 100), ctx)
    undo(ctx) // redo stack now has 1 entry, undo stack is empty.

    // Different edit — should clear redo and push the (restored) current state.
    commitBoqData((prev) => setLeafField(prev, '1.1.2', 'qty', 200), ctx)

    expect(state.redoStack).toHaveLength(0)
    // After undo, live state was back to original; the new commit pushed that
    // restored-original state to the undo stack. So undoStack has 1 entry.
    expect(state.undoStack).toHaveLength(1)
    // The pushed snapshot must have the original qty on 1.1.1 (because undo
    // restored it before this commit ran).
    expect(state.undoStack[0][0].children![0].children![0].qty).toBe(1240)
    // The live tree must reflect the new edit on 1.1.2.
    expect(ctx.boqData[0].children![0].children![1].qty).toBe(200)
  })
})

describe('BOQ handlers — updateItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates qty on the targeted leaf and pushes the prior state to undo', () => {
    const state = freshState()
    const ctx = makeCtx(state)

    updateItem('1.1.1', 'qty', 5000, ctx)

    expect(ctx.boqData[0].children![0].children![0].qty).toBe(5000)
    expect(state.undoStack).toHaveLength(1)
    expect(state.undoStack[0][0].children![0].children![0].qty).toBe(1240)
  })

  it('clamps qty to >= 0', () => {
    const state = freshState()
    const ctx = makeCtx(state)

    updateItem('1.1.1', 'qty', -50, ctx)

    expect(ctx.boqData[0].children![0].children![0].qty).toBe(0)
  })

  it('updates rate on a nested leaf', () => {
    const state = freshState()
    const ctx = makeCtx(state)

    updateItem('2.2.2', 'rate', 9999, ctx)

    const leaf = ctx.boqData.find((i) => i.id === '2')!.children![1].children![1]
    expect(leaf.rate).toBe(9999)
  })
})

describe('BOQ handlers — duplicateItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts a copy immediately after the original with a stamped id/code/desc', () => {
    const state = freshState()
    const ctx = makeCtx(state)

    duplicateItem('1.1.1', ctx)

    const foundationChildren = ctx.boqData[0].children![0].children!
    // Should now have 5 entries (4 original + 1 copy).
    expect(foundationChildren).toHaveLength(5)
    // Copy is at index 1 (immediately after the original).
    const copy = foundationChildren[1]
    expect(copy.id).toMatch(/^1\.1\.1-copy-/)
    // Code is now suffixed with a short Date.now() token so successive
    // duplicates of the same item don't collide.
    expect(copy.code).toMatch(/^1\.1\.1-copy-/)
    expect(copy.desc).toContain('(Copy)')
    expect(copy.qty).toBe(1240) // deep-cloned content
  })

  it('produces unique codes when the same item is duplicated twice', () => {
    const state = freshState()
    const ctx = makeCtx(state)

    duplicateItem('1.1.1', ctx)
    // Force a different Date.now() so the suffix differs. (Real-world usage
    // can't duplicate in the same millisecond via a UI click, but two
    // programmatic calls in the same test tick can.)
    vi.spyOn(Date, 'now').mockReturnValueOnce(0)
    duplicateItem('1.1.1', ctx)

    const foundationChildren = ctx.boqData[0].children![0].children!
    // Two copies now exist (positions 1 and 2).
    const copy1 = foundationChildren[1]
    const copy2 = foundationChildren[2]
    expect(copy1.id).not.toBe(copy2.id)
    expect(copy1.code).not.toBe(copy2.code)
  })
})

describe('BOQ handlers — addChildItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('adds a new child under the target parent, auto-expands parent, selects the new id', () => {
    const state = freshState()
    const ctx = makeCtx(state)

    addChildItem('1.1', ctx)

    const foundation = ctx.boqData[0].children![0]
    expect(foundation.children).toHaveLength(5) // 4 original + 1 new
    const newChild = foundation.children![4]
    expect(newChild.id).toMatch(/^1\.1\./)
    // Sibling codes are renumbered parent.1, parent.2, … so the 5th child
    // under '1.1' gets the code '1.1.5' (was previously the collision-prone
    // '1.1.new' placeholder).
    expect(newChild.code).toBe('1.1.5')
    // Earlier siblings keep their codes too (renumber is consistent).
    expect(foundation.children![0].code).toBe('1.1.1')
    expect(foundation.children![3].code).toBe('1.1.4')
    expect(newChild.level).toBe(2)
    expect(state.expanded).toContain('1.1')
    expect(state.selectedId).toBe(newChild.id)
  })

  it('rejects adding a child under a non-Heading item (no double-counting)', () => {
    const state = freshState()
    const ctx = makeCtx(state)
    const rowsBefore = state.rows

    // '1.1.1' is a Priced item (not a Heading) — guard must refuse.
    addChildItem('1.1.1', ctx)

    // No commit happened — rows ref unchanged.
    expect(state.rows).toBe(rowsBefore)
    expect(state.undoStack).toHaveLength(0)
    // toast.error was called (mocked at top of file).
    expect(toast.error).toHaveBeenCalled()
  })
})

describe('BOQ handlers — deleteItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // deleteItem now prompts for confirmation when the item has descendants.
    // jsdom doesn't implement window.confirm, so stub it to return true (user
    // confirms) by default. Tests that want to exercise the cancel branch
    // override this per-test.
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    )
  })

  it('removes the item and its subtree from the tree', () => {
    const state = freshState()
    const ctx = makeCtx(state)

    // Delete '1.1' (Foundation Works, which has 4 children). confirm() is
    // stubbed to true so the delete proceeds.
    deleteItem('1.1', ctx)

    const root1 = ctx.boqData.find((i) => i.id === '1')!
    expect(root1.children).toHaveLength(1) // only '1.2 Substructure' remains
    expect(root1.children![0].id).toBe('1.2')
  })

  it('prompts for confirmation when the item has descendants', () => {
    const state = freshState()
    const ctx = makeCtx(state)

    // '1.1' has 4 descendants — confirm must be called with a description
    // that mentions the descendant count.
    deleteItem('1.1', ctx)

    expect(global.confirm).toHaveBeenCalledTimes(1)
    const promptText = (global.confirm as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(promptText).toContain('1.1')
    expect(promptText).toContain('descendant')
  })

  it('does NOT prompt for confirmation when deleting a leaf item', () => {
    const state = freshState()
    const ctx = makeCtx(state)

    // '1.1.1' is a leaf Priced item with no children.
    deleteItem('1.1.1', ctx)

    expect(global.confirm).not.toHaveBeenCalled()
    const foundation = ctx.boqData[0].children![0]
    expect(foundation.children).toHaveLength(3) // 4 - 1
  })

  it('aborts the delete when the user cancels the confirmation', () => {
    const state = freshState()
    const ctx = makeCtx(state)
    const rowsBefore = state.rows
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false)
    )

    deleteItem('1.1', ctx)

    // No commit, no undo entry, tree unchanged.
    expect(state.rows).toBe(rowsBefore)
    expect(state.undoStack).toHaveLength(0)
  })
})

describe('BOQ handlers — reparentItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('moves an item under a new parent and updates its level', () => {
    const state = freshState()
    const ctx = makeCtx(state)

    // Move '1.1.1' (Excavation, level 2) under '2' (Road Works, level 0).
    reparentItem('1.1.1', '2', ctx)

    // '1.1' should now have 3 children (was 4).
    const foundation = ctx.boqData.find((i) => i.id === '1')!.children![0]
    expect(foundation.children).toHaveLength(3)

    // '2' should now have the moved item in its children.
    const roadWorks = ctx.boqData.find((i) => i.id === '2')!
    expect(roadWorks.children).toContainEqual(expect.objectContaining({ id: '1.1.1', level: 1 }))

    expect(state.expanded).toContain('2')
    expect(state.selectedId).toBe('1.1.1')
  })

  it('rejects dropping an item onto itself (no-op)', () => {
    const state = freshState()
    const ctx = makeCtx(state)
    const rowsBefore = state.rows

    reparentItem('1.1.1', '1.1.1', ctx)

    expect(state.undoStack).toHaveLength(0)
    expect(state.rows).toBe(rowsBefore) // no commit happened
  })

  it('rejects cycle-creating drops (dropping a heading into its own subtree)', () => {
    const state = freshState()
    const ctx = makeCtx(state)
    const rowsBefore = state.rows

    // Try to move '1' (top-level heading) under '1.1.1' (its own grandchild).
    reparentItem('1', '1.1.1', ctx)

    expect(state.undoStack).toHaveLength(0)
    expect(state.rows).toBe(rowsBefore) // no commit happened
  })
})
