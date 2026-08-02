// ─── Unified Vendor + Project Location seed data ────────────────────────────
//
// Migrates the existing 4 static VENDORS (src/data/seed/admin.ts) and the
// 3 INITIAL_SCS (src/data/seed/subcontractor.ts) into the unified `vendors`
// table shape (src/lib/types/vendor.ts). Also seeds project_locations for
// the Kathmandu Ring Road Expansion — Package 3 project.
//
// The seed data is intentionally self-contained: instead of importing the
// legacy arrays and remapping at runtime, we duplicate the SC operational
// arrays verbatim so the new table has the same demo richness without
// coupling to the soon-to-be-deprecated `subcontractors` seed.

import type { Vendor, ProjectLocation, ComplianceDoc, SuppliedMaterial } from '@/lib/types/vendor'
import { MATERIALS } from '@/data/seed/admin'
import { INITIAL_SCS } from '@/data/seed/subcontractor'

// Kathmandu Ring Road Expansion — Package 3 (matches projects seed in
// supabase/migrations/00000000000000_schema.sql).
const KRR_PROJECT_ID = '00000000-0000-0000-0000-000000000001'

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a SuppliedMaterial entry from a MATERIALS master row, preserving
 * the project rate (preferred over the org baseline rate).
 */
function mat(code: string, brand?: string): SuppliedMaterial {
  const m = MATERIALS.find((x) => x.code === code)
  if (!m) {
    return { code, name: code, brand, rate: 0, uom: '' }
  }
  return {
    code: m.code,
    name: m.name,
    brand,
    rate: m.projectRate ?? m.rate,
    uom: m.uom,
    lastUpdated: '2026-07-01',
  }
}

/** Standard compliance docs for a supplier — PAN + GST + cancelled cheque. */
function supplierDocs(): ComplianceDoc[] {
  return [
    { type: 'pan_card', label: 'PAN Card', uploadedAt: '2025-04-12', fileUrl: '/docs/pan.pdf' },
    {
      type: 'gst_cert',
      label: 'GST / VAT Certificate',
      uploadedAt: '2025-04-12',
      fileUrl: '/docs/gst.pdf',
    },
    {
      type: 'cancelled_cheque',
      label: 'Cancelled Cheque',
      uploadedAt: '2025-04-15',
      fileUrl: '/docs/cheque.pdf',
    },
  ]
}

/** Compliance docs for a subcontractor — insurance + labour licence (with expiry). */
function scDocs(insuranceExpiry: string, labourLicenseExpiry: string): ComplianceDoc[] {
  return [
    {
      type: 'insurance',
      label: 'Workmen Compensation Insurance',
      expiryDate: insuranceExpiry,
      uploadedAt: '2025-03-10',
      fileUrl: '/docs/insurance.pdf',
      notes: 'Annual policy — renewed before expiry',
    },
    {
      type: 'labour_licence',
      label: 'Labour Licence',
      expiryDate: labourLicenseExpiry,
      uploadedAt: '2025-03-10',
      fileUrl: '/docs/labour-licence.pdf',
    },
    { type: 'pan_card', label: 'PAN Card', uploadedAt: '2025-03-10', fileUrl: '/docs/pan.pdf' },
    {
      type: 'cancelled_cheque',
      label: 'Cancelled Cheque',
      uploadedAt: '2025-03-12',
      fileUrl: '/docs/cheque.pdf',
    },
  ]
}

// ─── INITIAL_VENDORS ────────────────────────────────────────────────────────
// 4 suppliers + 3 subcontractors = 7 vendors, all scoped to the KRR-P3 project.

