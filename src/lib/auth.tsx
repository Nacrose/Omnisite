'use client'

/**
 * OmniSite auth context.
 *
 * Strategy:
 * - When Supabase is configured (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY present),
 *   uses supabase.auth.signInWithPassword() / signOut() and listens for
 *   session changes via onAuthStateChange(). No bypass, no backdoor.
 * - When Supabase is NOT configured (no env vars), auto-logs in as a demo
 *   user "Demo User" (PM role) so the app remains usable in demo mode.
 *   This is safe because there's no database to expose.
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
  /** True while the user's role is being resolved from user_projects. */
  roleLoading: boolean
  isDemo: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  roleLoading: false,
  isDemo: false,
  signIn: async () => ({ error: 'AuthProvider not mounted' }),
  signOut: async () => {},
})

// ─── Demo user (no Supabase configured) ─────────────────────────────────────
// Generic name avoids fingerprinting — anyone hitting an unconfigured
// deployment sees "Demo User" instead of a specific person's name.
const DEMO_USER: OmniUser = {
  id: 'demo-user',
  email: 'demo@omnisite.app',
  name: 'Demo User',
  role: 'PM',
  isDemo: true,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map a Supabase user to our OmniUser shape.
 *
 * SECURITY: Role is NO LONGER read from user_metadata.role (which is
 * client-set and vulnerable to self-escalation). Instead, the role starts
 * as 'FOREMAN' (least-privilege) and is resolved async from the
 * user_projects table via fetchUserRole(). The caller must call
 * fetchUserRole() after mapping to update the role.
 *
 * Name is still read from user_metadata (it's display-only, not security-relevant).
 */
function mapSupabaseUser(u: SupabaseUser): OmniUser {
  const meta = (u.user_metadata || {}) as Record<string, unknown>
  const name =
    (meta.name as string) ||
    (meta.full_name as string) ||
    u.email
      ?.split('@')[0]
      ?.split('.')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ') ||
    'Unknown User'
  return {
    id: u.id,
    email: u.email || '',
    name,
    role: 'FOREMAN', // least-privilege default; resolved async via fetchUserRole
    isDemo: false,
  }
}

/**
 * Fetch the user's role from the user_projects table (DB-backed source of
 * truth). Updates the OmniUser in-place via the setter. Falls back to
 * 'FOREMAN' if the user has no user_projects rows.
 *
 * Calls the onSettled callback when done (success or failure) so the caller
 * can clear its roleLoading flag.
 */
async function fetchUserRole(
  userId: string,
  setUser: (updater: (prev: OmniUser | null) => OmniUser | null) => void,
  onSettled?: () => void
): Promise<void> {
  if (!supabase) {
    onSettled?.()
    return
  }
  try {
    const { data } = await supabase
      .from('user_projects')
      .select('role')
      .eq('user_id', userId)
      .order('role')
      .limit(1)
      .single()

    if (data?.role) {
      setUser((prev) => (prev && prev.id === userId ? { ...prev, role: data.role as Role } : prev))
    }
  } catch {
    // User has no user_projects rows, or query failed — role stays as FOREMAN.
  } finally {
    onSettled?.()
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured()
  const [user, setUser] = useState<OmniUser | null>(null)
  const [loading, setLoading] = useState(true)
  // roleLoading is true between session bootstrap and the async role fetch
  // resolving. During this window, the UI shows FOREMAN permissions (the
  // least-privilege default) — callers should gate write buttons on this
  // flag to avoid letting users click actions they may not actually have.
  const [roleLoading, setRoleLoading] = useState(false)

  useEffect(() => {
    let active = true

    if (!configured || !supabase) {
      // Demo mode — no Supabase configured. Auto-login as Demo User
      // after a tiny delay so the loading state is visible.
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
    // NO demo bypass. If there's no session, the user must sign in.
    let subscription: Subscription | null = null

    supabase!.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) => {
        if (!active) return
        const s = data.session
        if (s?.user) {
          setUser(mapSupabaseUser(s.user))
          // Resolve role async from user_projects (DB-backed, not user_metadata)
          setRoleLoading(true)
          fetchUserRole(s.user.id, setUser, () => {
            if (active) setRoleLoading(false)
          })
        }
        // No session → user stays null → login page shows.
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setLoading(false)
      })

    subscription = supabase!.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      if (session?.user) {
        setUser(mapSupabaseUser(session.user))
        setRoleLoading(true)
        fetchUserRole(session.user.id, setUser, () => {
          if (active) setRoleLoading(false)
        })
      } else {
        setUser(null)
        setRoleLoading(false)
      }
    }).data.subscription

    return () => {
      active = false
      subscription?.unsubscribe()
    }
  }, [configured])

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    if (!configured || !supabase) {
      // Demo mode — accept any non-empty credentials and "sign in" as the demo user.
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
    if (!configured || !supabase) {
      setUser(null)
      return
    }
    await supabase.auth.signOut()
    setUser(null)
  }

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, roleLoading, isDemo: configured ? false : true, signIn, signOut }),
    [user, loading, roleLoading, configured]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
