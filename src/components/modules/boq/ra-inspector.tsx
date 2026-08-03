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
  Edit3,
  CheckCircle2,
  TrendingUp,
  History,
  Link2,
  Layers,
  MapPin,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { BoqItem } from './types'
import { LocationPicker } from '@/components/ui/location-picker'

interface RaRow {
  id: string
  code: string
  name: string
  uom: string
  qty: number
  rate: number
  source: string
}

// NOTE: The INITIAL_* constants below are kept ONLY as a reference template
// (e.g. for a future "Load PCC Template" button). They are NOT used as the
// default state of new items — every BOQ item starts with an EMPTY RA so the
// user fills in their own resource rows. Previously every Priced item got
// the same cement/sand/aggregate breakdown, which was misleading.
const INITIAL_MATERIALS: RaRow[] = []
const INITIAL_LABOUR: RaRow[] = []
const INITIAL_EQUIPMENT: RaRow[] = []

// PCC reference template (DoR M15 default coefficients). Exported so a future
// "Load PCC Template" button can call this; not used as the default state.
export const PCC_TEMPLATE_MATERIALS: RaRow[] = [
  {
    id: 'pcc-mat-cem',
    code: 'M-CEM-OPC',
    name: 'Cement OPC 53 Grade (Udaipur)',
    uom: 'Bag',
    qty: 4.5,
    rate: 920,
    source: 'Project Rate Library',
  },
  {
    id: 'pcc-mat-sand',
    code: 'M-SAND-R',
    name: 'River Sand (Trishuli)',
    uom: 'cum',
    qty: 0.45,
    rate: 3850,
    source: 'Project Rate Library',
  },
  {
    id: 'pcc-mat-agg',
    code: 'M-AGG-20',
    name: 'Coarse Aggregate 20mm',
    uom: 'cum',
    qty: 0.9,
    rate: 2950,
    source: 'Project Rate Library',
  },
  {
    id: 'pcc-mat-water',
    code: 'M-WAT',
    name: 'Water (tanker)',
    uom: 'ltr',
    qty: 180,
    rate: 0.45,
    source: 'Project Rate Library',
  },
]

export const PCC_TEMPLATE_LABOUR: RaRow[] = [
  {
    id: 'pcc-lab-masn',
    code: 'L-MASN',
    name: 'Mason (Skilled Cat. I)',
    uom: 'day',
    qty: 0.6,
    rate: 1450,
    source: 'DoR Norm 2075',
  },
  {
    id: 'pcc-lab-hel',
    code: 'L-HEL',
    name: 'Mazdoor (Unskilled)',
    uom: 'day',
    qty: 1.4,
    rate: 950,
    source: 'DoR Norm 2075',
  },
  {
    id: 'pcc-lab-mix',
    code: 'L-MIX',
    name: 'Mixer Operator',
    uom: 'day',
    qty: 0.2,
    rate: 1200,
    source: 'DoR Norm 2075',
  },
]

export const PCC_TEMPLATE_EQUIPMENT: RaRow[] = [
  {
    id: 'pcc-eq-mix',
    code: 'E-MIX',
    name: 'Concrete Mixer 0.4 cum',
    uom: 'hr',
    qty: 1.8,
    rate: 285,
    source: 'Equipment Master',
  },
  {
    id: 'pcc-eq-vib',
    code: 'E-VIB',
    name: 'Needle Vibrator 60mm',
    uom: 'hr',
    qty: 1.2,
    rate: 95,
    source: 'Equipment Master',
  },
]

