'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, X } from 'lucide-react'
import type { PctCosts, CustomPctCost } from './ra-types'

interface PctCostsSectionProps {
  pctCosts: PctCosts
  setPctCosts: React.Dispatch<React.SetStateAction<PctCosts>>
  customPctCosts: CustomPctCost[]
  setCustomPctCosts: React.Dispatch<React.SetStateAction<CustomPctCost[]>>
  directCost: number
  labourCost: number
  materialCost: number
  equipCost: number
  pctCostBase: number
}

/**
 * The "% Costs (Indirect)" section of the RA builder.
 *
 * Renders the 4 built-in percentage-cost rows (labour / material / equipment
 * / T&P) plus any user-added custom indirect-cost rows.
 *
 * Extracted from ra-inspector.tsx so the main component focuses on layout.
 */
export function PctCostsSection({
  pctCosts,
  setPctCosts,
  customPctCosts,
  setCustomPctCosts,
  directCost,
  labourCost,
  materialCost,
  equipCost,
  pctCostBase,
}: PctCostsSectionProps) {
  return (
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
            onCheckedChange={(v) => setPctCosts((s) => ({ ...s, tp: { ...s.tp, on: !!v } }))}
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
      {/* User-added custom indirect-cost rows. */}
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
                      r.id === row.id ? { ...r, base: e.target.value as typeof row.base } : r
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
                onClick={() => setCustomPctCosts((prev) => prev.filter((r) => r.id !== row.id))}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface OpSectionProps {
  opOnDirect: boolean
  setOpOnDirect: (v: boolean) => void
  opOnPct: boolean
  setOpOnPct: (v: boolean) => void
  opPct: number
  setOpPct: (v: number) => void
  directCost: number
  pctCostBase: number
  overheadAmount: number
}

/**
 * The "Overhead & Profit (cumulative)" section of the RA builder.
 */
export function OpSection({
  opOnDirect,
  setOpOnDirect,
  opOnPct,
  setOpOnPct,
  opPct,
  setOpPct,
  directCost,
  pctCostBase,
  overheadAmount,
}: OpSectionProps) {
  return (
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
  )
}
