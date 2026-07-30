'use client'

import { useState } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Plus, Search, Users, FileText, Truck, Package, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown, Wallet, Percent, Calendar, ShieldCheck, Activity,
  Gauge, Wrench, Zap, ArrowRight, ArrowLeft, X, Edit3, Layers, Mountain,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { usePersistentState } from '@/lib/use-persistent-state'

// ─── Types ───────────────────────────────────────────────────────────────────

type ItemType = 'composite' | 'conditional'

interface ScItem {
  id: string
  code: string
  desc: string
  uom: string
  rate: number
  plannedQty: number
  actualQty: number
  type: ItemType
  // Mapping to main BOQ (for composite items — e.g., "drain per rmt" maps to excavation, PCC, RCC, etc.)
  mapping?: { boqCode: string; boqDesc: string; coefficient: number; uom: string }[]
  // For conditional items (tunneling support): rock class + design pattern
  rockClass?: string
  designPattern?: number  // expected qty per rm of advance for this rock class
}

interface MaterialIssue {
  id: string       // MIN number
  date: string
  materialCode: string
  materialName: string
  uom: string
  qty: number
  rate: number
  issuedBy: string
  notes?: string
}

interface MaterialReturn {
  id: string       // MRN number
  date: string
  materialCode: string
  materialName: string
  uom: string
  qty: number
  rate: number
  returnedBy: string
  notes?: string
}

interface ConsumableIssue {
  id: string
  date: string
  name: string       // curing compound, binding wire, diesel, form release agent
  uom: string
  qty: number
  rate: number
  normPerUnit?: number  // e.g., 0.5 kg binding wire per MT steel
  normUnit?: string     // "MT"
  normBasis?: number    // total basis (e.g., 28.5 MT steel)
}

interface CustomDeductible {
  id: string
  type: 'tds' | 'equipment' | 'penalty' | 'electricity' | 'insurance' | 'material_overuse' | 'other'
  label: string
  amount: number
  ratePct?: number
  notes?: string
}

interface Subcontractor {
  id: string
  name: string
  scope: string
  agreementValue: number
  advancePaid: number
  advancePct: number       // e.g., 10%
  retentionPct: number     // e.g., 5%
  reworkCost: number
  status: 'active' | 'closed'
  pan: string
  gst: string
  insuranceExpiry: string
  labourLicenseExpiry: string
  items: ScItem[]
  materialIssues: MaterialIssue[]
  materialReturns: MaterialReturn[]
  consumables: ConsumableIssue[]
  customDeductibles: CustomDeductible[]
  assignedTasks: { taskId: string; taskName: string; progress: number; baseline: string; status: string }[]
  ncrCount: number
  incidents: number
  isTunneling: boolean
}

// ─── Initial Data ────────────────────────────────────────────────────────────

