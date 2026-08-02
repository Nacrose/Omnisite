import { NextRequest, NextResponse } from 'next/server'
import type { z } from 'zod'
import { createUserClient } from '@/lib/supabase-server'
import {
  requireAuth,
  requireRole,
  verifyProjectAccess,
  isProjectScopedTable,
  type AuthenticatedUser,
} from '@/lib/api-auth'
import { upsertWithAudit, deleteWithAudit } from '@/lib/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { logDbError } from '@/lib/safe-log'
import { validateBody } from '@/lib/validation'

// ─── createCrudHandler ──────────────────────────────────────────────────────
// Eliminates the ~2400 lines of copy-paste across the 15 business-table API
// routes. Each route file shrinks to ~10 lines: import the factory, import the
// Zod schema from validation.ts, export { GET, POST, DELETE }.
//
// The factory preserves the exact pipeline the hand-written routes followed:
//
//   GET    : requireAuth → checkRateLimit → userClient.from(table).select(*)
//            → optional project_id filter → optional cursor pagination
//            (limit+1 hasNext detection) → logDbError on failure.
//   POST   : requireAuth → requireRole → checkRateLimit → validateBody →
//            optional transformBody → RLS-gated pre-flight read for oldData →
//            verifyProjectAccess on INSERTs → upsertWithAudit (service-role,
//            transactional) → logDbError + sanitized 500 on failure.
//   DELETE : requireAuth → requireRole → checkRateLimit → pre-flight read
//            (RLS-gated) → deleteWithAudit (service-role, transactional) →
//            logDbError + sanitized 500 on failure.
//
// The variations between routes (cursor field, sort field + direction, PK
// column, cbs_nodes accepting ?code= AND ?id=, grns/stock_items returning []
// on empty + 201 on INSERT, chat_messages overriding sender_id/sender_name
// from the session) are expressed as config flags.

export interface CrudConfig<T> {
  /** Database table name (e.g. 'boq_items'). */
  table: string
  /** Zod schema used to validate the POST body. */
  schema: z.ZodSchema<T>
  /** Primary-key column (defaults to 'id'). cbs_nodes uses 'code'. */
  pk?: string
  /**
   * Cursor field for pagination. When set, GET honors ?limit= and ?cursor=
   * and returns { data, nextCursor } when limit > 0. When omitted, GET
   * returns the full list as a JSON array.
   */
  cursorField?: string
  /** Sort field for GET ordering (defaults to 'created_at'). */
  orderField?: string
  /** Sort direction (defaults to true = ascending). */
  orderAscending?: boolean
  /**
   * Cursor value type. 'string' is passed as-is; 'number' is parsed via
   * Number(cursor) before the .gt() filter (matches the tasks route, which
   * uses an INTEGER sort_order column). Defaults to 'string'.
   */
  cursorType?: 'string' | 'number'
  /**
   * Accept ?id= as an alias for ?code= on DELETE (cbs_nodes compatibility —
   * its PK is 'code' but some clients still send ?id=).
   */
  acceptLegacyIdParam?: boolean
  /** Return [] instead of null when GET yields no rows (grns, stock_items). */
  emptyArrayOnEmpty?: boolean
  /** Return 201 on INSERT, 200 on UPDATE (grns, stock_items). */
  status201OnInsert?: boolean
  /**
   * Optional body transform run AFTER validation, BEFORE the pre-flight read.
   * Used by chat_messages to override sender_id / sender_name from the
   * authenticated session. May mutate body in place or return a new object.
   */
  transformBody?: (body: T, user: AuthenticatedUser) => void | T | Promise<void | T>
}

