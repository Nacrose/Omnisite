import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

/**
 * Server-side Supabase client using the service_role key.
 * Bypasses RLS — used only in API routes (server-side, never exposed to client).
 *
 * Set SUPABASE_SERVICE_ROLE_KEY in your .env.local or Vercel env vars.
 * If not set, API routes will return 500 errors (client-side localStorage still works).
 *
 * Implemented as a lazy Proxy so importing this module does NOT throw at
 * build time when env vars are missing — the actual `createClient` call
 * is deferred until the first property access (i.e. the first API request).
 */
let _client: SupabaseClient | null = null
let _clientError: Error | null = null

function getClient(): SupabaseClient {
  if (_client) return _client
  if (_clientError) throw _clientError

  if (!supabaseUrl || !supabaseServiceKey) {
    _clientError = new Error(
      'Server Supabase client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment.'
    )
    throw _clientError
  }

  _client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _client
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient()
    const value = (client as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})

export const isServerSupabaseConfigured = (): boolean => {
  return supabaseUrl !== '' && supabaseServiceKey !== ''
}
