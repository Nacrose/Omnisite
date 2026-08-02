'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Plus,
  Download,
  Edit3,
  FileSpreadsheet,
  History,
  Link2,
  Copy,
  Trash2,
  FilePlus,
  Undo2,
  Redo2,
  GripVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { usePersistentState } from '@/lib/use-persistent-state'
import {
  useColumnVisibility,
  useColumnWidths,
  ColumnToggle,
  ColumnResizeHandle,
  StickyTableShell,
  StickyTableHeader,
  StickyTableBody,
  type ColumnDef,
} from '@/components/ui/table-utils'
import { useSyncedState } from '@/lib/use-synced-state'
import { useApp } from '@/lib/app-store'
import { LoadingState } from '@/components/ui/loading-state'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'

import { type BoqItem, BOQ_DATA, flatten } from './types'
import { BoqGrid, ContextMenuItem, type BoqEditingState } from './boq-grid'
import { RaInspector, NonPricedInspector } from './ra-inspector'
import { exportToCsv } from '@/lib/csv-export'
import {
  undo,
  redo,
  updateItem,
  duplicateItem,
  deleteItem,
  addChildItem,
  reparentItem,
  exportRa,
  rebuildBoqTree,
  type BoqHandlerCtx,
} from './handlers'
import { useBoqDnd } from './dnd'
import { AuditLogViewer } from '@/components/modules/audit-log-viewer'

