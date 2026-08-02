import { createCrudHandler } from '@/lib/crud-handler'
import { workerSchema } from '@/lib/validation'

// GET /api/workers — list workers (no pagination; ordered by created_at).
// POST /api/workers — upsert a worker via upsertWithAudit. PII fields
// (workers.phone) are masked in the audit diff by the upsert_with_audit()
// Postgres function (see migration 00000000000009).
// DELETE /api/workers?id=... — delete via deleteWithAudit (pre-flight RLS read).
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'workers',
  schema: workerSchema,
  orderField: 'created_at',
})
