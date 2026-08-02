'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Building2, Loader2, AlertCircle, Info, ArrowRight } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isSupabaseConfigured } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const { user, loading, signIn, isDemo } = useAuth()
  const configured = isSupabaseConfigured()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          <CardTitle className="text-lg">Sign in</CardTitle>
          <CardDescription>Enter your credentials to access the project workspace.</CardDescription>
        </CardHeader>
        <CardContent>
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
          </form>

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
                  data stays in your browser.
                </div>
              </div>
            </div>
          )}

          {configured && (
            <>
              <p className="text-muted-foreground mt-4 text-center text-[10px]">
                Forgot your password? Contact your project administrator.
              </p>
              <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-700 dark:text-amber-300">
                <strong>Demo access disabled.</strong> Sign in with your Supabase credentials. To
                explore without auth, run the app without
                <code className="mx-1 rounded bg-amber-500/20 px-1 py-0.5 font-mono">
                  NEXT_PUBLIC_SUPABASE_URL
                </code>
                configured.
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-6 max-w-sm text-center text-[10px]">
        OmniSite · Enterprise Construction Management · FIDIC-compliant audit trail
      </p>
    </div>
  )
}
