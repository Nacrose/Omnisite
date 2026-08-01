import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, requireRole } from '@/lib/api-auth'
import { logAudit, computeDiff } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateBody } from '@/lib/validation'

// User-project assignments (membership / role linkage)
const userProjectSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  project_id: z.string().uuid(),
  role: z.string().default('FOREMAN'),
})

// GET /api/user-projects — fetch the current user's project assignments only
export async function GET(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  // Use a user-scoped client so RLS policies are enforced.
  // Return only the current user's assignments.
  const userClient = createUserClient(user.accessToken)
  const { data, error } = await userClient
    .from('user_projects')
    .select('*')
    .eq('user_id', user.id)
    .order('project_id', { ascending: true })

  if (error) {
    console.error('[API] user_projects error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  return NextResponse.json(data)
}

// POST /api/user-projects — upsert a user-project assignment (PM only)
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'user_projects')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  // Only Project Managers may assign users to projects.
  if (user.role !== 'PM') {
    return NextResponse.json(
      { error: 'Forbidden — PM role required to manage user-project assignments' },
      { status: 403 }
    )
  }

  const rawBody = await req.json()
  const { data: body, error: validationError } = validateBody(userProjectSchema, rawBody)
  if (validationError) return validationError

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)

  // Fetch old values for audit (before the upsert overwrites them).
  const { data: oldData } = body.id
    ? await userClient.from('user_projects').select('*').eq('id', body.id).single()
    : { data: null }

  const { data, error } = await userClient.from('user_projects').upsert(body).select()

  if (error) {
    console.error('[API] user_projects error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Audit log the mutation (fire-and-forget, uses service-role client).
  logAudit({
    table_name: 'user_projects',
    record_id: body.id || data?.[0]?.id || 'unknown',
    action: oldData ? 'UPDATE' : 'INSERT',
    changed_by: user.id,
    changed_fields: oldData
      ? computeDiff(oldData as Record<string, unknown>, body as Record<string, unknown>)
      : undefined,
  }).catch(() => {})

  return NextResponse.json(data)
}

// DELETE /api/user-projects — delete a user-project assignment by id (PM only)
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'user_projects')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  // Only Project Managers may remove user-project assignments.
  if (user.role !== 'PM') {
    return NextResponse.json(
      { error: 'Forbidden — PM role required to manage user-project assignments' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)
  const { error } = await userClient.from('user_projects').delete().eq('id', id)

  if (error) {
    console.error('[API] user_projects error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Audit log the deletion.
  logAudit({
    table_name: 'user_projects',
    record_id: id,
    action: 'DELETE',
    changed_by: user.id,
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
