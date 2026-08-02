// ─── Types & constants for the Procurement module ───────────────────────────

export type Tab = 'req' | 'po' | 'grn' | 'stock' | 'min'

export interface Vendor {
  name: string
  rate: number
  selected?: boolean
}

export interface ReqItem {
  id: string
  item: string
  uom: string
  qty: number
  vendors: Vendor[]
  status: 'Draft' | 'Approved' | "Partially PO'd" | "Fully PO'd"
  source: 'Sched' | 'Manual'
  overrideReason?: string
}

export interface Po {
  id: string
  vendor: string
  date: string
  value: number
  status: 'Delivered' | 'Partial' | 'Pending'
  items: number
  grn: boolean
  /** Originating requisition ID — closes the traceability gap (REQ → PO → GRN). */
  reqId?: string
  /** Material code this PO delivers (links to StockItem for stock movements). */
  materialCode?: string
  /** Unit rate at PO creation — used for 3-way match locked-amount calc. */
  rate?: number
  /** Ordered quantity (may differ from requisition qty if split across vendors). */
  poQty?: number
}

/** Goods Received Note — 3-way match (PO qty vs GRN qty vs Invoice qty). */
export interface Grn {
  id: string
  poId: string
  vendor: string
  poQty: number
  grnQty: number
  invoiceQty: number
  /** Unit rate as per the PO (the agreed rate). */
  poRate?: number
  /** Unit rate as per the invoice (what the vendor is actually charging). */
  rate: number
  payStatus: 'Cleared' | 'Hold' | 'Partial Hold' | 'Awaiting GRN'
  /** Material code delivered — used to increment StockItem.onHand on GRN. */
  materialCode?: string
  date: string
}

/** Stock item — live inventory, derived from GRN receipts minus MIN issues. */
export interface StockItem {
  code: string
  name: string
  onHand: number
  reserved: number
  avgCost: number
  warehouse: string
}

/**
 * Material Issue Note (MIN) — material issued against a task.
 *
 * Used by the MIN tab in the Procurement module. Each MIN references a
 * scheduler task so material variance can be tracked in the DSR Inspector.
 */
export interface MinNote {
  id: string
  date: string
  task: string
  items: string
  issued: string
  status: 'Issued' | 'N/A'
}

// Re-export the seed data arrays so existing imports from './types' keep
// working. The seed data itself lives in '@/data/seed/procurement'.
export {
  INITIAL_REQS,
  INITIAL_POS,
  INITIAL_GRNS,
  INITIAL_STOCK,
  INITIAL_MINS,
} from '@/data/seed/procurement'

// Backward compat: STOCK is now a snapshot of INITIAL_STOCK. The live stock
// state is managed via useSyncedState in the procurement module.
import { INITIAL_STOCK } from '@/data/seed/procurement'
export const STOCK = INITIAL_STOCK
