'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Plus, Download, FileSpreadsheet, FilePlus, Undo2, Redo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { exportToCsv } from '@/lib/csv-export'
import { type BoqItem, flatten } from './types'
import { exportRa } from './export-ra'
import { addChildItem, type BoqHandlerCtx } from './handlers'

interface BoqToolbarProps {
  /** Active project name (for the title when nothing is selected). */
  activeProject: string | null
  /** Number of selected rows (for the title when > 0). */
  selectedCount: number
  /** Search query state. */
  searchQuery: string
  onSearchChange: (v: string) => void
  /** Whether the dataset is truncated (shows "Load more" button). */
  boqTruncated: boolean
  onLoadMore: () => void
  /** Undo/redo state. */
  canUndo: boolean
  canRedo: boolean
  undoCount: number
  redoCount: number
  onUndo: () => void
  onRedo: () => void
  /** Selected leaf item (for Export RA + Add child). */
  selectedLeaf: BoqItem | undefined
  /** Full BOQ tree (for Export CSV). */
  boqData: BoqItem[]
  /** Handler context (for Add child). */
  ctx: BoqHandlerCtx
}

/**
 * BOQ grid header toolbar (search, truncation indicator, undo/redo,
 * Export RA, Export CSV, Add Item).
 *
 * Extracted from `BoqModule` so the component body focuses on layout.
 */
export function BoqToolbar({
  activeProject,
  selectedCount,
  searchQuery,
  onSearchChange,
  boqTruncated,
  onLoadMore,
  canUndo,
  canRedo,
  undoCount,
  redoCount,
  onUndo,
  onRedo,
  selectedLeaf,
  boqData,
  ctx,
}: BoqToolbarProps) {
  return (
    <>
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
        <Input
          placeholder="Filter BOQ items…"
          className="h-7 w-44 pl-7 text-xs"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
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
            onClick={onLoadMore}
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
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (⌘Z)"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7 w-7 p-0', !canRedo && 'cursor-not-allowed opacity-40')}
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (⌘⇧Z)"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
        {(canUndo || canRedo) && (
          <span className="text-muted-foreground px-1 font-mono text-[9px]">
            {undoCount}/{undoCount + redoCount}
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
          const flatRows = flatten(boqData)
          exportToCsv(
            'omnisite-boq.csv',
            ['Code', 'Description', 'Type', 'Qty', 'UOM', 'Rate (NPR)', 'Amount (NPR)'],
            flatRows.map((i: BoqItem) => [
              i.code,
              i.desc,
              i.type,
              i.qty,
              i.uom,
              i.rate,
              i.qty * i.rate,
            ])
          )
          toast.success('BOQ exported', {
            description: `${flatRows.length} items exported to CSV`,
          })
        }}
      >
        <Download className="h-3.5 w-3.5" />
        Export CSV
      </Button>
      <Button
        size="sm"
        className="h-7 gap-1.5 text-xs"
        // Disable the + Item button when the selected item is not a Heading
        // — children can only be added under Headings (the handler guards
        // this too, but disabling gives better UX). If no item is selected,
        // allow the click so the handler can show its error toast (audit B6-3).
        disabled={!!selectedLeaf && selectedLeaf.type !== 'Heading'}
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
    </>
  )
}

/**
 * The header title for the BOQ grid — shows selection count or active project.
 */
export function BoqGridTitle({
  selectedCount,
  activeProject,
}: {
  selectedCount: number
  activeProject: string | null
}) {
  return `BOQ · ${selectedCount > 0 ? `${selectedCount} selected` : (activeProject ?? 'No project selected')}`
}
