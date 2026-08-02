import { createCrudHandler } from '@/lib/crud-handler'
import { qsItemSchema } from '@/lib/validation'

// GET /api/qs-items — list Q&S items (no pagination; ordered by created_at).
// POST /api/qs-items — upsert a QS item via upsertWithAudit.
// DELETE /api/qs-items?id=... — delete via deleteWithAudit (pre-flight RLS read).
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'qs_items',
  schema: qsItemSchema,
  orderField: 'created_at',
})
