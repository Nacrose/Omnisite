import { createCrudHandler } from '@/lib/crud-handler'
import { boqItemSchema } from '@/lib/validation'

// GET /api/boq — cursor pagination on `code`.
// POST /api/boq — upsert a BOQ item via upsertWithAudit.
// DELETE /api/boq?id=... — delete via deleteWithAudit (pre-flight RLS read).
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'boq_items',
  schema: boqItemSchema,
  cursorField: 'code',
  orderField: 'code',
})
