import { NextRequest, NextResponse } from 'next/server'
import { supabase, isServerSupabaseConfigured } from '@/lib/supabase-server'

export interface AuthenticatedUser {
  id: string
  email: string
  role: string
  /** The user's Supabase access token — pass to createUserClient() for RLS-scoped queries. */
  accessToken: string
}

/**
 * Verify that the incoming API request has a valid Supabase session.
 *
 * SECURITY MODEL:
 * - If Supabase is NOT configured (true demo mode — no env vars at all),
 *   requests pass through with a demo user. This is safe because there's
 *   no database to expose.
 * - If Supabase IS configured, the request MUST have a valid Bearer token.
 *   No exceptions, no bypass flags, no demo backdoors. An unauthenticated
 *   request gets a 401.
 *
 * The returned `accessToken` should be passed to `createUserClient()` to
 * create a per-request Supabase client that impersonates the user — all
 * queries are then scoped by RLS policies.
 */
export async function requireAuth(req: NextRequest): Promise<{
  user: AuthenticatedUser | null
  error: NextResponse | null
}> {
  // True demo mode — no Supabase configured at all. Safe to allow.
  if (!isServerSupabaseConfigured()) {
    return {
      user: { id: 'demo-user', email: 'demo@omnisite', role: 'PM', accessToken: '' },
      error: null,
    }
  }

  try {
    // Extract the Bearer token from the Authorization header.
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Unauthorized — no Bearer token provided' },
          { status: 401 }
        ),
      }
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify the token with Supabase. This checks that the token is valid
    // and not expired. The user's RLS policies will apply when this token
    // is used to create a user-scoped client.
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
        accessToken: token,
      },
      error: null,
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
