import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Lazy-init: only create the client if URL and key are provided
// This prevents "supabaseUrl is required" errors on Vercel when env vars aren't set yet
let _supabase: SupabaseClient | null = null

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabase) {
      if (supabaseUrl && supabaseAnonKey) {
        _supabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: true, autoRefreshToken: true },
          realtime: { params: { eventsPerSecond: 10 } },
        })
      } else {
        // Return a no-op client that won't crash but won't do anything
        throw new Error('Supabase not configured — using localStorage fallback')
      }
    }
    return _supabase[prop as keyof SupabaseClient]
  },
})

export const isSupabaseConfigured = () => {
  return supabaseUrl !== '' && supabaseAnonKey !== ''
}
