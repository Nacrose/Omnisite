import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, requireRole } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateBody } from '@/lib/validation'

// Letters (correspondence)
const letterSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  number: z.string().min(1),
  date: z.string().optional(),
  type: z.string().optional(),
  from_party: z.string().optional(),
  to_party: z.string().optional(),
  subject: z.string().optional(),
  reply_by: z.string().optional(),
  reply_to: z.string().nullable().optional(),
  has_variation: z.boolean().default(false),
  body: z.string().optional(),
})

// GET /api/letters — fetch letters, optionally filtered by project_id
// Supports cursor-based pagination: ?limit=200&cursor=<last_date>
export async function GET(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimitError = checkRateLimit(req)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')
  const limit = parseInt(searchParams.get('limit') || '0', 10)
  const cursor = searchParams.get('cursor')

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)
  let query = userClient.from('letters').select('*')
  if (projectId) query = query.eq('project_id', projectId)
  if (cursor) query = query.gt('date', cursor) // cursor = last item's date
  if (limit > 0) query = query.limit(limit + 1) // fetch 1 extra to check for next page
  const { data, error } = await query.order('date', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If pagination requested, return { data, nextCursor }
  if (limit > 0 && data) {
    const hasMore = data.length > limit
    const items = hasMore ? data.slice(0, limit) : data
    const nextCursor = hasMore ? items[items.length - 1]?.date : null
    return NextResponse.json({ data: items, nextCursor })
  }

  return NextResponse.json(data)
}

// POST /api/letters — upsert a letter
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'letters')
  if (roleError) return roleError

  const rateLimitError = checkRateLimit(req)
  if (rateLimitError) return rateLimitError

  const rawBody = await req.json()
  const { data: body, error: validationError } = validateBody(letterSchema, rawBody)
  if (validationError) return validationError

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)
  const { data, error } = await userClient
    .from('letters')
    .upsert(body)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Audit log the mutation (fire-and-forget, uses service-role client).
  logAudit({
    table_name: 'letters',
    record_id: body.id || data?.[0]?.id || 'unknown',
    action: 'UPDATE',
    changed_by: user.email,
  }).catch(() => {})

  return NextResponse.json(data)
}

// DELETE /api/letters — delete a letter by id
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'letters')
  if (roleError) return roleError

  const rateLimitError = checkRateLimit(req)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)
  const { error } = await userClient
    .from('letters')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Audit log the deletion.
  logAudit({
    table_name: 'letters',
    record_id: id,
    action: 'DELETE',
    changed_by: user.email,
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