const INITIAL_SCS: Subcontractor[] = [
  {
    id: 'SC-01',
    name: 'M/S Lama Constructions',
    scope: 'Drain construction (composite rate per linear meter)',
    agreementValue: 14_550_000,
    advancePaid: 1_455_000,
    advancePct: 10,
    retentionPct: 5,
    reworkCost: 0,
    status: 'active',
    pan: '123456789',
    gst: 'N/A',
    insuranceExpiry: '2027-03-15',
    labourLicenseExpiry: '2026-12-31',
    isTunneling: false,
    items: [
      {
        id: 'SC-01-1',
        code: 'SC-1',
        desc: 'Drain construction per linear meter (composite)',
        uom: 'rmt',
        rate: 48500,
        plannedQty: 300,
        actualQty: 215,
        type: 'composite',
        mapping: [
          { boqCode: '3.1', boqDesc: 'Excavation for drain', coefficient: 1.67, uom: 'cum' },
          { boqCode: '3.2', boqDesc: 'PCC M15 bed', coefficient: 0.40, uom: 'cum' },
          { boqCode: '3.3', boqDesc: 'RCC M25 walls', coefficient: 0.60, uom: 'cum' },
          { boqCode: '3.4', boqDesc: 'Formwork', coefficient: 3.00, uom: 'sqm' },
          { boqCode: '3.5', boqDesc: 'Rebar Fe500', coefficient: 0.095, uom: 'MT' },
          { boqCode: '3.6', boqDesc: 'Plaster', coefficient: 1.50, uom: 'sqm' },
          { boqCode: '3.7', boqDesc: 'Expansion joint', coefficient: 0.40, uom: 'rmt' },
        ],
      },
    ],
    materialIssues: [
      { id: 'MIN-SC1-001', date: '15 Jul', materialCode: 'M-CEM-OPC', materialName: 'Cement OPC 53', uom: 'bag', qty: 850, rate: 920, issuedBy: 'Sita G.', notes: 'For PCC + RCC' },
      { id: 'MIN-SC1-002', date: '20 Jul', materialCode: 'M-STEEL-TMT16', materialName: 'TMT Steel 16mm', uom: 'MT', qty: 12.5, rate: 118200, issuedBy: 'Sita G.' },
      { id: 'MIN-SC1-003', date: '25 Jul', materialCode: 'M-AGG-20', materialName: 'Coarse Aggregate 20mm', uom: 'cum', qty: 145, rate: 2950, issuedBy: 'Sita G.' },
      { id: 'MIN-SC1-004', date: '28 Jul', materialCode: 'M-SAND-R', materialName: 'River Sand', uom: 'cum', qty: 72, rate: 3850, issuedBy: 'Sita G.' },
    ],
    materialReturns: [
      { id: 'MRN-SC1-001', date: '28 Jul', materialCode: 'M-CEM-OPC', materialName: 'Cement OPC 53', uom: 'bag', qty: 32, rate: 920, returnedBy: 'Foreman (SC)', notes: 'Surplus from last pour' },
    ],
    consumables: [
      { id: 'CON-SC1-001', date: '15 Jul', name: 'Binding wire', uom: 'kg', qty: 6.5, rate: 95, normPerUnit: 0.5, normUnit: 'MT', normBasis: 12.5 },
      { id: 'CON-SC1-002', date: '20 Jul', name: 'Curing compound', uom: 'ltr', qty: 18, rate: 180, normPerUnit: 0.15, normUnit: 'sqm', normBasis: 120 },
      { id: 'CON-SC1-003', date: '25 Jul', name: 'Form release agent', uom: 'ltr', qty: 8, rate: 220, normPerUnit: 0.05, normUnit: 'sqm', normBasis: 120 },
    ],
    customDeductibles: [
      { id: 'DED-SC1-1', type: 'tds', label: 'TDS (1.5%)', amount: 0, ratePct: 1.5, notes: 'Nepal TDS on subcontractor payment' },
      { id: 'DED-SC1-2', type: 'equipment', label: 'Concrete mixer hire', amount: 8400, notes: '3 days × NPR 2,800/day' },
      { id: 'DED-SC1-3', type: 'electricity', label: 'Site electricity (July)', amount: 5200, notes: 'Metered' },
    ],
    assignedTasks: [
      { taskId: 'T-301', taskName: 'Box Culvert Construction', progress: 35, baseline: 'Wk 13 → 31', status: 'on-track' },
      { taskId: 'T-302', taskName: 'Base slab concrete', progress: 70, baseline: 'Wk 14 → 19', status: 'on-track' },
      { taskId: 'T-303', taskName: 'Wall & slab rebar', progress: 12, baseline: 'Wk 18 → 26', status: 'delayed' },
    ],
    ncrCount: 1,
    incidents: 0,
  },
  {
    id: 'SC-02',
    name: 'Shrestha Steel Works',
    scope: 'Rebar fabrication & fixing',
    agreementValue: 2_183_000,
    advancePaid: 218_300,
    advancePct: 10,
    retentionPct: 5,
    reworkCost: 24_500,
    status: 'active',
    pan: '987654321',
    gst: 'N/A',
    insuranceExpiry: '2026-11-30',
    labourLicenseExpiry: '2027-01-15',
    isTunneling: false,
    items: [
      {
        id: 'SC-02-1',
        code: 'SC-2',
        desc: 'Rebar fabrication & fixing (Fe500)',
        uom: 'MT',
        rate: 118000,
        plannedQty: 18.5,
        actualQty: 11.65,
        type: 'composite',
        mapping: [
          { boqCode: '1.2.1', boqDesc: 'Reinforcement steel Fe500 (TMT)', coefficient: 1.0, uom: 'MT' },
        ],
      },
    ],
    materialIssues: [
      { id: 'MIN-SC2-001', date: '18 Jul', materialCode: 'M-STEEL-TMT16', materialName: 'TMT Steel 16mm', uom: 'MT', qty: 12.0, rate: 118200, issuedBy: 'Sita G.' },
    ],
    materialReturns: [],
    consumables: [
      { id: 'CON-SC2-001', date: '18 Jul', name: 'Binding wire', uom: 'kg', qty: 6.0, rate: 95, normPerUnit: 0.5, normUnit: 'MT', normBasis: 12.0 },
    ],
    customDeductibles: [
      { id: 'DED-SC2-1', type: 'tds', label: 'TDS (1.5%)', amount: 0, ratePct: 1.5 },
    ],
    assignedTasks: [
      { taskId: 'T-303', taskName: 'Wall & slab rebar', progress: 12, baseline: 'Wk 18 → 26', status: 'delayed' },
    ],
    ncrCount: 1,
    incidents: 0,
  },
  {
    id: 'SC-03',
    name: 'Himal Tunneling Co.',
    scope: 'Tunnel excavation & support (uncertain works)',
    agreementValue: 0, // determined by actual quantities
    advancePaid: 4_400_000,
    advancePct: 10,
    retentionPct: 5,
    reworkCost: 0,
    status: 'active',
    pan: '555666777',
    gst: 'N/A',
    insuranceExpiry: '2027-06-30',
    labourLicenseExpiry: '2026-10-12',
    isTunneling: true,
    items: [
      // Base excavation — per rm of advance
      {
        id: 'SC-03-1',
        code: 'SC-TUN-EXC',
        desc: 'Tunnel excavation (all rock classes)',
        uom: 'rm',
        rate: 45000,
        plannedQty: 0, // unknown total
        actualQty: 42.5, // from face log
        type: 'composite',
        mapping: [
          { boqCode: '4.1', boqDesc: 'Tunnel excavation', coefficient: 1.0, uom: 'rm' },
        ],
      },
      // Conditional support items — 0 planned, activated by face log
      {
        id: 'SC-03-2',
        code: 'SC-TUN-SR',
        desc: 'Steel rib ISMB 150 (conditional)',
        uom: 'no',
        rate: 8500,
        plannedQty: 0,
        actualQty: 38, // from face log
        type: 'conditional',
        rockClass: 'Class III',
        designPattern: 0.83, // 1 rib per 1.2m = 0.83/rm
      },
      {
        id: 'SC-03-3',
        code: 'SC-TUN-SC50',
        desc: 'Shotcrete 50mm (conditional)',
        uom: 'sqm',
        rate: 1200,
        plannedQty: 0,
        actualQty: 285, // from face log
        type: 'conditional',
        rockClass: 'Class III',
        designPattern: 6.67, // perimeter × 1rm
      },
      {
        id: 'SC-03-4',
        code: 'SC-TUN-SC75',
        desc: 'Shotcrete 75mm (upgraded — Class IV)',
        uom: 'sqm',
        rate: 1800,
        plannedQty: 0,
        actualQty: 45, // from face log (Class IV section)
        type: 'conditional',
        rockClass: 'Class IV',
        designPattern: 10.0,
      },
      {
        id: 'SC-03-5',
        code: 'SC-TUN-RB3',
        desc: 'Rock bolt 3m (conditional)',
        uom: 'no',
        rate: 1800,
        plannedQty: 0,
        actualQty: 152, // from face log
        type: 'conditional',
        rockClass: 'Class III',
        designPattern: 4.0,
      },
    ],
    materialIssues: [
      { id: 'MIN-SC3-001', date: '10 Jul', materialCode: 'M-STEEL-ISMB150', materialName: 'ISMB 150 steel', uom: 'no', qty: 40, rate: 6200, issuedBy: 'Sita G.' },
      { id: 'MIN-SC3-002', date: '12 Jul', materialCode: 'M-SHOTCRETE', materialName: 'Shotcrete mix', uom: 'cum', qty: 18, rate: 8500, issuedBy: 'Sita G.' },
      { id: 'MIN-SC3-003', date: '15 Jul', materialCode: 'M-ROCKBOLT3', materialName: 'Rock bolt 3m', uom: 'no', qty: 160, rate: 1100, issuedBy: 'Sita G.' },
    ],
    materialReturns: [],
    consumables: [
      { id: 'CON-SC3-001', date: '10 Jul', name: 'Diesel (excavator)', uom: 'ltr', qty: 850, rate: 165, normPerUnit: 20, normUnit: 'rm', normBasis: 42.5 },
    ],
    customDeductibles: [
      { id: 'DED-SC3-1', type: 'tds', label: 'TDS (1.5%)', amount: 0, ratePct: 1.5 },
      { id: 'DED-SC3-2', type: 'equipment', label: 'Ventilation fan hire', amount: 28000, notes: 'Monthly' },
    ],
    assignedTasks: [
      { taskId: 'T-301', taskName: 'Hammock — Tunneling uncertain', progress: 35, baseline: 'Wk 14 → 32', status: 'on-track' },
    ],
    ncrCount: 0,
    incidents: 0,
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}

function fmtNPR(n: number) {
  return `NPR ${n.toLocaleString('en-IN')}`
}

// ─── Main Module ─────────────────────────────────────────────────────────────

export function SubcontractorModule() {
  const [selectedId, setSelectedId] = usePersistentState('omnisite-sc-selected', 'SC-01')
  const [scs, setScs] = usePersistentState<Subcontractor[]>('omnisite-scs', () => JSON.parse(JSON.stringify(INITIAL_SCS)))
  const [activeTab, setActiveTab] = useState('subboq')

  const selected = scs.find(s => s.id === selectedId) ?? scs[0]

  return (
    <>
      <Toaster richColors position="top-center" />
      <Workspace2Pane
        leftPane={
          <>
            <PaneHeader title="Subcontractors">
              <Button variant="ghost" size="sm" className="h-7"><Plus className="w-3.5 h-3.5" /></Button>
            </PaneHeader>
            <div className="px-3 py-2 border-b border-[var(--pane-divider)]">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search subcontractors…" className="h-8 pl-7 text-xs" />
              </div>
            </div>
            <PaneBody className="py-2">
              {scs.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={cn('w-full text-left px-3 py-2 border-l-2', selectedId === s.id ? 'bg-accent border-l-primary' : 'border-l-transparent hover:bg-accent/50')}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{s.id}</span>
                    {s.isTunneling && <Badge variant="secondary" className="text-[9px] bg-violet-500/15 text-violet-700 dark:text-violet-300"><Mountain className="w-2 h-2 mr-0.5" />Tunneling</Badge>}
                    <Badge variant="secondary" className="text-[9px]">{s.status}</Badge>
                  </div>
                  <div className="text-xs font-medium mt-0.5 truncate">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{s.scope}</div>
                </button>
              ))}
            </PaneBody>
          </>
        }
        centerPane={
          <>
            <PaneHeader title={`SC Register · ${scs.length} active`}>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5"><FileText className="w-3.5 h-3.5" />Export</Button>
              <Button size="sm" className="h-7 text-xs gap-1.5"><Plus className="w-3.5 h-3.5" />Add Subcontractor</Button>
            </PaneHeader>
            <div className="flex items-center h-8 border-b border-[var(--pane-divider)] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/30">
              <div className="w-16 px-2">SC #</div>
              <div className="flex-1 px-2">Subcontractor</div>
              <div className="w-28 px-2 text-right">Agreement</div>
              <div className="w-28 px-2 text-right">Earned</div>
              <div className="w-20 px-2 text-right">Advance</div>
              <div className="w-20 px-2 text-right">Retention</div>
              <div className="w-20 px-2 text-right">Rework</div>
              <div className="w-28 px-2 text-right">Net Payable</div>
            </div>
            <PaneBody className="px-0">
              {scs.map(s => {
                const earned = s.items.reduce((sum, it) => sum + it.actualQty * it.rate, 0)
                const retention = earned * (s.retentionPct / 100)
                const netPayable = earned - s.advancePaid - retention - s.reworkCost - s.customDeductibles.reduce((sum, d) => sum + d.amount, 0)
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className={cn('flex items-center h-14 border-b border-[var(--pane-divider)] text-xs cursor-pointer row-hover', selectedId === s.id && 'bg-accent')}
                  >
                    <div className="w-16 px-2 font-mono text-muted-foreground">{s.id}</div>
                    <div className="flex-1 px-2 min-w-0">
                      <div className="font-medium truncate flex items-center gap-1.5">
                        {s.isTunneling && <Mountain className="w-3 h-3 text-violet-500 flex-shrink-0" />}
                        {s.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">{s.scope}</div>
                    </div>
                    <div className="w-28 px-2 text-right font-mono">{s.agreementValue > 0 ? fmtNPR(s.agreementValue) : 'Variable'}</div>
                    <div className="w-28 px-2 text-right font-mono font-medium">{fmtNPR(earned)}</div>
                    <div className="w-20 px-2 text-right font-mono text-muted-foreground">{fmt(s.advancePaid)}</div>
                    <div className="w-20 px-2 text-right font-mono text-muted-foreground">{fmt(retention)}</div>
                    <div className={cn('w-20 px-2 text-right font-mono', s.reworkCost > 0 && 'text-red-500')}>{s.reworkCost > 0 ? fmt(s.reworkCost) : '—'}</div>
                    <div className={cn('w-28 px-2 text-right font-mono font-bold', netPayable < 0 && 'text-amber-600')}>{fmtNPR(netPayable)}</div>
                  </div>
                )
              })}
            </PaneBody>
          </>
        }
        rightPane={<ScInspector sc={selected} activeTab={activeTab} setActiveTab={setActiveTab} />}
        leftPaneWidth="240px"
        rightPaneWidth="440px"
      />
    </>
  )
}

