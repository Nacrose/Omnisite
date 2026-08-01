'use client'

import { useState, useEffect } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search, Plus, Download,
  Edit3, FileSpreadsheet,
  History, Link2, Copy, Trash2, FilePlus, Undo2, Redo2, GripVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { usePersistentState } from '@/lib/use-persistent-state'
import { useColumnVisibility, ColumnToggle, StickyTableShell, StickyTableHeader, StickyTableBody, type ColumnDef } from '@/components/ui/table-utils'
import { useSyncedState } from '@/lib/use-synced-state'
import { LoadingState } from '@/components/ui/loading-state'
import {
  DndContext, DragOverlay,
  PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'

import { type BoqItem, BOQ_DATA, flatten } from './types'
import { BoqGrid, ContextMenuItem, type BoqEditingState } from './boq-grid'
import { RaInspector, NonPricedInspector } from './ra-inspector'
import { exportToCsv } from '@/lib/csv-export'

export function BoqModule() {
  // Synced state — uses Supabase when configured, falls back to localStorage
  const [selectedId, setSelectedId] = usePersistentState('omnisite-boq-selected', '1.1.3')
  const [expandedArr, setExpandedArr] = usePersistentState<string[]>('omnisite-boq-expanded', ['1', '1.1', '2', '2.1', '3'])
  const [boqRows, setBoqRows, boqLoading] = useSyncedState<BoqItem[]>(
    'omnisite-boq-data',
    'boq_items',
    () => JSON.parse(JSON.stringify(BOQ_DATA)),
    {
      fieldMap: { desc: 'description', hasRA: 'has_ra', parentId: 'parent_id' },
      primaryKey: 'id',
    }
  )

  // Rebuild tree from flat rows (DB stores flat, app needs tree)
  const boqData = (() => {
    if (!boqRows || boqRows.length === 0) return JSON.parse(JSON.stringify(BOQ_DATA))
    // Check if data is already a tree (has non-empty children arrays) or flat rows.
    // NOTE: use Array.isArray(r.children) && r.children.length > 0 instead of
    // `'children' in r` — the `in` operator checks key existence, and flattenTree
    // sets `children: undefined` on every flattened row, so `'children' in r`
    // would always be true and the rebuild-from-flat branch would never run.
    const hasChildren = boqRows.some((r) => Array.isArray((r as BoqItem).children) && (r as BoqItem).children!.length > 0)
    if (hasChildren) return boqRows

    // Rebuild tree from flat rows using parent_id
    const rows = boqRows as unknown as Record<string, unknown>[]
    const map = new Map<string, BoqItem>()
    const roots: BoqItem[] = []

    // First pass: create all nodes
    for (const row of rows) {
      const item: BoqItem = {
        id: row.id as string,
        code: row.code as string,
        desc: (row.desc || row.description) as string,
        type: (row.type as BoqItem['type']) || 'Priced',
        qty: Number(row.qty) || 0,
        uom: (row.uom as string) || '',
        rate: Number(row.rate) || 0,
        hasRA: Boolean(row.hasRA ?? row.has_ra),
        level: Number(row.level) || 0,
      }
      map.set(item.id, item)
    }

    // Second pass: build tree
    for (const row of rows) {
      const item = map.get(row.id as string)!
      const parentId = (row.parentId || row.parent_id) as string | null
      if (parentId && map.has(parentId)) {
        const parent = map.get(parentId)!
        if (!parent.children) parent.children = []
        parent.children.push(item)
      } else {
        roots.push(item)
      }
    }

    return roots.length > 0 ? roots : JSON.parse(JSON.stringify(BOQ_DATA))
  })()
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
  const { visible: boqColVisible, isVisible: boqIsVisible, toggle: boqToggleCol } = useColumnVisibility(BOQ_COLS.map(c => c.key), [], 'boq-grid')
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; itemId: string } | null>(null)
  // Drag-and-drop state
  const [draggedItem, setDraggedItem] = useState<BoqItem | null>(null)
  const [dragOverHeading, setDragOverHeading] = useState<string | null>(null)
  // Undo/redo history stacks (deep snapshots of boqData)
  const [undoStack, setUndoStack] = useState<BoqItem[][]>([])
  const [redoStack, setRedoStack] = useState<BoqItem[][]>([])

  // Convert expanded array to Set for O(1) lookups
  const expanded = new Set(expandedArr)
  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0

  // Flatten tree to flat rows for DB storage
  const flattenTree = (items: BoqItem[], parentId: string | null = null): BoqItem[] => {
    const out: BoqItem[] = []
    for (const item of items) {
      out.push({ ...item, parentId: parentId || undefined, children: undefined })
      if (item.children) out.push(...flattenTree(item.children, item.id))
    }
    return out
  }

  // Helper: commit a new boqData state, pushing the current state to undo stack and clearing redo.
  // Uses a functional update on setBoqRows so the latest committed state is
  // used (avoids stale-closure bugs when multiple edits land in the same
  // React batch). Pushes to undoStack and clears redoStack via functional
  // updates so the side effects don't run inside the setBoqRows updater
  // (which would double-fire under StrictMode).
  const commitBoqData = (updater: (prev: BoqItem[]) => BoqItem[]) => {
    // Capture the current tree for the undo stack BEFORE applying the updater.
    const currentTree = boqData
    setUndoStack(u => [...u, JSON.parse(JSON.stringify(currentTree))])
    setRedoStack([])
    setBoqRows(prevRows => {
      // Rebuild the tree from the previous flat rows, apply the updater,
      // then flatten the result for storage.
      const prevTree = rebuildTreeFromRows(prevRows)
      const next = updater(prevTree)
      return flattenTree(next) as unknown as BoqItem[]
    })
  }

  // Helper used by commitBoqData: rebuild a BoqItem tree from flat rows.
  // (Mirrors the IIFE above but operates on an arbitrary row array.)
  const rebuildTreeFromRows = (rows: BoqItem[]): BoqItem[] => {
    if (!rows || rows.length === 0) return JSON.parse(JSON.stringify(BOQ_DATA))
    const hasChildren = rows.some((r) => Array.isArray(r.children) && r.children!.length > 0)
    if (hasChildren) return rows
    const map = new Map<string, BoqItem>()
    const roots: BoqItem[] = []
    for (const row of rows as unknown as Record<string, unknown>[]) {
      const item: BoqItem = {
        id: row.id as string,
        code: row.code as string,
        desc: (row.desc || row.description) as string,
        type: (row.type as BoqItem['type']) || 'Priced',
        qty: Number(row.qty) || 0,
        uom: (row.uom as string) || '',
        rate: Number(row.rate) || 0,
        hasRA: Boolean(row.hasRA ?? row.has_ra),
        level: Number(row.level) || 0,
      }
      map.set(item.id, item)
    }
    for (const row of rows as unknown as Record<string, unknown>[]) {
      const item = map.get(row.id as string)!
      const parentId = (row.parentId || row.parent_id) as string | null
      if (parentId && map.has(parentId)) {
        const parent = map.get(parentId)!
        if (!parent.children) parent.children = []
        parent.children.push(item)
      } else {
        roots.push(item)
      }
    }
    return roots.length > 0 ? roots : JSON.parse(JSON.stringify(BOQ_DATA))
  }

  const undo = () => {
    if (undoStack.length === 0) return
    // Pull the snapshot to restore and the current tree to push to redo,
    // then apply via functional setBoqRows. Side effects are pulled out of
    // the updater so they don't double-fire under StrictMode.
    const snapshot = undoStack[undoStack.length - 1]
    const currentTree = boqData
    setUndoStack(u => u.slice(0, -1))
    setRedoStack(r => [...r, JSON.parse(JSON.stringify(currentTree))])
    setBoqRows(flattenTree(snapshot) as unknown as BoqItem[])
    toast.success('Undo', { description: `Reverted (${undoStack.length - 1} actions left)` })
  }

  const redo = () => {
    if (redoStack.length === 0) return
    const snapshot = redoStack[redoStack.length - 1]
    const currentTree = boqData
    setRedoStack(r => r.slice(0, -1))
    setUndoStack(u => [...u, JSON.parse(JSON.stringify(currentTree))])
    setBoqRows(flattenTree(snapshot) as unknown as BoqItem[])
    toast.success('Redo', { description: `${redoStack.length - 1} actions left` })
  }

  // Keyboard shortcuts for undo/redo (⌘Z / ⌘⇧Z)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        e.preventDefault()
        undo()
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        e.preventDefault()
        redo()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [undo, redo])

  const allFlat = flatten(boqData)

  // Apply the search filter: when query is non-empty, filter the tree to
  // items whose code or description matches (and their ancestor headings).
  const filteredBoqData = (() => {
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
  })()

  const selectedLeaf = allFlat.find(i => i.id === selectedId) ?? allFlat[2]

  // Live contract total — sum of qty × rate for all non-heading items
  const contractTotal = allFlat
    .filter(i => i.type !== 'Heading')
    .reduce((sum, i) => sum + i.qty * i.rate, 0)

  // Update a single BOQ item's qty or rate
  const updateItem = (id: string, field: 'qty' | 'rate', value: number) => {
    commitBoqData(prev => {
      const updated = JSON.parse(JSON.stringify(prev)) as BoqItem[]
      const walk = (items: BoqItem[]) => {
        for (const it of items) {
          if (it.id === id) {
            it[field] = Math.max(0, value)
            return true
          }
          if (it.children && walk(it.children)) return true
        }
        return false
      }
      walk(updated)
      return updated
    })
  }

  // Context menu actions
  const duplicateItem = (id: string) => {
    commitBoqData(prev => {
      const updated = JSON.parse(JSON.stringify(prev)) as BoqItem[]
      const walk = (items: BoqItem[]): BoqItem[] => {
        const result: BoqItem[] = []
        for (const it of items) {
          result.push(it)
          if (it.id === id) {
            const copy = JSON.parse(JSON.stringify(it)) as BoqItem
            copy.id = `${it.id}-copy-${Date.now().toString(36)}`
            copy.code = `${it.code}-copy`
            copy.desc = `${it.desc} (Copy)`
            result.push(copy)
          }
          if (it.children) it.children = walk(it.children)
        }
        return result
      }
      return walk(updated)
    })
    toast.success('Item duplicated', { description: `Copy created below ${id}` })
  }

  const deleteItem = (id: string) => {
    commitBoqData(prev => {
      const updated = JSON.parse(JSON.stringify(prev)) as BoqItem[]
      const walk = (items: BoqItem[]): BoqItem[] => {
        return items.filter(it => {
          if (it.id === id) return false
          if (it.children) it.children = walk(it.children)
          return true
        })
      }
      return walk(updated)
    })
    toast.success('Item deleted', { description: `${id} removed from BOQ` })
  }

  const addChildItem = (parentId: string) => {
    const newId = `${parentId}.${Date.now().toString(36)}`
    commitBoqData(prev => {
      const updated = JSON.parse(JSON.stringify(prev)) as BoqItem[]
      const walk = (items: BoqItem[]) => {
        for (const it of items) {
          if (it.id === parentId) {
            if (!it.children) it.children = []
            it.children.push({
              id: newId,
              code: `${it.code}.new`,
              desc: 'New BOQ item',
              type: 'Priced',
              qty: 0,
              uom: 'cum',
              rate: 0,
              level: it.level + 1,
            })
            return true
          }
          if (it.children && walk(it.children)) return true
        }
        return false
      }
      walk(updated)
      return updated
    })
    setExpandedArr(prev => prev.includes(parentId) ? prev : [...prev, parentId])
    setSelectedId(newId)
    toast.success('Child item added', { description: `New item under ${parentId}` })
  }

  // ─── Drag-and-drop reparenting ────────────────────────────────────────────

  // Find an item and its parent in the tree
  const findItemAndParent = (items: BoqItem[], id: string, parent: BoqItem | null = null, depth = 0): { item: BoqItem; parent: BoqItem | null; depth: number } | null => {
    for (const it of items) {
      if (it.id === id) return { item: it, parent, depth }
      if (it.children) {
        const found = findItemAndParent(it.children, id, it, depth + 1)
        if (found) return found
      }
    }
    return null
  }

  // Recursively update the level of an item and its children
  const updateLevels = (item: BoqItem, newLevel: number): BoqItem => {
    return {
      ...item,
      level: newLevel,
      children: item.children?.map(c => updateLevels(c, newLevel + 1)),
    }
  }

  // Reparent an item: remove from old location, add to new parent's children
  const reparentItem = (draggedId: string, targetHeadingId: string) => {
    if (draggedId === targetHeadingId) return // can't drop on self

    // Find the dragged item and check it's not a parent of the target (no cycles)
    const dragInfo = findItemAndParent(boqData, draggedId)
    if (!dragInfo) return

    // Check for cycle: is targetHeadingId a descendant of draggedId?
    const isDescendant = (items: BoqItem[] | undefined, ancestorId: string, targetId: string): boolean => {
      if (!items) return false
      for (const it of items) {
        if (it.id === ancestorId) {
          // Check if targetId is in this subtree
          const checkSubtree = (node: BoqItem): boolean => {
            if (node.id === targetId) return true
            return node.children?.some(c => checkSubtree(c)) || false
          }
          if (checkSubtree(it)) return true
        }
        if (it.children && isDescendant(it.children, ancestorId, targetId)) return true
      }
      return false
    }
    if (isDescendant(boqData, draggedId, targetHeadingId)) {
      toast.error('Cannot reparent', { description: 'Cannot move a heading into its own subtree' })
      return
    }

    commitBoqData(prev => {
      const updated = JSON.parse(JSON.stringify(prev)) as BoqItem[]
      let movedItem: BoqItem | null = null

      // Step 1: Remove the dragged item from its current location
      const removeFromTree = (items: BoqItem[]): BoqItem[] => {
        return items.filter(it => {
          if (it.id === draggedId) {
            movedItem = it
            return false
          }
          if (it.children) it.children = removeFromTree(it.children)
          return true
        })
      }
      const cleaned = removeFromTree(updated)

      // Step 2: Find the target heading and add the item to its children
      if (movedItem) {
        const targetLevel = findItemAndParent(cleaned, targetHeadingId)?.depth ?? 0
        movedItem = updateLevels(movedItem, targetLevel + 1)
        const addToTarget = (items: BoqItem[]): boolean => {
          for (const it of items) {
            if (it.id === targetHeadingId) {
              if (!it.children) it.children = []
              it.children.push(movedItem!)
              return true
            }
            if (it.children && addToTarget(it.children)) return true
          }
          return false
        }
        addToTarget(cleaned)
      }

      return cleaned
    })

    // Auto-expand the target heading
    setExpandedArr(prev => prev.includes(targetHeadingId) ? prev : [...prev, targetHeadingId])
    setSelectedId(draggedId)
    toast.success('Item reparented', {
      description: `${draggedItem?.code} moved under ${targetHeadingId}`,
    })
  }

  // DnD sensors — require 5px movement to start drag (prevents accidental drags on click)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragStart = (e: DragStartEvent) => {
    const item = allFlat.find(i => i.id === e.active.id)
    setDraggedItem(item || null)
  }

  const handleDragOver = (e: { over: { id: string | number } | null }) => {
    setDragOverHeading(e.over ? String(e.over.id) : null)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    setDraggedItem(null)
    setDragOverHeading(null)
    if (!over) return
    reparentItem(String(active.id), String(over.id))
  }

  const handleDragCancel = () => {
    setDraggedItem(null)
    setDragOverHeading(null)
  }

  const exportRa = (id: string) => {
    const item = allFlat.find(i => i.id === id)
    toast.info('Not yet implemented', { description: 'This feature is planned but not yet built.' })
  }

  // Close context menu on outside click / escape
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null) }
    document.addEventListener('click', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [contextMenu])

  const toggleExpand = (id: string) => {
    setExpandedArr(prev => {
      const arr = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      return arr
    })
  }

  const handleToggleSelect = (id: string, value: boolean) => {
    setSelected(prev => {
      const n = new Set(prev)
      if (value) n.add(id); else n.delete(id)
      return n
    })
  }

  if (boqLoading) {
    return <div className="h-full flex items-center justify-center"><LoadingState label="Loading BOQ items…" /></div>
  }

  return (
    <>
    <Workspace3Pane
      centerPane={
        <>
          <PaneHeader title={`BOQ · ${selected.size > 0 ? `${selected.size} selected` : 'Kathmandu Ring Road P3'}`}>
            {/* Search — moved from the old left outline pane */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Filter BOQ items…" className="h-7 w-44 pl-7 text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <span className="hidden lg:flex items-center gap-1.5 text-[10px] text-muted-foreground px-2 py-0.5 rounded bg-secondary/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Edit Qty/Rate · drag rows to headings to reparent
            </span>
            {/* Undo/Redo buttons */}
            <div className="flex items-center gap-0.5 border-r border-[var(--pane-divider)] pr-1.5 mr-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn('h-7 w-7 p-0', !canUndo && 'opacity-40 cursor-not-allowed')}
                onClick={undo}
                disabled={!canUndo}
                title="Undo (⌘Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn('h-7 w-7 p-0', !canRedo && 'opacity-40 cursor-not-allowed')}
                onClick={redo}
                disabled={!canRedo}
                title="Redo (⌘⇧Z)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </Button>
              {(canUndo || canRedo) && (
                <span className="text-[9px] text-muted-foreground font-mono px-1">
                  {undoStack.length}/{undoStack.length + redoStack.length}
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5" />Export RA (DoR Format)
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => {
              const flat = flatten(boqData)
              exportToCsv('omnisite-boq.csv', ['Code', 'Description', 'Type', 'Qty', 'UOM', 'Rate (NPR)', 'Amount (NPR)'],
                flat.map(i => [i.code, i.desc, i.type, i.qty, i.uom, i.rate, i.qty * i.rate]))
              toast.success('BOQ exported', { description: `${flat.length} items exported to CSV` })
            }}>
              <Download className="w-3.5 h-3.5" />Export CSV
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1.5"><Plus className="w-3.5 h-3.5" />Item</Button>
          </PaneHeader>
          {/* Column header — sticky on vertical scroll, scrolls horizontally with body */}
          <StickyTableShell minWidth={1000}>
          <StickyTableHeader>
            <div className="w-6" />
            <div className="w-7" />
            {boqIsVisible('code') && <div className="w-16 px-2">Code</div>}
            <div className="flex-1 px-2">Description</div>
            {boqIsVisible('qty') && <div className="w-24 px-2 text-right">Qty</div>}
            {boqIsVisible('uom') && <div className="w-14 px-2">UOM</div>}
            {boqIsVisible('rate') && <div className="w-28 px-2 text-right">Rate (NPR)</div>}
            {boqIsVisible('amount') && <div className="w-28 px-2 text-right">Amount (NPR)</div>}
            {boqIsVisible('type') && <div className="w-24 px-2">Type</div>}
            {boqIsVisible('ra') && <div className="w-10 text-center">RA</div>}
            <div className="flex-shrink-0 pr-2"><ColumnToggle columns={BOQ_COLS} visible={boqColVisible} onToggle={boqToggleCol} /></div>
          </StickyTableHeader>
          <StickyTableBody>
          <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <BoqGrid
                items={filteredBoqData}
                expanded={searchQuery.trim() ? new Set(allFlat.map(i => i.id)) : expanded}
                selectedId={selectedId}
                selected={selected}
                editing={editing}
                draggedItem={draggedItem}
                dragOverHeading={dragOverHeading}
                onSelectId={setSelectedId}
                onContextMenu={setContextMenu}
                onToggleExpand={toggleExpand}
                onToggleSelect={handleToggleSelect}
                onUpdateItem={updateItem}
                onSetEditing={setEditing}
                isVisible={boqIsVisible}
              />
              <DragOverlay>
                {draggedItem ? (
                  <div className="flex items-center h-9 px-4 pane border border-primary rounded-md shadow-lg text-xs gap-2">
                    <GripVertical className="w-3 h-3 text-primary" />
                    <span className="font-mono text-muted-foreground">{draggedItem.code}</span>
                    <span className="font-medium truncate">{draggedItem.desc}</span>
                    <Badge variant="secondary" className="text-[9px] ml-2">{draggedItem.type}</Badge>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </StickyTableBody>
          </StickyTableShell>
          {/* Footer — contract summary moved from the old left outline pane */}
          <div className="h-9 border-t border-[var(--pane-divider)] flex items-center px-4 text-xs text-muted-foreground bg-secondary/30 gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {allFlat.filter(i => i.type !== 'Heading').length} line items · live totals
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span>{allFlat.filter(i => i.type === 'Priced').length} priced</span>
            <span className="text-muted-foreground/50">·</span>
            <span>{allFlat.filter(i => i.type === 'Provisional Sum').length} PS</span>
            <span className="text-muted-foreground/50">·</span>
            <span>{allFlat.filter(i => i.type === 'Daywork').length} daywork</span>
            <div className="flex-1" />
            <span>Contract Total: <span className="font-mono font-bold text-foreground tabular-nums">NPR {contractTotal.toLocaleString()}</span></span>
          </div>
        </>
      }
      rightPane={
        selectedLeaf.type === 'Priced' ? (
          // key={item.id} forces RaInspector to remount when the selected
          // BOQ item changes, so its internal coefficient/row state resets
          // instead of leaking from the previous item.
          <RaInspector key={selectedLeaf.id} item={selectedLeaf} />
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
            className="fixed z-50 pane border border-[var(--pane-divider)] rounded-lg shadow-2xl overflow-hidden py-1 w-52 animate-in fade-in zoom-in-95 duration-100"
            style={{ left: Math.min(contextMenu.x, window.innerWidth - 220), top: Math.min(contextMenu.y, window.innerHeight - 280) }}
            onClick={(e) => e.stopPropagation()}
          >
            <ContextMenuItem icon={<Edit3 className="w-3.5 h-3.5" />} label="Edit item" onClick={() => { setContextMenu(null); toast.info('Not yet implemented', { description: 'This feature is planned but not yet built.' }) }} />
            <ContextMenuItem icon={<Copy className="w-3.5 h-3.5" />} label="Duplicate" shortcut="⌘D" onClick={() => { duplicateItem(contextMenu.itemId); setContextMenu(null) }} />
            <ContextMenuItem icon={<FilePlus className="w-3.5 h-3.5" />} label="Add child item" onClick={() => { addChildItem(contextMenu.itemId); setContextMenu(null) }} />
            <div className="my-1 h-px bg-[var(--pane-divider)]" />
            <ContextMenuItem icon={<FileSpreadsheet className="w-3.5 h-3.5" />} label="Export RA (DoR)" onClick={() => { exportRa(contextMenu.itemId); setContextMenu(null) }} />
            <ContextMenuItem icon={<Link2 className="w-3.5 h-3.5" />} label="Link to Schedule" onClick={() => { setContextMenu(null); toast.info('Not yet implemented', { description: 'This feature is planned but not yet built.' }) }} />
            <ContextMenuItem icon={<History className="w-3.5 h-3.5" />} label="View audit log" onClick={() => { setContextMenu(null); toast.info('Not yet implemented', { description: 'This feature is planned but not yet built.' }) }} />
            <div className="my-1 h-px bg-[var(--pane-divider)]" />
            <ContextMenuItem icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete" danger onClick={() => { deleteItem(contextMenu.itemId); setContextMenu(null) }} />
          </div>
        </>
      )}
    </>
  )
}

export default BoqModule
