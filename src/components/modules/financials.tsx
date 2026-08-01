'use client'

import { useState } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Search, Plus, Upload, TrendingUp, TrendingDown, AlertTriangle,
  DollarSign, FileSpreadsheet, CheckCircle2, Camera, Receipt, Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePersistentState } from '@/lib/use-persistent-state'
import { useColumnVisibility, ColumnToggle, StickyTableShell, StickyTableHeader, StickyTableBody, type ColumnDef } from '@/components/ui/table-utils'
import { useSyncedState } from '@/lib/use-synced-state'
import { LoadingState } from '@/components/ui/loading-state'
import { exportToCsv } from '@/lib/csv-export'
import { toast } from 'sonner'
import { undoableToast } from '@/components/ui/confirm-dialog'
import { Download } from 'lucide-react'

interface CbsNode {
  code: string; name: string; budget: number; committed: number; actual: number; forecast: number; marginPct: number; level: number; children?: CbsNode[]; parentCode?: string
}

const CBS: CbsNode[] = [
  {
    code: '1', name: 'Bridge Works', budget: 285_000_000, committed: 268_000_000, actual: 142_500_000, forecast: 278_000_000, marginPct: 2.4, level: 0,
    children: [
      { code: '1.1', name: 'Foundation', budget: 84_000_000, committed: 82_000_000, actual: 48_300_000, forecast: 80_500_000, marginPct: 4.2, level: 1 },
      { code: '1.2', name: 'Substructure', budget: 112_000_000, committed: 108_000_000, actual: 64_200_000, forecast: 110_800_000, marginPct: 1.1, level: 1 },
      { code: '1.3', name: 'Superstructure', budget: 89_000_000, committed: 78_000_000, actual: 30_000_000, forecast: 86_700_000, marginPct: 2.6, level: 1 },
    ],
  },
  {
    code: '2', name: 'Road Works', budget: 145_000_000, committed: 138_000_000, actual: 82_300_000, forecast: 142_500_000, marginPct: 1.7, level: 0,
    children: [
      { code: '2.1', name: 'Earthwork', budget: 38_000_000, committed: 36_500_000, actual: 28_400_000, forecast: 37_200_000, marginPct: 2.1, level: 1 },
      { code: '2.2', name: 'Pavement', budget: 89_000_000, committed: 84_500_000, actual: 48_700_000, forecast: 87_800_000, marginPct: 1.3, level: 1 },
      { code: '2.3', name: 'Signage & Markings', budget: 18_000_000, committed: 17_000_000, actual: 5_200_000, forecast: 17_500_000, marginPct: 2.8, level: 1 },
    ],
  },
  {
    code: '3', name: 'Drainage', budget: 57_400_000, committed: 54_200_000, actual: 18_400_000, forecast: 56_800_000, marginPct: 1.0, level: 0,
  },
]

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

function flattenCbs(items: CbsNode[]): CbsNode[] {
  const out: CbsNode[] = []
  for (const i of items) {
    out.push(i)
    if (i.children) out.push(...flattenCbs(i.children))
  }
  return out
}

