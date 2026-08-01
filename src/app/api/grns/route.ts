import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, requireRole, verifyProjectAccess, isProjectScopedTable } from '@/lib/api-auth'
import { upsertWithAudit, deleteWithAudit } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { logDbError } from '@/lib/safe-log'
import { validateBody } from '@/lib/validation'

// GRN (Goods Received Note) — 3-way match (PO vs GRN vs Invoice)
const grnSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  po_id: z.string().min(1),
  vendor: z.string().min(1),
  po_qty: z.number().min(0).default(0),
  grn_qty: z.number().min(0).default(0),
  invoice_qty: z.number().min(0).default(0),
  rate: z.number().min(0).default(0),
  pay_status: z.enum(['Cleared', 'Hold', 'Partial Hold', 'Awaiting GRN']).default('Awaiting GRN'),
  material_code: z.string().optional(),
  date: z.string().optional(),
})

// GET /api/grns — fetch GRNs, optionally filtered by project_id
export async function GET(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  const userClient = createUserClient(user.accessToken)
  let query = userClient.from('grns').select('*')
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query.order('date', { ascending: false })

  if (error) {
    logDbError('grns', 'GET', error, { userId: user.id })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

// POST /api/grns — create or update a GRN
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roleError = requireRole(user, 'grns')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { data, error: validationError } = validateBody(grnSchema, await req.json())
  if (validationError) return validationError

  const userClient = createUserClient(user.accessToken)
  const { data: existing } = await userClient.from('grns').select('*').eq('id', data.id).single()

  // For INSERTs (no existing row), verify the user has access to the
  // target project_id. upsertWithAudit uses the service-role client
  // which bypasses RLS, so this explicit check is mandatory.
  if (!existing && isProjectScopedTable('grns')) {
    const projectId = (data as Record<string, unknown>).project_id as string | undefined
    const hasAccess = await verifyProjectAccess(userClient, user.id, projectId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden — no access to this project' }, { status: 403 })
    }
  }

  // Transactional upsert + audit log via service-role client.
  // Replaces the prior insert/update branch + fire-and-forget logAudit pattern.
  const { data: result, error } = await upsertWithAudit(
    'grns',
    data as Record<string, unknown>,
    'id',
    user.id,
    existing ? 'UPDATE' : 'INSERT',
    existing as Record<string, unknown> | null
  )

  if (error || !result) {
    logDbError('grns', 'POST', error || 'no data returned', {
      recordId: data.id as string,
      userId: user.id,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(result, { status: existing ? 200 : 201 })
}

// DELETE /api/grns?id=GRN-XXX
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roleError = requireRole(user, 'grns')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Pre-flight read via the user-scoped client (RLS-gated) — proves the
  // user has access to this row before we delete it via the service client.
  const userClient = createUserClient(user.accessToken)
  const { data: existing } = await userClient.from('grns').select('id').eq('id', id).limit(1)

  if (!existing || existing.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Transactional delete + audit log via service-role client.
  const { deleted, error } = await deleteWithAudit('grns', id, 'id', user.id)

  if (error) {
    logDbError('grns', 'DELETE', error, { recordId: id, userId: user.id })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
