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
  designPattern?: number  // expected qty per rm of advance for this rock class
}

export interface MaterialIssue {
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

export interface MaterialReturn {
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

export interface ConsumableIssue {
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

export const INITIAL_SCS: Subcontractor[] = [
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

export function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}

export function fmtNPR(n: number) {
  return `NPR ${n.toLocaleString('en-IN')}`
}
