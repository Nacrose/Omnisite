import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createUserClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'
import { logDbError } from '@/lib/safe-log'

// GET /api/audit-log — list audit_log entries.
//
// Query params (all optional):
//   ?table_name=boq_items  — filter by table_name
//   ?record_id=1.1.3       — filter by record_id
//   ?limit=100             — page size (default 100, max 500)
//   ?cursor=<iso8601>      — pagination cursor (timestamp of the last row
//                            from the previous page; rows are ordered
//                            timestamp DESC so we use .lt() to advance)
//
// The endpoint uses createUserClient (the user's access_token) so RLS
// policies on audit_log apply automatically — PMs only see audit entries
// for projects they have access to.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const tableName = searchParams.get('table_name')
  const recordId = searchParams.get('record_id')
  const cursor = searchParams.get('cursor')
  const limitParam = parseInt(searchParams.get('limit') || '100', 10)
  const limit = Math.min(Math.max(limitParam || 100, 1), 500)

  const userClient = createUserClient(user.accessToken)
  let query = userClient
    .from('audit_log')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit + 1)

  if (tableName) query = query.eq('table_name', tableName)
  if (recordId) query = query.eq('record_id', recordId)
  if (cursor) query = query.lt('timestamp', cursor)

  const { data, error } = await query

  if (error) {
    logDbError('audit_log', 'GET', error, { userId: user.id })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const rows = data ?? []
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const lastItem = items[items.length - 1] as { timestamp?: string } | undefined
  const nextCursor = hasMore && lastItem?.timestamp ? lastItem.timestamp : null

  return NextResponse.json({ data: items, nextCursor })
}
