import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, requireRole, verifyProjectAccess, isProjectScopedTable } from '@/lib/api-auth'
import { upsertWithAudit, deleteWithAudit } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { logDbError } from '@/lib/safe-log'
import { validateBody } from '@/lib/validation'

// Subcontractors
const subcontractorSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  name: z.string().min(1),
  scope: z.string().optional(),
  agreement_value: z.number().min(0).default(0),
  advance_paid: z.number().min(0).default(0),
  advance_pct: z.number().default(0),
  retention_pct: z.number().default(0),
  rework_cost: z.number().min(0).default(0),
  status: z.string().default('Active'),
  pan: z.string().optional(),
  gst: z.string().optional(),
  insurance_expiry: z.string().optional(),
  labour_license_expiry: z.string().optional(),
  is_tunneling: z.boolean().default(false),
  items: z.string().optional(), // serialized JSON
  material_issues: z.string().optional(), // serialized JSON
  material_returns: z.string().optional(), // serialized JSON
  consumables: z.string().optional(), // serialized JSON
  custom_deductibles: z.string().optional(), // serialized JSON
  assigned_tasks: z.string().optional(), // serialized JSON
  ncr_count: z.number().int().min(0).default(0),
  incidents: z.number().int().min(0).default(0),
})

// GET /api/subcontractors — fetch subcontractors, optionally filtered by project_id
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
  let query = userClient.from('subcontractors').select('*')
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query.order('name', { ascending: true })

  if (error) {
    logDbError('subcontractors', 'GET', error, { userId: user.id })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  return NextResponse.json(data)
}

// POST /api/subcontractors — upsert a subcontractor
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'subcontractors')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const rawBody = await req.json()
  const { data: body, error: validationError } = validateBody(subcontractorSchema, rawBody)
  if (validationError) return validationError

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)

  // Fetch old values via the user-scoped client (RLS-gated).
  // For UPDATE, this proves the user has read access to the row.
  // For INSERT, verifyProjectAccess below replaces the implicit RLS check
  // that the service-role upsert bypasses.
  const { data: oldData } = body.id
    ? await userClient.from('subcontractors').select('*').eq('id', body.id).single()
    : { data: null }

  // For INSERTs (no existing row), verify the user has access to the
  // target project_id. upsertWithAudit uses the service-role client
  // which bypasses RLS, so this explicit check is mandatory.
  if (!oldData && isProjectScopedTable('subcontractors')) {
    const projectId = (body as Record<string, unknown>).project_id as string | undefined
    const hasAccess = await verifyProjectAccess(userClient, user.id, projectId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden — no access to this project' }, { status: 403 })
    }
  }

  // Transactional upsert + audit log via service-role client.
  // If either fails, both roll back — the audit trail is never lost.
  const { data, error } = await upsertWithAudit(
    'subcontractors',
    body as Record<string, unknown>,
    'id',
    user.id,
    oldData ? 'UPDATE' : 'INSERT',
    oldData as Record<string, unknown> | null
  )

  if (error || !data) {
    logDbError('subcontractors', 'POST', error || 'no data returned', {
      recordId: body.id as string,
      userId: user.id,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}

// DELETE /api/subcontractors — delete a subcontractor by id
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'subcontractors')
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
    .from('subcontractors')
    .select('id')
    .eq('id', id)
    .limit(1)

  if (!existing || existing.length === 0) {
    // Row doesn't exist OR RLS denies access — return 404 (don't leak which).
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Transactional delete + audit log via service-role client.
  const { deleted, error } = await deleteWithAudit('subcontractors', id, 'id', user.id)

  if (error) {
    logDbError('subcontractors', 'DELETE', error, { recordId: id, userId: user.id })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
