import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/**
 * Create a Supabase client for the edge proxy (middleware) that reads the
 * session from the incoming request's cookies and writes refreshed cookies
 * to the outgoing response.
 *
 * This is in a SEPARATE file from supabase-server.ts because the proxy runs
 * in the edge runtime, which cannot import `next/headers` (Node.js only).
 * Keeping the proxy client factory isolated prevents the edge bundle from
 * pulling in server-only modules.
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
