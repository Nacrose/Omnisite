import { NextRequest, NextResponse } from 'next/server'
import type { z } from 'zod'
import {
  createUserClient,
  getServiceClient,
  isServerSupabaseConfigured,
} from '@/lib/supabase-server'
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

// ─── Demo-mode guard ────────────────────────────────────────────────────────
//
// In demo mode (no Supabase configured), requireAuth() returns a demo user
// with `accessToken: ''`. createUserClient('') then throws "Supabase not
// configured" because the client constructor checks the env vars. This
// affects every project-scoped CRUD route — the bell's /api/notifications
// fetch, /api/boq, /api/tasks, etc. all 500 in demo mode.
//
// The fix: short-circuit demo mode at each route handler. GET returns []
// (or the pagination envelope with empty data) — the client-side
// useSyncedState hook already falls back to localStorage in demo mode, so
// the empty server response is never actually consumed. POST/DELETE return
// 503 with a clear message — demo writes go through usePersistentState,
// not the API.
//
// In production (Supabase configured) this guard is a no-op — the real
// client is constructed as before.
function isDemoUser(user: AuthenticatedUser | null): boolean {
  return !isServerSupabaseConfigured() || (user != null && !user.accessToken)
}

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

    // ─── Demo mode short-circuit ───────────────────────────────────────────
    // In demo mode there's no DB to query — return an empty result so the
    // client-side useSyncedState hook falls back to localStorage without
    // seeing a 500. Mirrors the pagination envelope shape when limit>0.
    if (isDemoUser(user)) {
      if (limit > 0 && cursorField) {
        return NextResponse.json({ data: [], nextCursor: null })
      }
      if (emptyArrayOnEmpty) {
        return NextResponse.json([])
      }
      return NextResponse.json([])
    }

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

    // ─── Demo mode short-circuit (before validateBody) ────────────────────
    // Demo writes go through usePersistentState (localStorage), not the API.
    // Return 503 with a clear message instead of letting createUserClient
    // throw "Supabase not configured" (which becomes a generic 500 + the
    // global error toast fires on every keystroke).
    //
    // Placed BEFORE validateBody so demo POSTs always get the 503 message
    // regardless of body shape. Previously a demo POST with a malformed
    // body would get a 400 Zod error before the 503 fired — inconsistent
    // (the runtime audit caught this as RT-3).
    if (isDemoUser(user)) {
      return NextResponse.json(
        {
          error:
            'Demo mode — writes are stored in the browser only. Configure Supabase to persist server-side.',
        },
        { status: 503 }
      )
    }

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

    // Project-scoped write gate.
    //
    // INSERT (no oldData): the body's project_id is the target. Verify the
    // user has access to it — without this, a malicious user with a valid
    // session could craft a body with a foreign project_id and write to a
    // project they're not assigned to (upsertWithAudit uses the service
    // role, which bypasses RLS).
    //
    // UPDATE (oldData present): the user already proved read access to the
    // row's existing project_id (the RLS-gated pre-flight read above).
    // BUT a malicious user could re-POST the row with a different
    // project_id, silently moving the row into a project they have no
    // assignment to. Reject any project_id change — project transfer is
    // not allowed via this generic CRUD route.
    //
    // ─── PK hijack defense (pass-2 audit P0-1) ────────────────────────────
    // The pre-flight read above is RLS-gated, so oldData=null when the row
    // exists in a foreign project the user can't read. Without this check,
    // a user could POST with a foreign PK + their own project_id — the
    // service-role upsert's ON CONFLICT (pk) DO UPDATE would silently
    // overwrite the foreign row, moving it into the attacker's project.
    // Most exploitable on worker_attendance (PK = WA-<worker>-<date>).
    //
    // Fix: do a SERVICE-ROLE existence check on the PK. If it exists in
    // ANY project, reject with 409. The user should use the UPDATE path
    // (which goes through the oldData branch + is properly gated) instead.
    if (isProjectScopedTable(table)) {
      const bodyProjectId = bodyRecord.project_id as string | undefined

      if (oldData) {
        const oldProjectId = (oldData as Record<string, unknown>).project_id as string | undefined
        if (bodyProjectId && oldProjectId && bodyProjectId !== oldProjectId) {
          return NextResponse.json(
            {
              error:
                'Forbidden — cannot change project_id via update. Use the project transfer endpoint.',
            },
            { status: 403 }
          )
        }
        // If body omits project_id, restore the existing one so the upsert
        // doesn't null it out (upsertWithAudit uses the body verbatim).
        if (!bodyProjectId && oldProjectId) {
          bodyRecord.project_id = oldProjectId
        }
      } else {
        const hasAccess = await verifyProjectAccess(userClient, user.id, bodyProjectId)
        if (!hasAccess) {
          return NextResponse.json(
            { error: 'Forbidden — no access to this project' },
            { status: 403 }
          )
        }

        // ─── PK collision check (service-role, bypasses RLS) ─────────────
        // If the body carries a PK that already exists in ANY project
        // (even one RLS hid from the user-scoped read above), this is
        // either a hijack attempt or a legitimate update the user
        // doesn't have read access to. Either way, reject — the upsert's
        // ON CONFLICT DO UPDATE would silently overwrite the foreign row.
        if (pkValue) {
          try {
            const serviceClient = getServiceClient()
            const { data: existingByService } = await serviceClient
              .from(table)
              .select('project_id')
              .eq(pk, pkValue as string)
              .limit(1)
            if (existingByService && existingByService.length > 0) {
              return NextResponse.json(
                {
                  error:
                    'Conflict — a record with this ID already exists. Use the update path (include the existing record ID in your request) instead of insert.',
                },
                { status: 409 }
              )
            }
          } catch {
            // getServiceClient throws if SUPABASE_SERVICE_ROLE_KEY isn't
            // configured. In that case, RLS is the only gate — which is
            // correct for deployments without audit logging. The pre-flight
            // user-scoped read already proved the user can't see a foreign
            // row, so the ON CONFLICT path would fire on a row they can't
            // read — but without the service role, the upsert itself would
            // also fail (upsertWithAudit requires the service role). So
            // this catch is only reachable in a misconfigured deployment.
            // Fail-closed: reject the write.
            return NextResponse.json(
              { error: 'Internal server error — audit logging not configured' },
              { status: 500 }
            )
          }
        }
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

    // ─── Demo mode short-circuit ───────────────────────────────────────────
    // Same as POST — demo deletes are local-only. Return 503 with a clear
    // message instead of letting createUserClient throw "Supabase not configured".
    if (isDemoUser(user)) {
      return NextResponse.json(
        {
          error: 'Demo mode — deletes are local-only. Configure Supabase to persist server-side.',
        },
        { status: 503 }
      )
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
