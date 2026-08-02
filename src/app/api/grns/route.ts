import { createCrudHandler } from '@/lib/crud-handler'
import { grnSchema } from '@/lib/validation'

// GET /api/grns — list GRNs (no pagination; newest-first by date).
// Returns [] instead of null when the table is empty.
// POST /api/grns — upsert a GRN via upsertWithAudit; 201 on INSERT, 200 on UPDATE.
// DELETE /api/grns?id=... — delete via deleteWithAudit (pre-flight RLS read).
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'grns',
  schema: grnSchema,
  orderField: 'date',
  orderAscending: false,
  emptyArrayOnEmpty: true,
  status201OnInsert: true,
})
