import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, requireRole, verifyProjectAccess, isProjectScopedTable } from '@/lib/api-auth'
import { upsertWithAudit, deleteWithAudit } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { logDbError } from '@/lib/safe-log'
import { validateBody, cbsNodeSchema } from '@/lib/validation'

// GET /api/cbs-nodes — fetch CBS nodes, optionally filtered by project_id
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
  let query = userClient.from('cbs_nodes').select('*')
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query.order('created_at', { ascending: true })

  if (error) {
    logDbError('cbs_nodes', 'GET', error, { userId: user.id })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  return NextResponse.json(data)
}

// POST /api/cbs-nodes — upsert a CBS node
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'cbs_nodes')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const rawBody = await req.json()
  const { data: body, error: validationError } = validateBody(cbsNodeSchema, rawBody)
  if (validationError) return validationError

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)

  // Fetch old values via the user-scoped client (RLS-gated).
  const { data: oldData } = body.code
    ? await userClient.from('cbs_nodes').select('*').eq('code', body.code).single()
    : { data: null }

  // For INSERTs (no existing row), verify the user has access to the
  // target project_id. upsertWithAudit uses the service-role client
  // which bypasses RLS, so this explicit check is mandatory.
  if (!oldData && isProjectScopedTable('cbs_nodes')) {
    const projectId = (body as Record<string, unknown>).project_id as string | undefined
    const hasAccess = await verifyProjectAccess(userClient, user.id, projectId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden — no access to this project' }, { status: 403 })
    }
  }

  // Transactional upsert + audit log via service-role client.
  const { data, error } = await upsertWithAudit(
    'cbs_nodes',
    body as Record<string, unknown>,
    'code',
    user.id,
    oldData ? 'UPDATE' : 'INSERT',
    oldData as Record<string, unknown> | null
  )

  if (error || !data) {
    logDbError('cbs_nodes', 'POST', error || 'no data returned', {
      recordId: body.code as string,
      userId: user.id,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}

// DELETE /api/cbs-nodes — delete a CBS node by code (cbs_nodes uses 'code' as PK, not 'id')
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'cbs_nodes')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  // cbs_nodes has no 'id' column — its primary key is 'code'. Accept either
  // ?code= or ?id= (the latter for backward compat) but always filter on 'code'.
  const code = searchParams.get('code') || searchParams.get('id')
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })

  // Pre-flight read via the user-scoped client (RLS-gated) — proves the
  // user has access to this row before we delete it via the service client.
  const userClient = createUserClient(user.accessToken)
  const { data: existing } = await userClient
    .from('cbs_nodes')
    .select('code')
    .eq('code', code)
    .limit(1)

  if (!existing || existing.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Transactional delete + audit log via service-role client.
  const { deleted, error } = await deleteWithAudit('cbs_nodes', code, 'code', user.id)

  if (error) {
    logDbError('cbs_nodes', 'DELETE', error, { recordId: code, userId: user.id })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
