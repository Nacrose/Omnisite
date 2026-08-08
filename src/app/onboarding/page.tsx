'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Building2, Loader2, CheckCircle2, ArrowRight, Shield, Crown } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isSupabaseConfigured } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Onboarding wizard — Super Admin setup ─────────────────────────────────
//
// The FIRST user to sign in becomes Super Admin. The wizard:
//   1. Welcomes them + explains the role hierarchy
//   2. Collects their display name + organization name
//   3. Assigns SUPER_ADMIN role
//   4. Redirects to /dashboard
//
// After the first Super Admin is set up:
//   - Super Admin creates Admins (from Admin → Users)
//   - Admins create projects + assign PMs (from Admin → New Project)
//   - PMs invite Site Engineers / Storekeepers / Foremen
//
// No project creation happens in this wizard. The Super Admin's job
// is org-level setup — they'll create projects (or delegate to an Admin)
// from the Admin module after onboarding.

type Step = 'welcome' | 'profile' | 'done'

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading, isDemo } = useAuth()
  const configured = isSupabaseConfigured()

  const [step, setStep] = useState<Step>('welcome')
  const [checking, setChecking] = useState(true)
  const [existingProjects, setExistingProjects] = useState<
    Array<{ project_id: string; role: string }>
  >([])

  // Wizard form state
  const [name, setName] = useState('')
  const [orgName, setOrgName] = useState('')

  // ─── Auth gating ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (configured && !loading && !user) {
      router.replace('/login?redirect=/onboarding')
    }
  }, [loading, user, configured, router])

  // ─── On mount: load the user's name + check existing projects ────────────
  useEffect(() => {
    if (!user) return
    Promise.resolve().then(() => setName(user.name || ''))

    if (!configured) {
      Promise.resolve().then(() => setChecking(false))
      return
    }

    fetch('/api/user-projects', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return []
        return (await res.json()) as Array<{ project_id: string; role: string }>
      })
      .then((rows) => {
        setExistingProjects(rows)
        setChecking(false)
        if (rows.length > 0) {
          // User already has projects assigned — skip the wizard.
          setStep('done')
        }
      })
      .catch(() => {
        setChecking(false)
      })
  }, [user, configured])

  // ─── Create Super Admin role ─────────────────────────────────────────────
  const setupSuperAdmin = async () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }

    setStep('done')
    toast.success('Super Admin setup complete', {
      description: 'You can now create Admins and manage the organization from Admin → Users.',
    })

    // In demo mode, just redirect — the demo user is already PM
    if (!configured) {
      setTimeout(() => router.replace('/dashboard'), 1500)
      return
    }

    // In Supabase mode, call the onboarding API to assign SUPER_ADMIN
    try {
      const res = await fetch('/api/onboarding/create-first-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          org_name: orgName.trim() || undefined,
          user_name: name.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        // Non-fatal — user can still use the app, just without the
        // server-side role assignment
        console.warn('[onboarding] Super Admin setup failed:', data.error)
      }
    } catch {
      // Network error — non-fatal
    }

    setTimeout(() => router.replace('/dashboard'), 1500)
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  if (loading || checking) {
    return (
      <div className="bg-background flex min-h-screen flex-col items-center justify-center px-4">
        <Loader2 className="text-primary h-6 w-6 animate-spin" />
        <span className="text-muted-foreground mt-3 text-xs">Checking your setup…</span>
      </div>
    )
  }

  return (
    <div className="bg-background theme-transition flex min-h-screen flex-col items-center justify-center px-4 py-8">
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

      <Card className="w-full max-w-md">
        {/* Step indicator */}
        {step !== 'done' && (
          <div className="flex items-center justify-center gap-2 pt-4">
            {(['welcome', 'profile'] as const).map((s, i) => {
              const stepOrder = ['welcome', 'profile', 'done']
              const currentIdx = stepOrder.indexOf(step)
              const isDone = i < currentIdx
              const isActive = i === currentIdx
              return (
                <div
                  key={s}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    isDone ? 'bg-primary w-6' : isActive ? 'bg-primary w-8' : 'bg-muted w-6'
                  )}
                />
              )
            })}
          </div>
        )}

        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {step === 'welcome' && <Crown className="text-primary h-4 w-4" />}
            {step === 'done' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            {step === 'welcome' && 'Welcome to OmniSite'}
            {step === 'done' && 'Setup Complete'}
          </CardTitle>
          <CardDescription>
            {step === 'welcome' && 'You are the first user — you will be set up as Super Admin.'}
            {step === 'done' && 'Redirecting to your dashboard…'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === 'welcome' ? (
            <div className="space-y-4">
              {!configured && (
                <div className="rounded-md border border-sky-500/30 bg-sky-500/10 p-2.5 text-[11px] text-sky-700 dark:text-sky-300">
                  Demo mode — Supabase not configured. You can walk through the wizard but role
                  assignment won't persist server-side.
                </div>
              )}

              {/* Role hierarchy explanation */}
              <div className="border-border bg-card space-y-2 rounded-lg border p-3">
                <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Role Hierarchy
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Crown className="h-3.5 w-3.5 text-amber-500" />
                    <span className="font-medium">Super Admin</span>
                    <span className="text-muted-foreground">
                      — you (creates Admins, manages org)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pl-4">
                    <Shield className="h-3 w-3 text-blue-500" />
                    <span>Admin</span>
                    <span className="text-muted-foreground">— creates projects, assigns PMs</span>
                  </div>
                  <div className="flex items-center gap-2 pl-8">
                    <Building2 className="h-3 w-3 text-violet-500" />
                    <span>PM</span>
                    <span className="text-muted-foreground">— manages project, invites team</span>
                  </div>
                  <div className="flex items-center gap-2 pl-12">
                    <span className="text-muted-foreground">
                      Site Engineer / Storekeeper / Foreman
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-muted-foreground text-xs leading-relaxed">
                After setup, go to Admin → Users to create your first Admin. The Admin will then
                create projects and assign Project Managers.
              </p>

              <Button className="w-full gap-1.5" onClick={() => setStep('profile')}>
                Get started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : step === 'done' ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <div className="text-sm font-semibold">You are Super Admin</div>
              <div className="text-muted-foreground text-center text-xs">
                Go to Admin → Users to create Admins who will set up projects and assign PMs.
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => router.replace('/dashboard')}
              >
                Go to dashboard
              </Button>
            </div>
          ) : (
            /* Profile step */
            <div className="space-y-3">
              <div>
                <label className="text-muted-foreground text-xs font-medium">Your name</label>
                <Input
                  className="mt-1"
                  type="text"
                  placeholder="Ram Bahadur Thapa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-muted-foreground text-xs font-medium">
                  Organization name
                </label>
                <Input
                  className="mt-1"
                  type="text"
                  placeholder="e.g. ABC Construction Pvt. Ltd."
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
                <p className="text-muted-foreground mt-1 text-[10px]">
                  Shown in the header + report headers. Can be changed later.
                </p>
              </div>
              <Button className="w-full gap-1.5" onClick={setupSuperAdmin} disabled={!name.trim()}>
                <Crown className="h-4 w-4" />
                Set up as Super Admin
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skip link for users who already have projects */}
      {existingProjects.length > 0 && step !== 'done' && (
        <div className="mt-4 text-center text-[11px]">
          <span className="text-muted-foreground">
            You already have {existingProjects.length} project
            {existingProjects.length === 1 ? '' : 's'} assigned.{' '}
          </span>
          <button
            onClick={() => router.replace('/dashboard')}
            className="text-primary hover:underline"
          >
            Go to dashboard →
          </button>
        </div>
      )}

      <p className="text-muted-foreground mt-6 max-w-md text-center text-[10px]">
        OmniSite · Construction Management · Role-based access control
      </p>
    </div>
  )
}
