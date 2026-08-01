'use client'

import { useState } from 'react'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Plus,
  Save,
  FolderOpen,
  Zap,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  History,
  Link2,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { BoqItem } from './types'

interface RaRow {
  code: string
  name: string
  uom: string
  qty: number
  rate: number
  source: string
}

const INITIAL_MATERIALS: RaRow[] = [
  {
    code: 'M-CEM-OPC',
    name: 'Cement OPC 53 Grade (Udaipur)',
    uom: 'Bag',
    qty: 4.5,
    rate: 920,
    source: 'Project Rate Library',
  },
  {
    code: 'M-SAND-R',
    name: 'River Sand (Trishuli)',
    uom: 'cum',
    qty: 0.45,
    rate: 3850,
    source: 'Project Rate Library',
  },
  {
    code: 'M-AGG-20',
    name: 'Coarse Aggregate 20mm',
    uom: 'cum',
    qty: 0.9,
    rate: 2950,
    source: 'Project Rate Library',
  },
  {
    code: 'M-WAT',
    name: 'Water (tanker)',
    uom: 'ltr',
    qty: 180,
    rate: 0.45,
    source: 'Project Rate Library',
  },
]

const INITIAL_LABOUR: RaRow[] = [
  {
    code: 'L-MASN',
    name: 'Mason (Skilled Cat. I)',
    uom: 'day',
    qty: 0.6,
    rate: 1450,
    source: 'DoR Norm 2075',
  },
  {
    code: 'L-HEL',
    name: 'Mazdoor (Unskilled)',
    uom: 'day',
    qty: 1.4,
    rate: 950,
    source: 'DoR Norm 2075',
  },
  {
    code: 'L-MIX',
    name: 'Mixer Operator',
    uom: 'day',
    qty: 0.2,
    rate: 1200,
    source: 'DoR Norm 2075',
  },
]

const INITIAL_EQUIPMENT: RaRow[] = [
  {
    code: 'E-MIX',
    name: 'Concrete Mixer 0.4 cum',
    uom: 'hr',
    qty: 1.8,
    rate: 285,
    source: 'Equipment Master',
  },
  {
    code: 'E-VIB',
    name: 'Needle Vibrator 60mm',
    uom: 'hr',
    qty: 1.2,
    rate: 95,
    source: 'Equipment Master',
  },
]

