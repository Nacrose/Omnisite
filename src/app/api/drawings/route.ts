import { createCrudHandler } from '@/lib/crud-handler'
import { drawingSchema } from '@/lib/validation'

// GET /api/drawings — cursor pagination on `created_at`.
// POST /api/drawings — upsert a drawing via upsertWithAudit.
// DELETE /api/drawings?id=... — delete via deleteWithAudit (pre-flight RLS read).
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'drawings',
  schema: drawingSchema,
  cursorField: 'created_at',
  orderField: 'created_at',
})
