'use client'

import { useState } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Plus, Upload, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePersistentState } from '@/lib/use-persistent-state'
import {
  useColumnVisibility,
  ColumnToggle,
  StickyTableShell,
  StickyTableHeader,
  StickyTableBody,
  type ColumnDef,
} from '@/components/ui/table-utils'
import { useSyncedState } from '@/lib/use-synced-state'
import { LoadingState } from '@/components/ui/loading-state'
import { exportToCsv } from '@/lib/csv-export'
import { uploadFile } from '@/lib/storage'
import { isSupabaseConfigured } from '@/lib/supabase'
import { toast } from 'sonner'
import { useRef } from 'react'
import { CBS, fmt, flattenCbs, type CbsNode } from './types'
import { rebuildTreeFromRows, createSetCbsData, createUpdateNode } from './hooks'
import { CbsTable, type EditingState } from './table'
import { FinancialsInspector, KpiCell } from './inspector'

export function FinancialsModule() {
  // Synced state — uses Supabase when configured, falls back to localStorage
  const [selectedCode, setSelectedCode] = usePersistentState('omnisite-financials-selected', '1.1')
  const [expandedArr, setExpandedArr] = usePersistentState<string[]>(
    'omnisite-financials-expanded',
    ['1', '2']
  )
  const raBillInputRef = useRef<HTMLInputElement>(null)
  const [cbsRows, setCbsRows, financialsLoading] = useSyncedState<CbsNode[]>(
    'omnisite-financials-cbs',
    'cbs_nodes',
    () => structuredClone(CBS) as typeof CBS,
    {
      fieldMap: { marginPct: 'margin_pct', parentCode: 'parent_code' },
      primaryKey: 'code',
    }
  )

  // Rebuild tree from flat rows
  const cbsData = rebuildTreeFromRows(cbsRows)

  // Wrapper setter that flattens before saving.
  // Uses a functional update on setCbsRows so the latest committed state
  // is used (avoids stale-closure bugs when multiple edits land in the
  // same React batch).
  const setCbsData = createSetCbsData(setCbsRows)

  // Convert expanded array to Set for O(1) lookups
  const expanded = new Set(expandedArr)

  const flat = flattenCbs(cbsData)
  const selected = flat.find((c) => c.code === selectedCode) ?? flat[0]

  // Update a CBS node's committed/actual/forecast.
  // After updating a leaf, walk back UP the tree and re-aggregate parent
  // totals so the parent's actual/committed/forecast/marginPct reflect
  // the sum of its children.
  const updateNode = createUpdateNode(flat, setCbsData)

  // Live totals — sum of TOP-LEVEL nodes only.
  // NOTE: must filter to roots (no parentCode). Summing all rows in cbsData
  // would double-count: each parent's budget + each child's budget.
  const totals = cbsData
    .filter((c) => !c.parentCode)
    .reduce(
      (acc, c) => ({
        budget: acc.budget + c.budget,
        committed: acc.committed + c.committed,
        actual: acc.actual + c.actual,
        forecast: acc.forecast + c.forecast,
      }),
      { budget: 0, committed: 0, actual: 0, forecast: 0 }
    )

  // Live total margin
  const totalMarginPct =
    totals.budget > 0 ? ((totals.budget - totals.forecast) / totals.budget) * 100 : 0

  // Non-persistent UI state
  const [editing, setEditing] = useState<EditingState>(null)
  // Column visibility
  const CBS_COLS: ColumnDef[] = [
    { key: 'expand', label: 'Expand', hideable: false },
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'CBS Node', hideable: false },
    { key: 'budget', label: 'Budget' },
    { key: 'committed', label: 'Committed' },
    { key: 'actual', label: 'Actual' },
    { key: 'forecast', label: 'Forecast' },
    { key: 'margin', label: 'Margin %' },
  ]
  const {
    visible: cbsColVisible,
    isVisible: cbsIsVisible,
    toggle: cbsToggleCol,
  } = useColumnVisibility(
    CBS_COLS.map((c) => c.key),
    [],
    'cbs-grid'
  )
  const [cbsSearch, setCbsSearch] = useState('')

  const toggleExpand = (code: string) => {
    setExpandedArr((prev) =>
      prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]
    )
  }

  if (financialsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState label="Loading financials…" />
      </div>
    )
  }

  return (
    <Workspace2Pane
      leftPane={
        <>
          <PaneHeader title="CBS Tree">
            <Button variant="ghost" size="sm" className="h-7" disabled title="Coming soon">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </PaneHeader>
          <PaneBody className="py-2">
            <div className="mb-2 px-3">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
                <Input
                  placeholder="Filter CBS nodes…"
                  className="h-8 pl-7 text-xs"
                  value={cbsSearch}
                  onChange={(e) => setCbsSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="text-muted-foreground px-3 py-2 text-[10px]">
              Mirrors BOQ WBS · 3 top nodes · 7 leaf items
            </div>
            {CBS.filter((c) => {
              if (!cbsSearch.trim()) return true
              const q = cbsSearch.toLowerCase()
              const liveNode = cbsData.find((n) => n.code === c.code) ?? c
              return (
                liveNode.code.toLowerCase().includes(q) || liveNode.name.toLowerCase().includes(q)
              )
            }).map((c) => {
              // Use the LIVE tree (cbsData) for display so the left-pane
              // reflects user edits. Previously this rendered from the CBS
              // constant, so edits to the P&L grid never updated the outline.
              const liveNode = cbsData.find((n) => n.code === c.code) ?? c
              return (
                <button
                  key={c.code}
                  onClick={() => setSelectedCode(c.code)}
                  className={cn(
                    'hover:bg-accent/50 w-full px-3 py-1.5 text-left',
                    selectedCode === c.code && 'bg-accent'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {liveNode.code}
                    </span>
                    <span className="text-xs font-medium">{liveNode.name}</span>
                  </div>
                </button>
              )
            })}
          </PaneBody>
        </>
      }
      centerPane={
        <>
          <PaneHeader title="P&L Grid · NPR">
            <span className="text-muted-foreground bg-secondary/60 hidden items-center gap-1.5 rounded px-2 py-0.5 text-[10px] lg:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Edit Committed/Actual/Forecast on leaf nodes
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => {
                exportToCsv(
                  'omnisite-financials.csv',
                  ['Code', 'Name', 'Budget', 'Committed', 'Actual', 'Forecast', 'Margin %'],
                  flattenCbs(cbsData).map((c) => [
                    c.code,
                    c.name,
                    c.budget,
                    c.committed,
                    c.actual,
                    c.forecast,
                    c.marginPct.toFixed(1),
                  ])
                )
                toast.success('Financials exported', {
                  description: `${flattenCbs(cbsData).length} CBS nodes exported to CSV`,
                })
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => {
                if (!isSupabaseConfigured()) {
                  toast.error('Storage not configured', {
                    description:
                      'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable uploads.',
                  })
                  return
                }
                raBillInputRef.current?.click()
              }}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload RA Bill
            </Button>
            <input
              ref={raBillInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = '' // reset so the same file can be re-uploaded
                if (!file) return
                const maxSize = 10 * 1024 * 1024 // 10 MB
                if (file.size > maxSize) {
                  toast.error('File too large', {
                    description: `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. Max 10 MB.`,
                  })
                  return
                }
                const toastId = toast.loading('Uploading RA bill…', { description: file.name })
                const result = await uploadFile('ra-bills', file, selectedCode || 'unassigned')
                if (result.error) {
                  toast.error('Upload failed', { id: toastId, description: result.error })
                } else {
                  toast.success('RA bill uploaded', {
                    id: toastId,
                    description: `${file.name} attached to ${selectedCode || 'project'}`,
                  })
                }
              }}
            />
            <Button size="sm" className="h-7 gap-1.5 text-xs" disabled title="Coming soon">
              <Plus className="h-3.5 w-3.5" />
              Quick Expense
            </Button>
          </PaneHeader>
          {/* Top KPI strip */}
          <div className="bg-secondary/20 grid grid-cols-4 gap-3 border-b border-[var(--pane-divider)] p-3">
            <KpiCell label="Budgeted (Contract)" value={`NPR ${fmt(totals.budget)}`} />
            <KpiCell label="Committed (POs)" value={`NPR ${fmt(totals.committed)}`} muted />
            <KpiCell label="Actual (DSR+Exp)" value={`NPR ${fmt(totals.actual)}`} />
            <KpiCell label="Forecast (EAC)" value={`NPR ${fmt(totals.forecast)}`} />
          </div>

          {/* Column header — sticky on vertical scroll, scrolls horizontally with body */}
          <StickyTableShell minWidth={900}>
            <StickyTableHeader>
              <div className="w-5" />
              {cbsIsVisible('code') && <div className="w-16 px-2">Code</div>}
              <div className="flex-1 px-2">CBS Node</div>
              {cbsIsVisible('budget') && <div className="w-24 px-2 text-right">Budget</div>}
              {cbsIsVisible('committed') && <div className="w-24 px-2 text-right">Committed</div>}
              {cbsIsVisible('actual') && <div className="w-24 px-2 text-right">Actual</div>}
              {cbsIsVisible('forecast') && <div className="w-24 px-2 text-right">Forecast</div>}
              {cbsIsVisible('margin') && <div className="w-20 px-2 text-right">Margin %</div>}
              <div className="flex-shrink-0 pr-2">
                <ColumnToggle columns={CBS_COLS} visible={cbsColVisible} onToggle={cbsToggleCol} />
              </div>
            </StickyTableHeader>
            <StickyTableBody>
              <CbsTable
                items={cbsData}
                depth={0}
                expanded={expanded}
                selectedCode={selectedCode}
                editing={editing}
                cbsIsVisible={cbsIsVisible}
                onSelectCode={setSelectedCode}
                toggleExpand={toggleExpand}
                updateNode={updateNode}
                setEditing={setEditing}
              />
            </StickyTableBody>
          </StickyTableShell>
          {/* Footer — project totals */}
          <div className="bg-secondary/30 flex h-9 items-center border-t border-[var(--pane-divider)] px-4 text-xs">
            <span className="font-medium">Project Totals</span>
            <div className="flex-1" />
            {cbsIsVisible('budget') && (
              <span className="w-24 text-right font-mono">{fmt(totals.budget)}</span>
            )}
            {cbsIsVisible('committed') && (
              <span className="text-muted-foreground w-24 text-right font-mono">
                {fmt(totals.committed)}
              </span>
            )}
            {cbsIsVisible('actual') && (
              <span className="w-24 text-right font-mono">{fmt(totals.actual)}</span>
            )}
            {cbsIsVisible('forecast') && (
              <span className="w-24 text-right font-mono">{fmt(totals.forecast)}</span>
            )}
            {cbsIsVisible('margin') && (
              <span
                className={cn(
                  'w-20 text-right font-mono font-bold tabular-nums',
                  totalMarginPct >= 0 ? 'delta-up' : 'delta-down'
                )}
              >
                {totalMarginPct >= 0 ? '+' : ''}
                {totalMarginPct.toFixed(1)}%
              </span>
            )}
          </div>
        </>
      }
      rightPane={<FinancialsInspector node={selected} />}
      leftPaneWidth="240px"
      rightPaneWidth="380px"
    />
  )
}

export default FinancialsModule
