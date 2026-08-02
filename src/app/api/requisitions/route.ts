import { createCrudHandler } from '@/lib/crud-handler'
import { requisitionSchema } from '@/lib/validation'

// GET /api/requisitions — list requisitions (no pagination; ordered by id).
// POST /api/requisitions — upsert a requisition via upsertWithAudit.
// DELETE /api/requisitions?id=... — delete via deleteWithAudit (pre-flight RLS read).
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'requisitions',
  schema: requisitionSchema,
  orderField: 'id',
})
