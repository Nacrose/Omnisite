// ─── Admin module seed data ─────────────────────────────────────────────────
//
// Three seed arrays for the Admin module:
//   - MATERIALS  → two-tier material master (Org / Project)
//   - VENDORS    → Approved Vendor List (AVL)
//   - ROLES      → Pre-configured role templates with per-module permissions
//
// The Material/Vendor/Role interfaces live here (not in the module's types.ts)
// so the seed file is self-contained — types.ts re-exports them.

/** Two-tier material master record. */
export interface Material {
  code: string
  name: string
  uom: string
  altUoms?: { uom: string; factor: number; rate: number }[]
  archived?: boolean
  /** `true` for Org Master rows (district rates, read-only). */
  org: boolean
  /** Per-project override rate (PM-editable). Falls back to `rate` when unset. */
  projectRate?: number
  /** Org baseline rate (district rate, read-only). */
  rate: number
}

/** Approved Vendor List entry. */
export interface Vendor {
  id: string
  name: string
  pan: string
  gst: string
  /** Material codes this vendor supplies. */
  materials: string[]
  brand: string
  rating: string
}

/** Per-module permission level. */
export type Permission = 'Edit' | 'Read' | 'Read own' | 'Edit own' | 'None'

/**
 * A role template — predefined permission set for a project role.
 *
 * `perms` maps module name to the permission level. Used by the Users tab
 * and UsersInspector to render the role-matrix grid.
 */
export interface Role {
  name: string
  users: number
  perms: Record<string, Permission>
}

/** A Rate Analysis preset — coefficients only (current rates fetched on load). */
export interface RatePreset {
  name: string
  items: number
  used: number
}

export const MATERIALS: Material[] = [
  {
    code: 'M-CEM-OPC',
    name: 'Cement OPC 53 Grade (Udaipur)',
    uom: 'Bag',
    rate: 918,
    projectRate: 920,
    altUoms: [
      { uom: 'Ton', factor: 20, rate: 18360 },
      { uom: 'Kg', factor: 0.05, rate: 0.46 },
    ],
    org: true,
  },
  {
    code: 'M-SAND-R',
    name: 'River Sand (Trishuli)',
    uom: 'cum',
    rate: 3850,
    projectRate: 3850,
    org: true,
  },
  {
    code: 'M-AGG-20',
    name: 'Coarse Aggregate 20mm',
    uom: 'cum',
    rate: 2950,
    projectRate: 2950,
    org: true,
  },
  {
    code: 'M-STEEL-TMT16',
    name: 'TMT Steel Fe500 16mm',
    uom: 'MT',
    rate: 118200,
    projectRate: 118200,
    org: true,
  },
  {
    code: 'M-PLY-18',
    name: 'Shuttering Ply 18mm',
    uom: 'Sheet',
    rate: 2790,
    projectRate: 2790,
    org: true,
    archived: true,
  },
]

export const VENDORS: Vendor[] = [
  {
    id: 'V-001',
    name: 'Udaipur Cement Ltd',
    pan: '123456789',
    gst: 'N/A (Nepal)',
    materials: ['M-CEM-OPC'],
    brand: 'Udaipur OPC 53',
    rating: 'A',
  },
  {
    id: 'V-002',
    name: 'Shivam Cement Pvt Ltd',
    pan: '987654321',
    gst: 'N/A',
    materials: ['M-CEM-OPC'],
    brand: 'Shivam OPC',
    rating: 'A-',
  },
  {
    id: 'V-003',
    name: 'Pashupati Steel Industries',
    pan: '555666777',
    gst: 'N/A',
    materials: ['M-STEEL-TMT16'],
    brand: 'Pashupati TMT',
    rating: 'A',
  },
  {
    id: 'V-004',
    name: 'Trishuli Sand Suppliers',
    pan: '111222333',
    gst: 'N/A',
    materials: ['M-SAND-R'],
    brand: '—',
    rating: 'B+',
  },
]

export const ROLES: Role[] = [
  {
    name: 'Site Engineer',
    users: 4,
    perms: {
      BOQ: 'Read',
      Scheduler: 'Edit',
      DSR: 'Edit',
      Procurement: 'Read',
      Financials: 'Read',
      Drawings: 'Edit',
    },
  },
  {
    name: 'Storekeeper',
    users: 2,
    perms: {
      BOQ: 'None',
      Scheduler: 'None',
      DSR: 'Read',
      Procurement: 'Edit',
      Financials: 'None',
      Drawings: 'Read',
    },
  },
  {
    name: 'Foreman',
    users: 6,
    perms: {
      BOQ: 'None',
      Scheduler: 'Read',
      DSR: 'Edit',
      Procurement: 'Read',
      Financials: 'None',
      Drawings: 'Read',
    },
  },
  {
    name: 'Subcontractor',
    users: 3,
    perms: {
      BOQ: 'Read own',
      Scheduler: 'Read own',
      DSR: 'Edit own',
      Procurement: 'None',
      Financials: 'Read own',
      Drawings: 'Read',
    },
  },
  {
    name: 'Project Manager',
    users: 1,
    perms: {
      BOQ: 'Edit',
      Scheduler: 'Edit',
      DSR: 'Edit',
      Procurement: 'Edit',
      Financials: 'Edit',
      Drawings: 'Edit',
    },
  },
]

/** Seed RA preset library — referenced by the Presets tab and its badge count. */
export const PRESETS: RatePreset[] = [
  { name: 'PCC M15 — DoR Standard 1:2:4', items: 4, used: 12 },
  { name: 'PCC M20 — Bridge Foundation', items: 4, used: 8 },
  { name: 'Reinforced Concrete Pile 600mm', items: 6, used: 3 },
  { name: 'Stone Soling 150mm', items: 3, used: 5 },
  { name: 'DBM 50mm — Pavement', items: 5, used: 2 },
]
