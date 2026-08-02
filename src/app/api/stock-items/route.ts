import { createCrudHandler } from '@/lib/crud-handler'
import { stockItemSchema } from '@/lib/validation'

// GET /api/stock-items — list stock (no pagination; ordered by name).
// Returns [] instead of null when the table is empty.
// POST /api/stock-items — upsert via upsertWithAudit; 201 on INSERT, 200 on UPDATE.
// DELETE /api/stock-items?code=... — delete via deleteWithAudit (pre-flight RLS read).
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'stock_items',
  schema: stockItemSchema,
  pk: 'code',
  orderField: 'name',
  emptyArrayOnEmpty: true,
  status201OnInsert: true,
})
