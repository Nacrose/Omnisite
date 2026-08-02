import { createCrudHandler } from '@/lib/crud-handler'
import { taskSchema } from '@/lib/validation'

// GET /api/tasks — cursor pagination on `id` (TEXT, unique). Previously this
// used `sort_order` (INTEGER) as the cursor, but the client never sends a
// sort_order — every row lands with the column default of 0 — so page 2
// (cursor=0, gt(0)) returned zero rows once the table grew past one page.
// Paginating on `id` is monotonic and unique, so the limit+1 / nextCursor
// trick works regardless of how many tasks share sort_order=0.
//
// `sort_order` is still written via the fieldMap in scheduler/index.tsx
// (sortOrder: 'sort_order') — the column exists and is used for client-side
// outline ordering; it just isn't suitable as a server-side pagination cursor.
//
// POST /api/tasks — upsert a task via upsertWithAudit.
// DELETE /api/tasks?id=... — delete via deleteWithAudit (pre-flight RLS read).
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'tasks',
  schema: taskSchema,
  cursorField: 'id',
  orderField: 'id',
})