export function BoqModule() {
  // Synced state — uses Supabase when configured, falls back to localStorage
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
    }
  )

  // Rebuild tree from flat rows (DB stores flat, app needs tree).
  // Memoized so the tree isn't rebuilt on every render — only when the
  // underlying flat rows actually change. Without this, every setState call
  // (even for unrelated UI state like `selected`) would re-walk every row.
  const boqData = useMemo(() => rebuildBoqTree(boqRows), [boqRows])

  // Non-persistent UI state
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<BoqEditingState | null>(null)
  // Search query — filters the tree by code/description.
  const [searchQuery, setSearchQuery] = useState('')
  // Column visibility
  const BOQ_COLS: ColumnDef[] = [
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

  // Convert expanded array to Set for O(1) lookups
  const expanded = new Set(expandedArr)
  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0

  // Flatten the tree for O(1) lookups by id. Memoized on boqData so the
  // flat array isn't rebuilt on every render.
  const allFlat = useMemo(() => flatten(boqData), [boqData])

  // Apply the search filter: when query is non-empty, filter the tree to
  // items whose code or description matches (and their ancestor headings).
  // Memoized on [boqData, searchQuery] so re-typing in the search box
  // re-filters, but unrelated re-renders (e.g. selection changes) don't.
  const filteredBoqData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return boqData
    const matches = (item: BoqItem) =>
      item.code.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)
    // Recursively filter: keep a node if it matches OR any descendant matches.
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

  // Fallback when nothing is selected: pick the first non-Heading item so
  // the inspector has something to render. Falls back to allFlat[0] (which
  // may be a Heading) only if there are no non-Heading items at all — this
  // is a degenerate empty-BOQ case and the inspector will show the
  // NonPricedInspector branch for it.
  const selectedLeaf =
    allFlat.find((i) => i.id === selectedId) ??
    allFlat.find((i) => i.type !== 'Heading') ??
    allFlat[0]

  // Live contract total — sum of qty × rate for LEAF non-heading items
  // only. Including parent items in the sum would double-count: a Priced
  // item with children would contribute both itself AND its children's
  // qty×rate. Leaves are items with no children (headings are also
  // excluded since they don't carry a rate).
  // Memoized on allFlat so it doesn't recompute on unrelated re-renders.
  const contractTotal = useMemo(
    () =>
      allFlat
        .filter((i) => i.type !== 'Heading' && (!i.children || i.children.length === 0))
        .reduce((sum, i) => sum + i.qty * i.rate, 0),
    [allFlat]
  )

  // Keep a ref to the latest `undo` so async callbacks (e.g. undoableToast
  // undo buttons, which fire seconds later) always invoke the version that
  // closes over the current state — not the stale one from the render that
  // created the toast. Without this, the toast's Undo would read a stale
  // undoStack and fail to restore the just-deleted item.
  //
  // `undoRef` is declared before `ctx` (and seeded with a no-op) so the ctx
  // object can reference it; the actual `undo(ctx)` closure is assigned in
  // a useEffect below, after `ctx` is initialized.
  const undoRef = useRef<() => void>(() => {})

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
  })

  // Keyboard shortcuts for undo/redo (⌘Z / ⌘⇧Z)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        e.preventDefault()
        undoFn()
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        e.preventDefault()
        redoFn()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  })

  // DnD — owned by useBoqDnd; the reparent callback delegates to handlers.ts.
  const dnd = useBoqDnd(allFlat, (draggedId, targetId) => reparentItem(draggedId, targetId, ctx))

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

  if (boqLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState label="Loading BOQ items…" />
      </div>
    )
  }

  // Guard against an empty BOQ store (e.g. fresh install with no seed data,
  // or all items deleted). Without this, `selectedLeaf` is undefined (the
  // `allFlat[2]` fallback returns undefined when allFlat is empty) and the
  // rightPane below would crash on `selectedLeaf.type`. Placed AFTER all
  // hooks have been called so we don't violate rules-of-hooks.
  if (!selectedLeaf) {
    return (
      <Workspace3Pane
        centerPane={
          <PaneBody className="text-muted-foreground flex items-center justify-center text-sm">
            No items to display
          </PaneBody>
        }
        rightPane={
          <PaneBody className="text-muted-foreground flex items-center justify-center text-sm">
            No items to display
          </PaneBody>
        }
        rightPaneWidth="380px"
      />
    )
  }

  return (
    <>
      <Workspace3Pane
        centerPane={
          <>
            <PaneHeader
              title={`BOQ · ${selected.size > 0 ? `${selected.size} selected` : (activeProject ?? 'No project selected')}`}
            >
              {/* Search — moved from the old left outline pane */}
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
                <Input
                  placeholder="Filter BOQ items…"
                  className="h-7 w-44 pl-7 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <span className="text-muted-foreground bg-secondary/60 hidden items-center gap-1.5 rounded px-2 py-0.5 text-[10px] lg:flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Edit Qty/Rate · drag rows to headings to reparent
              </span>
              {boqTruncated && (
                <>
                  <span
                    className="hidden items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 lg:flex dark:text-amber-300"
                    title="Dataset hit the 2000-row cap. Refine your filter or contact admin for full data."
                  >
                    Showing first 2000 rows
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 gap-1.5 px-2 text-[10px]"
                    onClick={async () => {
                      try {
                        await loadMoreBoq()
                        toast.success('Loaded next page')
                      } catch {
                        toast.error('Failed to load more rows')
                      }
                    }}
                    title="Fetch the next page of BOQ rows from the server"
                  >
                    <FilePlus className="h-3 w-3" />
                    Load more
                  </Button>
                </>
              )}
              {/* Undo/Redo buttons */}
              <div className="mr-1 flex items-center gap-0.5 border-r border-[var(--pane-divider)] pr-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn('h-7 w-7 p-0', !canUndo && 'cursor-not-allowed opacity-40')}
                  onClick={undoFn}
                  disabled={!canUndo}
                  title="Undo (⌘Z)"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn('h-7 w-7 p-0', !canRedo && 'cursor-not-allowed opacity-40')}
                  onClick={redoFn}
                  disabled={!canRedo}
                  title="Redo (⌘⇧Z)"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </Button>
                {(canUndo || canRedo) && (
                  <span className="text-muted-foreground px-1 font-mono text-[9px]">
                    {undoStack.length}/{undoStack.length + redoStack.length}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => {
                  if (selectedLeaf?.hasRA) {
                    exportRa(selectedLeaf)
                  } else {
                    toast.error('Select a BOQ item with Rate Analysis enabled first.')
                  }
                }}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Export RA (DoR Format)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => {
                  const flat = flatten(boqData)
                  exportToCsv(
                    'omnisite-boq.csv',
                    ['Code', 'Description', 'Type', 'Qty', 'UOM', 'Rate (NPR)', 'Amount (NPR)'],
                    flat.map((i) => [i.code, i.desc, i.type, i.qty, i.uom, i.rate, i.qty * i.rate])
                  )
                  toast.success('BOQ exported', {
                    description: `${flat.length} items exported to CSV`,
                  })
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
              <Button
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => {
                  if (selectedLeaf) {
                    addChildItem(selectedLeaf.id, ctx)
                  } else {
                    toast.error('Select a parent heading first, then click + to add a child item.')
                  }
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Item
              </Button>
            </PaneHeader>
            {/* Column header — sticky on vertical scroll, scrolls horizontally with body */}
            <StickyTableShell minWidth={1000}>
              <StickyTableHeader>
                <div className="w-6" />
                <div className="w-7" />
                {boqIsVisible('code') && (
                  <div className="relative px-2" style={{ width: `${colWidths.code || 64}px` }}>
                    Code
                    <ColumnResizeHandle
                      columnKey="code"
                      currentWidth={colWidths.code || 64}
                      onDragStart={colStartDrag}
                    />
                  </div>
                )}
                <div className="flex-1 px-2">Description</div>
                {boqIsVisible('qty') && (
                  <div
                    className="relative px-2 text-right"
                    style={{ width: `${colWidths.qty || 96}px` }}
                  >
                    Qty
                    <ColumnResizeHandle
                      columnKey="qty"
                      currentWidth={colWidths.qty || 96}
                      onDragStart={colStartDrag}
                    />
                  </div>
                )}
                {boqIsVisible('uom') && (
                  <div className="relative px-2" style={{ width: `${colWidths.uom || 56}px` }}>
                    UOM
                    <ColumnResizeHandle
                      columnKey="uom"
                      currentWidth={colWidths.uom || 56}
                      onDragStart={colStartDrag}
                    />
                  </div>
                )}
                {boqIsVisible('rate') && (
                  <div
                    className="relative px-2 text-right"
                    style={{ width: `${colWidths.rate || 112}px` }}
                  >
                    Rate (NPR)
                    <ColumnResizeHandle
                      columnKey="rate"
                      currentWidth={colWidths.rate || 112}
                      onDragStart={colStartDrag}
                    />
                  </div>
                )}
                {boqIsVisible('amount') && (
                  <div
                    className="relative px-2 text-right"
                    style={{ width: `${colWidths.amount || 112}px` }}
                  >
                    Amount (NPR)
                    <ColumnResizeHandle
                      columnKey="amount"
                      currentWidth={colWidths.amount || 112}
                      onDragStart={colStartDrag}
                    />
                  </div>
                )}
                {boqIsVisible('type') && (
                  <div className="relative px-2" style={{ width: `${colWidths.type || 96}px` }}>
                    Type
                    <ColumnResizeHandle
                      columnKey="type"
                      currentWidth={colWidths.type || 96}
                      onDragStart={colStartDrag}
                    />
                  </div>
                )}
                {boqIsVisible('ra') && (
                  <div
                    className="relative text-center"
                    style={{ width: `${colWidths.ra || 40}px` }}
                  >
                    RA
                    <ColumnResizeHandle
                      columnKey="ra"
                      currentWidth={colWidths.ra || 40}
                      onDragStart={colStartDrag}
                    />
                  </div>
                )}
                <div className="flex-shrink-0 pr-2">
                  <ColumnToggle
                    columns={BOQ_COLS}
                    visible={boqColVisible}
                    onToggle={boqToggleCol}
                  />
                </div>
              </StickyTableHeader>
              <StickyTableBody>
                <DndContext
                  sensors={dnd.sensors}
                  collisionDetection={closestCenter}
                  onDragStart={dnd.handleDragStart}
                  onDragOver={dnd.handleDragOver}
                  onDragEnd={dnd.handleDragEnd}
                  onDragCancel={dnd.handleDragCancel}
                >
                  <BoqGrid
                    items={filteredBoqData}
                    expanded={searchQuery.trim() ? new Set(allFlat.map((i) => i.id)) : expanded}
                    selectedId={selectedId}
                    selected={selected}
                    editing={editing}
                    draggedItem={dnd.draggedItem}
                    dragOverHeading={dnd.dragOverHeading}
                    onSelectId={setSelectedId}
                    onContextMenu={setContextMenu}
                    onToggleExpand={toggleExpand}
                    onToggleSelect={handleToggleSelect}
                    onUpdateItem={(id, field, value) => updateItem(id, field, value, ctx)}
                    onSetEditing={setEditing}
                    isVisible={boqIsVisible}
                    colWidths={colWidths}
                  />
                  <DragOverlay>
                    {dnd.draggedItem ? (
                      <div className="pane border-primary flex h-9 items-center gap-2 rounded-md border px-4 text-xs shadow-lg">
                        <GripVertical className="text-primary h-3 w-3" />
                        <span className="text-muted-foreground font-mono">
                          {dnd.draggedItem.code}
                        </span>
                        <span className="truncate font-medium">{dnd.draggedItem.desc}</span>
                        <Badge variant="secondary" className="ml-2 text-[9px]">
                          {dnd.draggedItem.type}
                        </Badge>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </StickyTableBody>
            </StickyTableShell>
            {/* Footer — contract summary moved from the old left outline pane */}
            <div className="text-muted-foreground bg-secondary/30 flex h-9 items-center gap-4 border-t border-[var(--pane-divider)] px-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                {allFlat.filter((i) => i.type !== 'Heading').length} line items · live totals
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span>{allFlat.filter((i) => i.type === 'Priced').length} priced</span>
              <span className="text-muted-foreground/50">·</span>
              <span>{allFlat.filter((i) => i.type === 'Provisional Sum').length} PS</span>
              <span className="text-muted-foreground/50">·</span>
              <span>{allFlat.filter((i) => i.type === 'Daywork').length} daywork</span>
              <div className="flex-1" />
              <span>
                Contract Total:{' '}
                <span className="text-foreground font-mono font-bold tabular-nums">
                  NPR {contractTotal.toLocaleString()}
                </span>
              </span>
            </div>
          </>
        }
        rightPane={
          selectedLeaf.type === 'Priced' ? (
            // key={item.id} forces RaInspector to remount when the selected
            // BOQ item changes, so its internal coefficient/row state resets
            // instead of leaking from the previous item.
            <RaInspector
              key={selectedLeaf.id}
              item={selectedLeaf}
              onUpdateLocation={(locId) => {
                // Propagate the location link into the synced boqRows store
                // so it persists to Supabase (location_id column added in
                // migration 12) and is visible to other modules. Without
                // this the inspector only kept the link in local state.
                setBoqRows((prev) =>
                  prev.map((r) =>
                    r.id === selectedLeaf.id ? { ...r, locationId: locId ?? undefined } : r
                  )
                )
              }}
            />
          ) : (
            <NonPricedInspector key={selectedLeaf.id} item={selectedLeaf} />
          )
        }
        rightPaneWidth="380px"
      />

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="pane animate-in fade-in zoom-in-95 fixed z-50 w-52 overflow-hidden rounded-lg border border-[var(--pane-divider)] py-1 shadow-2xl duration-100"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 220),
              top: Math.min(contextMenu.y, window.innerHeight - 280),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ContextMenuItem
              icon={<Edit3 className="h-3.5 w-3.5" />}
              label="Edit item"
              onClick={() => {
                toast.info('Inline editing coming soon', {
                  description: 'Edit Qty and Rate directly in the grid cells.',
                })
                setContextMenu(null)
              }}
            />
            <ContextMenuItem
              icon={<Copy className="h-3.5 w-3.5" />}
              label="Duplicate"
              shortcut="⌘D"
              onClick={() => {
                duplicateItem(contextMenu.itemId, ctx)
                setContextMenu(null)
              }}
            />
            <ContextMenuItem
              icon={<FilePlus className="h-3.5 w-3.5" />}
              label="Add child item"
              onClick={() => {
                addChildItem(contextMenu.itemId, ctx)
                setContextMenu(null)
              }}
            />
            <div className="my-1 h-px bg-[var(--pane-divider)]" />
            <ContextMenuItem
              icon={<FileSpreadsheet className="h-3.5 w-3.5" />}
              label="Export RA (DoR)"
              onClick={() => {
                exportRa(allFlat.find((i) => i.id === contextMenu.itemId))
                setContextMenu(null)
              }}
            />
            <ContextMenuItem
              icon={<Link2 className="h-3.5 w-3.5" />}
              label="Link to Schedule"
              onClick={() => {
                toast.info('Task linking coming soon', {
                  description: 'Assign BOQ items to scheduler tasks from the Task Inspector.',
                })
                setContextMenu(null)
              }}
            />
            <ContextMenuItem
              icon={<History className="h-3.5 w-3.5" />}
              label="View audit log"
              onClick={() => {
                const item = allFlat.find((i) => i.id === contextMenu.itemId)
                setAuditViewer({
                  recordId: contextMenu.itemId,
                  label: item ? `${item.code} · ${item.desc}` : contextMenu.itemId,
                })
                setContextMenu(null)
              }}
            />
            <div className="my-1 h-px bg-[var(--pane-divider)]" />
            <ContextMenuItem
              icon={<Trash2 className="h-3.5 w-3.5" />}
              label="Delete"
              danger
              onClick={() => {
                deleteItem(contextMenu.itemId, ctx)
                setContextMenu(null)
              }}
            />
          </div>
        </>
      )}

      {auditViewer && (
        <AuditLogViewer
          tableName="boq_items"
          recordId={auditViewer.recordId}
          recordLabel={auditViewer.label}
          onClose={() => setAuditViewer(null)}
        />
      )}
    </>
  )
}

export default BoqModule
