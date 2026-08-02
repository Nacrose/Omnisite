import { createCrudHandler } from '@/lib/crud-handler'
import { cbsNodeSchema } from '@/lib/validation'

// GET /api/cbs-nodes — list CBS nodes (no pagination; ordered by created_at).
// POST /api/cbs-nodes — upsert a CBS node via upsertWithAudit (PM-only).
// DELETE /api/cbs-nodes?code=... — accepts ?id= as a legacy alias for ?code=.
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'cbs_nodes',
  schema: cbsNodeSchema,
  pk: 'code',
  orderField: 'created_at',
  acceptLegacyIdParam: true,
})
