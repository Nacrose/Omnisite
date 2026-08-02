import { createCrudHandler } from '@/lib/crud-handler'
import { purchaseOrderSchema } from '@/lib/validation'

// GET /api/purchase-orders — list POs (no pagination; newest-first by date).
// POST /api/purchase-orders — upsert a PO via upsertWithAudit.
// DELETE /api/purchase-orders?id=... — delete via deleteWithAudit (pre-flight RLS read).
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'purchase_orders',
  schema: purchaseOrderSchema,
  orderField: 'date',
  orderAscending: false,
})
