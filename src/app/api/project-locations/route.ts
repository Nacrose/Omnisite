import { createCrudHandler } from '@/lib/crud-handler'
import { projectLocationSchema } from '@/lib/validation'

// GET /api/project-locations — list project locations (ordered by sort_order
// then created_at; no pagination). Accepts ?project_id= to filter by project.
// POST /api/project-locations — upsert via upsertWithAudit. Write access is
// gated by api-auth.ts: PM or SITE_ENGINEER (field setup is done by engineers
// on site, not just PMs — see migration 00000000000010 §6/§7).
// DELETE /api/project-locations?id=... — delete via deleteWithAudit.
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'project_locations',
  schema: projectLocationSchema,
  orderField: 'sort_order',
})
