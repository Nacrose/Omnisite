import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

/**
 * Server-side Supabase client using the service_role key.
 * Bypasses RLS — used only in API routes (server-side, never exposed to client).
 *
 * Set SUPABASE_SERVICE_ROLE_KEY in your .env.local or Vercel env vars.
 * If not set, API routes will return 500 errors (client-side localStorage still works).
 */
export const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey || 'missing-service-key',
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
)

export const isServerSupabaseConfigured = (): boolean => {
  return supabaseUrl !== '' && supabaseServiceKey !== ''
}
