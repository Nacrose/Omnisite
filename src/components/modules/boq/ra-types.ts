/**
 * Types and constants for the BOQ Rate Analysis (RA) inspector.
 *
 * Extracted from ra-inspector.tsx so the type + PCC template constants can
 * be shared with export-ra.ts and any future RA-related modules.
 */

export interface RaRow {
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
export const INITIAL_MATERIALS: RaRow[] = []
export const INITIAL_LABOUR: RaRow[] = []
export const INITIAL_EQUIPMENT: RaRow[] = []

// PCC reference template (DoR M15 default coefficients). Exported so a future
// "Load PCC Template" button can call this; not used as the default state.
export const PCC_TEMPLATE_MATERIALS: RaRow[] = [
  {
    id: 'pcc-mat-cem',
    code: 'M-CEM-OPC',
    name: 'Cement OPC 53 Grade (Udauru)',
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

/**
 * Shape of the built-in percentage-cost rows (labour / material / equipment / T&P).
 */
export interface PctCosts {
  labour: { on: boolean; pct: number }
  material: { on: boolean; pct: number }
  equipment: { on: boolean; pct: number }
  tp: { on: boolean; pct: number }
}

/**
 * Shape of user-added custom indirect-cost rows.
 */
export interface CustomPctCost {
  id: string
  label: string
  pct: number
  on: boolean
  base: 'direct' | 'labour' | 'material' | 'equipment'
}
