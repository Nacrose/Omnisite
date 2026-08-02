import { createCrudHandler } from '@/lib/crud-handler'
import { taskSchema } from '@/lib/validation'

// GET /api/tasks — cursor pagination on `sort_order` (INTEGER, so the cursor
// is converted via Number() before the .gt() filter).
// POST /api/tasks — upsert a task via upsertWithAudit.
// DELETE /api/tasks?id=... — delete via deleteWithAudit (pre-flight RLS read).
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'tasks',
  schema: taskSchema,
  cursorField: 'sort_order',
  orderField: 'sort_order',
  cursorType: 'number',
})