export function RaInspector({
  item,
  onUpdateLocation,
}: {
  item: BoqItem
  /**
   * Fired when the user picks (or clears) a work location in the
   * LocationPicker. The parent uses this to mutate its synced boqRows state
   * so the link persists to Supabase and is visible across modules — the
   * inspector can't do that itself because it only owns a local mirror.
   */
  onUpdateLocation?: (locationId: string | null) => void
}) {
  // NOTE: RA state (materials/labour/equipment/pctCosts) is local useState
  // seeded from empty arrays. It is NOT persisted to the database — switching
  // BOQ items or reloading discards all edits. This is a known limitation.
  // The state IS scoped per BOQ item via key={selectedLeaf.id} on the
  // RaInspector mount (index.tsx), so switching items resets the arrays.
  // Persistence requires adding an ra_data JSONB column to boq_items and
  // wiring the local state through useSyncedState.

  // Use item.locationId directly as the LocationPicker value — no local
  // mirror needed. The parent's onUpdateLocation callback propagates the
  // change, the boqRows store updates, and the new item prop flows back in
  // the same React batch. This is the standard controlled-component pattern
  // and avoids the stale-local-state bug that a useState mirror would cause
  // when the item prop changes externally (audit B3-1 — same fix as the
  // scheduler's R5-1).
  const locationId = item.locationId

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
  // User-added custom indirect-cost rows. The four rows above are kept as
  // first-class knobs (labour / material / equipment / T&P) because they're
  // the standard DoR headings; `customPctCosts` is the extension point for
  // project-specific indirects (insurance, contingency, contractor's profit,
  // etc.). Each row carries its own base selector so a custom row can be
  // levied on direct cost OR on any of the three sub-costs — matching how
  // the built-in rows behave. Previously the "+" button showed a "coming
  // soon" toast and the user could not add any indirect cost row at all.
  const [customPctCosts, setCustomPctCosts] = useState<
    {
      id: string
      label: string
      pct: number
      on: boolean
      base: 'direct' | 'labour' | 'material' | 'equipment'
    }[]
  >([])
  const [opOnDirect, setOpOnDirect] = useState(true)
  const [opOnPct, setOpOnPct] = useState(true)
  const [opPct, setOpPct] = useState(15)

  // Helper to update a single row's field. Field is any keyof RaRow so the
  // inline-editable inputs (code/name/uom) on user-added rows can write back
  // through the same code path as qty/rate.
  const updateRow = (
    setter: React.Dispatch<React.SetStateAction<RaRow[]>>,
    index: number,
    field: keyof RaRow,
    value: string | number
  ) => {
    setter((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  // Delete a row from a resource section by index.
  const deleteRow = (setter: React.Dispatch<React.SetStateAction<RaRow[]>>, index: number) => {
    setter((prev) => prev.filter((_, i) => i !== index))
  }

  // Blank row template for the "Add" button. `source: 'Manual'` makes it
  // clear in the UI that this row came from the user, not from a rate library.
  const blankRaRow = (): RaRow => ({
    id: crypto.randomUUID(),
    code: '',
    name: '',
    uom: '',
    qty: 0,
    rate: 0,
    source: 'Manual',
  })

  // Recompute on every render — pure function of state
  const directCost = [...materials, ...labour, ...equipment].reduce((s, r) => s + r.qty * r.rate, 0)
  const labourCost = labour.reduce((s, r) => s + r.qty * r.rate, 0)
  const materialCost = materials.reduce((s, r) => s + r.qty * r.rate, 0)
  const equipCost = equipment.reduce((s, r) => s + r.qty * r.rate, 0)

  const pctCostBase =
    (pctCosts.labour.on ? (labourCost * pctCosts.labour.pct) / 100 : 0) +
    (pctCosts.material.on ? (materialCost * pctCosts.material.pct) / 100 : 0) +
    (pctCosts.equipment.on ? (equipCost * pctCosts.equipment.pct) / 100 : 0) +
    (pctCosts.tp.on ? (directCost * pctCosts.tp.pct) / 100 : 0) +
    // User-added custom indirect-cost rows. Each row's base selects which
    // sub-cost the percentage is levied on, mirroring the four built-in
    // rows (labour / material / equipment on their respective sub-costs;
    // T&P on direct). Without this aggregation, custom rows would be
    // visible in the UI but silently excluded from the live totals.
    customPctCosts
      .filter((r) => r.on)
      .reduce((sum, r) => {
        const base =
          r.base === 'labour'
            ? labourCost
            : r.base === 'material'
              ? materialCost
              : r.base === 'equipment'
                ? equipCost
                : directCost
        return sum + (base * r.pct) / 100
      }, 0)

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
          {/* Location picker — optional FK to project_locations.id */}
          <div className="mt-2">
            <label className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase">
              <MapPin className="h-3 w-3" />
              Work Location
            </label>
            <LocationPicker
              value={locationId}
              onChange={(locId) => {
                // Propagate to the parent so the synced boqRows store is
                // mutated — the location_id column added in migration 12 is
                // then persisted to Supabase and visible to other modules.
                // (audit B3-1: no local mirror — item.locationId is the
                // source of truth, updated via the parent callback.)
                onUpdateLocation?.(locId)
                toast.success('Location linked to BOQ item', {
                  description: locId
                    ? `${item.code} → ${locId}`
                    : `Cleared location on ${item.code}`,
                })
              }}
              allowClear
              placeholder="Link to a project location…"
              className="mt-1"
            />
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
              itemUom={item.uom}
              onUpdate={(i, f, v) => updateRow(setMaterials, i, f, v)}
              onAdd={() => setMaterials((prev) => [...prev, blankRaRow()])}
              onDelete={(i) => deleteRow(setMaterials, i)}
            />
            <RaSection
              title="Labour"
              icon={<Layers className="h-3.5 w-3.5" />}
              rows={labour}
              itemUom={item.uom}
              onUpdate={(i, f, v) => updateRow(setLabour, i, f, v)}
              onAdd={() => setLabour((prev) => [...prev, blankRaRow()])}
              onDelete={(i) => deleteRow(setLabour, i)}
            />
            <RaSection
              title="Equipment"
              icon={<Layers className="h-3.5 w-3.5" />}
              rows={equipment}
              itemUom={item.uom}
              onUpdate={(i, f, v) => updateRow(setEquipment, i, f, v)}
              onAdd={() => setEquipment((prev) => [...prev, blankRaRow()])}
              onDelete={(i) => deleteRow(setEquipment, i)}
            />

            {/* % COSTS */}
            <div className="border-y border-[var(--pane-divider)] px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  % Costs (Indirect)
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 text-xs"
                  onClick={() =>
                    setCustomPctCosts((prev) => [
                      ...prev,
                      {
                        // crypto.randomUUID() keeps custom row ids collision-free
                        // even when the user double-clicks Add in quick succession.
                        id: crypto.randomUUID(),
                        label: 'Custom Indirect',
                        pct: 0,
                        on: true,
                        base: 'direct',
                      },
                    ])
                  }
                >
                  <Plus className="h-3 w-3" />
                  Add
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
                    // Use `|| ''` so the input shows empty (not 0) when the
                    // user clears it — same pattern as the T&P input below.
                    // Previously used `value={pctCosts.labour.pct}` which
                    // showed 0 when cleared, preventing the user from typing
                    // a new value (audit B5-8).
                    value={pctCosts.labour.pct || ''}
                    placeholder="—"
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
                    value={pctCosts.material.pct || ''}
                    placeholder="—"
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
                    value={pctCosts.equipment.pct || ''}
                    placeholder="—"
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
              {/* User-added custom indirect-cost rows. Each row is fully
                  editable (label / base / pct / on / delete). Bases map to
                  the same four sub-costs the built-in rows use, so a custom
                  row can be levied on direct OR any sub-cost without changing
                  the calculation engine. */}
              {customPctCosts.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {customPctCosts.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center gap-2 rounded-md border border-[var(--pane-divider)] p-1.5 text-xs"
                    >
                      <Checkbox
                        checked={row.on}
                        onCheckedChange={(v) =>
                          setCustomPctCosts((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, on: !!v } : r))
                          )
                        }
                      />
                      <Input
                        className="h-6 flex-1 text-xs"
                        value={row.label}
                        placeholder="Label (e.g. Insurance)"
                        onChange={(e) =>
                          setCustomPctCosts((prev) =>
                            prev.map((r) => (r.id === row.id ? { ...r, label: e.target.value } : r))
                          )
                        }
                      />
                      <select
                        className="h-6 rounded border border-[var(--pane-divider)] bg-transparent px-1 text-[11px]"
                        value={row.base}
                        onChange={(e) =>
                          setCustomPctCosts((prev) =>
                            prev.map((r) =>
                              r.id === row.id
                                ? { ...r, base: e.target.value as typeof row.base }
                                : r
                            )
                          )
                        }
                        title="Base the percentage is levied on"
                      >
                        <option value="direct">on Direct</option>
                        <option value="labour">on Labour</option>
                        <option value="material">on Material</option>
                        <option value="equipment">on Equipment</option>
                      </select>
                      <span className="text-muted-foreground">%</span>
                      <Input
                        className="h-6 w-12 text-xs"
                        type="number"
                        value={row.pct || ''}
                        placeholder="0"
                        onChange={(e) =>
                          setCustomPctCosts((prev) =>
                            prev.map((r) =>
                              r.id === row.id ? { ...r, pct: parseFloat(e.target.value) || 0 } : r
                            )
                          )
                        }
                      />
                      <button
                        className="text-muted-foreground rounded p-0.5 hover:text-red-500"
                        title="Remove row"
                        onClick={() =>
                          setCustomPctCosts((prev) => prev.filter((r) => r.id !== row.id))
                        }
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                    // Use `|| ''` so the input shows empty (not 0) when
                    // cleared — same pattern as the pct cost inputs above
                    // (audit B5-8).
                    value={opPct || ''}
                    placeholder="—"
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
            {/* Honest placeholder — the real traceability rows (schedule task,
                PO, DSR actual qty, GRN receipts, RA bill, NCR holds) are not
                wired into the inspector yet. They require cross-module links
                from this BOQ item to specific DSR entries, POs, GRNs, and RA
                Bills, which the data model doesn't expose per-item today.

                Showing fabricated task IDs / PO numbers / quantities here
                would mislead users into thinking the inspector has live
                traceability data when it doesn't. The grid context menu's
                "View audit log" already opens the real audit trail via the
                AuditLogViewer; this tab will be populated once the BOQ ↔
                DSR/PO/GRN/RA foreign keys are linked per item. */}
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--pane-divider)] py-8 text-center">
              <Link2 className="text-muted-foreground h-6 w-6 opacity-50" />
              <div className="text-xs font-medium">No traceability data linked yet</div>
              <p className="text-muted-foreground max-w-sm text-[11px] leading-relaxed">
                Traceability data will appear here when DSR entries, POs, GRNs, and RA Bills are
                linked to this BOQ item.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="audit" className="mt-0 space-y-3 px-4 py-3">
            <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <History className="h-3.5 w-3.5" />
              Audit Log
            </div>
            {/* The AuditLogViewer component (used by the BOQ grid context
                menu) opens as a modal that fetches real audit entries from
                /api/audit-log. Embedding it inline here would require
                restructuring it into a non-modal variant — out of scope for
                this fix. Instead, point users to the existing affordance so
                they get the real, server-backed audit trail rather than the
                previously-hardcoded fake entries
                ("Engr. Updated cement rate 895→920", etc.). */}
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--pane-divider)] py-8 text-center">
              <History className="text-muted-foreground h-6 w-6 opacity-50" />
              <div className="text-xs font-medium">Audit log opens from the grid</div>
              <p className="text-muted-foreground max-w-sm text-[11px] leading-relaxed">
                Right-click the BOQ item in the grid → &lsquo;View audit log&rsquo; to see the full
                audit trail.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Preset bar */}
        <div className="bg-secondary/20 flex items-center gap-2 border-t border-[var(--pane-divider)] p-3">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() =>
              toast.info('RA preset saving coming soon', {
                description: 'Presets are managed in Admin → RA Presets.',
              })
            }
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Load Preset
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() =>
              toast.info('RA preset saving coming soon', {
                description: 'Presets are managed in Admin → RA Presets.',
              })
            }
          >
            <Save className="h-3.5 w-3.5" />
            Save Preset
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() =>
              toast.info('Rate Analysis saving coming soon', {
                description:
                  'RA data is currently session-only and lost on item switch. This will be persisted to the boq_items table in a future update.',
              })
            }
          >
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
  itemUom,
  onUpdate,
  onAdd,
  onDelete,
}: {
  title: string
  icon: React.ReactNode
  rows: RaRow[]
  /** UOM of the BOQ item this section belongs to — used in the subtotal
   *  label so the per-unit cost is shown against the right unit. Previously
   *  this used the first resource row's UOM, which is wrong: a 'cum' BOQ
   *  item can have 'Bag' cement and 'day' labour rows, and the subtotal
   *  shouldn't inherit either of those. */
  itemUom: string
  onUpdate: (index: number, field: keyof RaRow, value: string | number) => void
  /** Append a blank row to the section's array. The parent owns the array
   *  state so the Add button just dispatches the action up. */
  onAdd: () => void
  /** Remove the row at the given index. */
  onDelete: (index: number) => void
}) {
  const sectionTotal = rows.reduce((s, r) => s + r.qty * r.rate, 0)
  return (
    <div className="border-b border-[var(--pane-divider)] px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
          {icon}
          {title}
        </div>
        <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={onAdd}>
          <Plus className="h-3 w-3" />
          Add
        </Button>
      </div>
      <div className="space-y-1.5">
        {rows.length === 0 && (
          <div className="text-muted-foreground rounded-md border border-dashed border-[var(--pane-divider)] px-2 py-3 text-center text-[11px]">
            No {title.toLowerCase()} rows yet — click <span className="font-medium">Add</span> to
            create one.
          </div>
        )}
        {rows.map((r, i) => (
          <div
            key={r.id}
            className="hover:bg-accent/40 grid grid-cols-12 items-center gap-1.5 rounded p-1.5 text-xs"
          >
            {/* Name + source — name is an inline input so the user can fill
                in newly-added blank rows without a separate edit affordance. */}
            <div className="col-span-4">
              <Input
                className="h-6 px-1 text-xs"
                value={r.name}
                placeholder="Resource name"
                onChange={(e) => onUpdate(i, 'name', e.target.value)}
              />
              <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[10px]">
                <span className="font-mono">{r.code || '—'}</span>
                <span>·</span>
                <span>{r.source || 'Manual'}</span>
              </div>
            </div>
            {/* Code — also editable inline for new rows. */}
            <Input
              className="col-span-2 h-6 px-1 font-mono text-xs"
              value={r.code}
              placeholder="Code"
              onChange={(e) => onUpdate(i, 'code', e.target.value)}
            />
            {/* UOM — short text input. Tight on width but adequate for the
                typical DoR units (Bag, cum, day, hr, ltr). */}
            <Input
              className="col-span-1 h-6 px-1 text-xs"
              value={r.uom}
              placeholder="UOM"
              onChange={(e) => onUpdate(i, 'uom', e.target.value)}
            />
            <Input
              className="col-span-2 h-6 px-1 text-xs"
              type="number"
              // Use `|| ''` so the input shows empty (not 0) when cleared —
              // same pattern as the pct cost inputs (audit B6-5).
              value={r.qty || ''}
              placeholder="0"
              onChange={(e) => onUpdate(i, 'qty', parseFloat(e.target.value) || 0)}
            />
            <div className="col-span-2 flex items-center gap-0.5">
              <Input
                className="h-6 flex-1 px-1 font-mono text-xs"
                type="number"
                value={r.rate || ''}
                placeholder="0"
                onChange={(e) => onUpdate(i, 'rate', parseFloat(e.target.value) || 0)}
              />
              <button
                className="text-muted-foreground rounded p-0.5 hover:text-red-500"
                title={`Remove ${r.name || 'row'}`}
                onClick={() => onDelete(i)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-[var(--pane-divider)] pt-2 text-xs">
        <span className="text-muted-foreground">Section subtotal ({rows.length} resources)</span>
        <span className="font-mono font-semibold">
          NPR {sectionTotal.toFixed(0)}/{itemUom || 'unit'}
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
