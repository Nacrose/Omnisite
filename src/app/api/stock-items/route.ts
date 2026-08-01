import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, requireRole, verifyProjectAccess, isProjectScopedTable } from '@/lib/api-auth'
import { upsertWithAudit, deleteWithAudit } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { logDbError } from '@/lib/safe-log'
import { validateBody } from '@/lib/validation'

// Stock items — live inventory
const stockItemSchema = z.object({
  code: z.string().min(1),
  project_id: z.string().uuid().optional(),
  name: z.string().min(1),
  on_hand: z.number().min(0).default(0),
  reserved: z.number().min(0).default(0),
  avg_cost: z.number().min(0).default(0),
  warehouse: z.string().optional(),
})

// GET /api/stock-items — fetch stock, optionally filtered by project_id
export async function GET(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  const userClient = createUserClient(user.accessToken)
  let query = userClient.from('stock_items').select('*')
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query.order('name', { ascending: true })

  if (error) {
    logDbError('stock_items', 'GET', error, { userId: user.id })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

// POST /api/stock-items — create or update a stock item
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roleError = requireRole(user, 'stock_items')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { data, error: validationError } = validateBody(stockItemSchema, await req.json())
  if (validationError) return validationError

  const userClient = createUserClient(user.accessToken)
  const { data: existing } = await userClient
    .from('stock_items')
    .select('*')
    .eq('code', data.code)
    .single()

  // For INSERTs (no existing row), verify the user has access to the
  // target project_id. upsertWithAudit uses the service-role client
  // which bypasses RLS, so this explicit check is mandatory.
  if (!existing && isProjectScopedTable('stock_items')) {
    const projectId = (data as Record<string, unknown>).project_id as string | undefined
    const hasAccess = await verifyProjectAccess(userClient, user.id, projectId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden — no access to this project' }, { status: 403 })
    }
  }

  // Transactional upsert + audit log via service-role client.
  const { data: result, error } = await upsertWithAudit(
    'stock_items',
    data as Record<string, unknown>,
    'code',
    user.id,
    existing ? 'UPDATE' : 'INSERT',
    existing as Record<string, unknown> | null
  )

  if (error || !result) {
    logDbError('stock_items', 'POST', error || 'no data returned', {
      recordId: data.code as string,
      userId: user.id,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(result, { status: existing ? 200 : 201 })
}

// DELETE /api/stock-items?code=M-CEM-OPC
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roleError = requireRole(user, 'stock_items')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })

  // Pre-flight read via the user-scoped client (RLS-gated) — proves the
  // user has access to this row before we delete it via the service client.
  const userClient = createUserClient(user.accessToken)
  const { data: existing } = await userClient
    .from('stock_items')
    .select('code')
    .eq('code', code)
    .limit(1)

  if (!existing || existing.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Transactional delete + audit log via service-role client.
  const { deleted, error } = await deleteWithAudit('stock_items', code, 'code', user.id)

  if (error) {
    logDbError('stock_items', 'DELETE', error, { recordId: code, userId: user.id })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