export function FinancialsModule() {
  // Synced state — uses Supabase when configured, falls back to localStorage
  const [selectedCode, setSelectedCode] = usePersistentState('omnisite-financials-selected', '1.1')
  const [expandedArr, setExpandedArr] = usePersistentState<string[]>('omnisite-financials-expanded', ['1', '2'])
  const [cbsRows, setCbsRows, financialsLoading] = useSyncedState<CbsNode[]>(
    'omnisite-financials-cbs',
    'cbs_nodes',
    () => JSON.parse(JSON.stringify(CBS)),
    {
      fieldMap: { marginPct: 'margin_pct', parentCode: 'parent_code' },
      primaryKey: 'code',
    }
  )

  // Rebuild tree from flat rows
  const cbsData = (() => {
    if (!cbsRows || cbsRows.length === 0) return JSON.parse(JSON.stringify(CBS))
    // Check if data is already a tree (has non-empty children arrays) or flat rows.
    // NOTE: use Array.isArray(r.children) && r.children.length > 0 instead of
    // `'children' in r` — the `in` operator checks key existence, and flattenCbs
    // sets `children: undefined` on every flattened row, so `'children' in r`
    // would always be true and the rebuild-from-flat branch would never run.
    const hasChildren = cbsRows.some((r) => Array.isArray((r as CbsNode).children) && (r as CbsNode).children!.length > 0)
    if (hasChildren) return cbsRows

    const rows = cbsRows as unknown as Record<string, unknown>[]
    const map = new Map<string, CbsNode>()
    const roots: CbsNode[] = []

    for (const row of rows) {
      const node: CbsNode = {
        code: row.code as string,
        name: row.name as string,
        budget: Number(row.budget) || 0,
        committed: Number(row.committed) || 0,
        actual: Number(row.actual) || 0,
        forecast: Number(row.forecast) || 0,
        marginPct: Number(row.marginPct ?? row.margin_pct) || 0,
        level: Number(row.level) || 0,
      }
      map.set(node.code, node)
    }
    for (const row of rows) {
      const node = map.get(row.code as string)!
      const parentCode = (row.parentCode || row.parent_code) as string | null
      if (parentCode && map.has(parentCode)) {
        const parent = map.get(parentCode)!
        if (!parent.children) parent.children = []
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    }
    return roots.length > 0 ? roots : JSON.parse(JSON.stringify(CBS))
  })()

  // Flatten tree for saving
  const flattenCbs = (items: CbsNode[], parentCode: string | null = null): CbsNode[] => {
    const out: CbsNode[] = []
    for (const item of items) {
      out.push({ ...item, parentCode: parentCode || undefined, children: undefined })
      if (item.children) out.push(...flattenCbs(item.children, item.code))
    }
    return out
  }

  // Wrapper setter that flattens before saving.
  // Uses a functional update on setCbsRows so the latest committed state
  // is used (avoids stale-closure bugs when multiple edits land in the
  // same React batch).
  const rebuildTreeFromRows = (rows: CbsNode[]): CbsNode[] => {
    if (!rows || rows.length === 0) return JSON.parse(JSON.stringify(CBS))
    const hasChildren = rows.some((r) => Array.isArray(r.children) && r.children!.length > 0)
    if (hasChildren) return rows
    const map = new Map<string, CbsNode>()
    const roots: CbsNode[] = []
    for (const row of rows as unknown as Record<string, unknown>[]) {
      const node: CbsNode = {
        code: row.code as string,
        name: row.name as string,
        budget: Number(row.budget) || 0,
        committed: Number(row.committed) || 0,
        actual: Number(row.actual) || 0,
        forecast: Number(row.forecast) || 0,
        marginPct: Number(row.marginPct ?? row.margin_pct) || 0,
        level: Number(row.level) || 0,
      }
      map.set(node.code, node)
    }
    for (const row of rows as unknown as Record<string, unknown>[]) {
      const node = map.get(row.code as string)!
      const parentCode = (row.parentCode || row.parent_code) as string | null
      if (parentCode && map.has(parentCode)) {
        const parent = map.get(parentCode)!
        if (!parent.children) parent.children = []
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    }
    return roots.length > 0 ? roots : JSON.parse(JSON.stringify(CBS))
  }

  const setCbsData = (updater: (prev: CbsNode[]) => CbsNode[]) => {
    setCbsRows(prevRows => {
      const prevTree = rebuildTreeFromRows(prevRows)
      const next = updater(prevTree)
      return flattenCbs(next) as unknown as CbsNode[]
    })
  }

  // Convert expanded array to Set for O(1) lookups
  const expanded = new Set(expandedArr)

  const flat = flattenCbs(cbsData)
  const selected = flat.find(c => c.code === selectedCode) ?? flat[0]

  // Live totals — sum of TOP-LEVEL nodes only.
  // NOTE: must filter to roots (no parentCode). Summing all rows in cbsData
  // would double-count: each parent's budget + each child's budget.
  const totals = cbsData
    .filter(c => !c.parentCode)
    .reduce((acc, c) => ({
      budget: acc.budget + c.budget,
      committed: acc.committed + c.committed,
      actual: acc.actual + c.actual,
      forecast: acc.forecast + c.forecast,
    }), { budget: 0, committed: 0, actual: 0, forecast: 0 })

  // Live total margin
  const totalMarginPct = totals.budget > 0 ? ((totals.budget - totals.forecast) / totals.budget) * 100 : 0

  // Non-persistent UI state
  const [editing, setEditing] = useState<{ code: string; field: 'committed' | 'actual' | 'forecast' } | null>(null)
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
  const { visible: cbsColVisible, isVisible: cbsIsVisible, toggle: cbsToggleCol } = useColumnVisibility(CBS_COLS.map(c => c.key), [], 'cbs-grid')
  const [cbsSearch, setCbsSearch] = useState('')

  // Update a CBS node's committed/actual/forecast.
  // After updating a leaf, walk back UP the tree and re-aggregate parent
  // totals so the parent's actual/committed/forecast/marginPct reflect
  // the sum of its children.
  const updateNode = (code: string, field: 'committed' | 'actual' | 'forecast', value: number) => {
    // Capture the previous value so we can offer an undo. Walk the current
    // tree (before the setState commit) to find the leaf being edited.
    const prevNode = flat.find(c => c.code === code)
    const oldValue = prevNode ? prevNode[field] : 0
    setCbsData(prev => {
      const updated = JSON.parse(JSON.stringify(prev)) as CbsNode[]
      // walk() returns true if the target was found in this subtree, so the
      // caller can re-aggregate the parent on the way back up the recursion.
      const walk = (items: CbsNode[]): boolean => {
        for (const n of items) {
          if (n.code === code) {
            n[field] = Math.max(0, value)
            // Recalculate margin: (budget - forecast) / budget * 100
            n.marginPct = n.budget > 0 ? ((n.budget - n.forecast) / n.budget) * 100 : 0
            return true
          }
          if (n.children && walk(n.children)) {
            // Re-aggregate this parent from its children after a child changed.
            n.actual = n.children.reduce((s, c) => s + c.actual, 0)
            n.committed = n.children.reduce((s, c) => s + c.committed, 0)
            n.forecast = n.children.reduce((s, c) => s + c.forecast, 0)
            n.budget = n.children.reduce((s, c) => s + c.budget, 0)
            n.marginPct = n.budget > 0 ? ((n.budget - n.forecast) / n.budget) * 100 : 0
            return true
          }
        }
        return false
      }
      walk(updated)
      return updated
    })
    undoableToast(
      `${field[0].toUpperCase()}${field.slice(1)} updated`,
      `${code}: ${oldValue} → ${Math.max(0, value)}. Click Undo to revert.`,
      () => updateNode(code, field, oldValue),
    )
  }

  const toggleExpand = (code: string) => {
    setExpandedArr(prev => prev.includes(code) ? prev.filter(x => x !== code) : [...prev, code])
  }

  const renderCbsRows = (items: CbsNode[], depth: number): React.ReactNode[] => {
    const rows: React.ReactNode[] = []
    for (const c of items) {
      const isExpanded = expanded.has(c.code)
      const hasChildren = c.children && c.children.length > 0
      const isSelected = c.code === selectedCode
      const isLeaf = !hasChildren
      const variance = c.budget - c.forecast
      rows.push(
        <div
          key={c.code}
          onClick={() => setSelectedCode(c.code)}
          className={cn(
            'flex items-center h-9 border-b border-[var(--pane-divider)] text-xs cursor-pointer row-hover',
            isSelected && 'bg-accent'
          )}
          style={{ paddingLeft: `${depth * 18 + 8}px` }}
        >
          <div className="w-5">
            {hasChildren && (
              <button onClick={e => { e.stopPropagation(); toggleExpand(c.code) }} className="p-0.5">
                {isExpanded ? '▾' : '▸'}
              </button>
            )}
          </div>
          {cbsIsVisible('code') && <div className="w-16 font-mono text-muted-foreground">{c.code}</div>}
          <div className={cn('flex-1 truncate', depth === 0 && 'font-semibold')}>{c.name}</div>
          {cbsIsVisible('budget') && <div className="w-24 text-right pr-2 font-mono text-muted-foreground">{fmt(c.budget)}</div>}
          {/* Committed — inline editable for leaf nodes */}
          {cbsIsVisible('committed') && <div className="w-24 pr-2">
            {isLeaf ? (
              <input
                type="number"
                value={c.committed || ''}
                onChange={(e) => updateNode(c.code, 'committed', parseFloat(e.target.value) || 0)}
                onFocus={() => setEditing({ code: c.code, field: 'committed' })}
                onBlur={() => setEditing(null)}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'w-full h-6 text-right text-xs font-mono px-1.5 rounded border transition-colors bg-transparent',
                  editing?.code === c.code && editing.field === 'committed'
                    ? 'border-primary bg-background ring-1 ring-primary/30'
                    : 'border-transparent hover:border-[var(--pane-divider)] hover:bg-accent/50 text-muted-foreground'
                )}
              />
            ) : (
              <span className="text-right block font-mono text-muted-foreground">{fmt(c.committed)}</span>
            )}
          </div>}
          {/* Actual — inline editable for leaf nodes */}
          {cbsIsVisible('actual') && <div className="w-24 pr-2">
            {isLeaf ? (
              <input
                type="number"
                value={c.actual || ''}
                onChange={(e) => updateNode(c.code, 'actual', parseFloat(e.target.value) || 0)}
                onFocus={() => setEditing({ code: c.code, field: 'actual' })}
                onBlur={() => setEditing(null)}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'w-full h-6 text-right text-xs font-mono px-1.5 rounded border transition-colors bg-transparent',
                  editing?.code === c.code && editing.field === 'actual'
                    ? 'border-primary bg-background ring-1 ring-primary/30'
                    : 'border-transparent hover:border-[var(--pane-divider)] hover:bg-accent/50'
                )}
              />
            ) : (
              <span className="text-right block font-mono">{fmt(c.actual)}</span>
            )}
          </div>}
          {/* Forecast — inline editable for leaf nodes */}
          {cbsIsVisible('forecast') && <div className="w-24 pr-2">
            {isLeaf ? (
              <input
                type="number"
                value={c.forecast || ''}
                onChange={(e) => updateNode(c.code, 'forecast', parseFloat(e.target.value) || 0)}
                onFocus={() => setEditing({ code: c.code, field: 'forecast' })}
                onBlur={() => setEditing(null)}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'w-full h-6 text-right text-xs font-mono px-1.5 rounded border transition-colors bg-transparent',
                  editing?.code === c.code && editing.field === 'forecast'
                    ? 'border-primary bg-background ring-1 ring-primary/30'
                    : 'border-transparent hover:border-[var(--pane-divider)] hover:bg-accent/50'
                )}
              />
            ) : (
              <span className="text-right block font-mono">{fmt(c.forecast)}</span>
            )}
          </div>}
          {/* Margin — live recalculated, color-coded */}
          {cbsIsVisible('margin') && <div className={cn('w-20 text-right pr-3 font-mono font-medium tabular-nums', c.marginPct >= 0 ? 'delta-up' : 'delta-down')}>
            {c.marginPct >= 0 ? '+' : ''}{c.marginPct.toFixed(1)}%
          </div>}
        </div>
      )
      if (hasChildren && isExpanded) rows.push(...renderCbsRows(c.children!, depth + 1))
    }
    return rows
  }

  if (financialsLoading) {
    return <div className="h-full flex items-center justify-center"><LoadingState label="Loading financials…" /></div>
  }

  return (
    <Workspace2Pane
      leftPane={
        <>
          <PaneHeader title="CBS Tree">
            <Button variant="ghost" size="sm" className="h-7" onClick={() => toast.info('Not yet implemented', { description: 'This feature is planned but not yet built.' })}><Plus className="w-3.5 h-3.5" /></Button>
          </PaneHeader>
          <PaneBody className="py-2">
            <div className="px-3 mb-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Filter CBS nodes…" className="h-8 pl-7 text-xs" value={cbsSearch} onChange={(e) => setCbsSearch(e.target.value)} />
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground px-3 py-2">Mirrors BOQ WBS · 3 top nodes · 7 leaf items</div>
            {CBS.filter(c => {
              if (!cbsSearch.trim()) return true
              const q = cbsSearch.toLowerCase()
              const liveNode = cbsData.find(n => n.code === c.code) ?? c
              return liveNode.code.toLowerCase().includes(q) || liveNode.name.toLowerCase().includes(q)
            }).map(c => {
              // Use the LIVE tree (cbsData) for display so the left-pane
              // reflects user edits. Previously this rendered from the CBS
              // constant, so edits to the P&L grid never updated the outline.
              const liveNode = cbsData.find(n => n.code === c.code) ?? c
              return (
                <button
                  key={c.code}
                  onClick={() => setSelectedCode(c.code)}
                  className={cn('w-full text-left px-3 py-1.5 hover:bg-accent/50', selectedCode === c.code && 'bg-accent')}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{liveNode.code}</span>
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
            <span className="hidden lg:flex items-center gap-1.5 text-[10px] text-muted-foreground px-2 py-0.5 rounded bg-secondary/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Edit Committed/Actual/Forecast on leaf nodes
            </span>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => {
              exportToCsv('omnisite-financials.csv',
                ['Code', 'Name', 'Budget', 'Committed', 'Actual', 'Forecast', 'Margin %'],
                flattenCbs(cbsData).map(c => [c.code, c.name, c.budget, c.committed, c.actual, c.forecast, c.marginPct.toFixed(1)])
              )
              toast.success('Financials exported', { description: `${flattenCbs(cbsData).length} CBS nodes exported to CSV` })
            }}><Download className="w-3.5 h-3.5" />Export CSV</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => toast.info('Not yet implemented', { description: 'This feature is planned but not yet built.' })}><Upload className="w-3.5 h-3.5" />Upload RA Bill</Button>
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => toast.info('Not yet implemented', { description: 'This feature is planned but not yet built.' })}><Plus className="w-3.5 h-3.5" />Quick Expense</Button>
          </PaneHeader>
          {/* Top KPI strip */}
          <div className="grid grid-cols-4 gap-3 p-3 border-b border-[var(--pane-divider)] bg-secondary/20">
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
            <div className="flex-shrink-0 pr-2"><ColumnToggle columns={CBS_COLS} visible={cbsColVisible} onToggle={cbsToggleCol} /></div>
          </StickyTableHeader>
          <StickyTableBody>{renderCbsRows(cbsData, 0)}</StickyTableBody>
          </StickyTableShell>
          {/* Footer — project totals */}
          <div className="h-9 border-t border-[var(--pane-divider)] flex items-center px-4 text-xs bg-secondary/30">
            <span className="font-medium">Project Totals</span>
            <div className="flex-1" />
            {cbsIsVisible('budget') && <span className="w-24 text-right font-mono">{fmt(totals.budget)}</span>}
            {cbsIsVisible('committed') && <span className="w-24 text-right font-mono text-muted-foreground">{fmt(totals.committed)}</span>}
            {cbsIsVisible('actual') && <span className="w-24 text-right font-mono">{fmt(totals.actual)}</span>}
            {cbsIsVisible('forecast') && <span className="w-24 text-right font-mono">{fmt(totals.forecast)}</span>}
            {cbsIsVisible('margin') && <span className={cn('w-20 text-right font-mono font-bold tabular-nums', totalMarginPct >= 0 ? 'delta-up' : 'delta-down')}>
              {totalMarginPct >= 0 ? '+' : ''}{totalMarginPct.toFixed(1)}%
            </span>}
          </div>
        </>
      }
      rightPane={<FinancialsInspector node={selected} />}
      leftPaneWidth="240px"
      rightPaneWidth="380px"
    />
  )
}