export function RaInspector({ item }: { item: BoqItem }) {
  // Live state for RA resource rows — drives real-time recalculation of
  // directCost / pctCostBase / totalCost / margin when the user edits a
  // qty or rate cell in the RA Builder tab.
  const [materials, setMaterials] = useState<RaRow[]>(INITIAL_MATERIALS)
  const [labour, setLabour] = useState<RaRow[]>(INITIAL_LABOUR)
  const [equipment, setEquipment] = useState<RaRow[]>(INITIAL_EQUIPMENT)
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

  // Helper to update a single row's qty or rate.
  const updateRow = (
    setter: React.Dispatch<React.SetStateAction<RaRow[]>>,
    index: number,
    field: 'qty' | 'rate',
    value: number
  ) => {
    setter((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  // Recompute on every render — pure function of state
  const directCost = [...materials, ...labour, ...equipment].reduce((s, r) => s + r.qty * r.rate, 0)
  const labourCost = labour.reduce((s, r) => s + r.qty * r.rate, 0)
  const materialCost = materials.reduce((s, r) => s + r.qty * r.rate, 0)
  const equipCost = equipment.reduce((s, r) => s + r.qty * r.rate, 0)

  const pctCostBase =
    (pctCosts.labour.on ? (labourCost * pctCosts.labour.pct) / 100 : 0) +
    (pctCosts.material.on ? (materialCost * pctCosts.material.pct) / 100 : 0) +
    (pctCosts.equipment.on ? (equipCost * pctCosts.equipment.pct) / 100 : 0) +
    (pctCosts.tp.on ? (directCost * pctCosts.tp.pct) / 100 : 0)

  const opBase = (opOnDirect ? directCost : 0) + (opOnPct ? pctCostBase : 0)
  const overheadAmount = opBase * (opPct / 100)
  const totalCost = directCost + pctCostBase + overheadAmount
  const contractRate = item.rate
  const margin = contractRate - totalCost
  // Guard divide-by-zero: if contractRate is 0 (e.g. cleared input),
  // marginPct would be Infinity/NaN and break the UI.
  const marginPct = contractRate > 0 ? (margin / contractRate) * 100 : 0
  // Visual-bar widths — also guarded against 0 / negative contractRate.
  const costBarPct = contractRate > 0 ? Math.min(100, (totalCost / contractRate) * 100) : 0
  const marginBarPct =
    contractRate > 0 ? Math.max(0, Math.min(100, (margin / contractRate) * 100)) : 0

  return (
    <>
      <PaneHeader title={`RA Inspector · ${item.code}`} />
      <PaneBody>
        <div className="border-b border-[var(--pane-divider)] p-4">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Item
          </div>
          <div className="mt-1 text-sm leading-snug font-semibold">{item.desc}</div>
          <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
            <span>
              {item.qty.toLocaleString()} {item.uom}
            </span>
            <span>·</span>
            <span>Rate: NPR {item.rate.toLocaleString()}</span>
          </div>
        </div>

        <Tabs defaultValue="builder" className="w-full">
          <div className="px-3 pt-2">
            <TabsList className="grid h-8 grid-cols-3 text-xs">
              <TabsTrigger value="builder" className="text-xs">
                RA Builder
              </TabsTrigger>
              <TabsTrigger value="trace" className="text-xs">
                Traceability
              </TabsTrigger>
              <TabsTrigger value="audit" className="text-xs">
                Audit Log
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="builder" className="mt-0">
            <RaSection
              title="Materials"
              icon={<Layers className="h-3.5 w-3.5" />}
              rows={materials}
              onUpdate={(i, f, v) => updateRow(setMaterials, i, f, v)}
            />
            <RaSection
              title="Labour"
              icon={<Layers className="h-3.5 w-3.5" />}
              rows={labour}
              onUpdate={(i, f, v) => updateRow(setLabour, i, f, v)}
            />
            <RaSection
              title="Equipment"
              icon={<Layers className="h-3.5 w-3.5" />}
              rows={equipment}
              onUpdate={(i, f, v) => updateRow(setEquipment, i, f, v)}
            />

            {/* % COSTS */}
            <div className="border-y border-[var(--pane-divider)] px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  % Costs (Indirect)
                </div>
                <Button variant="ghost" size="sm" className="h-6 text-xs">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 rounded-md border border-[var(--pane-divider)] p-2">
                  <Checkbox
                    checked={pctCosts.labour.on}
                    onCheckedChange={(v) =>
                      setPctCosts((s) => ({ ...s, labour: { ...s.labour, on: !!v } }))
                    }
                  />
                  <span className="flex-1">% of Labour</span>
                  <Input
                    className="h-6 w-12 text-xs"
                    type="number"
                    value={pctCosts.labour.pct}
                    onChange={(e) =>
                      setPctCosts((s) => ({
                        ...s,
                        labour: { ...s.labour, pct: parseFloat(e.target.value) || 0 },
                      }))
                    }
                  />
                </label>
                <label className="flex items-center gap-2 rounded-md border border-[var(--pane-divider)] p-2">
                  <Checkbox
                    checked={pctCosts.material.on}
                    onCheckedChange={(v) =>
                      setPctCosts((s) => ({ ...s, material: { ...s.material, on: !!v } }))
                    }
                  />
                  <span className="flex-1">% of Material</span>
                  <Input
                    className="h-6 w-12 text-xs"
                    type="number"
                    value={pctCosts.material.pct}
                    onChange={(e) =>
                      setPctCosts((s) => ({
                        ...s,
                        material: { ...s.material, pct: parseFloat(e.target.value) || 0 },
                      }))
                    }
                  />
                </label>
                <label className="flex items-center gap-2 rounded-md border border-[var(--pane-divider)] p-2">
                  <Checkbox
                    checked={pctCosts.equipment.on}
                    onCheckedChange={(v) =>
                      setPctCosts((s) => ({ ...s, equipment: { ...s.equipment, on: !!v } }))
                    }
                  />
                  <span className="flex-1">% of Equipment</span>
                  <Input
                    className="h-6 w-12 text-xs"
                    type="number"
                    value={pctCosts.equipment.pct}
                    onChange={(e) =>
                      setPctCosts((s) => ({
                        ...s,
                        equipment: { ...s.equipment, pct: parseFloat(e.target.value) || 0 },
                      }))
                    }
                  />
                </label>
                <label className="flex items-center gap-2 rounded-md border border-[var(--pane-divider)] p-2">
                  <Checkbox
                    checked={pctCosts.tp.on}
                    onCheckedChange={(v) =>
                      setPctCosts((s) => ({ ...s, tp: { ...s.tp, on: !!v } }))
                    }
                  />
                  <span className="flex-1">T&P Charges</span>
                  <Input
                    className="h-6 w-12 text-xs"
                    type="number"
                    placeholder="—"
                    value={pctCosts.tp.pct || ''}
                    onChange={(e) =>
                      setPctCosts((s) => ({
                        ...s,
                        tp: { ...s.tp, pct: parseFloat(e.target.value) || 0 },
                      }))
                    }
                  />
                </label>
              </div>
            </div>

            {/* O&P */}
            <div className="border-b border-[var(--pane-divider)] px-4 py-3">
              <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                Overhead & Profit (cumulative)
              </div>
              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2">
                  <Checkbox checked={opOnDirect} onCheckedChange={(v) => setOpOnDirect(!!v)} />
                  <span className="flex-1">On Direct Cost</span>
                  <span className="font-mono">NPR {directCost.toFixed(0)}</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={opOnPct} onCheckedChange={(v) => setOpOnPct(!!v)} />
                  <span className="flex-1">On Prior % Costs</span>
                  <span className="font-mono">NPR {pctCostBase.toFixed(0)}</span>
                </label>
                <div className="flex items-center gap-2 pt-1 pl-6">
                  <span className="text-muted-foreground flex-1">O&P %</span>
                  <Input
                    className="h-6 w-16 text-xs"
                    type="number"
                    value={opPct}
                    onChange={(e) => setOpPct(parseFloat(e.target.value) || 0)}
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
                <div className="flex justify-between border-t border-[var(--pane-divider)] pt-1">
                  <span className="font-medium">O&P Amount</span>
                  <span className="font-mono font-semibold tabular-nums">
                    NPR {overheadAmount.toFixed(0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-secondary/30 px-4 py-3">
              <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                Financial Summary & Margin
                <span className="text-primary/70 text-[10px] font-normal tracking-normal normal-case">
                  · recalculates live
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <Row label="Direct Cost" value={`NPR ${directCost.toFixed(0)}`} />
                <Row label="% Costs" value={`NPR ${pctCostBase.toFixed(0)}`} muted />
                <Row label="O&P" value={`NPR ${overheadAmount.toFixed(0)}`} muted />
                <Separator className="my-2" />
                <Row label="Total RA Cost" value={`NPR ${totalCost.toFixed(0)}`} bold />
                <Row
                  label="Contract BOQ Rate"
                  value={`NPR ${contractRate.toLocaleString()}`}
                  bold
                />
                <Separator className="my-2" />
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <TrendingUp
                      className={cn('h-3.5 w-3.5', margin >= 0 ? 'delta-up' : 'delta-down')}
                    />
                    Actual Gross Margin
                  </span>
                  <span
                    className={cn(
                      'font-mono font-bold tabular-nums',
                      margin >= 0 ? 'delta-up' : 'delta-down'
                    )}
                  >
                    {marginPct >= 0 ? '+' : ''}
                    {marginPct.toFixed(1)}%
                  </span>
                </div>
                <div className="text-muted-foreground pl-5 text-[10px]">
                  Margin per {item.uom}: NPR{' '}
                  <span className="font-mono tabular-nums">{margin.toFixed(0)}</span> · No
                  double-count of RA O&P
                </div>
                {/* Visual margin bar */}
                <div className="mt-2 border-t border-[var(--pane-divider)] pt-2">
                  <div className="text-muted-foreground mb-1 flex items-center justify-between text-[10px]">
                    <span>Cost</span>
                    <span>Margin</span>
                  </div>
                  <div className="bg-secondary flex h-2 overflow-hidden rounded-full">
                    <div
                      className="bg-amber-500/70 transition-all duration-300"
                      style={{ width: `${costBarPct}%` }}
                    />
                    <div
                      className={cn(
                        'transition-all duration-300',
                        margin >= 0 ? 'bg-emerald-500/70' : 'bg-red-500/70'
                      )}
                      style={{ width: `${marginBarPct}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px]">
                    <span className="font-mono text-amber-600">NPR {totalCost.toFixed(0)}</span>
                    <span
                      className={cn('font-mono', margin >= 0 ? 'text-emerald-600' : 'text-red-600')}
                    >
                      {margin >= 0 ? '+' : ''}NPR {margin.toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="trace" className="mt-0 space-y-3 px-4 py-3">
            <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
              Traceability Matrix
            </div>
            <TraceRow
              icon={<Link2 className="h-3.5 w-3.5" />}
              label="Schedule Task"
              value="T-104 · Foundation PCC"
              status="linked"
            />
            <TraceRow
              icon={<Link2 className="h-3.5 w-3.5" />}
              label="Purchase Order"
              value="PO-2410-018 · Cement 1,200 bags"
              status="linked"
            />
            <TraceRow
              icon={<Link2 className="h-3.5 w-3.5" />}
              label="DSR Actual Qty"
              value="142.5 / 145 cum (98.3%)"
              status="progress"
            />
            <TraceRow
              icon={<Link2 className="h-3.5 w-3.5" />}
              label="GRN Receipts"
              value="4 GRNs · NPR 1,384,500"
              status="linked"
            />
            <TraceRow
              icon={<Link2 className="h-3.5 w-3.5" />}
              label="Running Account"
              value="RA Bill #4 · claimed 142.5 cum"
              status="linked"
            />
            <TraceRow
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              label="NCR Holds"
              value="NCR-034 · 0 billable"
              status="blocked"
            />
          </TabsContent>

          <TabsContent value="audit" className="mt-0 space-y-3 px-4 py-3">
            <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <History className="h-3.5 w-3.5" />
              Audit Log
            </div>
            <AuditRow
              who="Engr."
              action="Updated cement rate from NPR 895 → NPR 920"
              when="2 hrs ago"
            />
            <AuditRow
              who="Bikash R."
              action="Adjusted mazdoor coefficient 1.6 → 1.4"
              when="Yesterday 16:42"
            />
            <AuditRow who="System" action="Preset loaded: PCC-M15-Standard" when="3 days ago" />
            <AuditRow who="Engr." action="Created RA from blank template" when="1 week ago" />
          </TabsContent>
        </Tabs>

        {/* Preset bar */}
        <div className="bg-secondary/20 flex items-center gap-2 border-t border-[var(--pane-divider)] p-3">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled
            title="Coming soon"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Load Preset
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled
            title="Coming soon"
          >
            <Save className="h-3.5 w-3.5" />
            Save Preset
          </Button>
          <div className="flex-1" />
          <Button size="sm" className="h-7 gap-1.5 text-xs" disabled title="Coming soon">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Save RA
          </Button>
        </div>
      </PaneBody>
    </>
  )
}

function RaSection({
  title,
  icon,
  rows,
  onUpdate,
}: {
  title: string
  icon: React.ReactNode
  rows: RaRow[]
  onUpdate: (index: number, field: 'qty' | 'rate', value: number) => void
}) {
  const sectionTotal = rows.reduce((s, r) => s + r.qty * r.rate, 0)
  return (
    <div className="border-b border-[var(--pane-divider)] px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
          {icon}
          {title}
        </div>
        <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs">
          <Plus className="h-3 w-3" />
          Add
        </Button>
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div
            key={i}
            className="hover:bg-accent/40 grid grid-cols-12 items-center gap-1.5 rounded p-1.5 text-xs"
          >
            <div className="col-span-7">
              <div className="truncate font-medium">{r.name}</div>
              <div className="text-muted-foreground flex items-center gap-1 text-[10px]">
                <span className="font-mono">{r.code}</span>
                <span>·</span>
                <span>{r.source}</span>
              </div>
            </div>
            <Input
              className="col-span-2 h-6 px-1 text-xs"
              type="number"
              value={r.qty}
              onChange={(e) => onUpdate(i, 'qty', parseFloat(e.target.value) || 0)}
            />
            <div className="col-span-3 flex items-center gap-1">
              <span className="text-muted-foreground text-[10px]">{r.uom}</span>
              <div className="flex flex-1 items-center gap-0.5">
                <Input
                  className="h-6 flex-1 px-1 font-mono text-xs"
                  type="number"
                  value={r.rate}
                  onChange={(e) => onUpdate(i, 'rate', parseFloat(e.target.value) || 0)}
                />
                <button
                  className="hover:bg-accent rounded p-0.5"
                  title="Auto-calc from primary UOM"
                >
                  <Zap className="h-3 w-3 text-amber-500" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-[var(--pane-divider)] pt-2 text-xs">
        <span className="text-muted-foreground">Section subtotal ({rows.length} resources)</span>
        <span className="font-mono font-semibold">
          NPR {sectionTotal.toFixed(0)}/{rows[0]?.uom || 'unit'}
        </span>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string
  value: string
  muted?: boolean
  bold?: boolean
}) {
  return (
    <div className="flex justify-between">
      <span className={cn(muted && 'text-muted-foreground', bold && 'font-semibold')}>{label}</span>
      <span className={cn('font-mono', bold && 'font-semibold')}>{value}</span>
    </div>
  )
}

function TraceRow({
  icon,
  label,
  value,
  status,
}: {
  icon: React.ReactNode
  label: string
  value: string
  status: 'linked' | 'progress' | 'blocked'
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--pane-divider)] p-2 text-xs">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground">{label}</div>
        <div className="truncate">{value}</div>
      </div>
      {status === 'linked' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
      {status === 'progress' && (
        <div className="h-3.5 w-3.5 rounded-full border-2 border-amber-500 border-t-transparent" />
      )}
      {status === 'blocked' && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
    </div>
  )
}

function AuditRow({ who, action, when }: { who: string; action: string; when: string }) {
  return (
    <div className="flex gap-2.5 text-xs">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-400 to-slate-600 text-[10px] font-semibold text-white">
        {who.charAt(0)}
      </div>
      <div className="flex-1">
        <div>
          <span className="font-medium">{who}</span>{' '}
          <span className="text-muted-foreground">{action}</span>
        </div>
        <div className="text-muted-foreground text-[10px]">{when}</div>
      </div>
    </div>
  )
}

export function NonPricedInspector({ item }: { item: BoqItem }) {
  return (
    <>
      <PaneHeader title={`Inspector · ${item.code}`} />
      <PaneBody>
        <div className="border-b border-[var(--pane-divider)] p-4">
          <Badge variant="secondary" className="text-xs">
            {item.type}
          </Badge>
          <div className="mt-2 text-sm leading-snug font-semibold">{item.desc}</div>
        </div>
        <div className="text-muted-foreground p-4 text-center text-xs">
          <Edit3 className="mx-auto mb-2 h-8 w-8 opacity-30" />
          <div className="text-foreground font-medium">{item.type} item</div>
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
