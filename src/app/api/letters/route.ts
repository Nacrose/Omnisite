import { createCrudHandler } from '@/lib/crud-handler'
import { letterSchema } from '@/lib/validation'

// GET /api/letters — cursor pagination on `date` (string).
// POST /api/letters — upsert a letter via upsertWithAudit.
// DELETE /api/letters?id=... — delete via deleteWithAudit (pre-flight RLS read).
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'letters',
  schema: letterSchema,
  cursorField: 'date',
  orderField: 'date',
})
