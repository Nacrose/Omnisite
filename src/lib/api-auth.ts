import { NextRequest, NextResponse } from 'next/server'
import {
  supabase,
  isServerSupabaseConfigured,
  createServerSupabaseClient,
} from '@/lib/supabase-server'
import type { Role } from '@/lib/permissions'

export interface AuthenticatedUser {
  id: string
  email: string
  role: Role
  /** The user's Supabase access token — pass to createUserClient() for RLS-scoped queries. */
  accessToken: string
}

// ─── Permission map: API table → required role for write operations ────────
// Read access is controlled by RLS (any authenticated user with project access
// can read). Write access is enforced here, server-side.
const TABLE_WRITE_ROLES: Record<string, Role[]> = {
  boq_items: ['PM', 'SITE_ENGINEER'],
  tasks: ['PM', 'SITE_ENGINEER'],
  dsr_entries: ['PM', 'SITE_ENGINEER', 'STOREKEEPER', 'FOREMAN'],
  cbs_nodes: ['PM'],
  requisitions: ['PM', 'SITE_ENGINEER', 'STOREKEEPER'],
  purchase_orders: ['PM', 'SITE_ENGINEER', 'STOREKEEPER'],
  drawings: ['PM', 'SITE_ENGINEER'],
  letters: ['PM', 'SITE_ENGINEER'],
  qs_items: ['PM', 'SITE_ENGINEER'],
  equipment: ['PM', 'SITE_ENGINEER'],
  subcontractors: ['PM'],
  workers: ['PM', 'SITE_ENGINEER', 'FOREMAN'],
  chat_messages: ['PM', 'SITE_ENGINEER', 'STOREKEEPER', 'FOREMAN'],
  projects: ['PM'],
  user_projects: ['PM'],
  grns: ['PM', 'SITE_ENGINEER', 'STOREKEEPER'],
  stock_items: ['PM', 'SITE_ENGINEER', 'STOREKEEPER'],
  // Unified vendor master (supersedes `subcontractors`). PM-only at the API
  // layer — the RLS policies in migration 00000000000010 §8 also allow
  // SITE_ENGINEER for supplier-category rows. Both layers must agree for a
  // write to go through; the stricter (intersection) wins. Keeping this
  // PM-only matches the financial-commitment stance of `subcontractors`.
  vendors: ['PM'],
  // Project locations (work-face / asset setup). SITE_ENGINEER can write
  // because field engineers set up locations on site, not just PMs.
  project_locations: ['PM', 'SITE_ENGINEER'],
  // Drawing annotations (markups / redlines on PDF pages). PM + Site Engineer
  // can author redlines; field teams (foremen, storekeepers) can read but not
  // annotate. Matches the RLS policy in migration 00000000000013 §3.
  drawing_annotations: ['PM', 'SITE_ENGINEER'],
  // RFIs (Requests For Information). Site engineers raise them, PMs
  // answer/close them. Storekeeper and Foreman are read-only (they need
  // visibility but don't author RFIs). Matches migration 28 RLS.
  rfis: ['PM', 'SITE_ENGINEER'],
  // Material Issue Notes (MINs). Storekeepers author them (they issue
  // material from the store); site engineers also author (sometimes
  // material is issued directly to a task without going through the store).
  // PMs can do everything; Foremen are read-only. Matches migration 29 RLS.
  material_issue_notes: ['PM', 'SITE_ENGINEER', 'STOREKEEPER'],
  // Notifications. Users can UPDATE their own read_at (RLS gates to
  // user_id = auth.uid()). PMs can DELETE for admin cleanup. INSERTs only
  // happen via the service-role cron route. All authenticated roles need
  // write so the bell's mark-as-read works for everyone.
  notifications: ['PM', 'SITE_ENGINEER', 'STOREKEEPER', 'FOREMAN'],
  // Per-day attendance records. Foremen log hours per worker per day;
  // site engineers can also author; PM can delete for cleanup.
  // Storekeeper is read-only. Matches migration 31 RLS.
  worker_attendance: ['PM', 'SITE_ENGINEER', 'FOREMAN'],
}

/**
 * Primary key column for each table. Used by API routes to pass an explicit
 * `onConflict` to .upsert() calls — without this, a malicious client can
 * overwrite an existing row by sending its PK in the body (Supabase defaults
 * to conflict-on-PK, but being explicit prevents ambiguity and documents
 * the expected conflict target per table).
 *
 * Tables not listed here default to 'id'.
 */
