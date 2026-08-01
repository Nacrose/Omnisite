import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

/**
 * Server-side Supabase client using the ANON key (NOT the service-role key).
 *
 * SECURITY MODEL:
 * - This client uses the anon key, which is subject to Row-Level Security
 *   (RLS) policies defined in Supabase.
 * - For user-facing API routes, we create a per-request client that
 *   impersonates the authenticated user by passing their access_token.
 *   This means all queries are scoped by the user's RLS policies —
 *   a user can only read/write rows they're authorized to see.
 * - The service-role client (`getServiceClient()`) is reserved for
 *   system-level operations (like audit logging) that need to bypass
 *   RLS. It should NEVER be used for user-facing data queries.
 *
 * Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in your
 * env vars. SUPABASE_SERVICE_ROLE_KEY is optional (only for audit logging).
 */

let _anonClient: SupabaseClient | null = null
let _clientError: Error | null = null

function getAnonClient(): SupabaseClient {
  if (_anonClient) return _anonClient
  if (_clientError) throw _clientError

  if (!supabaseUrl || !supabaseAnonKey) {
    _clientError = new Error(
      'Server Supabase client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.'
    )
    throw _clientError
  }

  _anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _anonClient
}

/**
 * The default export — an anon-key client with NO user context.
 * Subject to RLS, but with the anon role (not a specific user).
 * Used for: session verification (getUser), auth checks.
 *
 * For user-scoped data queries, use `createUserClient(accessToken)`
 * instead — that client impersonates the authenticated user.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getAnonClient()
    const value = (client as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})

/**
 * Create a per-request Supabase client that impersonates the authenticated
 * user by passing their access_token. All queries through this client are
 * scoped by the user's RLS policies.
 *
 * Use this in API route handlers after verifying the session:
 *   const { user, accessToken } = await requireAuth(req)
 *   const userClient = createUserClient(accessToken)
 *   const { data } = await userClient.from('boq_items').select('*')
 */
export function createUserClient(accessToken: string): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase not configured')
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}

/**
 * Service-role client — bypasses RLS entirely.
 * RESERVED for system operations only (audit logging, system maintenance).
 * NEVER use this for user-facing data queries.
 */
let _serviceClient: SupabaseClient | null = null

export function getServiceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured. Required for audit logging.')
  }
  _serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _serviceClient
}

/**
 * Check if the anon-key client is configured (basic Supabase setup).
 */
export const isServerSupabaseConfigured = (): boolean => {
  return supabaseUrl !== '' && supabaseAnonKey !== ''
}

/**
 * Check if the service-role key is configured (for audit logging).
 */
export const isServiceClientConfigured = (): boolean => {
  return supabaseUrl !== '' && supabaseServiceKey !== ''
}

// ─── @supabase/ssr cookie-based clients ────────────────────────────────────

/**
 * Create a Supabase client for Server Components and Route Handlers that
 * reads the session from cookies (set by the browser client via
 * @supabase/ssr). This is the SSR equivalent of the browser client —
 * same auth state, but accessible server-side.
 *
 * Must be called inside a request scope (Server Component, Route Handler,
 * or Server Action) — it uses next/headers cookies() which requires that
 * context.
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }
  const cookieStore = await cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing sessions.
          // The proxy.ts edge function handles cookie refresh.
        }
      },
    },
  })
}

/**
 * Create a Supabase client for the edge proxy (middleware) that reads the
 * session from the incoming request's cookies and writes refreshed cookies
 * to the outgoing response.
 *
 * This is the key piece that enables server-side auth gating: the proxy
 * can call supabase.auth.getUser() to verify the session before the page
 * even renders, and redirect to /login if there's no session.
 */
export function createProxySupabaseClient(req: NextRequest, res: NextResponse): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase not configured')
  }
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
      },
    },
  })
}
