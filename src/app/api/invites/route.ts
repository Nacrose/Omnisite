import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServiceClient, isServiceClientConfigured } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { logDbError } from '@/lib/safe-log'

// ─── Invite User schema ─────────────────────────────────────────────────────
//
// PM invites a colleague by email. The server:
//   1. Calls Supabase Auth admin.createUser to create the auth user
//      (or finds the existing one if the email is already registered).
//   2. Inserts a row into user_projects with the selected role.
//   3. Sends a magic-link email so the invitee can set a password.
//   4. Returns the new user_projects row so the UI can update.

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  role: z.enum(['PM', 'SITE_ENGINEER', 'STOREKEEPER', 'FOREMAN']).default('FOREMAN'),
  projectId: z.string().uuid(),
})

// ─── Helper ──────────────────────────────────────────────────────────────────

function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): {
  data: T | null
  error: NextResponse | null
} {
  const result = schema.safeParse(body)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return {
      data: null,
      error: NextResponse.json(
        { error: `Validation error: ${firstError.path.join('.')} — ${firstError.message}` },
        { status: 400 }
      ),
    }
  }
  return { data: result.data, error: null }
}

// ─── POST: invite a user ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (user.role !== 'PM') {
    return NextResponse.json(
      { error: 'Forbidden — only Project Managers can invite users' },
      { status: 403 }
    )
  }

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const rawBody = await req.json()
  const { data: body, error: validationError } = validateBody(inviteSchema, rawBody)
  if (validationError || !body)
    return validationError ?? NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  if (!isServiceClientConfigured()) {
    return NextResponse.json(
      {
        error:
          'Supabase service role is not configured. Set SUPABASE_SERVICE_ROLE_KEY to invite users.',
      },
      { status: 503 }
    )
  }

  const serviceClient = getServiceClient()

  // ─── 1. Create or find the auth user ───────────────────────────────────
  let authUserId: string
  let isNewUser = false

  const { data: createdUser, error: createError } = await serviceClient.auth.admin.createUser({
    email: body.email,
    email_confirm: true,
    user_metadata: body.name ? { name: body.name, full_name: body.name } : undefined,
  })

  if (createError) {
    if (createError.message.includes('already') || createError.message.includes('exists')) {
      // User already registered — look them up
      const { data: existingUsers, error: listError } = await serviceClient.auth.admin.listUsers()
      if (listError || !existingUsers) {
        logDbError('user_projects', 'INVITE_LIST_USERS', listError, { userId: user.id })
        return NextResponse.json({ error: 'Failed to look up existing user' }, { status: 500 })
      }
      const existing = existingUsers.users.find((u) => u.email === body.email)
      if (!existing) {
        return NextResponse.json({ error: 'User exists but could not be found' }, { status: 500 })
      }
      authUserId = existing.id
    } else {
      logDbError('user_projects', 'INVITE_CREATE_USER', createError, { userId: user.id })
      return NextResponse.json(
        { error: 'Failed to create user: ' + createError.message },
        { status: 500 }
      )
    }
  } else {
    authUserId = createdUser.user.id
    isNewUser = true

    // Send invite email (magic link) for newly created users
    await serviceClient.auth.admin
      .generateLink({
        type: 'magiclink',
        email: body.email,
      })
      .catch(() => {
        // Non-fatal — the user is created, they just won't get the email.
      })
  }

  // ─── 2. Check if already assigned to this project ──────────────────────
  const { data: existingAssignment } = await serviceClient
    .from('user_projects')
    .select('id, role')
    .eq('user_id', authUserId)
    .eq('project_id', body.projectId)
    .limit(1)

  if (existingAssignment && existingAssignment.length > 0) {
    // Already assigned — update the role
    const { error: updateError } = await serviceClient
      .from('user_projects')
      .update({ role: body.role })
      .eq('id', existingAssignment[0].id)

    if (updateError) {
      logDbError('user_projects', 'INVITE_UPDATE_ROLE', updateError, {
        userId: user.id,
        recordId: authUserId,
      })
      return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      userId: authUserId,
      email: body.email,
      role: body.role,
      projectId: body.projectId,
      updated: true,
      isNewUser,
    })
  }

  // ─── 3. Insert user_projects row ───────────────────────────────────────
  const { data: assignment, error: insertError } = await serviceClient
    .from('user_projects')
    .insert({
      user_id: authUserId,
      project_id: body.projectId,
      role: body.role,
    })
    .select()
    .single()

  if (insertError) {
    logDbError('user_projects', 'INVITE_INSERT', insertError, {
      userId: user.id,
      recordId: authUserId,
    })
    return NextResponse.json({ error: 'Failed to assign user to project' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    userId: authUserId,
    email: body.email,
    name: body.name,
    role: body.role,
    projectId: body.projectId,
    assignmentId: assignment?.id,
    isNewUser,
  })
}

// ─── GET: list all users on a project (PM only) ─────────────────────────────

export async function GET(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (user.role !== 'PM') {
    return NextResponse.json(
      { error: 'Forbidden — only Project Managers can list project users' },
      { status: 403 }
    )
  }

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  if (!isServiceClientConfigured()) {
    return NextResponse.json({ error: 'Supabase service role not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  const serviceClient = getServiceClient()

  const { data: assignments, error: assignmentsError } = await serviceClient
    .from('user_projects')
    .select('id, user_id, project_id, role')
    .eq('project_id', projectId)
    .order('role')

  if (assignmentsError) {
    logDbError('user_projects', 'INVITE_LIST', assignmentsError, { userId: user.id })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (!assignments || assignments.length === 0) {
    return NextResponse.json([])
  }

  // Fetch emails from auth.users
  const { data: authUsers, error: authError2 } = await serviceClient.auth.admin.listUsers()

  if (authError2 || !authUsers) {
    return NextResponse.json(assignments.map((a) => ({ ...a, email: null, name: null })))
  }

  const userMap = new Map(authUsers.users.map((u) => [u.id, u]))

  return NextResponse.json(
    assignments.map((a) => {
      const authUser = userMap.get(a.user_id)
      return {
        ...a,
        email: authUser?.email ?? null,
        name: (authUser?.user_metadata as Record<string, unknown>)?.name as string | null,
      }
    })
  )
}

// ─── DELETE: remove a user from a project ───────────────────────────────────

export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (user.role !== 'PM') {
    return NextResponse.json(
      { error: 'Forbidden — only Project Managers can remove users' },
      { status: 403 }
    )
  }

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const assignmentId = searchParams.get('id')
  if (!assignmentId) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  if (!isServiceClientConfigured()) {
    return NextResponse.json({ error: 'Supabase service role not configured' }, { status: 503 })
  }

  const serviceClient = getServiceClient()

  // Prevent PMs from removing themselves
  const { data: assignment } = await serviceClient
    .from('user_projects')
    .select('user_id')
    .eq('id', assignmentId)
    .single()

  if (assignment?.user_id === user.id) {
    return NextResponse.json(
      { error: 'You cannot remove yourself from the project' },
      { status: 400 }
    )
  }

  const { error: deleteError } = await serviceClient
    .from('user_projects')
    .delete()
    .eq('id', assignmentId)

  if (deleteError) {
    logDbError('user_projects', 'INVITE_DELETE', deleteError, {
      userId: user.id,
      recordId: assignmentId,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
