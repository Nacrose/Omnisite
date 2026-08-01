import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const isSupabaseConfigured = (): boolean => {
  return supabaseUrl !== '' && supabaseAnonKey !== ''
}

/**
 * Browser-side Supabase client — uses @supabase/ssr's createBrowserClient.
 *
 * This switches auth persistence from localStorage to cookies, which means:
 * - The session cookie is readable by the edge proxy (server-side auth gating)
 * - No more localStorage/cookie mismatch (the previous login-loop root cause)
 * - The proxy can refresh the session cookie on every request
 *
 * Only initialized when env vars are present. When not configured, the app
 * runs in demo mode (auto-login as demo user, all data in localStorage).
 * Callers must check isSupabaseConfigured() before accessing `supabase`.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createBrowserClient(supabaseUrl, supabaseAnonKey, {
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null
