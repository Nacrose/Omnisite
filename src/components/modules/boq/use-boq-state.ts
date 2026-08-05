'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { usePersistentState } from '@/lib/use-persistent-state'
import { useSyncedState } from '@/lib/use-synced-state'
import { useColumnVisibility, useColumnWidths, type ColumnDef } from '@/components/ui/table-utils'
import { useApp } from '@/lib/app-store'
import { type BoqItem, BOQ_DATA, flatten } from './types'
import { rebuildBoqTree, undo, redo, reparentItem, type BoqHandlerCtx } from './handlers'
import { useBoqDnd } from './dnd'
import type { BoqEditingState } from './boq-grid'

/**
 * Column definitions for the BOQ grid. Declared at module scope so the array
 * identity is stable across renders — the column-toggle UI and the visibility
 * hook both reference BOQ_COLS, and a fresh array every render would force
 * both to re-walk the column list on every state change.
 * `hideable: false` marks columns the user can't hide (checkbox / expand
 * affordances + the primary description column).
 */
export const BOQ_COLS: ColumnDef[] = [
  { key: 'checkbox', label: 'Checkbox', hideable: false },
  { key: 'expand', label: 'Expand', hideable: false },
  { key: 'code', label: 'Code' },
  { key: 'desc', label: 'Description', hideable: false },
  { key: 'qty', label: 'Qty' },
  { key: 'uom', label: 'UOM' },
  { key: 'rate', label: 'Rate (NPR)' },
  { key: 'amount', label: 'Amount (NPR)' },
  { key: 'type', label: 'Type' },
  { key: 'ra', label: 'RA' },
]

/**
 * State + derived memoizations + undo/redo + DnD + handler context for the
 * BOQ module.
 *
 * Extracted from `BoqModule` so the component body focuses on render. This
 * hook owns:
 *   - Synced BOQ state (Supabase or localStorage)
 *   - UI state (selection, expansion, search, editing, context menu, modals)
 *   - Column visibility + widths (persisted to localStorage)
 *   - Undo/redo stacks + keyboard shortcuts (⌘Z / ⌘⇧Z)
 *   - The `BoqHandlerCtx` (captured fresh on every render so extracted
 *     handler functions see the latest state)
 *   - DnD wiring (useBoqDnd)
 *   - Derived: boqData, allFlat, filteredBoqData, searchExpandedSet,
 *     selectedLeaf, contractTotal
 *
 * Mutation handlers (updateItem, duplicateItem, etc.) live in ./handlers.ts
 * and are called via the `ctx` object.
 */
