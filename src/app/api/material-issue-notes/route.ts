import { createCrudHandler } from '@/lib/crud-handler'
import { materialIssueNoteSchema } from '@/lib/validation'

// GET /api/material-issue-notes — list MINs for the active project.
// POST /api/material-issue-notes — upsert a MIN via upsertWithAudit.
//   Write access: PM + Site Engineer + Storekeeper. Foreman is read-only.
//   Matches migration 29 RLS.
// DELETE /api/material-issue-notes?id=... — PM or Storekeeper only.
//
// PII: none. MIN fields are operational records (date, task, items, issuer).
//
// Migration 29 RLS policies enforce per-project read + write role gating.
// Stock deduction is intentionally NOT done server-side here — it remains
// an app-level concern in material-reconciliation.ts so the existing variance
// tracking logic continues to work. A future trigger could decrement
// stock_items.on_hand on MIN INSERT, but that's a separate design decision.
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'material_issue_notes',
  schema: materialIssueNoteSchema,
  // Sort by ID descending so the most recent MIN (highest number) appears
  // first in the register — matches the seed ordering (MIN-0042 above 0041).
  cursorField: 'id',
  orderField: 'id',
  orderAscending: false,
})
