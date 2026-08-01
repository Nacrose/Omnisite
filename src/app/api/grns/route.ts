import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, requireRole, getPrimaryKey } from '@/lib/api-auth'
import { logAudit, computeDiff } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateBody } from '@/lib/validation'

// GRN (Goods Received Note) — 3-way match (PO vs GRN vs Invoice)
const grnSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  po_id: z.string().min(1),
  vendor: z.string().min(1),
  po_qty: z.number().min(0).default(0),
  grn_qty: z.number().min(0).default(0),
  invoice_qty: z.number().min(0).default(0),
  rate: z.number().min(0).default(0),
  pay_status: z.enum(['Cleared', 'Hold', 'Partial Hold', 'Awaiting GRN']).default('Awaiting GRN'),
  material_code: z.string().optional(),
  date: z.string().optional(),
})

// GET /api/grns — fetch GRNs, optionally filtered by project_id
export async function GET(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  const userClient = createUserClient(user.accessToken)
  let query = userClient.from('grns').select('*')
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query.order('date', { ascending: false })

  if (error) {
    console.error('[API] grns error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

// POST /api/grns — create or update a GRN
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roleError = requireRole(user, 'grns')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { data, error: validationError } = validateBody(grnSchema, await req.json())
  if (validationError) return validationError

  const userClient = createUserClient(user.accessToken)
  const { data: existing } = await userClient.from('grns').select('*').eq('id', data.id).single()

  if (existing) {
    const diff = computeDiff(existing as Record<string, unknown>, data as Record<string, unknown>)
    const { data: updated, error } = await userClient
      .from('grns')
      .update(data)
      .eq('id', data.id)
      .select()
      .single()

    if (error) {
      console.error('[API] grns update error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    logAudit({
      table_name: 'grns',
      record_id: data.id,
      action: 'UPDATE',
      changed_by: user.id,
      changed_fields: diff,
    }).catch(() => {})

    return NextResponse.json(updated)
  }

  const { data: inserted, error } = await userClient.from('grns').insert(data).select().single()

  if (error) {
    console.error('[API] grns insert error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  logAudit({
    table_name: 'grns',
    record_id: data.id,
    action: 'INSERT',
    changed_by: user.id,
  }).catch(() => {})

  return NextResponse.json(inserted, { status: 201 })
}

// DELETE /api/grns?id=GRN-XXX
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roleError = requireRole(user, 'grns')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const userClient = createUserClient(user.accessToken)
  const { error } = await userClient.from('grns').delete().eq('id', id)

  if (error) {
    console.error('[API] grns delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  logAudit({
    table_name: 'grns',
    record_id: id,
    action: 'DELETE',
    changed_by: user.id,
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
