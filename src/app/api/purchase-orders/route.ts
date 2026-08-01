import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, requireRole } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateBody } from '@/lib/validation'

// Purchase orders
const purchaseOrderSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  vendor: z.string().min(1),
  date: z.string().optional(),
  value: z.number().min(0).default(0),
  status: z.string().default('Open'),
  items: z.string().optional(), // serialized JSON
  has_grn: z.boolean().default(false),
})

// GET /api/purchase-orders — fetch purchase orders, optionally filtered by project_id
export async function GET(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)
  let query = userClient.from('purchase_orders').select('*')
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query.order('date', { ascending: false })

  if (error) {
    console.error('[API] purchase_orders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  return NextResponse.json(data)
}

// POST /api/purchase-orders — upsert a purchase order
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'purchase_orders')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const rawBody = await req.json()
  const { data: body, error: validationError } = validateBody(purchaseOrderSchema, rawBody)
  if (validationError) return validationError

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)

  // Fetch old values for audit (before the upsert overwrites them).
  const { data: oldData } = body.id
    ? await userClient.from('purchase_orders').select('*').eq('id', body.id).single()
    : { data: null }

  const { data, error } = await userClient
    .from('purchase_orders')
    .upsert(body)
    .select()

  if (error) {
    console.error('[API] purchase_orders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Audit log the mutation (fire-and-forget, uses service-role client).
  logAudit({
    table_name: 'purchase_orders',
    record_id: body.id || data?.[0]?.id || 'unknown',
    action: oldData ? 'UPDATE' : 'INSERT',
    changed_by: user.id,
    changed_fields: oldData ? { old: oldData, new: body } : undefined,
  }).catch(() => {})

  return NextResponse.json(data)
}

// DELETE /api/purchase-orders — delete a purchase order by id
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'purchase_orders')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)
  const { error } = await userClient
    .from('purchase_orders')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[API] purchase_orders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Audit log the deletion.
  logAudit({
    table_name: 'purchase_orders',
    record_id: id,
    action: 'DELETE',
    changed_by: user.id,
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
