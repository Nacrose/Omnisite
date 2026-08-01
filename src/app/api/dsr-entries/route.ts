import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, requireRole, getPrimaryKey } from '@/lib/api-auth'
import { logAudit, computeDiff } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateBody } from '@/lib/validation'

// DSR (Daily Site Report) entries
const dsrEntrySchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  task: z.string().min(1),
  source: z.string().optional(),
  chainage: z.string().optional(),
  planned: z.number().min(0).default(0),
  actual: z.number().min(0).default(0),
  uom: z.string().optional(),
  status: z.string().default('Open'),
  has_rfi: z.boolean().default(false),
  has_photos: z.boolean().default(false),
  remarks: z.string().optional(),
  date: z.string().optional(),
})

// GET /api/dsr-entries — fetch DSR entries, optionally filtered by project_id
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
  let query = userClient.from('dsr_entries').select('*')
  if (projectId) query = query.eq('project_id', projectId)
  if (cursor) query = query.gt('created_at', cursor) // cursor = last item's created_at
  if (limit > 0) query = query.limit(limit + 1) // fetch 1 extra to check for next page
  const { data, error } = await query.order('created_at', { ascending: true })

  if (error) {
    console.error('[API] dsr_entries error:', error)
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

// POST /api/dsr-entries — upsert a DSR entry
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'dsr_entries')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const rawBody = await req.json()
  const { data: body, error: validationError } = validateBody(dsrEntrySchema, rawBody)
  if (validationError) return validationError

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)

  // Fetch old values for audit (before the upsert overwrites them).
  const { data: oldData } = body.id
    ? await userClient.from('dsr_entries').select('*').eq('id', body.id).single()
    : { data: null }

  const { data, error } = await userClient
    .from('dsr_entries')
    .upsert(body, { onConflict: getPrimaryKey('dsr_entries') })
    .select()

  if (error) {
    console.error('[API] dsr_entries error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Audit log the mutation (fire-and-forget, uses service-role client).
  logAudit({
    table_name: 'dsr_entries',
    record_id: body.id || data?.[0]?.id || 'unknown',
    action: oldData ? 'UPDATE' : 'INSERT',
    changed_by: user.id,
    changed_fields: oldData
      ? computeDiff(oldData as Record<string, unknown>, body as Record<string, unknown>)
      : undefined,
  }).catch(() => {})

  return NextResponse.json(data)
}

// DELETE /api/dsr-entries — delete a DSR entry by id
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'dsr_entries')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)
  const { error } = await userClient.from('dsr_entries').delete().eq('id', id)

  if (error) {
    console.error('[API] dsr_entries error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Audit log the deletion.
  logAudit({
    table_name: 'dsr_entries',
    record_id: id,
    action: 'DELETE',
    changed_by: user.id,
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
