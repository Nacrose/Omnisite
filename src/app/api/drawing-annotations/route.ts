import { createCrudHandler } from '@/lib/crud-handler'
import { drawingAnnotationSchema } from '@/lib/validation'

// GET /api/drawing-annotations — list markups (filter by project_id / drawing_id).
// POST /api/drawing-annotations — upsert an annotation via upsertWithAudit.
//   Write access is gated by api-auth.ts: PM or SITE_ENGINEER (redlines are
//   contractual records — field teams can read but not annotate).
// DELETE /api/drawing-annotations?id=... — delete via deleteWithAudit.
//
// The original PDF file is NEVER modified by this route — markups are stored
// as separate JSON rows (fabric_data column) keyed by drawing_id + page_number.
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'drawing_annotations',
  schema: drawingAnnotationSchema,
  cursorField: 'created_at',
  orderField: 'created_at',
})
