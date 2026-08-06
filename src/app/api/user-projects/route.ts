import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUserClient, isServerSupabaseConfigured } from '@/lib/supabase-server'
import { requireAuth, requireRole, checkOrigin, type AuthenticatedUser } from '@/lib/api-auth'
import { upsertWithAudit, deleteWithAudit } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { logDbError } from '@/lib/safe-log'
import { validateBody } from '@/lib/validation'

// Demo-mode guard — same pattern as crud-handler.ts isDemoUser().
function isDemoUser(user: AuthenticatedUser | null): boolean {
  return !isServerSupabaseConfigured() || (user != null && !user.accessToken)
}

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

  // Demo mode — return [] so the workspace-shell's onboarding check
  // doesn't see a 500 and the user isn't redirected to /onboarding.
  if (isDemoUser(user)) {
    return NextResponse.json([])
  }

  // Use a user-scoped client so RLS policies are enforced.
  // Return only the current user's assignments.
  const userClient = createUserClient(user.accessToken)
  const { data, error } = await userClient
    .from('user_projects')
    .select('*')
    .eq('user_id', user.id)
    .order('project_id', { ascending: true })

  if (error) {
    logDbError('user_projects', 'GET', error, { userId: user.id })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  return NextResponse.json(data)
}

// POST /api/user-projects — upsert a user-project assignment (PM only)
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // CSRF: reject cross-origin POSTs
  const originError = checkOrigin(req)
  if (originError) return originError

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

  // Demo mode — writes are local-only.
  if (isDemoUser(user)) {
    return NextResponse.json(
      { error: 'Demo mode — writes are stored in the browser only.' },
      { status: 503 }
    )
  }

  const rawBody = await req.json()
  const { data: body, error: validationError } = validateBody(userProjectSchema, rawBody)
  if (validationError) return validationError

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)

  // Fetch old values via the user-scoped client (RLS-gated).
  const { data: oldData } = body.id
    ? await userClient.from('user_projects').select('*').eq('id', body.id).single()
    : { data: null }

  // Transactional upsert + audit log via service-role client.
  const { data, error } = await upsertWithAudit(
    'user_projects',
    body as Record<string, unknown>,
    'id',
    user.id,
    oldData ? 'UPDATE' : 'INSERT',
    oldData as Record<string, unknown> | null
  )

  if (error || !data) {
    logDbError('user_projects', 'POST', error || 'no data returned', {
      recordId: body.id as string,
      userId: user.id,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}

// DELETE /api/user-projects — delete a user-project assignment by id (PM only)
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // CSRF: reject cross-origin DELETEs
  const originError = checkOrigin(req)
  if (originError) return originError

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

  // Demo mode — deletes are local-only.
  if (isDemoUser(user)) {
    return NextResponse.json({ error: 'Demo mode — deletes are local-only.' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Pre-flight read via the user-scoped client (RLS-gated) — proves the
  // user has access to this row before we delete it via the service client.
  const userClient = createUserClient(user.accessToken)
  const { data: existing } = await userClient
    .from('user_projects')
    .select('id')
    .eq('id', id)
    .limit(1)

  if (!existing || existing.length === 0) {
    // Row doesn't exist OR RLS denies access — return 404 (don't leak which).
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Transactional delete + audit log via service-role client.
  const { deleted, error } = await deleteWithAudit('user_projects', id, 'id', user.id)

  if (error) {
    logDbError('user_projects', 'DELETE', error, { recordId: id, userId: user.id })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
