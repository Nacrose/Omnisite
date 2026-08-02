import { createCrudHandler } from '@/lib/crud-handler'
import { vendorSchema } from '@/lib/validation'

// GET /api/vendors — list vendors (no pagination; ordered by name).
// POST /api/vendors — upsert a vendor via upsertWithAudit. Write access is
// gated by api-auth.ts: PM-only for subcontractors/consultants/labour,
// PM-or-SITE_ENGINEER for suppliers (see migration 00000000000010 §8).
// PII fields (vendors.pan / .gst) are masked in the audit diff by the
// upsert_with_audit() Postgres function (migration 00000000000009).
// DELETE /api/vendors?id=... — delete via deleteWithAudit.
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'vendors',
  schema: vendorSchema,
  orderField: 'name',
})