function KpiCell({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-lg font-bold mt-0.5', muted && 'text-muted-foreground')}>{value}</div>
    </div>
  )
}

function FinancialsInspector({ node }: { node: CbsNode }) {
  const systemEarned = node.actual * 1.04 // BCWP proxy
  const clientBilled = node.actual * 0.92 // upload&track value
  const unbilled = systemEarned - clientBilled

  return (
    <>
      <PaneHeader title={`Financial Inspector · ${node.code}`} />
      <PaneBody>
        <div className="p-4 border-b border-[var(--pane-divider)]">
          <Badge variant="outline" className="text-[10px]">CBS Node</Badge>
          <div className="text-sm font-semibold mt-2">{node.name}</div>
        </div>

        <Tabs defaultValue="pl">
          <div className="px-3 pt-2">
            <TabsList className="grid grid-cols-3 h-8 w-full text-xs">
              <TabsTrigger value="pl" className="text-[11px]">P&L</TabsTrigger>
              <TabsTrigger value="billing" className="text-[11px]">Client Billing</TabsTrigger>
              <TabsTrigger value="expenses" className="text-[11px]">Expenses</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="pl" className="mt-0 px-4 py-3 space-y-3 text-xs">
            <Row label="Budgeted Cost (BOQ)" value={`NPR ${fmt(node.budget)}`} />
            <Row label="Committed Cost (POs)" value={`NPR ${fmt(node.committed)}`} muted />
            <Row label="Actual Cost (DSR + Manual)" value={`NPR ${fmt(node.actual)}`} />
            <Row label="Forecast (EAC)" value={`NPR ${fmt(node.forecast)}`} bold />
            <Separator />
            <Row label="Variance (Budget − Forecast)" value={`NPR ${fmt(node.budget - node.forecast)}`} className={node.budget - node.forecast >= 0 ? 'delta-up' : 'delta-down'} />
            <Row label="Node Margin" value={`${node.marginPct >= 0 ? '+' : ''}${node.marginPct.toFixed(1)}%`} className={node.marginPct >= 0 ? 'delta-up' : 'delta-down'} bold />

            <Separator />

            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Cost Composition (Actual)</div>
            <div className="space-y-1.5">
              <CostBar label="Material" amount={node.actual * 0.58} color="bg-blue-500" total={node.actual} />
              <CostBar label="Labour" amount={node.actual * 0.22} color="bg-emerald-500" total={node.actual} />
              <CostBar label="Equipment" amount={node.actual * 0.12} color="bg-amber-500" total={node.actual} />
              <CostBar label="Subcontractor" amount={node.actual * 0.05} color="bg-violet-500" total={node.actual} />
              <CostBar label="Indirect / O&P" amount={node.actual * 0.03} color="bg-rose-500" total={node.actual} />
            </div>
          </TabsContent>

          <TabsContent value="billing" className="mt-0 px-4 py-3 space-y-3 text-xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Upload & Track Model</div>
            <div className="rounded-md border border-[var(--pane-divider)] p-3 bg-secondary/20">
              <div className="flex items-center gap-2 mb-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-medium">RA Bill #4 — Approved</span>
                <Badge variant="secondary" className="text-[9px] ml-auto">12 Aug 2026</Badge>
              </div>
              <div className="text-[10px] text-muted-foreground">Gross Billed Amount (manual input):</div>
              <Input className="mt-1 h-8 text-xs font-mono" defaultValue={`NPR ${fmt(clientBilled)}`} />
              <Button size="sm" variant="outline" className="mt-2 h-7 text-xs gap-1.5 w-full"><Upload className="w-3 h-3" />Re-upload Excel/PDF</Button>
            </div>

            <Separator />

            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">System Reconciliation</div>
            <Row label="System Earned Value (BCWP)" value={`NPR ${fmt(systemEarned)}`} />
            <Row label="Uploaded Gross Billed" value={`NPR ${fmt(clientBilled)}`} muted />
            <Separator />
            <div className={cn('flex items-center gap-2 p-2 rounded-md', unbilled > 0 ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-emerald-500/10 border border-emerald-500/30')}>
              <AlertTriangle className={cn('w-3.5 h-3.5', unbilled > 0 ? 'text-amber-500' : 'text-emerald-500')} />
              <div className="flex-1">
                <div className="font-medium">{unbilled > 0 ? 'Unbilled Work Detected' : 'Reconciled'}</div>
                <div className="text-[10px] text-muted-foreground">
                  {unbilled > 0 ? `NPR ${fmt(unbilled)} earned but not yet billed. Risk of revenue leakage.` : 'Billed matches earned value.'}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="expenses" className="mt-0 px-4 py-3 space-y-2 text-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quick Expense Entries</div>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"><Plus className="w-3 h-3" />Add</Button>
            </div>
            {[
              { date: '29 Jul', desc: 'Site engineer salary — July', amount: 45000, cat: 'Salary' },
              { date: '28 Jul', desc: 'Fuel — site vehicle (receipt)', amount: 8200, cat: 'Travel' },
              { date: '27 Jul', desc: 'Survey equipment rental', amount: 12500, cat: 'T&P' },
              { date: '25 Jul', desc: 'Workshop — concrete testing', amount: 4500, cat: 'Quality' },
            ].map((e, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded border border-[var(--pane-divider)]">
                <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{e.desc}</div>
                  <div className="text-[10px] text-muted-foreground">{e.date} · {e.cat}</div>
                </div>
                <div className="font-mono">NPR {e.amount.toLocaleString()}</div>
                <Camera className="w-3 h-3 text-violet-500" />
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </PaneBody>
    </>
  )
}

function Row({ label, value, muted, bold, className }: { label: string; value: string; muted?: boolean; bold?: boolean; className?: string }) {
  return (
    <div className="flex justify-between">
      <span className={cn(muted && 'text-muted-foreground', bold && 'font-semibold')}>{label}</span>
      <span className={cn('font-mono', bold && 'font-bold', className)}>{value}</span>
    </div>
  )
}

function CostBar({ label, amount, color, total }: { label: string; amount: number; color: string; total: number }) {
  const pct = total > 0 ? (amount / total) * 100 : 0
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span>{label}</span>
        <span className="font-mono">NPR {fmt(amount)} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