// ─── SC Inspector (right pane with tabs) ─────────────────────────────────────

function ScInspector({ sc, activeTab, setActiveTab }: { sc: Subcontractor; activeTab: string; setActiveTab: (t: string) => void }) {
  return (
    <>
      <PaneHeader title={`SC Inspector · ${sc.id}`} />
      <PaneBody>
        {/* Header */}
        <div className="p-4 border-b border-[var(--pane-divider)]">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="text-[10px]">{sc.status}</Badge>
            {sc.isTunneling && <Badge variant="secondary" className="text-[10px] bg-violet-500/15 text-violet-700 dark:text-violet-300"><Mountain className="w-2.5 h-2.5 mr-0.5" />Tunneling SC</Badge>}
          </div>
          <div className="text-sm font-semibold">{sc.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{sc.scope}</div>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
            <span>PAN: {sc.pan}</span>
            <span>·</span>
            <span>Insurance: {sc.insuranceExpiry}</span>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="px-3 pt-2">
            <TabsList className="grid h-8 w-full text-xs" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
              <TabsTrigger value="subboq" className="text-[9px] px-1">Sub-BOQ</TabsTrigger>
              <TabsTrigger value="material" className="text-[9px] px-1">Material</TabsTrigger>
              <TabsTrigger value="consumables" className="text-[9px] px-1">Consum.</TabsTrigger>
              <TabsTrigger value="bill" className="text-[9px] px-1">Bill</TabsTrigger>
              <TabsTrigger value="schedule" className="text-[9px] px-1">Schedule</TabsTrigger>
              <TabsTrigger value="performance" className="text-[9px] px-1">Perf.</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="subboq" className="mt-0"><SubBoqTab sc={sc} /></TabsContent>
          <TabsContent value="material" className="mt-0"><MaterialTab sc={sc} /></TabsContent>
          <TabsContent value="consumables" className="mt-0"><ConsumablesTab sc={sc} /></TabsContent>
          <TabsContent value="bill" className="mt-0"><RunningBillTab sc={sc} /></TabsContent>
          <TabsContent value="schedule" className="mt-0"><ScheduleTab sc={sc} /></TabsContent>
          <TabsContent value="performance" className="mt-0"><PerformanceTab sc={sc} /></TabsContent>
        </Tabs>
      </PaneBody>
    </>
  )
}

// ─── Sub-BOQ Tab (composite + conditional items + mapping) ───────────────────

function SubBoqTab({ sc }: { sc: Subcontractor }) {
  const compositeItems = sc.items.filter(i => i.type === 'composite')
  const conditionalItems = sc.items.filter(i => i.type === 'conditional')
  const earned = sc.items.reduce((sum, it) => sum + it.actualQty * it.rate, 0)

  return (
    <div className="p-4 space-y-4 text-xs">
      {/* Earned value summary */}
      <div className="p-2.5 rounded-md bg-secondary/40">
        <div className="text-[10px] text-muted-foreground">Total Earned Value (SC BOQ actuals × SC rates)</div>
        <div className="text-lg font-bold mt-0.5 tabular-nums">{fmtNPR(earned)}</div>
      </div>

      {/* Composite items */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Layers className="w-3 h-3" /> Composite Items ({compositeItems.length})
        </div>
        <div className="space-y-2">
          {compositeItems.map(it => {
            const earnedItem = it.actualQty * it.rate
            const progress = it.plannedQty > 0 ? (it.actualQty / it.plannedQty) * 100 : 0
            return (
              <div key={it.id} className="rounded-md border border-[var(--pane-divider)] overflow-hidden">
                <div className="p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] text-muted-foreground">{it.code}</span>
                    <Badge variant="outline" className="text-[9px]">{it.type}</Badge>
                  </div>
                  <div className="font-medium text-xs">{it.desc}</div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span>Rate: <span className="font-mono text-foreground">{fmtNPR(it.rate)}/{it.uom}</span></span>
                    <span>·</span>
                    <span>Planned: <span className="font-mono text-foreground">{it.plannedQty > 0 ? it.plannedQty : 'Variable'} {it.uom}</span></span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, progress)}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                      {it.actualQty} / {it.plannedQty > 0 ? it.plannedQty : '?'} {it.uom}
                      {it.plannedQty > 0 && ` (${progress.toFixed(0)}%)`}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1.5 text-[10px]">
                    <span className="text-muted-foreground">Earned: <span className="font-mono font-medium text-foreground">{fmtNPR(earnedItem)}</span></span>
                  </div>
                </div>

                {/* Mapping table */}
                {it.mapping && it.mapping.length > 0 && (
                  <div className="border-t border-[var(--pane-divider)] bg-secondary/20 p-2.5">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Mapping → Main BOQ (coefficients per {it.uom})
                    </div>
                    <div className="space-y-1">
                      {it.mapping.map((m, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px]">
                          <span className="font-mono text-muted-foreground w-12">{m.boqCode}</span>
                          <span className="flex-1 truncate">{m.boqDesc}</span>
                          <span className="font-mono text-muted-foreground">×{m.coefficient}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-mono font-medium w-16 text-right">{(m.coefficient * it.actualQty).toFixed(2)} {m.uom}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5 pt-1.5 border-t border-[var(--pane-divider)] text-[9px] text-muted-foreground">
                      Derived BOQ quantities shown for {it.actualQty} {it.uom} actual completion
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Conditional items (tunneling) */}
      {conditionalItems.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Mountain className="w-3 h-3" /> Conditional Support Items ({conditionalItems.length})
          </div>
          <div className="p-2 rounded-md bg-violet-500/10 border border-violet-500/30 text-[10px] text-muted-foreground mb-2">
            These items have 0 planned quantity — activated by face log entries. Payment is per actual installation.
          </div>
          <div className="space-y-1.5">
            {conditionalItems.map(it => {
              const earnedItem = it.actualQty * it.rate
              const designQty = it.designPattern ? it.designPattern * 42.5 : 0 // 42.5 = total rm advanced
              const variance = it.actualQty - designQty
              const variancePct = designQty > 0 ? (variance / designQty) * 100 : 0
              const overSupport = variance > 0
              return (
                <div key={it.id} className="rounded-md border border-[var(--pane-divider)] p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] text-muted-foreground">{it.code}</span>
                    <Badge variant="secondary" className="text-[9px] bg-violet-500/15 text-violet-700 dark:text-violet-300">{it.rockClass}</Badge>
                  </div>
                  <div className="font-medium text-xs">{it.desc}</div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span>Rate: <span className="font-mono text-foreground">{fmtNPR(it.rate)}/{it.uom}</span></span>
                    <span>·</span>
                    <span>Design: <span className="font-mono text-foreground">{it.designPattern}/{it.uom}/rm</span></span>
                  </div>
                  {/* Variance row */}
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                    <div className="p-1.5 rounded bg-secondary/40 text-center">
                      <div className="text-muted-foreground">Design Qty</div>
                      <div className="font-mono font-medium">{designQty.toFixed(1)} {it.uom}</div>
                    </div>
                    <div className="p-1.5 rounded bg-secondary/40 text-center">
                      <div className="text-muted-foreground">Actual</div>
                      <div className="font-mono font-medium">{it.actualQty} {it.uom}</div>
                    </div>
                    <div className={cn('p-1.5 rounded text-center', overSupport ? 'bg-amber-500/10' : 'bg-emerald-500/10')}>
                      <div className="text-muted-foreground">Variance</div>
                      <div className={cn('font-mono font-bold', overSupport ? 'text-amber-600' : 'text-emerald-600')}>
                        {variance >= 0 ? '+' : ''}{variance.toFixed(1)} ({variancePct >= 0 ? '+' : ''}{variancePct.toFixed(0)}%)
                      </div>
                    </div>
                  </div>
                  {overSupport && (
                    <div className="mt-1.5 p-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[10px] flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      <span>Over-support detected — RFI required for consultant approval before billing</span>
                    </div>
                  )}
                  <div className="flex justify-between mt-1.5 text-[10px]">
                    <span className="text-muted-foreground">Earned: <span className="font-mono font-medium text-foreground">{fmtNPR(earnedItem)}</span></span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5"><Plus className="w-3.5 h-3.5" />Add SC BOQ Item</Button>
    </div>
  )
}

// ─── Material Reconciliation Tab ─────────────────────────────────────────────

function MaterialTab({ sc }: { sc: Subcontractor }) {
  // Aggregate by material
  const materialMap = new Map<string, {
    code: string; name: string; uom: string; rate: number;
    issued: number; returned: number; theoretical: number;
  }>()

  // Sum issued
  for (const mi of sc.materialIssues) {
    const key = mi.materialCode
    const existing = materialMap.get(key) || { code: mi.materialCode, name: mi.materialName, uom: mi.uom, rate: mi.rate, issued: 0, returned: 0, theoretical: 0 }
    existing.issued += mi.qty
    materialMap.set(key, existing)
  }
  // Sum returns
  for (const mr of sc.materialReturns) {
    const key = mr.materialCode
    const existing = materialMap.get(key)
    if (existing) existing.returned += mr.qty
  }
  // Calculate theoretical from composite items mapping × RA coefficients
  // Simplified: cement = 4.5 bags/cum PCC, steel = 1:1, aggregate = 0.9 cum/cum, sand = 0.45 cum/cum
  const totalRmt = sc.items.find(i => i.type === 'composite')?.actualQty || 0
  for (const [, m] of materialMap) {
    if (m.code === 'M-CEM-OPC') {
      // PCC: 0.40 cum/rmt × 4.5 bags + RCC: 0.60 cum/rmt × 6.5 bags = 5.7 bags/rmt
      m.theoretical = totalRmt * 5.7
    } else if (m.code === 'M-STEEL-TMT16' || m.code === 'M-STEEL-ISMB150') {
      m.theoretical = totalRmt * 0.095
    } else if (m.code === 'M-AGG-20') {
      m.theoretical = totalRmt * (0.40 * 0.9 + 0.60 * 0.9) // PCC + RCC agg
    } else if (m.code === 'M-SAND-R') {
      m.theoretical = totalRmt * (0.40 * 0.45 + 0.60 * 0.45)
    }
  }

  const materials = Array.from(materialMap.values())

  return (
    <div className="p-4 space-y-3 text-xs">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Material Issue & Reconciliation
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 rounded-md bg-secondary/40 text-center">
          <div className="text-[10px] text-muted-foreground">Total Issued</div>
          <div className="text-sm font-bold">{sc.materialIssues.length} MINs</div>
        </div>
        <div className="p-2 rounded-md bg-secondary/40 text-center">
          <div className="text-[10px] text-muted-foreground">Total Returns</div>
          <div className="text-sm font-bold">{sc.materialReturns.length} MRNs</div>
        </div>
        <div className="p-2 rounded-md bg-secondary/40 text-center">
          <div className="text-[10px] text-muted-foreground">Materials Tracked</div>
          <div className="text-sm font-bold">{materials.length}</div>
        </div>
      </div>

      {/* Reconciliation table */}
      <div className="rounded-md border border-[var(--pane-divider)] overflow-hidden">
        <div className="grid grid-cols-12 gap-1 px-2 py-1.5 bg-secondary/30 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="col-span-4">Material</div>
          <div className="col-span-2 text-right">Theoretical</div>
          <div className="col-span-2 text-right">Issued</div>
          <div className="col-span-1 text-right">Ret.</div>
          <div className="col-span-2 text-right">Net Used</div>
          <div className="col-span-1 text-right">Var%</div>
        </div>
        {materials.map(m => {
          const netUsed = m.issued - m.returned
          const variance = m.theoretical > 0 ? ((netUsed - m.theoretical) / m.theoretical) * 100 : 0
          const overVariance = Math.abs(variance) > 5
          return (
            <div key={m.code} className={cn('grid grid-cols-12 gap-1 px-2 py-1.5 border-t border-[var(--pane-divider)]', overVariance && 'bg-amber-500/5')}>
              <div className="col-span-4 min-w-0">
                <div className="font-medium truncate">{m.name}</div>
                <div className="text-[9px] text-muted-foreground font-mono">{m.code}</div>
              </div>
              <div className="col-span-2 text-right font-mono text-muted-foreground">{m.theoretical.toFixed(1)} {m.uom}</div>
              <div className="col-span-2 text-right font-mono">{m.issued.toFixed(1)}</div>
              <div className="col-span-1 text-right font-mono text-muted-foreground">{m.returned.toFixed(0)}</div>
              <div className="col-span-2 text-right font-mono font-medium">{netUsed.toFixed(1)}</div>
              <div className={cn('col-span-1 text-right font-mono font-bold', overVariance ? 'text-amber-600' : 'text-emerald-600')}>
                {variance >= 0 ? '+' : ''}{variance.toFixed(0)}%
              </div>
            </div>
          )
        })}
      </div>

      <div className="p-2 rounded-md bg-blue-500/10 border border-blue-500/30 text-[10px] text-muted-foreground">
        Theoretical = mapped BOQ qty × RA coefficient. Net Used = Issued − Returned. Variance &gt;5% is flagged for chargeback.
      </div>

      {/* Issue register */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Material Issue Notes (MIN)</div>
        <div className="space-y-1.5">
          {sc.materialIssues.map(mi => (
            <div key={mi.id} className="flex items-center gap-2 p-1.5 rounded border border-[var(--pane-divider)]">
              <Package className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{mi.id}</span>
                  <span className="text-[10px] text-muted-foreground">{mi.date}</span>
                  <span className="text-[10px]">{mi.materialName}</span>
                </div>
              </div>
              <span className="font-mono text-[10px]">{mi.qty} {mi.uom}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{fmtNPR(mi.qty * mi.rate)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Returns */}
      {sc.materialReturns.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Material Return Notes (MRN)</div>
          <div className="space-y-1.5">
            {sc.materialReturns.map(mr => (
              <div key={mr.id} className="flex items-center gap-2 p-1.5 rounded border border-emerald-500/30 bg-emerald-500/5">
                <ArrowLeft className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{mr.id}</span>
                    <span className="text-[10px] text-muted-foreground">{mr.date}</span>
                    <span className="text-[10px]">{mr.materialName}</span>
                  </div>
                  {mr.notes && <div className="text-[9px] text-muted-foreground truncate">{mr.notes}</div>}
                </div>
                <span className="font-mono text-[10px]">{mr.qty} {mr.uom}</span>
                <span className="font-mono text-[10px] text-emerald-600">−{fmtNPR(mr.qty * mr.rate)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5"><Plus className="w-3.5 h-3.5" />Issue Material to SC</Button>
    </div>
  )
}

// ─── Consumables Tab ─────────────────────────────────────────────────────────

function ConsumablesTab({ sc }: { sc: Subcontractor }) {
  return (
    <div className="p-4 space-y-3 text-xs">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Consumables Tracking (norm-based chargeback)
      </div>

      <div className="rounded-md border border-[var(--pane-divider)] overflow-hidden">
        <div className="grid grid-cols-12 gap-1 px-2 py-1.5 bg-secondary/30 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="col-span-4">Consumable</div>
          <div className="col-span-2 text-right">Issued</div>
          <div className="col-span-2 text-right">Norm</div>
          <div className="col-span-2 text-right">Theoretical</div>
          <div className="col-span-2 text-right">Variance</div>
        </div>
        {sc.consumables.map(c => {
          const theoretical = c.normPerUnit && c.normBasis ? c.normPerUnit * c.normBasis : 0
          const variance = c.qty - theoretical
          const variancePct = theoretical > 0 ? (variance / theoretical) * 100 : 0
          const overNorm = variance > 0
          return (
            <div key={c.id} className="grid grid-cols-12 gap-1 px-2 py-1.5 border-t border-[var(--pane-divider)]">
              <div className="col-span-4 min-w-0">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-[9px] text-muted-foreground">{c.date} · {fmtNPR(c.rate)}/{c.uom}</div>
              </div>
              <div className="col-span-2 text-right font-mono">{c.qty} {c.uom}</div>
              <div className="col-span-2 text-right font-mono text-muted-foreground">
                {c.normPerUnit ? `${c.normPerUnit}/${c.normUnit}` : '—'}
              </div>
              <div className="col-span-2 text-right font-mono text-muted-foreground">
                {theoretical > 0 ? `${theoretical.toFixed(1)} ${c.uom}` : '—'}
              </div>
              <div className={cn('col-span-2 text-right font-mono font-medium', overNorm ? 'text-amber-600' : 'text-emerald-600')}>
                {variance >= 0 ? '+' : ''}{variance.toFixed(1)} ({variancePct >= 0 ? '+' : ''}{variancePct.toFixed(0)}%)
              </div>
            </div>
          )
        })}
      </div>

      <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-[10px] text-muted-foreground">
        Over-norm consumption is charged back to the SC at cost. E.g., if binding wire norm is 0.5 kg/MT and SC used 6.5 kg for 12.5 MT (norm = 6.25 kg), the extra 0.25 kg is charged.
      </div>

      {/* Chargeback summary */}
      <div className="p-2.5 rounded-md bg-secondary/40">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Chargeback Summary</div>
        {(() => {
          let totalChargeback = 0
          sc.consumables.forEach(c => {
            const theoretical = c.normPerUnit && c.normBasis ? c.normPerUnit * c.normBasis : 0
            const overQty = Math.max(0, c.qty - theoretical)
            totalChargeback += overQty * c.rate
          })
          return (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total over-norm chargeback</span>
              <span className="font-mono font-bold text-amber-600">{fmtNPR(totalChargeback)}</span>
            </div>
          )
        })()}
      </div>

      <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5"><Plus className="w-3.5 h-3.5" />Add Consumable Issue</Button>
    </div>
  )
}

// ─── Running Bill Tab (expanded deductibles) ─────────────────────────────────

function RunningBillTab({ sc }: { sc: Subcontractor }) {
  const earned = sc.items.reduce((sum, it) => sum + it.actualQty * it.rate, 0)
  const retention = earned * (sc.retentionPct / 100)
  const tds = sc.customDeductibles.find(d => d.type === 'tds')
  const tdsAmount = tds ? earned * ((tds.ratePct || 0) / 100) : 0
  const otherDeductibles = sc.customDeductibles.filter(d => d.type !== 'tds')
  const otherDeductibleTotal = otherDeductibles.reduce((sum, d) => sum + d.amount, 0)

  // Material over-use chargeback
  let materialChargeback = 0
  const materialMap = new Map<string, { issued: number; returned: number; theoretical: number; rate: number }>()
  for (const mi of sc.materialIssues) {
    const e = materialMap.get(mi.materialCode) || { issued: 0, returned: 0, theoretical: 0, rate: mi.rate }
    e.issued += mi.qty; materialMap.set(mi.materialCode, e)
  }
  for (const mr of sc.materialReturns) {
    const e = materialMap.get(mr.materialCode)
    if (e) e.returned += mr.qty
  }
  const totalRmt = sc.items.find(i => i.type === 'composite')?.actualQty || 0
  for (const [, m] of materialMap) {
    if (m.code === 'M-CEM-OPC' as any) m.theoretical = totalRmt * 5.7
    else if (m.code === 'M-STEEL-TMT16' as any || m.code === 'M-STEEL-ISMB150' as any) m.theoretical = totalRmt * 0.095
    const netUsed = m.issued - m.returned
    const overQty = Math.max(0, netUsed - m.theoretical)
    materialChargeback += overQty * m.rate
  }

  // Consumable chargeback
  let consumableChargeback = 0
  sc.consumables.forEach(c => {
    const theoretical = c.normPerUnit && c.normBasis ? c.normPerUnit * c.normBasis : 0
    const overQty = Math.max(0, c.qty - theoretical)
    consumableChargeback += overQty * c.rate
  })

  const totalDeductions = sc.advancePaid + retention + sc.reworkCost + tdsAmount + otherDeductibleTotal + materialChargeback + consumableChargeback
  const netPayable = earned - totalDeductions

  const DEDUCTION_TYPE_ICONS: Record<string, typeof Wallet> = {
    advance: Wallet,
    retention: Percent,
    rework: AlertTriangle,
    tds: Percent,
    equipment: Truck,
    penalty: AlertTriangle,
    electricity: Zap,
    insurance: ShieldCheck,
    material_overuse: Package,
    other: FileText,
  }

  return (
    <div className="p-4 space-y-3 text-xs">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Running Bill Computation</div>

      {/* Earned value */}
      <div className="p-2.5 rounded-md bg-primary/5 border border-primary/20">
        <div className="flex justify-between">
          <span className="font-medium">Total Earned Value</span>
          <span className="font-mono font-bold text-base tabular-nums">{fmtNPR(earned)}</span>
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">Sum of SC BOQ actuals × SC rates</div>
      </div>

      {/* Deductions */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Deductions</div>

        {/* Advance recovery */}
        <BillRow icon={Wallet} label={`Advance recovery (${sc.advancePct}%)`} amount={-sc.advancePaid} color="text-red-600" />

        {/* Retention */}
        <BillRow icon={Percent} label={`Retention (${sc.retentionPct}%)`} amount={-retention} color="text-amber-600" />

        {/* Rework */}
        {sc.reworkCost > 0 && (
          <BillRow icon={AlertTriangle} label="Rework cost (NCR recovery)" amount={-sc.reworkCost} color="text-red-600" />
        )}

        {/* TDS */}
        {tds && (
          <BillRow icon={Percent} label={`${tds.label}`} amount={-tdsAmount} color="text-red-600" />
        )}

        {/* Material over-use chargeback */}
        {materialChargeback > 0 && (
          <BillRow icon={Package} label="Material over-use chargeback" amount={-materialChargeback} color="text-red-600" />
        )}

        {/* Consumable over-norm chargeback */}
        {consumableChargeback > 0 && (
          <BillRow icon={Wrench} label="Consumable over-norm chargeback" amount={-consumableChargeback} color="text-red-600" />
        )}

        {/* Other custom deductibles */}
        {otherDeductibles.map(d => {
          const Icon = DEDUCTION_TYPE_ICONS[d.type] || FileText
          return <BillRow key={d.id} icon={Icon} label={d.label} amount={-d.amount} color="text-red-600" notes={d.notes} />
        })}
      </div>

      <Separator />

      {/* Net payable */}
      <div className={cn('p-3 rounded-md', netPayable >= 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-amber-500/10 border border-amber-500/30')}>
        <div className="flex justify-between items-center">
          <span className="font-bold flex items-center gap-1.5"><Wallet className="w-4 h-4" />Net Payable</span>
          <span className={cn('font-mono font-bold text-lg tabular-nums', netPayable >= 0 ? 'text-emerald-600' : 'text-amber-600')}>
            {fmtNPR(netPayable)}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {netPayable < 0 ? 'SC owes project (advance exceeds earned)' : 'Payable to SC after all deductions'}
        </div>
      </div>

      <Button className="w-full h-9 text-xs gap-1.5"><FileText className="w-3.5 h-3.5" />Generate Running Bill</Button>

      {/* Add deductible */}
      <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5"><Plus className="w-3.5 h-3.5" />Add Custom Deductible</Button>
    </div>
  )
}

function BillRow({ icon: Icon, label, amount, color, notes }: { icon: typeof Wallet; label: string; amount: number; color: string; notes?: string }) {
  return (
    <div className="flex items-center gap-2 p-1.5 rounded border border-[var(--pane-divider)]">
      <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', color)} />
      <div className="flex-1 min-w-0">
        <div className="text-xs">{label}</div>
        {notes && <div className="text-[9px] text-muted-foreground truncate">{notes}</div>}
      </div>
      <span className={cn('font-mono font-medium tabular-nums', color)}>
        {amount >= 0 ? '+' : ''}{fmtNPR(Math.abs(amount))}
      </span>
    </div>
  )
}

// ─── Schedule Linkage Tab ────────────────────────────────────────────────────

function ScheduleTab({ sc }: { sc: Subcontractor }) {
  return (
    <div className="p-4 space-y-3 text-xs">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Schedule Linkage (assigned tasks)
      </div>

      <div className="space-y-2">
        {sc.assignedTasks.map(t => (
          <div key={t.taskId} className="rounded-md border border-[var(--pane-divider)] p-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[10px] text-muted-foreground">{t.taskId}</span>
              <Badge variant="secondary" className={cn('text-[9px]', t.status === 'delayed' && 'bg-red-500/15 text-red-700 dark:text-red-300', t.status === 'on-track' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300')}>
                {t.status}
              </Badge>
            </div>
            <div className="font-medium text-xs">{t.taskName}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{t.baseline}</div>
            {/* Progress bar */}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className={cn('h-full rounded-full', t.status === 'delayed' ? 'bg-red-500' : 'bg-primary')} style={{ width: `${t.progress}%` }} />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">{t.progress}%</span>
            </div>
          </div>
        ))}
      </div>

      {sc.isTunneling && (
        <div className="p-2.5 rounded-md bg-violet-500/10 border border-violet-500/30 text-[10px]">
          <div className="font-medium flex items-center gap-1.5 text-violet-700 dark:text-violet-300">
            <Mountain className="w-3 h-3" />Hammock Task — Quantity-Driven
          </div>
          <div className="text-muted-foreground mt-1">
            Duration expands/contracts based on cumulative face log advance. If it pushes past the Must Finish On deadline, triggers Critical Path Breach modal with EOT claim or acceleration options.
          </div>
        </div>
      )}

      <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5"><Plus className="w-3.5 h-3.5" />Assign Schedule Task</Button>
    </div>
  )
}

// ─── Performance Dashboard Tab ───────────────────────────────────────────────

function PerformanceTab({ sc }: { sc: Subcontractor }) {
  const onTimeRate = sc.assignedTasks.length > 0
    ? (sc.assignedTasks.filter(t => t.status === 'on-track').length / sc.assignedTasks.length) * 100
    : 100

  const earned = sc.items.reduce((sum, it) => sum + it.actualQty * it.rate, 0)
  const retention = earned * (sc.retentionPct / 100)
  const netPayable = earned - sc.advancePaid - retention - sc.reworkCost

  // Material efficiency
  let matEfficiency = 100
  let matCount = 0
  const materialMap = new Map<string, { issued: number; returned: number; theoretical: number }>()
  for (const mi of sc.materialIssues) {
    const e = materialMap.get(mi.materialCode) || { issued: 0, returned: 0, theoretical: 0 }
    e.issued += mi.qty; materialMap.set(mi.materialCode, e)
  }
  for (const mr of sc.materialReturns) {
    const e = materialMap.get(mr.materialCode)
    if (e) e.returned += mr.qty
  }
  const totalRmt = sc.items.find(i => i.type === 'composite')?.actualQty || 0
  for (const [, m] of materialMap) {
    if (m.code === 'M-CEM-OPC' as any) m.theoretical = totalRmt * 5.7
    else if (m.code === 'M-STEEL-TMT16' as any || m.code === 'M-STEEL-ISMB150' as any) m.theoretical = totalRmt * 0.095
    const netUsed = m.issued - m.returned
    const variance = m.theoretical > 0 ? Math.abs(((netUsed - m.theoretical) / m.theoretical) * 100) : 0
    matEfficiency = Math.min(matEfficiency, 100 - variance)
    matCount++
  }

  const kpis = [
    { label: 'On-Time Delivery', value: `${onTimeRate.toFixed(0)}%`, icon: Calendar, color: onTimeRate >= 80 ? 'text-emerald-600' : onTimeRate >= 50 ? 'text-amber-600' : 'text-red-600', desc: `${sc.assignedTasks.filter(t => t.status === 'on-track').length}/${sc.assignedTasks.length} tasks on track` },
    { label: 'Quality (NCRs)', value: `${sc.ncrCount}`, icon: ShieldCheck, color: sc.ncrCount === 0 ? 'text-emerald-600' : sc.ncrCount <= 1 ? 'text-amber-600' : 'text-red-600', desc: 'Non-conformance reports linked to SC' },
    { label: 'Material Efficiency', value: `${matEfficiency.toFixed(0)}%`, icon: Package, color: matEfficiency >= 95 ? 'text-emerald-600' : matEfficiency >= 85 ? 'text-amber-600' : 'text-red-600', desc: `${matCount} materials tracked` },
    { label: 'Safety (Incidents)', value: `${sc.incidents}`, icon: Activity, color: sc.incidents === 0 ? 'text-emerald-600' : 'text-red-600', desc: 'Incidents on SC tasks' },
  ]

  return (
    <div className="p-4 space-y-3 text-xs">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Performance Dashboard</div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2">
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="p-2.5 rounded-md border border-[var(--pane-divider)]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{k.label}</span>
                <Icon className={cn('w-3.5 h-3.5', k.color)} />
              </div>
              <div className={cn('text-lg font-bold mt-0.5', k.color)}>{k.value}</div>
              <div className="text-[10px] text-muted-foreground">{k.desc}</div>
            </div>
          )
        })}
      </div>

      {/* Compliance */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Compliance</div>
        <div className="space-y-1.5">
          <ComplianceRow label="PAN" value={sc.pan} status="ok" />
          <ComplianceRow label="GST" value={sc.gst} status="ok" />
          <ComplianceRow label="Insurance" value={`Expires ${sc.insuranceExpiry}`} status="ok" />
          <ComplianceRow label="Labour License" value={`Expires ${sc.labourLicenseExpiry}`} status="warn" />
        </div>
      </div>

      {/* Financial summary */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Financial Summary</div>
        <div className="p-2.5 rounded-md bg-secondary/40 space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Agreement value</span><span className="font-mono">{sc.agreementValue > 0 ? fmtNPR(sc.agreementValue) : 'Variable'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Earned to date</span><span className="font-mono font-medium">{fmtNPR(earned)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Advance paid</span><span className="font-mono text-red-600">{fmtNPR(sc.advancePaid)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Net payable</span><span className="font-mono font-bold text-emerald-600">{fmtNPR(netPayable)}</span></div>
        </div>
      </div>
    </div>
  )
}

function ComplianceRow({ label, value, status }: { label: string; value: string; status: 'ok' | 'warn' | 'exp' }) {
  return (
    <div className="flex items-center gap-2 p-1.5 rounded border border-[var(--pane-divider)]">
      <div className={cn(
        'w-1.5 h-1.5 rounded-full',
        status === 'ok' && 'bg-emerald-500',
        status === 'warn' && 'bg-amber-500',
        status === 'exp' && 'bg-red-500',
      )} />
      <span className="text-[10px] text-muted-foreground w-24">{label}</span>
      <span className="text-[10px] flex-1 truncate">{value}</span>
      {status === 'warn' && <Badge variant="secondary" className="text-[9px] bg-amber-500/15 text-amber-700 dark:text-amber-300">Expiring</Badge>}
    </div>
  )
}
