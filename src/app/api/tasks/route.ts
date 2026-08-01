import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, requireRole } from '@/lib/api-auth'
import { logAudit, computeDiff } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateBody, taskSchema } from '@/lib/validation'

// GET /api/tasks — fetch tasks, optionally filtered by project_id
// Supports cursor-based pagination: ?limit=200&cursor=<last_sort_order>
export async function GET(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')
  const limit = parseInt(searchParams.get('limit') || '0', 10)
  const cursor = searchParams.get('cursor')

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)
  let query = userClient.from('tasks').select('*')
  if (projectId) query = query.eq('project_id', projectId)
  if (cursor) query = query.gt('sort_order', Number(cursor)) // cursor = last item's sort_order as string
  if (limit > 0) query = query.limit(limit + 1) // fetch 1 extra to check for next page
  const { data, error } = await query.order('sort_order', { ascending: true })

  if (error) {
    console.error('[API] tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // If pagination requested, return { data, nextCursor }
  if (limit > 0 && data) {
    const hasMore = data.length > limit
    const items = hasMore ? data.slice(0, limit) : data
    const nextCursor = hasMore ? String(items[items.length - 1]?.sort_order) : null
    return NextResponse.json({ data: items, nextCursor })
  }

  return NextResponse.json(data)
}

// POST /api/tasks — upsert a task
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'tasks')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const rawBody = await req.json()
  const { data: body, error: validationError } = validateBody(taskSchema, rawBody)
  if (validationError) return validationError

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)

  // Fetch old values for audit (before the upsert overwrites them).
  const { data: oldData } = body.id
    ? await userClient.from('tasks').select('*').eq('id', body.id).single()
    : { data: null }

  const { data, error } = await userClient
    .from('tasks')
    .upsert(body)
    .select()

  if (error) {
    console.error('[API] tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Audit log the mutation (fire-and-forget, uses service-role client).
  logAudit({
    table_name: 'tasks',
    record_id: body.id || data?.[0]?.id || 'unknown',
    action: oldData ? 'UPDATE' : 'INSERT',
    changed_by: user.id,
    changed_fields: oldData ? computeDiff(oldData as Record<string, unknown>, body as Record<string, unknown>) : undefined,
  }).catch(e => {
      console.error('[AUDIT] Failed:', e)
      import('@/lib/sentry').then(({ Sentry }) => Sentry.captureException(e)).catch(() => {})
    })

  return NextResponse.json(data)
}

// DELETE /api/tasks — delete a task by id
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'tasks')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)
  const { error } = await userClient
    .from('tasks')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[API] tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Audit log the deletion.
  logAudit({
    table_name: 'tasks',
    record_id: id,
    action: 'DELETE',
    changed_by: user.id,
  }).catch(e => {
      console.error('[AUDIT] Failed:', e)
      import('@/lib/sentry').then(({ Sentry }) => Sentry.captureException(e)).catch(() => {})
    })

  return NextResponse.json({ success: true })
}
