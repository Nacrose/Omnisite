import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, isServiceClientConfigured } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = await checkRateLimit(req, user.id)
  if (rl) return rl
  if (!isServiceClientConfigured()) return NextResponse.json({ permissions: {} })

  const { searchParams } = new URL(req.url)
  let projectId = searchParams.get('projectId')
  const sc = getServiceClient()
  if (!projectId) {
    const { data: a } = await sc
      .from('user_projects')
      .select('project_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()
    if (a) projectId = a.project_id
  }
  if (!projectId) return NextResponse.json({ permissions: {} })

  const { data } = await sc
    .from('user_projects')
    .select('permissions')
    .eq('user_id', user.id)
    .eq('project_id', projectId)
    .limit(1)
    .single()
  return NextResponse.json({ permissions: data?.permissions ?? {} })
}
