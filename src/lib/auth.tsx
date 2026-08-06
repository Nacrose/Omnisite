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
  /**
   * Send a password-reset email. Supabase sends an email with a link
   * to a hosted page where the user picks a new password. Requires
   * Supabase to be configured (no demo-mode fallback).
   *
   * Pass the absolute redirect URL the user should land on after
   * resetting — typically \`window.location.origin + '/login'\`.
   * Supabase appends the recovery token as a hash fragment.
   */
  resetPassword: (email: string, redirectTo?: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  roleLoading: false,
  isDemo: false,
  signIn: async () => ({ error: 'AuthProvider not mounted' }),
  signOut: async () => {},
  resetPassword: async () => ({ error: 'AuthProvider not mounted' }),
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
  // In demo mode (no Supabase), loading starts as FALSE — there's nothing
  // to load, the demo user is set synchronously below. Starting as `true`
  // caused "stuck on loading workspace" if the useEffect's 150ms timeout
  // was delayed by slow hydration or JS chunk loading.
  // In Supabase mode, loading starts as true and resolves after
  // getSession() completes (or the 5s safety timeout fires).
  const [user, setUser] = useState<OmniUser | null>(configured ? null : DEMO_USER)
  const [loading, setLoading] = useState(configured)
  // roleLoading is true between session bootstrap and the async role fetch
  // resolving. During this window, the UI shows FOREMAN permissions (the
  // least-privilege default) — callers should gate write buttons on this
  // flag to avoid letting users click actions they may not actually have.
  const [roleLoading, setRoleLoading] = useState(false)

  useEffect(() => {
    let active = true

    if (!configured || !supabase) {
      // Demo mode — user is already set (DEMO_USER from initial state).
      // loading is already false. Nothing to do here.
      return () => {
        active = false
      }
    }

    // Real Supabase flow — bootstrap from existing session, then subscribe.
    // NO demo bypass. If there's no session, the user must sign in.
    let subscription: Subscription | null = null

    // Safety timeout — if getSession() hangs (network issue, CSP blocking,
    // misconfigured env), force loading=false after 5 seconds so the Sign In
    // button becomes clickable.
    const timeout = setTimeout(() => {
      if (active) setLoading(false)
    }, 5000)

    supabase!.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) => {
        if (!active) return
        clearTimeout(timeout)
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
        clearTimeout(timeout)
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

  /**
   * Send a password-reset email. Supabase's resetPasswordForEmail() sends
   * a recovery link to the user's inbox. The link points to Supabase's
   * hosted recovery page, which redirects to `redirectTo` (with a recovery
   * token in the hash fragment) after the user picks a new password.
   *
   * The redirect URL must be in Supabase's allowed redirect URLs list
   * (Dashboard → Authentication → URL Configuration). For local dev, add
   * http://localhost:3000/login; for production, add https://your-domain/login.
   *
   * Returns { error: null } on success (the email is queued by Supabase).
   * Returns { error: string } if Supabase is not configured, if the rate
   * limit is hit, or if the email doesn't exist (Supabase returns success
   * for unknown emails to prevent user enumeration, so callers can't tell
   * the difference — the toast always says "if the email exists, you'll
   * get a reset link").
   */
  const resetPassword = async (
    email: string,
    redirectTo?: string
  ): Promise<{ error: string | null }> => {
    if (!configured || !supabase) {
      return { error: 'Password reset is not available in demo mode.' }
    }
    const redirectUrl = redirectTo || `${window.location.origin}/login`
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    })
    if (error) return { error: error.message }
    return { error: null }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      roleLoading,
      isDemo: configured ? false : true,
      signIn,
      signOut,
      resetPassword,
    }),
    [user, loading, roleLoading, configured]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
