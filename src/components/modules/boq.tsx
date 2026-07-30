'use client'

import { useState } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search, Plus, ChevronRight, ChevronDown, Download, Save, FolderOpen,
  Zap, Edit3, FileSpreadsheet, AlertTriangle, CheckCircle2, TrendingUp,
  History, Link2, Lock, Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface BoqItem {
  id: string
  code: string
  desc: string
  type: 'Priced' | 'Provisional Sum' | 'Daywork' | 'Heading'
  qty: number
  uom: string
  rate: number
  hasRA?: boolean
  level: number
  children?: BoqItem[]
}

const BOQ_DATA: BoqItem[] = [
  {
    id: '1', code: '1', desc: 'Bridge over Bagmati River', type: 'Heading', qty: 0, uom: '', rate: 0, level: 0,
    children: [
      {
        id: '1.1', code: '1.1', desc: 'Foundation Works', type: 'Heading', qty: 0, uom: '', rate: 0, level: 1,
        children: [
          { id: '1.1.1', code: '1.1.1', desc: 'Excavation in ordinary soil', type: 'Priced', qty: 1240, uom: 'cum', rate: 485, hasRA: true, level: 2 },
          { id: '1.1.2', code: '1.1.2', desc: 'Stone soling 150mm thick', type: 'Priced', qty: 320, uom: 'cum', rate: 4250, hasRA: true, level: 2 },
          { id: '1.1.3', code: '1.1.3', desc: 'PCC M15 (1:2:4) below footing', type: 'Priced', qty: 88, uom: 'cum', rate: 9800, hasRA: true, level: 2 },
          { id: '1.1.4', code: '1.1.4', desc: 'PCC M20 grade concrete', type: 'Priced', qty: 145, uom: 'cum', rate: 12400, hasRA: true, level: 2 },
        ],
      },
      {
        id: '1.2', code: '1.2', desc: 'Substructure', type: 'Heading', qty: 0, uom: '', rate: 0, level: 1,
        children: [
          { id: '1.2.1', code: '1.2.1', desc: 'Reinforcement steel Fe500 (TMT)', type: 'Priced', qty: 18.5, uom: 'MT', rate: 118000, hasRA: true, level: 2 },
          { id: '1.2.2', code: '1.2.2', desc: 'Shuttering ply waterproof', type: 'Priced', qty: 420, uom: 'sqm', rate: 980, hasRA: true, level: 2 },
          { id: '1.2.3', code: '1.2.3', desc: 'Dewatering provision', type: 'Provisional Sum', qty: 1, uom: 'lot', rate: 250000, level: 2 },
        ],
      },
    ],
  },
  {
    id: '2', code: '2', desc: 'Road Works', type: 'Heading', qty: 0, uom: '', rate: 0, level: 0,
    children: [
      {
        id: '2.1', code: '2.1', desc: 'Earthwork', type: 'Heading', qty: 0, uom: '', rate: 0, level: 1,
        children: [
          { id: '2.1.1', code: '2.1.1', desc: 'Excavation for road formation', type: 'Priced', qty: 18500, uom: 'cum', rate: 412, hasRA: true, level: 2 },
          { id: '2.1.2', code: '2.1.2', desc: 'Embankment fill (compacted)', type: 'Priced', qty: 8200, uom: 'cum', rate: 385, hasRA: true, level: 2 },
        ],
      },
      {
        id: '2.2', code: '2.2', desc: 'Pavement', type: 'Heading', qty: 0, uom: '', rate: 0, level: 1,
        children: [
          { id: '2.2.1', code: '2.2.1', desc: 'DBM 50mm thick bituminous layer', type: 'Priced', qty: 14200, uom: 'sqm', rate: 1450, hasRA: true, level: 2 },
          { id: '2.2.2', code: '2.2.2', desc: 'BC 40mm wearing course', type: 'Priced', qty: 14200, uom: 'sqm', rate: 1680, hasRA: true, level: 2 },
          { id: '2.2.3', code: '2.2.3', desc: 'Prime coat application', type: 'Daywork', qty: 1, uom: 'lot', rate: 0, level: 2 },
        ],
      },
    ],
  },
  {
    id: '3', code: '3', desc: 'Drainage & Cross Drainage', type: 'Heading', qty: 0, uom: '', rate: 0, level: 0,
    children: [
      { id: '3.1', code: '3.1', desc: 'Hume pipe NP3 600mm dia', type: 'Priced', qty: 84, uom: 'rmt', rate: 6800, hasRA: true, level: 1 },
      { id: '3.2', code: '3.2', desc: 'Box culvert 2x2m precast', type: 'Priced', qty: 6, uom: 'no', rate: 285000, hasRA: true, level: 1 },
    ],
  },
]

