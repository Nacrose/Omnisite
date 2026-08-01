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
  // True demo mode — no Supabase configured at all, or demo mode explicitly
  // enabled via OMNISITE_DEMO_MODE=true. Safe to allow.
  if (!isServerSupabaseConfigured() || process.env.OMNISITE_DEMO_MODE === 'true') {
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

  // Defense-in-depth: even when OMNISITE_DEMO_MODE=true allows requireAuth()
  // to return a demo user, block writes to sensitive tables if the user has
  // no real access token. This prevents a demo user from mutating a real
  // Supabase database when both demo mode AND Supabase are configured
  // (e.g., a staging environment). RLS would also reject these, but this
  // makes the guard explicit and fails fast with a clear error.
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