export function createCrudHandler<T>(config: CrudConfig<T>): {
  GET: (req: NextRequest) => Promise<NextResponse>
  POST: (req: NextRequest) => Promise<NextResponse>
  DELETE: (req: NextRequest) => Promise<NextResponse>
} {
  const {
    table,
    schema,
    pk = 'id',
    cursorField,
    orderField = 'created_at',
    orderAscending = true,
    cursorType = 'string',
    acceptLegacyIdParam = false,
    emptyArrayOnEmpty = false,
    status201OnInsert = false,
    transformBody,
  } = config

  // When a cursorField is set, the existing routes always order by the same
  // field (the cursor and the order column are the same). Preserve that.
  const effectiveOrderField = cursorField ?? orderField

  // ─── GET ──────────────────────────────────────────────────────────────
  async function GET(req: NextRequest): Promise<NextResponse> {
    const { user, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rateLimitError = await checkRateLimit(req, user.id)
    if (rateLimitError) return rateLimitError

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('project_id')
    const limit = parseInt(searchParams.get('limit') || '0', 10)
    const cursor = searchParams.get('cursor')

    const userClient = createUserClient(user.accessToken)
    let query = userClient.from(table).select('*')
    if (projectId) query = query.eq('project_id', projectId)

    // Cursor-based pagination: only when cursorField is configured AND a
    // cursor was supplied. The limit+1 trick lets us detect hasNext without
    // a second count(*) query.
    if (cursorField && cursor) {
      const cursorValue = cursorType === 'number' ? Number(cursor) : cursor
      query = query.gt(cursorField, cursorValue)
    }
    if (limit > 0) query = query.limit(limit + 1)

    const { data, error } = await query.order(effectiveOrderField, {
      ascending: orderAscending,
    })

    if (error) {
      logDbError(table, 'GET', error, { userId: user.id })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Pagination envelope is only returned when the caller asked for a page
    // (limit > 0) AND the route supports cursor pagination. Routes without
    // cursorField always return the raw array.
    if (limit > 0 && cursorField && data) {
      const hasMore = data.length > limit
      const items = hasMore ? data.slice(0, limit) : data
      const lastItem = items[items.length - 1] as Record<string, unknown> | undefined
      const nextCursorRaw = lastItem ? lastItem[cursorField] : null
      const nextCursor =
        nextCursorRaw == null
          ? null
          : cursorType === 'number'
            ? String(nextCursorRaw)
            : (nextCursorRaw as string)
      return NextResponse.json({ data: items, nextCursor })
    }

    // grns / stock_items return [] instead of null when the table is empty.
    if (emptyArrayOnEmpty) {
      return NextResponse.json(data || [])
    }

    return NextResponse.json(data)
  }

  // ─── POST ─────────────────────────────────────────────────────────────
  async function POST(req: NextRequest): Promise<NextResponse> {
    const { user, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const roleError = requireRole(user, table)
    if (roleError) return roleError

    const rateLimitError = await checkRateLimit(req, user.id)
    if (rateLimitError) return rateLimitError

    const rawBody = await req.json()
    const { data: validated, error: validationError } = validateBody(schema, rawBody)
    if (validationError) return validationError

    // Apply the optional body transform (chat_messages overrides sender_*).
    let body = validated
    if (transformBody) {
      const transformed = await transformBody(body, user)
      if (transformed !== undefined) body = transformed as T
    }

    const userClient = createUserClient(user.accessToken)
    const bodyRecord = body as Record<string, unknown>
    const pkValue = bodyRecord[pk]

    // Pre-flight read via the user-scoped client (RLS-gated). For UPDATE,
    // this proves the user has read access to the row. For INSERT (no
    // existing row), verifyProjectAccess below replaces the implicit RLS
    // check that the service-role upsert bypasses.
    const { data: oldData } = pkValue
      ? await userClient
          .from(table)
          .select('*')
          .eq(pk, pkValue as string)
          .single()
      : { data: null }

    // For INSERTs (no existing row), verify the user has access to the
    // target project_id. upsertWithAudit uses the service-role client which
    // bypasses RLS, so this explicit check is mandatory.
    if (!oldData && isProjectScopedTable(table)) {
      const projectId = bodyRecord.project_id as string | undefined
      const hasAccess = await verifyProjectAccess(userClient, user.id, projectId)
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Forbidden — no access to this project' },
          { status: 403 }
        )
      }
    }

    // Transactional upsert + audit log via service-role client. If either
    // fails, both roll back — the audit trail is never lost.
    const { data, error } = await upsertWithAudit(
      table,
      bodyRecord,
      pk,
      user.id,
      oldData ? 'UPDATE' : 'INSERT',
      (oldData as Record<string, unknown> | null) ?? null
    )

    if (error || !data) {
      logDbError(table, 'POST', error || 'no data returned', {
        recordId: (pkValue as string | undefined) ?? undefined,
        userId: user.id,
      })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (status201OnInsert && !oldData) {
      return NextResponse.json(data, { status: 201 })
    }

    return NextResponse.json(data)
  }

  // ─── DELETE ───────────────────────────────────────────────────────────
  async function DELETE(req: NextRequest): Promise<NextResponse> {
    const { user, error: authError } = await requireAuth(req)
    if (authError) return authError
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const roleError = requireRole(user, table)
    if (roleError) return roleError

    const rateLimitError = await checkRateLimit(req, user.id)
    if (rateLimitError) return rateLimitError

    const { searchParams } = new URL(req.url)
    // cbs_nodes has PK 'code' but accepts ?id= as a legacy alias.
    const id =
      pk === 'code' && acceptLegacyIdParam
        ? searchParams.get('code') || searchParams.get('id')
        : searchParams.get(pk)
    if (!id) {
      return NextResponse.json({ error: `${pk} required` }, { status: 400 })
    }

    // Pre-flight read via the user-scoped client (RLS-gated) — proves the
    // user has access to this row before we delete it via the service client.
    const userClient = createUserClient(user.accessToken)
    const { data: existing } = await userClient.from(table).select(pk).eq(pk, id).limit(1)

    if (!existing || existing.length === 0) {
      // Row doesn't exist OR RLS denies access — return 404 (don't leak which).
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Transactional delete + audit log via service-role client.
    const { error } = await deleteWithAudit(table, id, pk, user.id)

    if (error) {
      logDbError(table, 'DELETE', error, { recordId: id, userId: user.id })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  return { GET, POST, DELETE }
}
