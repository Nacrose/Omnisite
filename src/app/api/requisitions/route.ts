import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, requireRole, verifyProjectAccess, isProjectScopedTable } from '@/lib/api-auth'
import { upsertWithAudit, deleteWithAudit } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { logDbError } from '@/lib/safe-log'
import { validateBody } from '@/lib/validation'

// Requisitions
const requisitionSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  item: z.string().min(1),
  uom: z.string().optional(),
  qty: z.number().min(0).default(0),
  status: z.string().default('Open'),
  source: z.string().optional(),
  vendors: z.string().optional(), // serialized JSON
  override_reason: z.string().optional(),
})

// GET /api/requisitions — fetch requisitions, optionally filtered by project_id
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
  let query = userClient.from('requisitions').select('*')
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query.order('id', { ascending: true })

  if (error) {
    logDbError('requisitions', 'GET', error, { userId: user.id })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  return NextResponse.json(data)
}

// POST /api/requisitions — upsert a requisition
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'requisitions')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const rawBody = await req.json()
  const { data: body, error: validationError } = validateBody(requisitionSchema, rawBody)
  if (validationError) return validationError

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)

  // Fetch old values via the user-scoped client (RLS-gated).
  // For UPDATE, this proves the user has read access to the row.
  // For INSERT, verifyProjectAccess below replaces the implicit RLS check
  // that the service-role upsert bypasses.
  const { data: oldData } = body.id
    ? await userClient.from('requisitions').select('*').eq('id', body.id).single()
    : { data: null }

  // For INSERTs (no existing row), verify the user has access to the
  // target project_id. upsertWithAudit uses the service-role client
  // which bypasses RLS, so this explicit check is mandatory.
  if (!oldData && isProjectScopedTable('requisitions')) {
    const projectId = (body as Record<string, unknown>).project_id as string | undefined
    const hasAccess = await verifyProjectAccess(userClient, user.id, projectId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden — no access to this project' }, { status: 403 })
    }
  }

  // Transactional upsert + audit log via service-role client.
  // If either fails, both roll back — the audit trail is never lost.
  const { data, error } = await upsertWithAudit(
    'requisitions',
    body as Record<string, unknown>,
    'id',
    user.id,
    oldData ? 'UPDATE' : 'INSERT',
    oldData as Record<string, unknown> | null
  )

  if (error || !data) {
    logDbError('requisitions', 'POST', error || 'no data returned', {
      recordId: body.id as string,
      userId: user.id,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}

// DELETE /api/requisitions — delete a requisition by id
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'requisitions')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Pre-flight read via the user-scoped client (RLS-gated) — proves the
  // user has access to this row before we delete it via the service client.
  const userClient = createUserClient(user.accessToken)
  const { data: existing } = await userClient
    .from('requisitions')
    .select('id')
    .eq('id', id)
    .limit(1)

  if (!existing || existing.length === 0) {
    // Row doesn't exist OR RLS denies access — return 404 (don't leak which).
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Transactional delete + audit log via service-role client.
  const { deleted, error } = await deleteWithAudit('requisitions', id, 'id', user.id)

  if (error) {
    logDbError('requisitions', 'DELETE', error, { recordId: id, userId: user.id })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