function flatten(items: BoqItem[]): BoqItem[] {
  const out: BoqItem[] = []
  for (const i of items) {
    out.push(i)
    if (i.children) out.push(...flatten(i.children))
  }
  return out
}

export function BoqModule() {
  const [selectedId, setSelectedId] = useState('1.1.3')
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['1', '1.1', '2', '2.1', '3']))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Convert BOQ_DATA into mutable state so Qty/Rate can be edited inline
  const [boqData, setBoqData] = useState<BoqItem[]>(() => JSON.parse(JSON.stringify(BOQ_DATA)))
  const [editing, setEditing] = useState<{ id: string; field: 'qty' | 'rate' } | null>(null)

  const allFlat = flatten(boqData)
  const selectedLeaf = allFlat.find(i => i.id === selectedId) ?? allFlat[2]

  // Live contract total — sum of qty × rate for all non-heading items
  const contractTotal = allFlat
    .filter(i => i.type !== 'Heading')
    .reduce((sum, i) => sum + i.qty * i.rate, 0)

  // Update a single BOQ item's qty or rate
  const updateItem = (id: string, field: 'qty' | 'rate', value: number) => {
    setBoqData(prev => {
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

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const renderRows = (items: BoqItem[], depth = 0): React.ReactNode[] => {
    const rows: React.ReactNode[] = []
    for (const item of items) {
      const isHeading = item.type === 'Heading'
      const isExpanded = expanded.has(item.id)
      const hasChildren = item.children && item.children.length > 0
      const isSelected = item.id === selectedId

      rows.push(
        <div
          key={item.id}
          onClick={() => setSelectedId(item.id)}
          className={cn(
            'flex items-center h-9 border-b border-[var(--pane-divider)] text-xs cursor-pointer row-hover transition-colors',
            isSelected && 'bg-accent'
          )}
          style={{ paddingLeft: `${depth * 18 + 8}px` }}
        >
          {!isHeading && (
            <div className="w-6 flex-shrink-0">
              <Checkbox
                checked={selected.has(item.id)}
                onCheckedChange={(v) => {
                  setSelected(prev => {
                    const n = new Set(prev)
                    if (v) n.add(item.id); else n.delete(item.id)
                    return n
                  })
                }}
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}
          <div className="w-7 flex-shrink-0">
            {hasChildren && (
              <button onClick={(e) => { e.stopPropagation(); toggleExpand(item.id) }} className="p-0.5 hover:bg-accent-foreground/10 rounded">
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
          <div className="w-16 flex-shrink-0 font-mono text-muted-foreground">{item.code}</div>
          <div className={cn('flex-1 min-w-0 truncate', isHeading && 'font-semibold')}>
            {item.desc}
          </div>
          {/* Qty cell — inline editable for non-heading items */}
          <div className="w-24 flex-shrink-0 pr-2">
            {isHeading || item.type === 'Provisional Sum' ? (
              <span className="text-right block text-muted-foreground">{item.qty > 0 ? item.qty.toLocaleString() : '—'}</span>
            ) : (
              <input
                type="number"
                value={item.qty || ''}
                onChange={(e) => updateItem(item.id, 'qty', parseFloat(e.target.value) || 0)}
                onFocus={() => setEditing({ id: item.id, field: 'qty' })}
                onBlur={() => setEditing(null)}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'w-full h-6 text-right text-xs font-mono px-1.5 rounded border transition-colors bg-transparent',
                  editing?.id === item.id && editing.field === 'qty'
                    ? 'border-primary bg-background ring-1 ring-primary/30'
                    : 'border-transparent hover:border-[var(--pane-divider)] hover:bg-accent/50'
                )}
              />
            )}
          </div>
          <div className="w-14 flex-shrink-0 text-muted-foreground">{item.uom || '—'}</div>
          {/* Rate cell — inline editable for non-heading items (locked for Provisional Sum) */}
          <div className="w-28 flex-shrink-0 pr-2">
            {isHeading ? (
              <span className="text-right block font-mono text-muted-foreground">—</span>
            ) : item.type === 'Provisional Sum' ? (
              <div className="flex items-center justify-end gap-1 text-muted-foreground">
                <Lock className="w-2.5 h-2.5" />
                <span className="font-mono">{item.rate.toLocaleString()}</span>
              </div>
            ) : (
              <input
                type="number"
                value={item.rate || ''}
                onChange={(e) => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                onFocus={() => setEditing({ id: item.id, field: 'rate' })}
                onBlur={() => setEditing(null)}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'w-full h-6 text-right text-xs font-mono px-1.5 rounded border transition-colors bg-transparent',
                  editing?.id === item.id && editing.field === 'rate'
                    ? 'border-primary bg-background ring-1 ring-primary/30'
                    : 'border-transparent hover:border-[var(--pane-divider)] hover:bg-accent/50'
                )}
              />
            )}
          </div>
          {/* Amount cell — auto-calculated, live updates */}
          <div className="w-28 flex-shrink-0 text-right pr-3 font-mono font-medium tabular-nums">
            {item.qty * item.rate > 0 ? (item.qty * item.rate).toLocaleString() : '—'}
          </div>
          <div className="w-24 flex-shrink-0 pr-2">
            {isHeading ? (
              <Badge variant="outline" className="text-[10px]">Heading</Badge>
            ) : (
              <Badge
                variant="secondary"
                className={cn('text-[10px]', item.type === 'Provisional Sum' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300', item.type === 'Daywork' && 'bg-violet-500/15 text-violet-700 dark:text-violet-300')}
              >
                {item.type}
              </Badge>
            )}
          </div>
          <div className="w-10 flex-shrink-0 flex justify-center">
            {!isHeading && item.hasRA && <Lock className="w-3 h-3 text-emerald-500" />}
          </div>
        </div>
      )

      if (hasChildren && isExpanded) {
        rows.push(...renderRows(item.children!, depth + 1))
      }
    }
    return rows
  }

  return (
    <Workspace3Pane
      leftPane={
        <>
          <PaneHeader title="BOQ Outline">
            <Button variant="ghost" size="sm" className="h-7"><Plus className="w-3.5 h-3.5" /></Button>
          </PaneHeader>
          <div className="px-3 py-2 border-b border-[var(--pane-divider)]">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Filter BOQ items…" className="h-8 pl-7 text-xs" />
            </div>
          </div>
          <PaneBody className="py-2">
            <BoqOutlineTree items={boqData} selectedId={selectedId} onSelect={setSelectedId} expanded={expanded} onToggle={toggleExpand} />
          </PaneBody>
          <div className="border-t border-[var(--pane-divider)] p-3 space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Contract Summary</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Total Contract Value</span><span className="font-mono font-semibold tabular-nums">NPR {(contractTotal / 1_000_000).toFixed(1)}M</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Priced items</span><span className="font-mono">82</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Provisional Sums</span><span className="font-mono">7</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Daywork items</span><span className="font-mono">3</span></div>
            </div>
          </div>
        </>
      }
      centerPane={
        <>
          <PaneHeader title={`BOQ Grid · ${selected.size > 0 ? `${selected.size} selected` : 'Kathmandu Ring Road P3'}`}>
            <span className="hidden lg:flex items-center gap-1.5 text-[10px] text-muted-foreground px-2 py-0.5 rounded bg-secondary/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Click Qty/Rate to edit
            </span>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5" />Export RA (DoR Format)
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
              <Download className="w-3.5 h-3.5" />Export
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1.5"><Plus className="w-3.5 h-3.5" />Item</Button>
          </PaneHeader>
          {/* Column header */}
          <div className="flex items-center h-8 border-b border-[var(--pane-divider)] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/30">
            <div className="w-6" />
            <div className="w-7" />
            <div className="w-16 px-2">Code</div>
            <div className="flex-1 px-2">Description</div>
            <div className="w-24 px-2 text-right">Qty</div>
            <div className="w-14 px-2">UOM</div>
            <div className="w-28 px-2 text-right">Rate (NPR)</div>
            <div className="w-28 px-2 text-right">Amount (NPR)</div>
            <div className="w-24 px-2">Type</div>
            <div className="w-10 text-center">RA</div>
          </div>
          <PaneBody className="px-0">
            {renderRows(boqData)}
          </PaneBody>
          <div className="h-9 border-t border-[var(--pane-divider)] flex items-center px-4 text-xs text-muted-foreground bg-secondary/30">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {allFlat.filter(i => i.type !== 'Heading').length} line items · live totals
            </span>
            <div className="flex-1" />
            <span>Contract Total: <span className="font-mono font-bold text-foreground tabular-nums">NPR {contractTotal.toLocaleString()}</span></span>
          </div>
        </>
      }
      rightPane={
        selectedLeaf.type === 'Priced' ? (
          <RaInspector item={selectedLeaf} />
        ) : (
          <NonPricedInspector item={selectedLeaf} />
        )
      }
      leftPaneWidth="280px"
      rightPaneWidth="380px"
    />
  )
}

function BoqOutlineTree({ items, selectedId, onSelect, expanded, onToggle, depth = 0 }: {
  items: BoqItem[]; selectedId: string; onSelect: (id: string) => void;
  expanded: Set<string>; onToggle: (id: string) => void; depth?: number;
}) {
  return (
    <div className="text-xs">
      {items.map(item => {
        const isExpanded = expanded.has(item.id)
        const hasChildren = item.children && item.children.length > 0
        const isHeading = item.type === 'Heading'
        return (
          <div key={item.id}>
            <button
              onClick={() => onSelect(item.id)}
              className={cn(
                'w-full flex items-center gap-1.5 h-7 pr-2 rounded transition-colors',
                selectedId === item.id ? 'bg-accent' : 'hover:bg-accent/50'
              )}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              {hasChildren ? (
                <span onClick={(e) => { e.stopPropagation(); onToggle(item.id) }} className="cursor-pointer p-0.5">
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </span>
              ) : (
                <span className="w-4" />
              )}
              <span className={cn('font-mono text-muted-foreground text-[10px] w-7', isHeading && 'font-semibold')}>{item.code}</span>
              <span className={cn('truncate flex-1 text-left', isHeading && 'font-semibold')}>{item.desc}</span>
              {item.hasRA && <Lock className="w-2.5 h-2.5 text-emerald-500" />}
            </button>
            {hasChildren && isExpanded && (
              <BoqOutlineTree items={item.children!} selectedId={selectedId} onSelect={onSelect} expanded={expanded} onToggle={onToggle} depth={depth + 1} />
            )}
          </div>
        )
      })}
    </div>
  )
}

interface RaRow {
  code: string; name: string; uom: string; qty: number; rate: number; source: string;
}

const MATERIALS: RaRow[] = [
  { code: 'M-CEM-OPC', name: 'Cement OPC 53 Grade (Udaipur)', uom: 'Bag', qty: 4.5, rate: 920, source: 'Project Rate Library' },
  { code: 'M-SAND-R', name: 'River Sand (Trishuli)', uom: 'cum', qty: 0.45, rate: 3850, source: 'Project Rate Library' },
  { code: 'M-AGG-20', name: 'Coarse Aggregate 20mm', uom: 'cum', qty: 0.9, rate: 2950, source: 'Project Rate Library' },
  { code: 'M-WAT', name: 'Water (tanker)', uom: 'ltr', qty: 180, rate: 0.45, source: 'Project Rate Library' },
]

const LABOUR: RaRow[] = [
  { code: 'L-MASN', name: 'Mason (Skilled Cat. I)', uom: 'day', qty: 0.6, rate: 1450, source: 'DoR Norm 2075' },
  { code: 'L-HEL', name: 'Mazdoor (Unskilled)', uom: 'day', qty: 1.4, rate: 950, source: 'DoR Norm 2075' },
  { code: 'L-MIX', name: 'Mixer Operator', uom: 'day', qty: 0.2, rate: 1200, source: 'DoR Norm 2075' },
]

const EQUIPMENT: RaRow[] = [
  { code: 'E-MIX', name: 'Concrete Mixer 0.4 cum', uom: 'hr', qty: 1.8, rate: 285, source: 'Equipment Master' },
  { code: 'E-VIB', name: 'Needle Vibrator 60mm', uom: 'hr', qty: 1.2, rate: 95, source: 'Equipment Master' },
]

function RaInspector({ item }: { item: BoqItem }) {
  // Live state for RA coefficients — drives real-time recalculation of the Financial Summary
  const [pctCosts, setPctCosts] = useState({
    labour: { on: true, pct: 2.5 },
    material: { on: true, pct: 1.5 },
    equipment: { on: true, pct: 3.5 },
    tp: { on: false, pct: 0 },
  })
  const [opOnDirect, setOpOnDirect] = useState(true)
  const [opOnPct, setOpOnPct] = useState(true)
  const [opPct, setOpPct] = useState(15)

  // Recompute on every render — pure function of state
  const directCost = [...MATERIALS, ...LABOUR, ...EQUIPMENT].reduce((s, r) => s + r.qty * r.rate, 0)
  const labourCost = LABOUR.reduce((s, r) => s + r.qty * r.rate, 0)
  const materialCost = MATERIALS.reduce((s, r) => s + r.qty * r.rate, 0)
  const equipCost = EQUIPMENT.reduce((s, r) => s + r.qty * r.rate, 0)

  const pctCostBase =
    (pctCosts.labour.on ? labourCost * pctCosts.labour.pct / 100 : 0) +
    (pctCosts.material.on ? materialCost * pctCosts.material.pct / 100 : 0) +
    (pctCosts.equipment.on ? equipCost * pctCosts.equipment.pct / 100 : 0) +
    (pctCosts.tp.on ? directCost * pctCosts.tp.pct / 100 : 0)

  const opBase = (opOnDirect ? directCost : 0) + (opOnPct ? pctCostBase : 0)
  const overheadAmount = opBase * (opPct / 100)
  const totalCost = directCost + pctCostBase + overheadAmount
  const contractRate = item.rate
  const margin = contractRate - totalCost
  const marginPct = (margin / contractRate) * 100

  return (
    <>
      <PaneHeader title={`RA Inspector · ${item.code}`} />
      <PaneBody>
        <div className="p-4 border-b border-[var(--pane-divider)]">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Item</div>
          <div className="text-sm font-semibold mt-1 leading-snug">{item.desc}</div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>{item.qty.toLocaleString()} {item.uom}</span>
            <span>·</span>
            <span>Rate: NPR {item.rate.toLocaleString()}</span>
          </div>
        </div>

        <Tabs defaultValue="builder" className="w-full">
          <div className="px-3 pt-2">
            <TabsList className="grid grid-cols-3 h-8 text-xs">
              <TabsTrigger value="builder" className="text-xs">RA Builder</TabsTrigger>
              <TabsTrigger value="trace" className="text-xs">Traceability</TabsTrigger>
              <TabsTrigger value="audit" className="text-xs">Audit Log</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="builder" className="mt-0">
            <RaSection title="Materials" icon={<Layers className="w-3.5 h-3.5" />} rows={MATERIALS} />
            <RaSection title="Labour" icon={<Layers className="w-3.5 h-3.5" />} rows={LABOUR} />
            <RaSection title="Equipment" icon={<Layers className="w-3.5 h-3.5" />} rows={EQUIPMENT} />

            {/* % COSTS */}
            <div className="px-4 py-3 border-y border-[var(--pane-divider)]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">% Costs (Indirect)</div>
                <Button variant="ghost" size="sm" className="h-6 text-xs"><Plus className="w-3 h-3" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 p-2 rounded-md border border-[var(--pane-divider)]">
                  <Checkbox
                    checked={pctCosts.labour.on}
                    onCheckedChange={(v) => setPctCosts(s => ({ ...s, labour: { ...s.labour, on: !!v } }))}
                  />
                  <span className="flex-1">% of Labour</span>
                  <Input
                    className="h-6 w-12 text-xs"
                    type="number"
                    value={pctCosts.labour.pct}
                    onChange={(e) => setPctCosts(s => ({ ...s, labour: { ...s.labour, pct: parseFloat(e.target.value) || 0 } }))}
                  />
                </label>
                <label className="flex items-center gap-2 p-2 rounded-md border border-[var(--pane-divider)]">
                  <Checkbox
                    checked={pctCosts.material.on}
                    onCheckedChange={(v) => setPctCosts(s => ({ ...s, material: { ...s.material, on: !!v } }))}
                  />
                  <span className="flex-1">% of Material</span>
                  <Input
                    className="h-6 w-12 text-xs"
                    type="number"
                    value={pctCosts.material.pct}
                    onChange={(e) => setPctCosts(s => ({ ...s, material: { ...s.material, pct: parseFloat(e.target.value) || 0 } }))}
                  />
                </label>
                <label className="flex items-center gap-2 p-2 rounded-md border border-[var(--pane-divider)]">
                  <Checkbox
                    checked={pctCosts.equipment.on}
                    onCheckedChange={(v) => setPctCosts(s => ({ ...s, equipment: { ...s.equipment, on: !!v } }))}
                  />
                  <span className="flex-1">% of Equipment</span>
                  <Input
                    className="h-6 w-12 text-xs"
                    type="number"
                    value={pctCosts.equipment.pct}
                    onChange={(e) => setPctCosts(s => ({ ...s, equipment: { ...s.equipment, pct: parseFloat(e.target.value) || 0 } }))}
                  />
                </label>
                <label className="flex items-center gap-2 p-2 rounded-md border border-[var(--pane-divider)]">
                  <Checkbox
                    checked={pctCosts.tp.on}
                    onCheckedChange={(v) => setPctCosts(s => ({ ...s, tp: { ...s.tp, on: !!v } }))}
                  />
                  <span className="flex-1">T&P Charges</span>
                  <Input
                    className="h-6 w-12 text-xs"
                    type="number"
                    placeholder="—"
                    value={pctCosts.tp.pct || ''}
                    onChange={(e) => setPctCosts(s => ({ ...s, tp: { ...s.tp, pct: parseFloat(e.target.value) || 0 } }))}
                  />
                </label>
              </div>
            </div>

            {/* O&P */}
            <div className="px-4 py-3 border-b border-[var(--pane-divider)]">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Overhead & Profit (cumulative)</div>
              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={opOnDirect}
                    onCheckedChange={(v) => setOpOnDirect(!!v)}
                  />
                  <span className="flex-1">On Direct Cost</span>
                  <span className="font-mono">NPR {directCost.toFixed(0)}</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={opOnPct}
                    onCheckedChange={(v) => setOpOnPct(!!v)}
                  />
                  <span className="flex-1">On Prior % Costs</span>
                  <span className="font-mono">NPR {pctCostBase.toFixed(0)}</span>
                </label>
                <div className="flex items-center gap-2 pl-6 pt-1">
                  <span className="flex-1 text-muted-foreground">O&P %</span>
                  <Input
                    className="h-6 w-16 text-xs"
                    type="number"
                    value={opPct}
                    onChange={(e) => setOpPct(parseFloat(e.target.value) || 0)}
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-[var(--pane-divider)]">
                  <span className="font-medium">O&P Amount</span>
                  <span className="font-mono font-semibold tabular-nums">NPR {overheadAmount.toFixed(0)}</span>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="px-4 py-3 bg-secondary/30">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                Financial Summary & Margin
                <span className="text-[10px] font-normal text-primary/70 normal-case tracking-normal">· recalculates live</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <Row label="Direct Cost" value={`NPR ${directCost.toFixed(0)}`} />
                <Row label="% Costs" value={`NPR ${pctCostBase.toFixed(0)}`} muted />
                <Row label="O&P" value={`NPR ${overheadAmount.toFixed(0)}`} muted />
                <Separator className="my-2" />
                <Row label="Total RA Cost" value={`NPR ${totalCost.toFixed(0)}`} bold />
                <Row label="Contract BOQ Rate" value={`NPR ${contractRate.toLocaleString()}`} bold />
                <Separator className="my-2" />
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className={cn('w-3.5 h-3.5', margin >= 0 ? 'delta-up' : 'delta-down')} />
                    Actual Gross Margin
                  </span>
                  <span className={cn('font-mono font-bold tabular-nums', margin >= 0 ? 'delta-up' : 'delta-down')}>
                    {marginPct >= 0 ? '+' : ''}{marginPct.toFixed(1)}%
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground pl-5">
                  Margin per {item.uom}: NPR <span className="font-mono tabular-nums">{margin.toFixed(0)}</span> · No double-count of RA O&P
                </div>
                {/* Visual margin bar */}
                <div className="mt-2 pt-2 border-t border-[var(--pane-divider)]">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Cost</span>
                    <span>Margin</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden flex bg-secondary">
                    <div
                      className="bg-amber-500/70 transition-all duration-300"
                      style={{ width: `${Math.min(100, (totalCost / contractRate) * 100)}%` }}
                    />
                    <div
                      className={cn('transition-all duration-300', margin >= 0 ? 'bg-emerald-500/70' : 'bg-red-500/70')}
                      style={{ width: `${Math.max(0, Math.min(100, (margin / contractRate) * 100))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] mt-1">
                    <span className="font-mono text-amber-600">NPR {totalCost.toFixed(0)}</span>
                    <span className={cn('font-mono', margin >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {margin >= 0 ? '+' : ''}NPR {margin.toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="trace" className="mt-0 px-4 py-3 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Traceability Matrix</div>
            <TraceRow icon={<Link2 className="w-3.5 h-3.5" />} label="Schedule Task" value="T-104 · Foundation PCC" status="linked" />
            <TraceRow icon={<Link2 className="w-3.5 h-3.5" />} label="Purchase Order" value="PO-2410-018 · Cement 1,200 bags" status="linked" />
            <TraceRow icon={<Link2 className="w-3.5 h-3.5" />} label="DSR Actual Qty" value="142.5 / 145 cum (98.3%)" status="progress" />
            <TraceRow icon={<Link2 className="w-3.5 h-3.5" />} label="GRN Receipts" value="4 GRNs · NPR 1,384,500" status="linked" />
            <TraceRow icon={<Link2 className="w-3.5 h-3.5" />} label="Running Account" value="RA Bill #4 · claimed 142.5 cum" status="linked" />
            <TraceRow icon={<AlertTriangle className="w-3.5 h-3.5" />} label="NCR Holds" value="NCR-034 · 0 billable" status="blocked" />
          </TabsContent>

          <TabsContent value="audit" className="mt-0 px-4 py-3 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />Audit Log
            </div>
            <AuditRow who="Arjun S." action="Updated cement rate from NPR 895 → NPR 920" when="2 hrs ago" />
            <AuditRow who="Bikash R." action="Adjusted mazdoor coefficient 1.6 → 1.4" when="Yesterday 16:42" />
            <AuditRow who="System" action="Preset loaded: PCC-M15-Standard" when="3 days ago" />
            <AuditRow who="Arjun S." action="Created RA from blank template" when="1 week ago" />
          </TabsContent>
        </Tabs>

        {/* Preset bar */}
        <div className="border-t border-[var(--pane-divider)] p-3 flex items-center gap-2 bg-secondary/20">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5"><FolderOpen className="w-3.5 h-3.5" />Load Preset</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5"><Save className="w-3.5 h-3.5" />Save Preset</Button>
          <div className="flex-1" />
          <Button size="sm" className="h-7 text-xs gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Save RA</Button>
        </div>
      </PaneBody>
    </>
  )
}

function RaSection({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: RaRow[] }) {
  const sectionTotal = rows.reduce((s, r) => s + r.qty * r.rate, 0)
  return (
    <div className="px-4 py-3 border-b border-[var(--pane-divider)]">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">{icon}{title}</div>
        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"><Plus className="w-3 h-3" />Add</Button>
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-12 gap-1.5 items-center text-xs p-1.5 rounded hover:bg-accent/40">
            <div className="col-span-7">
              <div className="font-medium truncate">{r.name}</div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <span className="font-mono">{r.code}</span>
                <span>·</span>
                <span>{r.source}</span>
              </div>
            </div>
            <Input className="col-span-2 h-6 text-xs px-1" defaultValue={r.qty} />
            <div className="col-span-3 flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">{r.uom}</span>
              <div className="flex-1 flex items-center gap-0.5">
                <Input className="h-6 text-xs px-1 flex-1 font-mono" defaultValue={r.rate} />
                <button className="p-0.5 hover:bg-accent rounded" title="Auto-calc from primary UOM">
                  <Zap className="w-3 h-3 text-amber-500" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--pane-divider)] text-xs">
        <span className="text-muted-foreground">Section subtotal ({rows.length} resources)</span>
        <span className="font-mono font-semibold">NPR {sectionTotal.toFixed(0)}/{rows[0]?.uom || 'unit'}</span>
      </div>
    </div>
  )
}

function Row({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={cn(muted && 'text-muted-foreground', bold && 'font-semibold')}>{label}</span>
      <span className={cn('font-mono', bold && 'font-semibold')}>{value}</span>
    </div>
  )
}

function TraceRow({ icon, label, value, status }: { icon: React.ReactNode; label: string; value: string; status: 'linked' | 'progress' | 'blocked' }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-md border border-[var(--pane-divider)] text-xs">
      <span className="text-muted-foreground">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-muted-foreground">{label}</div>
        <div className="truncate">{value}</div>
      </div>
      {status === 'linked' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
      {status === 'progress' && <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-500 border-t-transparent" />}
      {status === 'blocked' && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
    </div>
  )
}

function AuditRow({ who, action, when }: { who: string; action: string; when: string }) {
  return (
    <div className="flex gap-2.5 text-xs">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex-shrink-0 flex items-center justify-center text-white text-[10px] font-semibold">
        {who.charAt(0)}
      </div>
      <div className="flex-1">
        <div><span className="font-medium">{who}</span> <span className="text-muted-foreground">{action}</span></div>
        <div className="text-[10px] text-muted-foreground">{when}</div>
      </div>
    </div>
  )
}

function NonPricedInspector({ item }: { item: BoqItem }) {
  return (
    <>
      <PaneHeader title={`Inspector · ${item.code}`} />
      <PaneBody>
        <div className="p-4 border-b border-[var(--pane-divider)]">
          <Badge variant="secondary" className="text-xs">{item.type}</Badge>
          <div className="text-sm font-semibold mt-2 leading-snug">{item.desc}</div>
        </div>
        <div className="p-4 text-center text-xs text-muted-foreground">
          <Edit3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <div className="font-medium text-foreground">{item.type} item</div>
          <p className="mt-1 leading-relaxed">
            {item.type === 'Provisional Sum'
              ? 'Lump-sum provision. Rate Analysis is hidden — amount is governed by the Engineer per Clause 13.5 of FIDIC Red Book.'
              : item.type === 'Daywork'
                ? 'Daywork rates apply. Quantities are measured on-site and valued at the Daywork Schedule rates included in the Contract.'
                : 'Heading items do not carry rates or RA buildup.'}
          </p>
        </div>
      </PaneBody>
    </>
  )
}