export const INITIAL_VENDORS: Vendor[] = [
  // ─── Suppliers (V-001 … V-004) — migrated from src/data/seed/admin.ts ────
  {
    id: 'V-001',
    projectId: KRR_PROJECT_ID,
    category: 'supplier',
    name: 'Udaipur Cement Ltd',
    tradeName: 'Udaipur OPC 53',
    status: 'active',
    rating: 'A',
    pan: '123456789',
    gst: 'N/A (Nepal)',
    contactPerson: 'Rajesh Makhim',
    phone: '+977-1-4101234',
    email: 'sales@udaipurcement.com.np',
    address: 'Industrial Estate, Balaju, Kathmandu',
    bank: {
      accountName: 'Udaipur Cement Ltd',
      accountNo: '01234567890123',
      bankName: 'Nepal Investment Bank',
      branch: 'Balazu',
      ifsc: 'NIBLNPKT',
    },
    paymentTerms: {
      creditDays: 30,
      advancePct: 0,
      retentionPct: 0,
      tdsSection: '194C',
      tdsRate: 1,
    },
    docs: supplierDocs(),
    materialsSupplied: [mat('M-CEM-OPC', 'Udaipur OPC 53')],
    createdAt: '2025-04-12T00:00:00Z',
    updatedAt: '2026-07-15T00:00:00Z',
  },
  {
    id: 'V-002',
    projectId: KRR_PROJECT_ID,
    category: 'supplier',
    name: 'Shivam Cement Pvt Ltd',
    tradeName: 'Shivam OPC',
    status: 'active',
    rating: 'A-',
    pan: '987654321',
    gst: 'N/A',
    contactPerson: 'Anjana Shrestha',
    phone: '+977-1-4225678',
    email: 'orders@shivamcement.com.np',
    address: 'Hetauda Industrial Estate, Makwanpur',
    bank: {
      accountName: 'Shivam Cement Pvt Ltd',
      accountNo: '09876543210987',
      bankName: 'Global IME Bank',
      branch: 'Hetauda',
      ifsc: 'GLBBNPKA',
    },
    paymentTerms: {
      creditDays: 21,
      advancePct: 10,
      retentionPct: 0,
      tdsSection: '194C',
      tdsRate: 1,
    },
    docs: supplierDocs(),
    materialsSupplied: [mat('M-CEM-OPC', 'Shivam OPC')],
    createdAt: '2025-04-18T00:00:00Z',
    updatedAt: '2026-07-12T00:00:00Z',
  },
  {
    id: 'V-003',
    projectId: KRR_PROJECT_ID,
    category: 'supplier',
    name: 'Pashupati Steel Industries',
    tradeName: 'Pashupati TMT',
    status: 'active',
    rating: 'A',
    pan: '555666777',
    gst: 'N/A',
    contactPerson: 'Suman Karki',
    phone: '+977-1-4439876',
    email: 'sales@pashupatisteel.com.np',
    address: 'Birgunj-12, Parsa',
    bank: {
      accountName: 'Pashupati Steel Industries',
      accountNo: '11223344556677',
      bankName: 'Standard Chartered Bank Nepal',
      branch: 'Birgunj',
      ifsc: 'SCBLNPKA',
    },
    paymentTerms: {
      creditDays: 45,
      advancePct: 0,
      retentionPct: 0,
      tdsSection: '194C',
      tdsRate: 1,
    },
    docs: supplierDocs(),
    materialsSupplied: [mat('M-STEEL-TMT16', 'Pashupati TMT')],
    createdAt: '2025-04-22T00:00:00Z',
    updatedAt: '2026-07-18T00:00:00Z',
  },
  {
    id: 'V-004',
    projectId: KRR_PROJECT_ID,
    category: 'supplier',
    name: 'Trishuli Sand Suppliers',
    tradeName: '—',
    status: 'active',
    rating: 'B+',
    pan: '111222333',
    gst: 'N/A',
    contactPerson: 'Bishnu Tamang',
    phone: '+977-9841234567',
    email: 'trishulisand@gmail.com',
    address: 'Trishuli, Nuwakot',
    bank: {
      accountName: 'Trishuli Sand Suppliers',
      accountNo: '99887766554433',
      bankName: 'Rastriya Banijya Bank',
      branch: 'Trishuli',
      ifsc: 'RBBANPKA',
    },
    paymentTerms: {
      creditDays: 14,
      advancePct: 0,
      retentionPct: 0,
      tdsSection: '194C',
      tdsRate: 1,
    },
    docs: supplierDocs(),
    materialsSupplied: [mat('M-SAND-R')],
    createdAt: '2025-05-02T00:00:00Z',
    updatedAt: '2026-07-10T00:00:00Z',
  },

  // ─── Subcontractors (SC-01 … SC-03) — migrated from INITIAL_SCS ──────────
  // Each SC mirrors the legacy subcontractors row 1-to-1 (items → workItems,
  // materialIssues, materialReturns, consumables, customDeductibles,
  // assignedTasks, ncrCount, incidents all preserved verbatim) and gains
  // bank + paymentTerms + docs as new unified fields.
  {
    id: 'SC-01',
    projectId: KRR_PROJECT_ID,
    category: 'subcontractor',
    name: 'M/S Lama Constructions',
    tradeName: 'Lama Constructions',
    status: 'active',
    rating: 'A',
    pan: '123456789',
    gst: 'N/A',
    contactPerson: 'Tenzin Lama',
    phone: '+977-9851043210',
    email: 'lama.constructions@gmail.com',
    address: 'Kapan-7, Kathmandu',
    bank: {
      accountName: 'M/S Lama Constructions',
      accountNo: '22334455667788',
      bankName: 'Nepal Bank Limited',
      branch: 'Kapan',
      ifsc: 'NBLNPKA',
    },
    paymentTerms: {
      creditDays: 30,
      advancePct: 10,
      retentionPct: 5,
      tdsSection: '194C',
      tdsRate: 1.5,
    },
    docs: scDocs('2027-03-15', '2026-12-31'),
    // SC-specific
    scope: INITIAL_SCS[0].scope,
    agreementValue: INITIAL_SCS[0].agreementValue,
    advancePaid: INITIAL_SCS[0].advancePaid,
    reworkCost: INITIAL_SCS[0].reworkCost,
    isTunneling: INITIAL_SCS[0].isTunneling,
    // SC operational data — verbatim copy
    workItems: INITIAL_SCS[0].items,
    materialIssues: INITIAL_SCS[0].materialIssues,
    materialReturns: INITIAL_SCS[0].materialReturns,
    consumables: INITIAL_SCS[0].consumables,
    customDeductibles: INITIAL_SCS[0].customDeductibles,
    assignedTasks: INITIAL_SCS[0].assignedTasks,
    ncrCount: INITIAL_SCS[0].ncrCount,
    incidents: INITIAL_SCS[0].incidents,
    createdAt: '2025-03-10T00:00:00Z',
    updatedAt: '2026-07-28T00:00:00Z',
  },
  {
    id: 'SC-02',
    projectId: KRR_PROJECT_ID,
    category: 'subcontractor',
    name: 'Shrestha Steel Works',
    tradeName: 'Shrestha Steel Works',
    status: 'active',
    rating: 'A-',
    pan: '987654321',
    gst: 'N/A',
    contactPerson: 'Kamal Shrestha',
    phone: '+977-9841155667',
    email: 'shrestha.steel@gmail.com',
    address: 'Bhaktapur-9, Sallaghari',
    bank: {
      accountName: 'Shrestha Steel Works',
      accountNo: '55667788990011',
      bankName: 'Everest Bank Nepal',
      branch: 'Bhaktapur',
      ifsc: 'EVBLNPKA',
    },
    paymentTerms: {
      creditDays: 21,
      advancePct: 10,
      retentionPct: 5,
      tdsSection: '194C',
      tdsRate: 1.5,
    },
    docs: scDocs('2026-11-30', '2027-01-15'),
    // SC-specific
    scope: INITIAL_SCS[1].scope,
    agreementValue: INITIAL_SCS[1].agreementValue,
    advancePaid: INITIAL_SCS[1].advancePaid,
    reworkCost: INITIAL_SCS[1].reworkCost,
    isTunneling: INITIAL_SCS[1].isTunneling,
    // SC operational data — verbatim copy
    workItems: INITIAL_SCS[1].items,
    materialIssues: INITIAL_SCS[1].materialIssues,
    materialReturns: INITIAL_SCS[1].materialReturns,
    consumables: INITIAL_SCS[1].consumables,
    customDeductibles: INITIAL_SCS[1].customDeductibles,
    assignedTasks: INITIAL_SCS[1].assignedTasks,
    ncrCount: INITIAL_SCS[1].ncrCount,
    incidents: INITIAL_SCS[1].incidents,
    createdAt: '2025-03-15T00:00:00Z',
    updatedAt: '2026-07-18T00:00:00Z',
  },
  {
    id: 'SC-03',
    projectId: KRR_PROJECT_ID,
    category: 'subcontractor',
    name: 'Himal Tunneling Co.',
    tradeName: 'Himal Tunneling Co.',
    status: 'active',
    rating: 'A',
    pan: '555666777',
    gst: 'N/A',
    contactPerson: 'Dawa Sherpa',
    phone: '+977-9860011223',
    email: 'himal.tunneling@gmail.com',
    address: 'Suryabinayak-3, Bhaktapur',
    bank: {
      accountName: 'Himal Tunneling Co.',
      accountNo: '77889900112233',
      bankName: 'Prime Commercial Bank',
      branch: 'Suryabinayak',
      ifsc: 'PCBLNPKA',
    },
    paymentTerms: {
      creditDays: 30,
      advancePct: 10,
      retentionPct: 5,
      tdsSection: '194C',
      tdsRate: 1.5,
    },
    docs: scDocs('2027-06-30', '2026-10-12'),
    // SC-specific
    scope: INITIAL_SCS[2].scope,
    agreementValue: INITIAL_SCS[2].agreementValue,
    advancePaid: INITIAL_SCS[2].advancePaid,
    reworkCost: INITIAL_SCS[2].reworkCost,
    isTunneling: INITIAL_SCS[2].isTunneling,
    // SC operational data — verbatim copy
    workItems: INITIAL_SCS[2].items,
    materialIssues: INITIAL_SCS[2].materialIssues,
    materialReturns: INITIAL_SCS[2].materialReturns,
    consumables: INITIAL_SCS[2].consumables,
    customDeductibles: INITIAL_SCS[2].customDeductibles,
    assignedTasks: INITIAL_SCS[2].assignedTasks,
    ncrCount: INITIAL_SCS[2].ncrCount,
    incidents: INITIAL_SCS[2].incidents,
    createdAt: '2025-02-28T00:00:00Z',
    updatedAt: '2026-07-15T00:00:00Z',
  },
]

