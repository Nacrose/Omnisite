import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, requireRole } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateBody } from '@/lib/validation'

// Subcontractors
const subcontractorSchema = z.object({
  id: z.string().min(1),
  project_id: z.string().uuid().optional(),
  name: z.string().min(1),
  scope: z.string().optional(),
  agreement_value: z.number().min(0).default(0),
  advance_paid: z.number().min(0).default(0),
  advance_pct: z.number().default(0),
  retention_pct: z.number().default(0),
  rework_cost: z.number().min(0).default(0),
  status: z.string().default('Active'),
  pan: z.string().optional(),
  gst: z.string().optional(),
  insurance_expiry: z.string().optional(),
  labour_license_expiry: z.string().optional(),
  is_tunneling: z.boolean().default(false),
  items: z.string().optional(), // serialized JSON
  material_issues: z.string().optional(), // serialized JSON
  material_returns: z.string().optional(), // serialized JSON
  consumables: z.string().optional(), // serialized JSON
  custom_deductibles: z.string().optional(), // serialized JSON
  assigned_tasks: z.string().optional(), // serialized JSON
  ncr_count: z.number().int().min(0).default(0),
  incidents: z.number().int().min(0).default(0),
})

// GET /api/subcontractors — fetch subcontractors, optionally filtered by project_id
export async function GET(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimitError = checkRateLimit(req)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)
  let query = userClient.from('subcontractors').select('*')
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query.order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

// POST /api/subcontractors — upsert a subcontractor
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'subcontractors')
  if (roleError) return roleError

  const rateLimitError = checkRateLimit(req)
  if (rateLimitError) return rateLimitError

  const rawBody = await req.json()
  const { data: body, error: validationError } = validateBody(subcontractorSchema, rawBody)
  if (validationError) return validationError

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)
  const { data, error } = await userClient
    .from('subcontractors')
    .upsert(body)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Audit log the mutation (fire-and-forget, uses service-role client).
  logAudit({
    table_name: 'subcontractors',
    record_id: body.id || data?.[0]?.id || 'unknown',
    action: 'UPDATE',
    changed_by: user.email,
  }).catch(() => {})

  return NextResponse.json(data)
}

// DELETE /api/subcontractors — delete a subcontractor by id
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'subcontractors')
  if (roleError) return roleError

  const rateLimitError = checkRateLimit(req)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)
  const { error } = await userClient
    .from('subcontractors')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Audit log the deletion.
  logAudit({
    table_name: 'subcontractors',
    record_id: id,
    action: 'DELETE',
    changed_by: user.email,
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
