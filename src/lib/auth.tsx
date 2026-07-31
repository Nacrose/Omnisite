'use client'

/**
 * OmniSite auth context.
 *
 * Strategy:
 *  - When Supabase is configured (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY present),
 *    uses supabase.auth.signInWithPassword() / signOut() and listens for
 *    session changes via onAuthStateChange().
 *  - When Supabase is NOT configured, auto-logs in as a demo user
 *    "Arjun Sharma" (PM role) so the app remains fully usable in demo mode.
 *
 * The User shape is intentionally minimal — id / email / name / role — so
 * downstream code (permissions.ts, audit.ts) doesn't care which provider is
 * backing the session.
 */

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import type { Session, User as SupabaseUser, Subscription } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Role } from '@/lib/permissions'

export interface OmniUser {
  id: string
  email: string
  name: string
  role: Role
  /** True when running in demo mode (no Supabase). */
  isDemo: boolean
}

interface AuthContextValue {
  user: OmniUser | null
  loading: boolean
  isDemo: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  /**
   * Sign in as the demo user (Arjun Sharma, PM) without credentials.
   * Sets the `omnisite-demo-bypass` flag so subsequent getSession() calls
   * re-grant demo access until signOut() clears the flag.
   */
  signInAsDemo: () => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isDemo: false,
  signIn: async () => ({ error: 'AuthProvider not mounted' }),
  signOut: async () => {},
  signInAsDemo: () => {},
})

// ─── Demo user (no Supabase configured) ─────────────────────────────────────
const DEMO_USER: OmniUser = {
  id: 'demo-user-arjun',
  email: 'arjun.sharma@omnisite.demo',
  name: 'Arjun Sharma',
  role: 'PM',
  isDemo: true,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map a Supabase user to our OmniUser shape.
 * Role is read from user_metadata.role (set during invite / admin creation);
 * falls back to 'PM' so a freshly-created account can still see everything.
 */
function mapSupabaseUser(u: SupabaseUser): OmniUser {
  const meta = (u.user_metadata || {}) as Record<string, unknown>
  const role = (meta.role as Role) || 'PM'
  const name =
    (meta.name as string) ||
    (meta.full_name as string) ||
    u.email?.split('@')[0]?.split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') ||
    'Unknown User'
  return {
    id: u.id,
    email: u.email || '',
    name,
    role,
    isDemo: false,
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured()
  const [user, setUser] = useState<OmniUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    if (!configured || !supabase) {
      // Demo mode — auto-login as Arjun Sharma after a tiny delay so the
      // loading state is visible (matches the real auth flow visually).
      const t = setTimeout(() => {
        if (!active) return
        setUser(DEMO_USER)
        setLoading(false)
      }, 150)
      return () => {
        active = false
        clearTimeout(t)
      }
    }

    // Real Supabase flow — bootstrap from existing session, then subscribe.
    // But also allow demo login when no Supabase Auth users are configured yet.
    // This lets the app work during development before auth users are created.
    let subscription: Subscription | null = null

    // Helper: check the demo bypass flag (server-side safe).
    const isDemoBypass = () =>
      typeof window !== 'undefined' && window.localStorage.getItem('omnisite-demo-bypass') === 'true'

    supabase!.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (!active) return
      const s = data.session
      if (s?.user) {
        setUser(mapSupabaseUser(s.user))
      } else if (isDemoBypass()) {
        // No active session, but demo bypass is enabled — grant demo access.
        setUser(DEMO_USER)
      }
      // Otherwise user stays null — login page will show.
      setLoading(false)
    }).catch(() => {
      if (!active) return
      setLoading(false)
    })

    subscription = supabase!.auth.onAuthStateChange((event, session) => {
      if (!active) return
      // Don't let the INITIAL_SESSION event (which fires immediately after
      // getSession) clear the demo user if the bypass flag is set.
      if (event === 'INITIAL_SESSION' && isDemoBypass() && !session) {
        return
      }
      setUser(session?.user ? mapSupabaseUser(session.user) : null)
    }).data.subscription

    return () => {
      active = false
      subscription?.unsubscribe()
    }
  }, [configured])

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    if (!configured || !supabase) {
      // Demo mode — accept any non-empty credentials and "sign in" as Arjun.
      if (!email.trim() || !password.trim()) {
        return { error: 'Email and password are required' }
      }
      setUser(DEMO_USER)
      return { error: null }
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  const signOut = async () => {
    // Always clear the demo bypass flag on sign-out so a real Supabase
    // user can sign in afterwards without manually clearing localStorage.
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('omnisite-demo-bypass')
    }
    if (!configured || !supabase) {
      setUser(null)
      return
    }
    await supabase.auth.signOut()
    setUser(null)
  }

  const signInAsDemo = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('omnisite-demo-bypass', 'true')
    }
    setUser(DEMO_USER)
    setLoading(false)
  }

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, isDemo: configured ? false : true, signIn, signOut, signInAsDemo }),
    [user, loading, configured],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
