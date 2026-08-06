'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Building2,
  Loader2,
  AlertCircle,
  Info,
  ArrowRight,
  Mail,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isSupabaseConfigured } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const { user, loading, signIn, resetPassword, isDemo } = useAuth()
  const configured = isSupabaseConfigured()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Forgot-password flow state. When `forgotMode` is true, the form
  // shows the email field only and the submit button says "Send reset
  // link" instead of "Sign in".
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetSubmitting, setResetSubmitting] = useState(false)

  // Show error from proxy redirect (e.g. auth service unavailable).
  // Computed outside the effect to avoid the set-state-in-effect lint rule.
  const [proxyError] = useState(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    const err = params.get('error')
    if (err === 'auth_service_unavailable') {
      return 'Authentication service is temporarily unavailable. Please try again in a moment.'
    }
    return null
  })

  // If already signed in, bounce to /.
  useEffect(() => {
    if (!loading && user) {
      router.replace('/')
    }
  }, [loading, user, router])

  // ─── Sign-in handler ──────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: signInError } = await signIn(email.trim(), password)
    setSubmitting(false)
    if (signInError) {
      setError(signInError)
      return
    }
    router.replace('/')
  }

  // ─── Forgot-password handler ──────────────────────────────────────────────
  // Calls Supabase's resetPasswordForEmail(). Supabase always returns success
  // (even for unknown emails) to prevent user enumeration — so we show a
  // generic "if the email exists, you'll get a link" message.
  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Enter your email above first')
      return
    }
    setResetSubmitting(true)
    const { error: resetError } = await resetPassword(email.trim())
    setResetSubmitting(false)
    if (resetError) {
      setError(resetError)
      return
    }
    setResetSent(true)
  }

  return (
    <div className="bg-background theme-transition flex min-h-screen flex-col items-center justify-center px-4">
      {/* Brand */}
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--accent-foreground)] shadow-sm">
          <Building2 className="h-5 w-5 text-white" strokeWidth={2.2} />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-base font-bold tracking-tight">OmniSite</span>
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Construction Cloud
          </span>
        </div>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">
            {forgotMode ? (resetSent ? 'Check your email' : 'Reset password') : 'Sign in'}
          </CardTitle>
          <CardDescription>
            {forgotMode
              ? resetSent
                ? 'If the email exists, a reset link is on its way.'
                : 'Enter your email and we’ll send a link to reset your password.'
              : 'Enter your credentials to access the project workspace.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resetSent ? (
            // ─── Reset-sent confirmation ────────────────────────────────────
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <div>
                  Reset link sent to <span className="font-mono">{email}</span> if an account exists
                  for that address. Check your inbox (and spam folder) — the link expires in 1 hour.
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full gap-1.5"
                onClick={() => {
                  setForgotMode(false)
                  setResetSent(false)
                  setError(null)
                }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </Button>
            </div>
          ) : forgotMode ? (
            // ─── Forgot-password form ───────────────────────────────────────
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-muted-foreground text-xs font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={resetSubmitting}
                  autoFocus
                />
              </div>

              {(error || proxyError) && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-700 dark:text-red-300"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>{error || proxyError}</span>
                </div>
              )}

              <Button type="submit" className="w-full gap-1.5" disabled={resetSubmitting}>
                {resetSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending reset link…
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Send reset link
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setForgotMode(false)
                  setError(null)
                }}
                className="text-muted-foreground hover:text-foreground mx-auto block text-[10px] underline-offset-2 hover:underline"
              >
                ← Back to sign in
              </button>
            </form>
          ) : (
            // ─── Sign-in form ──────────────────────────────────────────────
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-muted-foreground text-xs font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-muted-foreground text-xs font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>

              {(error || proxyError) && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-700 dark:text-red-300"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>{error || proxyError}</span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              {/* Forgot-password link — replaces the previous "Contact your
                  project administrator" dead-end. */}
              {configured && (
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(true)
                    setError(null)
                  }}
                  className="text-muted-foreground hover:text-foreground mx-auto block text-[10px] underline-offset-2 hover:underline"
                >
                  Forgot your password?
                </button>
              )}
            </form>
          )}

          {/* Demo mode notice */}
          {!configured && (
            <div
              role="status"
              className="mt-4 flex items-start gap-2 rounded-md border border-sky-500/30 bg-sky-500/10 p-2.5 text-[11px] text-sky-700 dark:text-sky-300"
            >
              <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <div>
                <div className="font-semibold">Demo mode — Supabase not configured</div>
                <div className="mt-0.5 text-sky-700/80 dark:text-sky-300/80">
                  Enter any email and password to sign in as the demo user (Demo User, PM role). All
                  data stays in your browser. Password reset is unavailable in demo mode.
                </div>
              </div>
            </div>
          )}

          {configured && !forgotMode && !resetSent && (
            <div className="text-muted-foreground mt-4 text-center text-[10px]">
              First time here? Ask your PM to invite you from Admin → Users.
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-6 max-w-sm text-center text-[10px]">
        OmniSite · Enterprise Construction Management · FIDIC-compliant audit trail
      </p>
    </div>
  )
}
