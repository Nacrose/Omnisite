import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServiceClient, isServiceClientConfigured } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { logDbError } from '@/lib/safe-log'

const updateSchema = z.object({
  assignmentId: z.string().uuid(),
  permissions: z.record(z.string(), z.boolean()),
})

export async function PUT(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'PM')
    return NextResponse.json({ error: 'Forbidden — PM only' }, { status: 403 })

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const rawBody = await req.json()
  const parsed = updateSchema.safeParse(rawBody)
  if (!parsed.success) return NextResponse.json({ error: 'Validation error' }, { status: 400 })
  const { assignmentId, permissions } = parsed.data

  if (!isServiceClientConfigured())
    return NextResponse.json({ error: 'Service role not configured' }, { status: 503 })

  const sc = getServiceClient()

  const { data: assignment } = await sc
    .from('user_projects')
    .select('id, project_id, user_id')
    .eq('id', assignmentId)
    .single()
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: pmCheck } = await sc
    .from('user_projects')
    .select('role')
    .eq('user_id', user.id)
    .eq('project_id', assignment.project_id)
    .limit(1)
  if (!pmCheck?.length || pmCheck[0].role !== 'PM')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (assignment.user_id === user.id && permissions['admin.manageUsers'] === false)
    return NextResponse.json({ error: 'Cannot revoke your own admin.manageUsers' }, { status: 400 })

  const { data: updated, error } = await sc
    .from('user_projects')
    .update({ permissions })
    .eq('id', assignmentId)
    .select('id, user_id, project_id, role, permissions')
    .single()

  if (error) {
    logDbError('user_projects', 'PERMISSIONS_UPDATE', error, {
      userId: user.id,
      recordId: assignmentId,
    })
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
  return NextResponse.json(updated)
}

export async function GET(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'PM') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const assignmentId = searchParams.get('assignmentId')
  if (!assignmentId) return NextResponse.json({ error: 'assignmentId required' }, { status: 400 })
  if (!isServiceClientConfigured())
    return NextResponse.json({ error: 'Service role not configured' }, { status: 503 })

  const sc = getServiceClient()
  const { data, error } = await sc
    .from('user_projects')
    .select('id, user_id, project_id, role, permissions')
    .eq('id', assignmentId)
    .single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: pmCheck } = await sc
    .from('user_projects')
    .select('role')
    .eq('user_id', user.id)
    .eq('project_id', data.project_id)
    .limit(1)
  if (!pmCheck?.length || pmCheck[0].role !== 'PM')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json(data)
}
