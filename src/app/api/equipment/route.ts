import { createCrudHandler } from '@/lib/crud-handler'
import { equipmentSchema } from '@/lib/validation'

// GET /api/equipment — list equipment (no pagination; ordered by created_at).
// POST /api/equipment — upsert an equipment record via upsertWithAudit.
// DELETE /api/equipment?id=... — delete via deleteWithAudit (pre-flight RLS read).
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'equipment',
  schema: equipmentSchema,
  orderField: 'created_at',
})
