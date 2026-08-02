// ─── Unified Vendor types ───────────────────────────────────────────────────
//
// Single type tree covering suppliers, subcontractors, consultants, and labour
// gangs — the four categories stored in the `vendors` table. The shape mirrors
// the DB columns in supabase/migrations/00000000000010_vendors_and_locations.sql
// 1-to-1, with snake_case DB columns mapped to camelCase TS fields.
//
// Subcontractor-only payload (work items, material issues, consumables, etc.)
// reuses the existing ScItem / MaterialIssue / MaterialReturn / ConsumableIssue
// / CustomDeductible contracts from the subcontractor module so the SC UI can
// consume the unified Vendor record without a type adapter.
//
// ─── Naming note ────────────────────────────────────────────────────────────
// `ProjectLocation` uses `group` (DB column `group_name`) and `assignedScId`
// (DB column `assigned_vendor_id`) — the field names that the pre-existing
// admin/locations-tab.tsx and admin/types.ts were already wired to. The DB
// columns keep the more general `group_name` / `assigned_vendor_id` names so
// the table can later hold non-SC vendor assignments (e.g., a supplier
// assigned to a Batch Plant location); the TS alias `assignedScId` is the
// narrow-but-stable name the UI already uses.
//
// `VendorRecord` is exported as a type alias for `Vendor` so existing imports
// in admin/types.ts keep resolving. New code should prefer `Vendor`.

import type {
  ConsumableIssue,
  CustomDeductible,
  MaterialIssue,
  MaterialReturn,
  ScItem,
} from '@/components/modules/vendors/types'

export type VendorCategory = 'supplier' | 'subcontractor' | 'consultant' | 'labour'
export type VendorStatus = 'active' | 'closed' | 'blacklisted'

/** Lifecycle status of a project location. */
export type LocationStatus = 'active' | 'closed'

/** Compliance document attached to a vendor (insurance, labour licence, etc.). */
export interface ComplianceDoc {
  type:
    | 'insurance'
    | 'labour_licence'
    | 'gst_cert'
    | 'pan_card'
    | 'esi_pf'
    | 'work_order'
    | 'cancelled_cheque'
    | 'other'
  label: string
  expiryDate?: string
  fileUrl?: string
  uploadedAt?: string
  notes?: string
}

/** A line in a supplier's supply catalog (rate catalog for materials they sell). */
export interface SuppliedMaterial {
  code: string
  name: string
  brand?: string
  rate: number
  uom: string
  lastUpdated?: string
}

/** Banking details for vendor payments. */
export interface VendorBankDetails {
  accountName?: string
  accountNo?: string
  bankName?: string
  branch?: string
  ifsc?: string
}

/** Payment terms applied to vendor invoices. */
export interface VendorPaymentTerms {
  creditDays: number
  advancePct: number
  retentionPct: number
  tdsSection?: string
  tdsRate: number
}

/**
 * Unified vendor record — covers all four categories.
 *
 * For `category = 'supplier'`, the supplier-specific fields are populated
 * (materialsSupplied, contact, banking, paymentTerms, docs).
 *
 * For `category = 'subcontractor'`, the SC-specific fields are populated
 * (workItems, materialIssues, materialReturns, consumables,
 * customDeductibles, assignedTasks, scope, agreementValue, advancePaid,
 * reworkCost, isTunneling, ncrCount, incidents). Bank + contact + docs
 * still apply.
 */
export interface Vendor {
  id: string
  projectId?: string
  category: VendorCategory
  name: string
  tradeName?: string
  status: VendorStatus
  rating: string

  // Legal
  pan?: string
  gst?: string
  vatNo?: string

  // Contact
  contactPerson?: string
  phone?: string
  email?: string
  address?: string

  // Banking (flat fields — mirror the `vendors` DB columns 1-to-1)
  bankAccountName?: string
  bankAccountNo?: string
  bankName?: string
  bankBranch?: string
  bankIfsc?: string

  // Payment terms (flat fields — mirror the `vendors` DB columns 1-to-1)
  creditDays?: number
  advancePct?: number
  retentionPct?: number
  tdsSection?: string
  tdsRate?: number

  // Compliance
  docs?: ComplianceDoc[]

  // Supply catalog (suppliers)
  materialsSupplied?: SuppliedMaterial[]

  // Work items (subcontractors) — reuse the SC module's ScItem contract.
  workItems?: ScItem[]

  // SC-specific
  scope?: string
  agreementValue?: number
  advancePaid?: number
  /** Cumulative advance amount already recovered across prior bills (SC only).
   *  Tracked in vendor state because we don't have a bills table yet — each
   *  `Generate Running Bill` action adds the current bill's recovery to this
   *  running total, capped at `advancePaid`. Persisted via localStorage
   *  fallback; not yet a DB column. */
  advanceRecovered?: number
  reworkCost?: number
  isTunneling?: boolean

  // SC operational data — same shapes as the existing subcontractors table.
  materialIssues?: MaterialIssue[]
  materialReturns?: MaterialReturn[]
  consumables?: ConsumableIssue[]
  customDeductibles?: CustomDeductible[]
  assignedTasks?: {
    taskId: string
    taskName: string
    progress: number
    baseline: string
    status: string
  }[]
  ncrCount?: number
  incidents?: number

  createdAt?: string
  updatedAt?: string
}

/**
 * Alias for `Vendor` kept for backward compatibility with the pre-wired
 * admin module imports (admin/types.ts and admin/locations-tab.tsx both
 * import `VendorRecord`). New code should prefer `Vendor`.
 */
export type VendorRecord = Vendor

/**
 * A physical work-face or asset location scoped to a project (bridge pier,
 * road chainage stretch, site campus area, batch plant, etc.).
 *
 * Locations can be assigned to a vendor (typically a subcontractor) so the
 * SC module's daily-face view can filter by "what's happening at Pier 3
 * right now".
 */
export interface ProjectLocation {
  id: string
  projectId?: string
  name: string
  /** Logical grouping (Bridge Structure, Approach Road, Site Campus, …). */
  group: string
  description?: string
  status: LocationStatus
  /** FK to vendors.id (typically a subcontractor). */
  assignedScId?: string
  /** Sort order within the project (lower = higher in the list). Optional so
   *  the New Location form can omit it and the store/DB default of 0 applies. */
  sortOrder?: number
  createdAt?: string
  updatedAt?: string
}
