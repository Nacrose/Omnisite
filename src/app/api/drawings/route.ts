import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, requireRole } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateBody } from '@/lib/validation'

// Drawings
const drawingSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  number: z.string().min(1),
  title: z.string().min(1),
  revision: z.string().optional(),
  date: z.string().optional(),
  status: z.string().default('Open'),
  size: z.string().optional(),
  discipline: z.string().optional(),
  links: z.string().optional(), // serialized JSON
  history: z.string().optional(), // serialized JSON
  file_url: z.string().optional(),
})

// GET /api/drawings — fetch drawings, optionally filtered by project_id
// Supports cursor-based pagination: ?limit=200&cursor=<last_created_at>
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
  let query = userClient.from('drawings').select('*')
  if (projectId) query = query.eq('project_id', projectId)
  if (cursor) query = query.gt('created_at', cursor) // cursor = last item's created_at
  if (limit > 0) query = query.limit(limit + 1) // fetch 1 extra to check for next page
  const { data, error } = await query.order('created_at', { ascending: true })

  if (error) {
    console.error('[API] drawings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // If pagination requested, return { data, nextCursor }
  if (limit > 0 && data) {
    const hasMore = data.length > limit
    const items = hasMore ? data.slice(0, limit) : data
    const nextCursor = hasMore ? items[items.length - 1]?.created_at : null
    return NextResponse.json({ data: items, nextCursor })
  }

  return NextResponse.json(data)
}

// POST /api/drawings — upsert a drawing
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'drawings')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const rawBody = await req.json()
  const { data: body, error: validationError } = validateBody(drawingSchema, rawBody)
  if (validationError) return validationError

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)

  // Fetch old values for audit (before the upsert overwrites them).
  const { data: oldData } = body.id
    ? await userClient.from('drawings').select('*').eq('id', body.id).single()
    : { data: null }

  const { data, error } = await userClient
    .from('drawings')
    .upsert(body)
    .select()

  if (error) {
    console.error('[API] drawings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Audit log the mutation (fire-and-forget, uses service-role client).
  logAudit({
    table_name: 'drawings',
    record_id: body.id || data?.[0]?.id || 'unknown',
    action: oldData ? 'UPDATE' : 'INSERT',
    changed_by: user.id,
    changed_fields: oldData ? { old: oldData, new: body } : undefined,
  }).catch(() => {})

  return NextResponse.json(data)
}

// DELETE /api/drawings — delete a drawing by id
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'drawings')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)
  const { error } = await userClient
    .from('drawings')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[API] drawings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Audit log the deletion.
  logAudit({
    table_name: 'drawings',
    record_id: id,
    action: 'DELETE',
    changed_by: user.id,
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
