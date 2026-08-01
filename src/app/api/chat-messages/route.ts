import { NextRequest, NextResponse } from 'next/server'
import { createUserClient } from '@/lib/supabase-server'
import { requireAuth, requireRole } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { validateBody, chatMessageSchema } from '@/lib/validation'

// GET /api/chat-messages — fetch chat messages, optionally filtered by project_id
export async function GET(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)
  let query = userClient.from('chat_messages').select('*')
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query.order('created_at', { ascending: true })

  if (error) {
    console.error('[API] chat_messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  return NextResponse.json(data)
}

// POST /api/chat-messages — upsert a chat message
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'chat_messages')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const rawBody = await req.json()
  const { data: body, error: validationError } = validateBody(chatMessageSchema, rawBody)
  if (validationError) return validationError

  // Override sender fields with the authenticated user's identity
  body.sender_id = user.id
  body.sender_name = user.email

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)

  // Fetch old values for audit (before the upsert overwrites them).
  const { data: oldData } = body.id
    ? await userClient.from('chat_messages').select('*').eq('id', body.id).single()
    : { data: null }

  const { data, error } = await userClient
    .from('chat_messages')
    .upsert(body)
    .select()

  if (error) {
    console.error('[API] chat_messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Audit log the mutation (fire-and-forget, uses service-role client).
  logAudit({
    table_name: 'chat_messages',
    record_id: body.id || data?.[0]?.id || 'unknown',
    action: oldData ? 'UPDATE' : 'INSERT',
    changed_by: user.id,
    changed_fields: oldData ? { old: oldData, new: body } : undefined,
  }).catch(() => {})

  return NextResponse.json(data)
}

// DELETE /api/chat-messages — delete a chat message by id
export async function DELETE(req: NextRequest) {
  const { user, error: authError } = await requireAuth(req)
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const roleError = requireRole(user, 'chat_messages')
  if (roleError) return roleError

  const rateLimitError = await checkRateLimit(req, user.id)
  if (rateLimitError) return rateLimitError

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Use a user-scoped client so RLS policies are enforced.
  const userClient = createUserClient(user.accessToken)
  const { error } = await userClient
    .from('chat_messages')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[API] chat_messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Audit log the deletion.
  logAudit({
    table_name: 'chat_messages',
    record_id: id,
    action: 'DELETE',
    changed_by: user.id,
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