export const TABLE_PRIMARY_KEYS: Record<string, string> = {
  boq_items: 'id',
  tasks: 'id',
  dsr_entries: 'id',
  cbs_nodes: 'code', // cbs_nodes uses 'code' as PK, not 'id'
  requisitions: 'id',
  purchase_orders: 'id',
  drawings: 'id',
  letters: 'id',
  qs_items: 'id',
  equipment: 'id',
  subcontractors: 'id',
  workers: 'id',
  chat_messages: 'id',
  projects: 'id',
  user_projects: 'id',
  grns: 'id',
  stock_items: 'code', // stock_items uses 'code' as PK
  audit_log: 'id',
  vendors: 'id',
  project_locations: 'id',
  drawing_annotations: 'id',
  rfis: 'id',
  material_issue_notes: 'id',
  notifications: 'id',
  worker_attendance: 'id',
}

/** Get the PK column for a table (defaults to 'id'). */
export function getPrimaryKey(table: string): string {
  return TABLE_PRIMARY_KEYS[table] ?? 'id'
}

/**
 * Tables that have a `project_id` column (i.e. are project-scoped).
 * Used by verifyProjectAccess() to know which rows to gate.
 *
 * `projects` and `user_projects` are NOT project-scoped (they ARE the
 * project / assignment tables), so they're excluded.
 */
const PROJECT_SCOPED_TABLES = new Set([
  'boq_items',
  'tasks',
  'dsr_entries',
  'cbs_nodes',
  'requisitions',
  'purchase_orders',
  'drawings',
  'letters',
  'qs_items',
  'equipment',
  'subcontractors',
  'workers',
  'chat_messages',
  'grns',
  'stock_items',
  'vendors',
  'project_locations',
  'drawing_annotations',
  'rfis',
  'material_issue_notes',
  'notifications',
  'worker_attendance',
])

/**
 * Verify that the user has access to a specific project_id.
 *
 * IMPORTANT: this is the explicit ownership check that replaces the implicit
 * RLS gating when routes switch from userClient.upsert() (RLS-enforced) to
 * upsertWithAudit() (service-role, RLS-bypassed). Without this check, a
 * malicious user with a valid session could craft a body with a foreign
 * project_id and write to a project they're not assigned to.
 *
 * PMs are granted access to any project (matches the user_has_pm_access()
 * RLS helper). Other roles must have an explicit user_projects row.
 *
 * @returns true if the user has access, false otherwise.
 */
export async function verifyProjectAccess(
  userClient: import('@supabase/supabase-js').SupabaseClient,
  userId: string,
  projectId: string | undefined | null
): Promise<boolean> {
  if (!projectId) return false
  const { data, error } = await userClient
    .from('user_projects')
    .select('project_id')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .limit(1)
  if (error || !data) return false
  return data.length > 0
}

/**
 * Whether a table is project-scoped (has a project_id column).
 * Routes use this to decide whether to call verifyProjectAccess().
 */
export function isProjectScopedTable(table: string): boolean {
  return PROJECT_SCOPED_TABLES.has(table)
}

/**
 * Resolve the user's role from the `user_projects` table (the DB-backed source
 * of truth) instead of trusting `user_metadata.role`.
 *
 * SECURITY: user_metadata is set client-side during user creation (e.g., in the
 * Supabase Dashboard or via the admin API), which means anyone who can create
 * a user can set role: 'PM'. Reading from user_projects closes the
 * self-escalation gap — the role is only granted via an INSERT into
 * user_projects, which is itself RLS-gated to PMs only.
 *
 * Falls back to 'FOREMAN' (least-privilege) if the user has no user_projects
 * rows, so a freshly-created account can't read or write anything until an
 * admin assigns them a role.
 */
async function resolveUserRole(userId: string): Promise<Role> {
  const { data } = await supabase
    .from('user_projects')
    .select('role')
    .eq('user_id', userId)
    .order('role')
    .limit(1)
    .single()

  if (data?.role) {
    return data.role as Role
  }
  return 'FOREMAN'
}

