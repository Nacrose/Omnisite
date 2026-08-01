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
  },
  {
    id: 'PO-2410-014',
    vendor: 'Trishuli Sand Suppliers',
    date: '08 Aug 2026',
    value: 173250,
    status: 'Partial',
    items: 2,
    grn: true,
  },
  {
    id: 'PO-2410-022',
    vendor: 'Hetauda Aggregates',
    date: '15 Aug 2026',
    value: 285600,
    status: 'Pending',
    items: 3,
    grn: false,
  },
]

export const STOCK = [
  {
    code: 'M-CEM-OPC',
    name: 'Cement OPC 53 (Bag)',
    onHand: 1240,
    reserved: 480,
    available: 760,
    avgCost: 918,
    warehouse: 'Main Store · Kalanki',
  },
  {
    code: 'M-SAND-R',
    name: 'River Sand (cum)',
    onHand: 38.5,
    reserved: 12,
    available: 26.5,
    avgCost: 3850,
    warehouse: 'Site Stockpile',
  },
  {
    code: 'M-AGG-20',
    name: 'Coarse Agg 20mm (cum)',
    onHand: 64.2,
    reserved: 28,
    available: 36.2,
    avgCost: 2950,
    warehouse: 'Site Stockpile',
  },
  {
    code: 'M-STEEL-TMT16',
    name: 'TMT Steel 16mm (MT)',
    onHand: 4.8,
    reserved: 3.2,
    available: 1.6,
    avgCost: 118200,
    warehouse: 'Rebar Yard',
  },
  {
    code: 'M-PLY-18',
    name: 'Shuttering Ply 18mm (Sheet)',
    onHand: 48,
    reserved: 24,
    available: 24,
    avgCost: 2790,
    warehouse: 'Formwork Yard',
  },
]
