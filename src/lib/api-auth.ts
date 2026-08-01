import { NextRequest, NextResponse } from 'next/server'
import { supabase, isServerSupabaseConfigured } from '@/lib/supabase-server'

export interface AuthenticatedUser {
  id: string
  email: string
  role: string
}

/**
 * Verify that the incoming API request has a valid Supabase session.
 *
 * Checks the `Authorization: Bearer <access_token>` header (set by the
 * browser Supabase client) OR falls back to reading the session cookie.
 *
 * If Supabase is NOT configured (demo mode), the request is allowed through
 * with a demo user — the UI gate (login page) handles access control in
 * that case.
 *
 * @returns `{ user, error }` — if `error` is non-null, return it directly
 *          from your route handler to deny the request.
 */
export async function requireAuth(req: NextRequest): Promise<{
  user: AuthenticatedUser | null
  error: NextResponse | null
}> {
  // Demo mode — no Supabase configured, allow all requests.
  if (!isServerSupabaseConfigured()) {
    return {
      user: { id: 'demo-user', email: 'demo@omnisite', role: 'PM' },
      error: null,
    }
  }

  try {
    // Try to get the session from the request.
    // The browser Supabase client sends the access token as a Bearer header
    // OR as a cookie (depending on auth configuration).
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
      const meta = (u.user_metadata || {}) as Record<string, unknown>
      return {
        user: {
          id: u.id,
          email: u.email || '',
          role: (meta.role as string) || 'PM',
        },
        error: null,
      }
    }

    // No Bearer header — try cookie-based session.
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session?.user) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Unauthorized — no active session' },
          { status: 401 }
        ),
      }
    }
    const u = session.user
    const meta = (u.user_metadata || {}) as Record<string, unknown>
    return {
      user: {
        id: u.id,
        email: u.email || '',
        role: (meta.role as string) || 'PM',
      },
      error: null,
    }
  } catch {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Unauthorized — session check failed' },
        { status: 401 }
      ),
    }
  }
}

/**
 * Check if the authenticated user has permission for a module action.
 * Returns true if allowed, false if denied.
 *
 * In demo mode, all actions are allowed.
 */
export function canPerformAction(
  user: AuthenticatedUser | null,
  _module: string,
  _action: 'read' | 'write' | 'delete'
): boolean {
  if (!user) return false
  // PM has full access; other roles are checked on the client side via
  // lib/permissions.ts. Server-side enforcement is a secondary gate.
  if (user.role === 'PM') return true
  // For now, allow all authenticated users to read; writes require PM.
  // This can be extended with the full permission matrix from permissions.ts.
  if (_action === 'read') return true
  return user.role === 'PM'
}