/**
 * Verify that the incoming API request has a valid Supabase session.
 *
 * Two paths:
 * 1. Cookie-based (preferred): uses @supabase/ssr's createServerSupabaseClient
 *    to read the session from cookies. This is the SSR-native path that
 *    works with the proxy's auth gating.
 * 2. Bearer token (fallback): if the request has an Authorization header,
 *    verifies the token directly. Useful for API clients / programmatic
 *    access that don't carry cookies.
 *
 * No demo bypass. If Supabase is configured, one of the two paths must
 * succeed. Demo mode (no Supabase) returns a demo user.
 */
export async function requireAuth(req: NextRequest): Promise<{
  user: AuthenticatedUser | null
  error: NextResponse | null
}> {
  // True demo mode — no Supabase configured at all. Safe to allow.
  // (The old OMNISITE_DEMO_MODE env var bypass was removed because it
  // allowed PM-level demo access even when a real Supabase backend was
  // configured — a privilege escalation risk on staging/production.)
  if (!isServerSupabaseConfigured()) {
    return {
      user: { id: 'demo-user', email: 'demo@omnisite', role: 'PM', accessToken: '' },
      error: null,
    }
  }

  try {
    // Path 1: Cookie-based session (preferred — works with @supabase/ssr)
    // createServerSupabaseClient reads cookies via next/headers.
    const serverClient = await createServerSupabaseClient()
    const { data: cookieData, error: cookieError } = await serverClient.auth.getUser()

    if (!cookieError && cookieData.user) {
      const u = cookieData.user
      // Resolve role from user_projects (DB-backed) — NOT user_metadata.role,
      // which is client-set and vulnerable to self-escalation.
      const role = await resolveUserRole(u.id)
      // Get the access token from the session for RLS-scoped queries
      const { data: sessionData } = await serverClient.auth.getSession()
      return {
        user: {
          id: u.id,
          email: u.email || '',
          role,
          accessToken: sessionData.session?.access_token || '',
        },
        error: null,
      }
    }

    // Path 2: Bearer token fallback (for API clients without cookies)
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const { data, error } = await supabase.auth.getUser(token)
      if (error || !data.user) {
        return {
          user: null,
          error: NextResponse.json(
            { error: 'Unauthorized — invalid or expired session' },
            { status: 401 }
          ),
        }
      }
      const u = data.user
      // Resolve role from user_projects (DB-backed) — same as cookie path.
      const role = await resolveUserRole(u.id)
      return {
        user: {
          id: u.id,
          email: u.email || '',
          role,
          accessToken: token,
        },
        error: null,
      }
    }

    // Neither cookie nor Bearer token — unauthorized
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Unauthorized — no session cookie or Bearer token provided' },
        { status: 401 }
      ),
    }
  } catch {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Unauthorized — session verification failed' },
        { status: 401 }
      ),
    }
  }
}

/**
 * Require that the authenticated user has permission to WRITE to a table.
 * Call this in POST/DELETE handlers after requireAuth().
 *
 * @example
 *   const { user, error } = await requireAuth(req)
 *   if (error) return error
 *   const roleError = requireRole(user, 'boq_items')  // write access
 *   if (roleError) return roleError
 */
export function requireRole(user: AuthenticatedUser | null, table: string): NextResponse | null {
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Skip role enforcement only in true demo mode (no Supabase configured),
  // where there is no database to enforce RLS against.
  if (!isServerSupabaseConfigured()) return null

  // Defense-in-depth: block writes to sensitive tables if the user has no
  // real access token. This catches the case where `requireAuth()` returned
  // a demo user (because Supabase isn't configured) but a route handler is
  // somehow reached with a configured Supabase backend — e.g. a race
  // condition during deployment, or a misconfigured staging environment.
  // RLS would also reject these writes, but this guard fails fast with a
  // clear error message instead of a generic RLS denial.
  if (!user.accessToken) {
    return NextResponse.json(
      {
        error:
          'Forbidden — demo users cannot write to the database. Sign in with a real account to make changes.',
      },
      { status: 403 }
    )
  }

  const allowedRoles = TABLE_WRITE_ROLES[table]
  if (!allowedRoles) {
    // Unknown table — allow (table might not be in the map yet)
    return null
  }

  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json(
      {
        error: `Forbidden — role '${user.role}' cannot write to '${table}'. Required: ${allowedRoles.join(' or ')}.`,
      },
      { status: 403 }
    )
  }

  return null
}

/**
 * Check if a user can read a table (for potential future use).
 * Currently all authenticated users with project access can read (enforced by RLS).
 */
export function canRead(_user: AuthenticatedUser | null, _table: string): boolean {
  return true // RLS handles read access
}
