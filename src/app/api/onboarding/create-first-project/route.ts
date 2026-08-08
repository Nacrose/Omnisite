import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServiceClient, isServiceClientConfigured } from '@/lib/supabase-server'
import { requireAuth, checkOrigin } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { upsertWithAudit } from '@/lib/audit'

/**
 * POST /api/onboarding/create-first-project
 *
 * Called from the /onboarding wizard by the FIRST user. Assigns the
 * SUPER_ADMIN role to the current user. Does NOT create a project —
 * that's done later by an Admin.
 *
 * Auth: any authenticated user (the first user has no role yet).
 * Refuses to run in demo mode (no Supabase).
 *
 * Role hierarchy:
 *   Super Admin (this endpoint) → creates Admins
 *   Admin → creates projects + assigns PMs
 *   PM → invites Engineers/Storekeepers/Foremen
 */

const setupSchema = z.object({
  name: z.string().min(1).max(200),
  org_name: z.string().max(200).optional(),
  user_name: z.string().max(200).optional(),
})

export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const originError = checkOrigin(req)
  if (originError) return originError

  if (!isServiceClientConfigured()) {
    return NextResponse.json(
      {
        error: 'Supabase service role is not configured. Onboarding requires Supabase.',
      },
      { status: 403 }
    )
  }

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const rawBody = await req.json()
  const parsed = setupSchema.safeParse(rawBody)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    return NextResponse.json(
      { error: `Validation error: ${firstError.path.join('.')} — ${firstError.message}` },
      { status: 400 }
    )
  }
  const body = parsed.data

  const serviceClient = getServiceClient()

  // ─── Guard: user already has a role? ─────────────────────────────────────
  // Onboarding is for first-time setup only. If the user already has a
  // user_projects row, they've been set up — redirect them to dashboard.
  const { data: existingAssignments } = await serviceClient
    .from('user_projects')
    .select('project_id, role')
    .eq('user_id', user.id)
    .limit(1)

  if (existingAssignments && existingAssignments.length > 0) {
    return NextResponse.json(
      {
        error: 'You already have a role assigned. Use the regular app — no onboarding needed.',
        existing_role: existingAssignments[0].role,
      },
      { status: 409 }
    )
  }

  // ─── Assign SUPER_ADMIN role ─────────────────────────────────────────────
  // We create a special "org" project (if one doesn't exist) and assign
  // the user as SUPER_ADMIN on it. This gives them access to the Admin
  // module where they can create Admins.
  //
  // Check if an org-level project already exists (code = 'ORG')
  const { data: orgProject } = await serviceClient
    .from('projects')
    .select('id')
    .eq('code', 'ORG')
    .limit(1)

  let projectId: string

  if (orgProject && orgProject.length > 0) {
    projectId = orgProject[0].id
  } else {
    // Create the org-level project
    const { data: newProject, error: projectError } = await upsertWithAudit(
      'projects',
      {
        name: body.org_name || 'OmniSite Organization',
        code: 'ORG',
        location: null,
        start_date: null,
        value: 0,
        status: 'Active',
      } as Record<string, unknown>,
      'id',
      user.id,
      'INSERT',
      null
    )

    if (projectError || !newProject) {
      return NextResponse.json(
        { error: 'Failed to create org project: ' + projectError },
        { status: 500 }
      )
    }
    projectId = (newProject as Record<string, unknown>).id as string
  }

  // Assign SUPER_ADMIN role
  const { data: assignment, error: assignmentError } = await upsertWithAudit(
    'user_projects',
    {
      user_id: user.id,
      project_id: projectId,
      role: 'SUPER_ADMIN',
      permissions: { all: true },
    } as Record<string, unknown>,
    'id',
    user.id,
    'INSERT',
    null
  )

  if (assignmentError || !assignment) {
    return NextResponse.json(
      {
        error: 'Failed to assign Super Admin role: ' + assignmentError,
      },
      { status: 500 }
    )
  }

  // ─── Optional: update user's display name ────────────────────────────────
  if (body.user_name) {
    await serviceClient.auth.admin
      .updateUserById(user.id, {
        user_metadata: { name: body.user_name, full_name: body.user_name },
      })
      .catch(() => {})
  }

  return NextResponse.json({
    role: 'SUPER_ADMIN',
    project_id: projectId,
    message: 'Super Admin role assigned. Go to Admin → Users to create Admins.',
  })
}
