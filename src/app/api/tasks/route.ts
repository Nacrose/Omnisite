import { createCrudHandler } from '@/lib/crud-handler'
import { taskSchema } from '@/lib/validation'

// GET /api/tasks — cursor pagination on `id` (TEXT, unique). Previously this
// used `sort_order` (INTEGER) as the cursor, but the client never sends a
// sort_order — every row lands with the column default of 0 — so page 2
// (cursor=0, gt(0)) returned zero rows once the table grew past one page.
// Paginating on `id` is monotonic and unique, so the limit+1 / nextCursor
// trick works regardless of how many tasks share sort_order=0.
//
// NOTE: `sort_order` is a column on the tasks table (with column default 0)
// but is NOT currently written by the scheduler module — the Task type has
// no `sortOrder` field, and the fieldMap in scheduler/index.tsx has no
// `sortOrder: 'sort_order'` entry. The column exists for forward-compat
// (a future outline-drag-and-drop feature will populate it). The previous
// comment here claimed the fieldMap wrote it, which was wrong (audit S12).
// Client-side outline ordering uses the array order of `tasksWithCpm`
// directly, which is preserved through `rebuildTreeFromRows` from the
// row order returned by this route (alphabetical by id).
//
// POST /api/tasks — upsert a task via upsertWithAudit.
// DELETE /api/tasks?id=... — delete via deleteWithAudit (pre-flight RLS read).
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'tasks',
  schema: taskSchema,
  cursorField: 'id',
  orderField: 'id',
})