// ─── INITIAL_LOCATIONS ──────────────────────────────────────────────────────
// Physical work-face / asset locations for the Kathmandu Ring Road — Package
// 3 project. Mix of:
//   • Bridge structure — piers + abutment + deck spans (assigned to SCs)
//   • Approach road — chainage stretches
//   • Site campus — batch plant + site office
//
// `sortOrder` controls the left-to-right order in the Locations panel of the
// SC daily-face view. Closed locations sort last within their group.

export const INITIAL_LOCATIONS: ProjectLocation[] = [
  // ─── Bridge Structure ──────────────────────────────────────────────────
  {
    id: 'LOC-PIER-1',
    projectId: KRR_PROJECT_ID,
    name: 'Pier 1',
    group: 'Bridge Structure',
    description: 'Central pier — foundation poured, shaft at 12m of 18m',
    status: 'active',
    assignedScId: 'SC-01',
    sortOrder: 1,
    createdAt: '2025-04-01T00:00:00Z',
    updatedAt: '2026-07-25T00:00:00Z',
  },
  {
    id: 'LOC-PIER-2',
    projectId: KRR_PROJECT_ID,
    name: 'Pier 2',
    group: 'Bridge Structure',
    description: 'Eastern pier — shaft rebar in progress',
    status: 'active',
    assignedScId: 'SC-02',
    sortOrder: 2,
    createdAt: '2025-04-05T00:00:00Z',
    updatedAt: '2026-07-22T00:00:00Z',
  },
  {
    id: 'LOC-PIER-3',
    projectId: KRR_PROJECT_ID,
    name: 'Pier 3',
    group: 'Bridge Structure',
    description: 'Western pier — foundation excavation complete',
    status: 'active',
    assignedScId: 'SC-01',
    sortOrder: 3,
    createdAt: '2025-04-10T00:00:00Z',
    updatedAt: '2026-07-20T00:00:00Z',
  },
  {
    id: 'LOC-ABUT-A',
    projectId: KRR_PROJECT_ID,
    name: 'Abutment A',
    group: 'Bridge Structure',
    description: 'Eastern abutment — backfill staged after deck pour',
    status: 'active',
    sortOrder: 4,
    createdAt: '2025-04-12T00:00:00Z',
    updatedAt: '2026-07-18T00:00:00Z',
  },
  {
    id: 'LOC-DECK-1-3',
    projectId: KRR_PROJECT_ID,
    name: 'Deck Span 1-3',
    group: 'Superstructure',
    description: 'Three-span precast girder deck between Pier 1 and Abutment A',
    status: 'active',
    assignedScId: 'SC-03',
    sortOrder: 5,
    createdAt: '2025-05-02T00:00:00Z',
    updatedAt: '2026-07-15T00:00:00Z',
  },

  // ─── Approach Road ────────────────────────────────────────────────────
  {
    id: 'LOC-CH-0-200',
    projectId: KRR_PROJECT_ID,
    name: '0+000 to 0+200',
    group: 'Approach Road',
    description: 'Eastern approach — subgrade + DBM 50mm underway',
    status: 'active',
    sortOrder: 6,
    createdAt: '2025-05-10T00:00:00Z',
    updatedAt: '2026-07-12T00:00:00Z',
  },
  {
    id: 'LOC-CH-200-400',
    projectId: KRR_PROJECT_ID,
    name: '0+200 to 0+400',
    group: 'Approach Road',
    description: 'Eastern approach — completed and handed over to traffic',
    status: 'closed',
    sortOrder: 7,
    createdAt: '2025-05-10T00:00:00Z',
    updatedAt: '2026-06-30T00:00:00Z',
  },

  // ─── Site Campus ──────────────────────────────────────────────────────
  {
    id: 'LOC-BATCH-PLANT',
    projectId: KRR_PROJECT_ID,
    name: 'Batch Plant',
    group: 'Site Campus',
    description: '30 cum/hr batching plant — main concrete supply for piers',
    status: 'active',
    sortOrder: 8,
    createdAt: '2025-03-20T00:00:00Z',
    updatedAt: '2026-07-28T00:00:00Z',
  },
  {
    id: 'LOC-SITE-OFFICE',
    projectId: KRR_PROJECT_ID,
    name: 'Site Office',
    group: 'Site Campus',
    description: 'PM office, drawing room, store, first-aid — main site campus',
    status: 'active',
    sortOrder: 9,
    createdAt: '2025-03-15T00:00:00Z',
    updatedAt: '2026-07-28T00:00:00Z',
  },
]
