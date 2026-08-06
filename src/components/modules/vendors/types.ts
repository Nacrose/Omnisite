// ─── Types ───────────────────────────────────────────────────────────────────

export type ItemType = 'composite' | 'conditional'

export interface ScItem {
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
  designPattern?: number // expected qty per rm of advance for this rock class
}

export interface MaterialIssue {
  id: string // MIN number
  date: string
  materialCode: string
  materialName: string
  uom: string
  qty: number
  rate: number
  issuedBy: string
  notes?: string
}

export interface MaterialReturn {
  id: string // MRN number
  date: string
  materialCode: string
  materialName: string
  uom: string
  qty: number
  rate: number
  returnedBy: string
  notes?: string
}

export interface ConsumableIssue {
  id: string
  date: string
  name: string // curing compound, binding wire, diesel, form release agent
  uom: string
  qty: number
  rate: number
  normPerUnit?: number // e.g., 0.5 kg binding wire per MT steel
  normUnit?: string // "MT"
  normBasis?: number // total basis (e.g., 28.5 MT steel)
}

export interface CustomDeductible {
  id: string
  type: 'tds' | 'equipment' | 'penalty' | 'electricity' | 'insurance' | 'material_overuse' | 'other'
  label: string
  amount: number
  ratePct?: number
  notes?: string
}

export interface Subcontractor {
  id: string
  name: string
  scope: string
  agreementValue: number
  advancePaid: number
  advancePct: number // e.g., 10%
  /** Cumulative advance amount already recovered across prior bills.
   *  Tracked in vendor state because we don't have a bills table yet —
   *  each `Generate Running Bill` action adds the current bill's recovery
   *  to this running total, capped at `advancePaid`. */
  advanceRecovered?: number
  retentionPct: number // e.g., 5%
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
  assignedTasks: {
    taskId: string
    taskName: string
    progress: number
    baseline: string
    status: string
  }[]
  ncrCount: number
  incidents: number
  isTunneling: boolean
  /** True when an open NCR has placed a billing hold on this SC.
   *  Set by the Q&S module's NCR workflow (createBillingHoldForNCR).
   *  When true, the Running Bill tab blocks bill generation until the
   *  hold is released (NCR closed or manually released). */
  billingHold?: boolean
}

// ─── Seed data ──────────────────────────────────────────────────────────────
//
// Re-export the seed data array so existing imports from './types' keep
// working. The seed data itself lives in '@/data/seed/subcontractor'.
export { INITIAL_SCS } from '@/data/seed/subcontractor'

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}

export function fmtNPR(n: number) {
  return `NPR ${n.toLocaleString('en-IN')}`
}