export function useBoqState() {
  // ─── Synced state ──────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = usePersistentState('omnisite-boq-selected', '1.1.3')
  const [expandedArr, setExpandedArr] = usePersistentState<string[]>('omnisite-boq-expanded', [
    '1',
    '1.1',
    '2',
    '2.1',
    '3',
  ])
  const { activeProject } = useApp()
  const [boqRows, setBoqRows, boqLoading, boqTruncated, loadMoreBoq] = useSyncedState<BoqItem[]>(
    'omnisite-boq-data',
    'boq_items',
    () => structuredClone(BOQ_DATA) as typeof BOQ_DATA,
    {
      fieldMap: {
        desc: 'description',
        hasRA: 'has_ra',
        parentId: 'parent_id',
        locationId: 'location_id',
      },
      primaryKey: 'id',
      // BOQ needs the full tree in memory for tree operations (drag-drop,
      // rate analysis rollups, CSV export). The default cap of 3 pages
      // (600 rows) is too low — large projects routinely have 1000+ items.
      // Cap at 10 pages (2000 rows) which matches the previous default.
      maxPages: 10,
    }
  )

  // Rebuild tree from flat rows (DB stores flat, app needs tree). Memoized
  // so the tree isn't rebuilt on every render.
  const boqData = useMemo(() => rebuildBoqTree(boqRows), [boqRows])

  // ─── Non-persistent UI state ───────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<BoqEditingState | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Column visibility — BOQ_COLS is declared at module scope.
  const {
    visible: boqColVisible,
    isVisible: boqIsVisible,
    toggle: boqToggleCol,
  } = useColumnVisibility(
    BOQ_COLS.map((c) => c.key),
    [],
    'boq-grid'
  )
  // Column width management — drag to resize, persisted to localStorage.
  const { widths: colWidths, startDrag: colStartDrag } = useColumnWidths('boq-grid', {
    code: 64,
    qty: 96,
    uom: 56,
    rate: 112,
    amount: 112,
    type: 96,
    ra: 40,
  })

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; itemId: string } | null>(
    null
  )
  // Undo/redo history stacks (deep snapshots of boqData)
  const [undoStack, setUndoStack] = useState<BoqItem[][]>([])
  const [redoStack, setRedoStack] = useState<BoqItem[][]>([])
  // Audit log viewer — opened from the row context menu.
  const [auditViewer, setAuditViewer] = useState<{
    recordId: string
    label: string
  } | null>(null)

  // ─── Derived ───────────────────────────────────────────────────────────
  // Convert expanded array to Set for O(1) lookups. Memoized on expandedArr
  // so the Set identity is stable across unrelated re-renders.
  const expanded = useMemo(() => new Set(expandedArr), [expandedArr])
  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0

  // Flatten the tree for O(1) lookups by id. Memoized on boqData.
  const allFlat = useMemo(() => flatten(boqData), [boqData])

  // Apply the search filter: when query is non-empty, filter the tree to
  // items whose code or description matches (and their ancestor headings).
  const filteredBoqData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return boqData
    const matches = (item: BoqItem) =>
      item.code.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)
    const filterTree = (items: BoqItem[]): BoqItem[] => {
      const out: BoqItem[] = []
      for (const it of items) {
        const childMatches = it.children ? filterTree(it.children) : []
        if (matches(it) || childMatches.length > 0) {
          out.push({ ...it, children: childMatches.length > 0 ? childMatches : it.children })
        }
      }
      return out
    }
    return filterTree(boqData)
  }, [boqData, searchQuery])

  // When a search query is active, expand every visible row so the user can
  // see matched descendants without manually expanding each heading.
  const searchExpandedSet = useMemo(
    () => (searchQuery.trim() ? new Set(allFlat.map((i) => i.id)) : expanded),
    [searchQuery, allFlat, expanded]
  )

  // Fallback when nothing is selected: pick the first non-Heading item so
  // the inspector has something to render.
  const selectedLeaf =
    allFlat.find((i) => i.id === selectedId) ??
    allFlat.find((i) => i.type !== 'Heading') ??
    allFlat[0]

  // If selectedId points to a deleted item (or stale persisted ID),
  // selectedLeaf falls back to the first non-Heading — but selectedId in
  // state stays stale, so the grid highlights NO row. Sync selectedId to
  // the fallback so the grid highlights the right row (audit B4-4). Uses
  // the "adjust state during render" pattern.
  if (selectedLeaf && selectedLeaf.id !== selectedId) {
    setSelectedId(selectedLeaf.id)
  }

  // Live contract total — sum of qty × rate for LEAF non-heading items only.
  // Including parent items would double-count.
  const contractTotal = useMemo(
    () =>
      allFlat
        .filter((i) => i.type !== 'Heading' && (!i.children || i.children.length === 0))
        .reduce((sum, i) => sum + i.qty * i.rate, 0),
    [allFlat]
  )

  // ─── Undo/redo refs + ctx ──────────────────────────────────────────────
  // Keep a ref to the latest `undo` so async callbacks (e.g. undoableToast
  // undo buttons, which fire seconds later) always invoke the version that
  // closes over the current state.
  const undoRef = useRef<() => void>(() => {})
  const redoRef = useRef<() => void>(() => {})

  // Handler context — captured fresh on every render so the extracted
  // handler functions always see the latest state + setters.
  const ctx: BoqHandlerCtx = {
    boqData,
    allFlat,
    setBoqRows,
    setUndoStack,
    setRedoStack,
    setExpandedArr,
    setSelectedId,
    undoStack,
    redoStack,
    undoRef,
  }

  // Stable `undo` / `redo` wrappers that bind the current ctx.
  const undoFn = () => undo(ctx)
  const redoFn = () => redo(ctx)
  useEffect(() => {
    undoRef.current = undoFn
    redoRef.current = redoFn
  })

  // Keyboard shortcuts for undo/redo (⌘Z / ⌘⇧Z). Uses refs so the effect
  // only mounts once (empty dep array) instead of re-subscribing on every
  // render (audit B4-7).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        e.preventDefault()
        undoRef.current()
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        e.preventDefault()
        redoRef.current()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // ─── DnD ───────────────────────────────────────────────────────────────
  // Owned by useBoqDnd; the reparent callback delegates to handlers.ts.
  const dnd = useBoqDnd(allFlat, (draggedId, targetId) => {
    reparentItem(draggedId, targetId, ctx)
  })

  // Close context menu on outside click / escape
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    document.addEventListener('click', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [contextMenu])

  // ─── Toggle handlers ───────────────────────────────────────────────────
  const toggleExpand = (id: string) => {
    setExpandedArr((prev) => {
      const arr = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      return arr
    })
  }

  const handleToggleSelect = (id: string, value: boolean) => {
    setSelected((prev) => {
      const n = new Set(prev)
      if (value) n.add(id)
      else n.delete(id)
      return n
    })
  }

  return {
    // Synced state
    boqRows,
    setBoqRows,
    boqLoading,
    boqTruncated,
    loadMoreBoq,
    boqData,
    allFlat,
    // UI state
    selectedId,
    setSelectedId,
    expandedArr,
    setExpandedArr,
    expanded,
    selected,
    setSelected,
    editing,
    setEditing,
    searchQuery,
    setSearchQuery,
    contextMenu,
    setContextMenu,
    auditViewer,
    setAuditViewer,
    undoStack,
    redoStack,
    canUndo,
    canRedo,
    // Column visibility + widths
    boqColVisible,
    boqIsVisible,
    boqToggleCol,
    colWidths,
    colStartDrag,
    // Derived
    filteredBoqData,
    searchExpandedSet,
    selectedLeaf,
    contractTotal,
    // Handler context + undo/redo
    ctx,
    undoFn,
    redoFn,
    // DnD
    dnd,
    // Toggles
    toggleExpand,
    handleToggleSelect,
    // Active project (for the header title)
    activeProject,
  }
}
