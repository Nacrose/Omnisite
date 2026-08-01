import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, requireRole } from '@/lib/api-auth'
import { logAudit, computeDiff } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateBody } from '@/lib/validation'

// Projects — this IS the projects table, so no project_id filter is applied.
// RLS policies on `user_projects` (joined via the projects table policy) ensure
// the user only sees projects they have been assigned to.
const projectSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  code: z.string().optional(),
  location: z.string().optional(),
  value: z.number().min(0).default(0),
  progress: z.number().int().min(0).max(100).default(0),
  status: z.string().default('Active'),
})

// GET /api/projects — fetch all projects the user has access to (RLS-scoped)
export async function GET(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  // Use a user-scoped client so RLS policies are enforced.
  // No project_id filter — this route returns all projects the user can see.
  const userClient = createUserClient(user.accessToken)
  const { data, error } = await userClient
    .from('projects')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('[API] projects error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  return NextResponse.json(data)
}

// POST /api/projects — upsert a project
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'projects')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const rawBody = await req.json()
  const { data: body, error: validationError } = validateBody(projectSchema, rawBody)
  if (validationError) return validationError

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)

  // Fetch old values for audit (before the upsert overwrites them).
  const { data: oldData } = body.id
    ? await userClient.from('projects').select('*').eq('id', body.id).single()
    : { data: null }

  const { data, error } = await userClient.from('projects').upsert(body).select()

  if (error) {
    console.error('[API] projects error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Audit log the mutation (fire-and-forget, uses service-role client).
  logAudit({
    table_name: 'projects',
    record_id: body.id || data?.[0]?.id || 'unknown',
    action: oldData ? 'UPDATE' : 'INSERT',
    changed_by: user.id,
    changed_fields: oldData
      ? computeDiff(oldData as Record<string, unknown>, body as Record<string, unknown>)
      : undefined,
  }).catch(() => {})

  return NextResponse.json(data)
}

// DELETE /api/projects — delete a project by id
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'projects')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)
  const { error } = await userClient.from('projects').delete().eq('id', id)

  if (error) {
    console.error('[API] projects error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Audit log the deletion.
  logAudit({
    table_name: 'projects',
    record_id: id,
    action: 'DELETE',
    changed_by: user.id,
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
