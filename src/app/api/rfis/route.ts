import { createCrudHandler } from '@/lib/crud-handler'
import { rfiSchema } from '@/lib/validation'

// GET /api/rfis — list RFIs for the active project (cursor pagination on `number`).
// POST /api/rfis — upsert an RFI via upsertWithAudit. Write access is gated by
//                  api-auth.ts: PM + Site Engineer. Storekeeper + Foreman are
//                  read-only (they need visibility but don't author RFIs).
// DELETE /api/rfis?id=... — delete via deleteWithAudit.
//
// PII: none. RFI fields are project collaboration content, not personal data.
// Migration 28 RLS policies enforce per-project read + PM/SE write.
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'rfis',
  schema: rfiSchema,
  // Sort by RFI number descending so the most recent RFI (highest number)
  // appears first in the register — matches the seed ordering (RFI-068 above
  // RFI-067 above RFI-066).
  cursorField: 'number',
  orderField: 'number',
  orderAscending: false,
})
