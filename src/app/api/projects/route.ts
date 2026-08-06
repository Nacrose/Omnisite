import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUserClient, isServerSupabaseConfigured } from '@/lib/supabase-server'
import { requireAuth, requireRole, checkOrigin, type AuthenticatedUser } from '@/lib/api-auth'
import { upsertWithAudit, deleteWithAudit } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { logDbError } from '@/lib/safe-log'
import { validateBody } from '@/lib/validation'

// Demo-mode guard — same pattern as crud-handler.ts isDemoUser().
// In demo mode (no Supabase), requireAuth returns accessToken:'' and
// createUserClient('') throws 'Supabase not configured' (500). Short-circuit
// before that happens.
function isDemoUser(user: AuthenticatedUser | null): boolean {
  return !isServerSupabaseConfigured() || (user != null && !user.accessToken)
}

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
  start_date: z.string().optional(),
})

// GET /api/projects — fetch all projects the user has access to (RLS-scoped)
export async function GET(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  // Demo mode — return [] so the client-side useSyncedState falls back
  // to localStorage seed data without seeing a 500.
  if (isDemoUser(user)) {
    return NextResponse.json([])
  }

  // Use a user-scoped client so RLS policies are enforced.
  // No project_id filter — this route returns all projects the user can see.
  const userClient = createUserClient(user.accessToken)
  const { data, error } = await userClient
    .from('projects')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    logDbError('projects', 'GET', error, { userId: user.id })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  return NextResponse.json(data)
}

// POST /api/projects — upsert a project
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // CSRF: reject cross-origin POSTs
  const originError = checkOrigin(req)
  if (originError) return originError

  const roleError = requireRole(user, 'projects')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  // Demo mode — writes are local-only.
  if (isDemoUser(user)) {
    return NextResponse.json(
      { error: 'Demo mode — writes are stored in the browser only.' },
      { status: 503 }
    )
  }

  const rawBody = await req.json()
  const { data: body, error: validationError } = validateBody(projectSchema, rawBody)
  if (validationError) return validationError

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)

  // Fetch old values via the user-scoped client (RLS-gated).
  const { data: oldData } = body.id
    ? await userClient.from('projects').select('*').eq('id', body.id).single()
    : { data: null }

  // Transactional upsert + audit log via service-role client.
  const { data, error } = await upsertWithAudit(
    'projects',
    body as Record<string, unknown>,
    'id',
    user.id,
    oldData ? 'UPDATE' : 'INSERT',
    oldData as Record<string, unknown> | null
  )

  if (error || !data) {
    logDbError('projects', 'POST', error || 'no data returned', {
      recordId: body.id as string,
      userId: user.id,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // If this is a NEW project (not an update), auto-assign the creator as PM.
  // Without this, the creator would have no access to their own project
  // (RLS requires a user_projects row).
  if (!oldData && data.id) {
    const { getServiceClient, isServiceClientConfigured } = await import('@/lib/supabase-server')
    if (isServiceClientConfigured()) {
      const sc = getServiceClient()
      await sc
        .from('user_projects')
        .insert({
          user_id: user.id,
          project_id: data.id,
          role: 'PM',
        })
        .then(({ error: assignError }) => {
          if (assignError) {
            // Non-fatal — the project is created, but the creator doesn't
            // have access. Log so the admin can fix it manually.
            logDbError('user_projects', 'AUTO_ASSIGN_PM', assignError, {
              userId: user.id,
              recordId: String(data.id),
            })
          }
        })
    }
  }

  return NextResponse.json(data)
}

// DELETE /api/projects — delete a project by id
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // CSRF: reject cross-origin DELETEs
  const originError = checkOrigin(req)
  if (originError) return originError

  const roleError = requireRole(user, 'projects')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

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
  const { data: existing } = await userClient.from('projects').select('id').eq('id', id).limit(1)

  if (!existing || existing.length === 0) {
    // Row doesn't exist OR RLS denies access — return 404 (don't leak which).
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Transactional delete + audit log via service-role client.
  const { deleted, error } = await deleteWithAudit('projects', id, 'id', user.id)

  if (error) {
    logDbError('projects', 'DELETE', error, { recordId: id, userId: user.id })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
