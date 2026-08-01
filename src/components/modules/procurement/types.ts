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

export const INITIAL_REQS: ReqItem[] = [
  {
    id: 'REQ-0142',
    item: 'Cement OPC 53 Grade',
    uom: 'Bag',
    qty: 1200,
    status: 'Approved',
    source: 'Sched',
    vendors: [
      { name: 'Udaipur Cement', rate: 920, selected: true },
      { name: 'Shivam Cement', rate: 935 },
      { name: 'Hongshi Cement', rate: 918 },
    ],
  },
  {
    id: 'REQ-0143',
    item: 'TMT Steel Fe500 16mm',
    uom: 'MT',
    qty: 8.5,
    status: "Partially PO'd",
    source: 'Manual',
    vendors: [
      { name: 'Pashupati Steel', rate: 118200, selected: true },
      { name: 'Hama Steel', rate: 119000 },
    ],
  },
  {
    id: 'REQ-0144',
    item: 'Shuttering Ply 18mm',
    uom: 'Sheet',
    qty: 60,
    status: 'Draft',
    source: 'Sched',
    vendors: [
      { name: 'Ghorahi Ply', rate: 2850 },
      { name: 'Ganapati Ply', rate: 2790, selected: true },
    ],
  },
]

export const INITIAL_POS: Po[] = [
  {
    id: 'PO-2410-018',
    vendor: 'Udaipur Cement',
    date: '12 Aug 2026',
    value: 1104000,
    status: 'Delivered',
    items: 1,
    grn: true,
    reqId: 'REQ-0142',
    materialCode: 'M-CEM-OPC',
    rate: 920,
    poQty: 1200,
  },
  {
    id: 'PO-2410-014',
    vendor: 'Trishuli Sand Suppliers',
    date: '08 Aug 2026',
    value: 173250,
    status: 'Partial',
    items: 2,
    grn: true,
    reqId: 'REQ-0143',
    materialCode: 'M-SAND-R',
    rate: 3850,
    poQty: 45,
  },
  {
    id: 'PO-2410-022',
    vendor: 'Hetauda Aggregates',
    date: '15 Aug 2026',
    value: 285600,
    status: 'Pending',
    items: 3,
    grn: false,
    reqId: 'REQ-0143',
    materialCode: 'M-AGG-20',
    rate: 2950,
    poQty: 96,
  },
  {
    id: 'PO-2410-016',
    vendor: 'Ghorahi Ply',
    date: '10 Aug 2026',
    value: 167400,
    status: 'Partial',
    items: 1,
    grn: true,
    reqId: 'REQ-0144',
    materialCode: 'M-PLY-18',
    rate: 2790,
    poQty: 60,
  },
]

export const INITIAL_GRNS: Grn[] = [
  {
    id: 'GRN-0089',
    poId: 'PO-2410-018',
    vendor: 'Udaipur Cement',
    poQty: 1200,
    grnQty: 1200,
    invoiceQty: 1200,
    rate: 920,
    payStatus: 'Cleared',
    materialCode: 'M-CEM-OPC',
    date: '13 Aug 2026',
  },
  {
    id: 'GRN-0088',
    poId: 'PO-2410-014',
    vendor: 'Trishuli Sand',
    poQty: 45,
    grnQty: 38,
    invoiceQty: 38,
    rate: 3850,
    payStatus: 'Partial Hold',
    materialCode: 'M-SAND-R',
    date: '09 Aug 2026',
  },
  {
    id: 'GRN-0090',
    poId: 'PO-2410-022',
    vendor: 'Hetauda Aggregates',
    poQty: 96,
    grnQty: 0,
    invoiceQty: 0,
    rate: 2950,
    payStatus: 'Awaiting GRN',
    materialCode: 'M-AGG-20',
    date: '—',
  },
  {
    id: 'GRN-0087',
    poId: 'PO-2410-016',
    vendor: 'Ghorahi Ply',
    poQty: 60,
    grnQty: 60,
    invoiceQty: 58,
    rate: 2790,
    payStatus: 'Hold',
    materialCode: 'M-PLY-18',
    date: '11 Aug 2026',
  },
]

export const INITIAL_STOCK: StockItem[] = [
  {
    code: 'M-CEM-OPC',
    name: 'Cement OPC 53 (Bag)',
    onHand: 1240,
    reserved: 480,
    avgCost: 918,
    warehouse: 'Main Store · Kalanki',
  },
  {
    code: 'M-SAND-R',
    name: 'River Sand (cum)',
    onHand: 38.5,
    reserved: 12,
    avgCost: 3850,
    warehouse: 'Site Stockpile',
  },
  {
    code: 'M-AGG-20',
    name: 'Coarse Agg 20mm (cum)',
    onHand: 64.2,
    reserved: 28,
    avgCost: 2950,
    warehouse: 'Site Stockpile',
  },
  {
    code: 'M-STEEL-TMT16',
    name: 'TMT Steel 16mm (MT)',
    onHand: 4.8,
    reserved: 3.2,
    avgCost: 118200,
    warehouse: 'Rebar Yard',
  },
  {
    code: 'M-PLY-18',
    name: 'Shuttering Ply 18mm (Sheet)',
    onHand: 48,
    reserved: 24,
    avgCost: 2790,
    warehouse: 'Formwork Yard',
  },
]

// Backward compat: STOCK is now a snapshot of INITIAL_STOCK. The live stock
// state is managed via useSyncedState in the procurement module.
export const STOCK = INITIAL_STOCK
