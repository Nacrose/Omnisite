import { createCrudHandler } from '@/lib/crud-handler'
import { dsrEntrySchema } from '@/lib/validation'

// GET /api/dsr-entries — cursor pagination on `created_at`.
// POST /api/dsr-entries — upsert a DSR entry via upsertWithAudit.
// DELETE /api/dsr-entries?id=... — delete via deleteWithAudit (pre-flight RLS read).
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'dsr_entries',
  schema: dsrEntrySchema,
  cursorField: 'created_at',
  orderField: 'created_at',
})
