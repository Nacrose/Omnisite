import { createCrudHandler } from '@/lib/crud-handler'
import { subcontractorSchema } from '@/lib/validation'

// GET /api/subcontractors — list subcontractors (no pagination; ordered by name).
// POST /api/subcontractors — upsert a subcontractor via upsertWithAudit.
// PII fields (subcontractors.pan / .gst) are masked in the audit diff by the
// upsert_with_audit() Postgres function (see migration 00000000000009).
// DELETE /api/subcontractors?id=... — delete via deleteWithAudit (PM-only).
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'subcontractors',
  schema: subcontractorSchema,
  orderField: 'name',
})
