import { createCrudHandler } from '@/lib/crud-handler'
import { notificationSchema } from '@/lib/validation'

// GET /api/notifications — list notifications for the current user.
//   RLS (migration 30) filters to:
//     - rows where user_id = auth.uid() (addressed directly)
//     - rows where user_id IS NULL AND project_id matches a user_projects
//       membership for the current user (broadcast to project members)
//   Cursor pagination on created_at DESC so newest notifications appear
//   first in the bell dropdown.
// POST /api/notifications — upsert (used by the bell to mark-as-read).
//   Write access: all authenticated roles (gated at RLS to user_id =
//   auth.uid() — a user can only UPDATE their own rows). The createCrudHandler
//   role check is permissive here; RLS is the real gate.
// DELETE /api/notifications?id=... — PM-only admin cleanup.
//
// The cron route (/api/cron/notifications-scan) inserts new rows via the
// service role, bypassing RLS. Users never insert directly.
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'notifications',
  schema: notificationSchema,
  cursorField: 'created_at',
  orderField: 'created_at',
  orderAscending: false,
})
