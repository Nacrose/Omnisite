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
  const { user, loading, signIn, signInAsDemo, isDemo } = useAuth()
  const configured = isSupabaseConfigured()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background theme-transition">
      {/* Brand */}
      <div className="flex items-center gap-2 mb-6">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--accent-foreground)] flex items-center justify-center shadow-sm">
          <Building2 className="w-5 h-5 text-white" strokeWidth={2.2} />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-base font-bold tracking-tight">OmniSite</span>
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            Construction Cloud
          </span>
        </div>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Sign in</CardTitle>
          <CardDescription>
            Enter your credentials to access the project workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
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
              <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
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

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 p-2.5 rounded-md bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300"
              >
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || loading}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {/* Demo mode notice */}
          {!configured && (
            <div
              role="status"
              className="mt-4 flex items-start gap-2 p-2.5 rounded-md bg-sky-500/10 border border-sky-500/30 text-[11px] text-sky-700 dark:text-sky-300"
            >
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold">Demo mode — Supabase not configured</div>
                <div className="mt-0.5 text-sky-700/80 dark:text-sky-300/80">
                  Enter any email and password to sign in as the demo user
                  (Arjun Sharma, PM role). All data stays in your browser.
                </div>
              </div>
            </div>
          )}

          {configured && isDemo === false && (
            <>
              <Button
                variant="outline"
                className="w-full mt-3"
                onClick={() => {
                  // Use the auth provider's signInAsDemo so the in-memory user
                  // is set immediately — relying on a fresh page load to pick
                  // up the localStorage flag would leave the user stuck on
                  // /login because AuthProvider only checks the flag on mount.
                  signInAsDemo()
                  router.push('/')
                }}
              >
                Continue as Demo User (Arjun Sharma, PM)
              </Button>
              <p className="mt-4 text-[10px] text-center text-muted-foreground">
                Forgot your password? Contact your project administrator.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-[10px] text-muted-foreground text-center max-w-sm">
        OmniSite · Enterprise Construction Management · FIDIC-compliant audit trail
      </p>
    </div>
  )
}
