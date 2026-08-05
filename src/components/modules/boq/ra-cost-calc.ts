/**
 * Pure cost-calculation logic for the BOQ Rate Analysis (RA) inspector.
 *
 * Extracted from ra-inspector.tsx so the math can be unit-tested in isolation
 * and shared with export-ra.ts if needed.
 */

import type { RaRow, PctCosts, CustomPctCost } from './ra-types'

/**
 * Inputs to the RA cost calculation.
 */
export interface RaCostInputs {
  materials: RaRow[]
  labour: RaRow[]
  equipment: RaRow[]
  pctCosts: PctCosts
  customPctCosts: CustomPctCost[]
  opOnDirect: boolean
  opOnPct: boolean
  opPct: number
  contractRate: number
}

/**
 * Computed RA cost breakdown.
 */
export interface RaCostResult {
  directCost: number
  labourCost: number
  materialCost: number
  equipCost: number
  pctCostBase: number
  opBase: number
  overheadAmount: number
  totalCost: number
  margin: number
  marginPct: number
  costBarPct: number
  marginBarPct: number
}

/**
 * Compute the full RA cost breakdown from resource rows + percentage-cost
 * config + overhead settings.
 *
 * Pure function — no side effects, no React dependency. Safe to call outside
 * the component (e.g. in tests or in export-ra.ts to align with the
 * inspector's live totals).
 */
export function computeRaCosts(inputs: RaCostInputs): RaCostResult {
  const {
    materials,
    labour,
    equipment,
    pctCosts,
    customPctCosts,
    opOnDirect,
    opOnPct,
    opPct,
    contractRate,
  } = inputs

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
    // T&P on direct).
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
  const margin = contractRate - totalCost
  // Guard divide-by-zero: if contractRate is 0 (e.g. cleared input),
  // marginPct would be Infinity/NaN and break the UI.
  const marginPct = contractRate > 0 ? (margin / contractRate) * 100 : 0
  // Visual-bar widths — also guarded against 0 / negative contractRate.
  const costBarPct = contractRate > 0 ? Math.min(100, (totalCost / contractRate) * 100) : 0
  const marginBarPct =
    contractRate > 0 ? Math.max(0, Math.min(100, (margin / contractRate) * 100)) : 0

  return {
    directCost,
    labourCost,
    materialCost,
    equipCost,
    pctCostBase,
    opBase,
    overheadAmount,
    totalCost,
    margin,
    marginPct,
    costBarPct,
    marginBarPct,
  }
}
