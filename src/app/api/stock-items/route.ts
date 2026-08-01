import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, requireRole } from '@/lib/api-auth'
import { logAudit, computeDiff } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateBody } from '@/lib/validation'

// Stock items — live inventory
const stockItemSchema = z.object({
  code: z.string().min(1),
  project_id: z.string().uuid().optional(),
  name: z.string().min(1),
  on_hand: z.number().min(0).default(0),
  reserved: z.number().min(0).default(0),
  avg_cost: z.number().min(0).default(0),
  warehouse: z.string().optional(),
})

// GET /api/stock-items — fetch stock, optionally filtered by project_id
export async function GET(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  const userClient = createUserClient(user.accessToken)
  let query = userClient.from('stock_items').select('*')
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query.order('name', { ascending: true })

  if (error) {
    console.error('[API] stock_items error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

// POST /api/stock-items — create or update a stock item
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roleError = requireRole(user, 'stock_items')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { data, error: validationError } = validateBody(stockItemSchema, await req.json())
  if (validationError) return validationError

  const userClient = createUserClient(user.accessToken)
  const { data: existing } = await userClient
    .from('stock_items')
    .select('*')
    .eq('code', data.code)
    .single()

  if (existing) {
    const diff = computeDiff(existing as Record<string, unknown>, data as Record<string, unknown>)
    const { data: updated, error } = await userClient
      .from('stock_items')
      .update(data)
      .eq('code', data.code)
      .select()
      .single()

    if (error) {
      console.error('[API] stock_items update error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    logAudit({
      table_name: 'stock_items',
      record_id: data.code,
      action: 'UPDATE',
      changed_by: user.id,
      changed_fields: diff,
    }).catch(() => {})

    return NextResponse.json(updated)
  }

  const { data: inserted, error } = await userClient
    .from('stock_items')
    .insert(data)
    .select()
    .single()

  if (error) {
    console.error('[API] stock_items insert error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  logAudit({
    table_name: 'stock_items',
    record_id: data.code,
    action: 'INSERT',
    changed_by: user.id,
  }).catch(() => {})

  return NextResponse.json(inserted, { status: 201 })
}

// DELETE /api/stock-items?code=M-CEM-OPC
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roleError = requireRole(user, 'stock_items')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })

  const userClient = createUserClient(user.accessToken)
  const { error } = await userClient.from('stock_items').delete().eq('code', code)

  if (error) {
    console.error('[API] stock_items delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  logAudit({
    table_name: 'stock_items',
    record_id: code,
    action: 'DELETE',
    changed_by: user.id,
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
