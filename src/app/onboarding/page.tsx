'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Building2,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  User,
  FolderPlus,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isSupabaseConfigured } from '@/lib/supabase'
import { toast } from 'sonner'

// ─── Onboarding wizard ─────────────────────────────────────────────────────
//
// Closes P1-28 in gap analysis. Previously, the README instructed the
// first user to:
//   INSERT INTO user_projects (user_id, project_id, role)
//   VALUES ('<auth.users.id>', '00000000-0000-0000-0000-000000000001', 'PM');
//
// in the Supabase SQL editor — a DBA-only workflow that blocked any
// non-technical contractor from getting started.
//
// This page auto-detects "user has no user_projects rows" and walks
// them through a 3-step wizard:
//   1. Welcome + profile confirmation (name)
//   2. Create a project (name, code, location, start date)
//   3. Auto-assign the current user as PM on the new project
//
// On completion, redirect to /dashboard with the new project active.
//
// The wizard is reachable at /onboarding. The workspace-shell checks
// on mount whether the user has any projects; if not, it redirects
// here. Direct visits also work — a user with projects sees a "you're
// already set up" message and a Continue button.

type Step = 'welcome' | 'profile' | 'project' | 'assign' | 'done'

interface UserProjectRow {
  project_id: string
  role: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading, isDemo } = useAuth()
  const configured = isSupabaseConfigured()

  const [step, setStep] = useState<Step>('welcome')
  const [checking, setChecking] = useState(true)
  const [existingProjects, setExistingProjects] = useState<UserProjectRow[]>([])

  // Wizard form state
  const [name, setName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [projectCode, setProjectCode] = useState('')
  const [projectLocation, setProjectLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)

  // ─── Auth gating ─────────────────────────────────────────────────────────
  // If not signed in (and Supabase is configured), bounce to /login.
  useEffect(() => {
    if (configured && !loading && !user) {
      router.replace('/login?redirect=/onboarding')
    }
  }, [loading, user, configured, router])

  // ─── On mount: load the user's name + check existing projects ────────────
  // Deferred via Promise.resolve().then() to avoid the "set-state-in-effect"
  // lint rule (cascading renders). Same pattern used elsewhere in the app.
  useEffect(() => {
    if (!user) return
    Promise.resolve().then(() => setName(user.name || ''))

    // Demo mode — skip the project check, jump straight to "create project"
    // (the demo user already has the seed project assigned via localStorage).
    if (!configured) {
      Promise.resolve().then(() => setChecking(false))
      return
    }

    // Fetch the user's existing project assignments
    fetch('/api/user-projects', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return []
        return (await res.json()) as UserProjectRow[]
      })
      .then((rows) => {
        setExistingProjects(rows)
        setChecking(false)
        // If the user already has projects, skip the wizard.
        if (rows.length > 0) {
          setStep('done')
        }
      })
      .catch(() => {
        setChecking(false)
        // Don't block the wizard on a failed fetch — the user might still
        // be able to create a project. The create step will surface the error.
      })
  }, [user, configured])

  // ─── Create project + auto-assign as PM ───────────────────────────────────
  const createProjectAndAssign = async () => {
    if (!projectName.trim() || !projectCode.trim()) {
      toast.error('Project name and code are required')
      return
    }
    setSubmitting(true)
    setStep('assign')
    try {
      // Step 1: create the project via /api/projects (PM-only — but in
      // onboarding the user has no role yet, so the API will reject. We
      // need a different path: the onboarding route creates the project
      // AND the user_projects row in one shot, with the service role).
      const res = await fetch('/api/onboarding/create-first-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName.trim(),
          code: projectCode.trim().toUpperCase(),
          location: projectLocation.trim() || undefined,
          start_date: startDate || undefined,
          // The user's display name from Supabase user_metadata — used to
          // update the user_projects row's display_name (denormalized for
          // the users-tab list).
          user_name: name.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to create project')
        setStep('project')
        setSubmitting(false)
        return
      }

      setCreatedProjectId(data.project_id)
      setStep('done')
      toast.success('Project created', {
        description: `${projectName} is ready. You're the PM. Redirecting to your dashboard…`,
      })

      // Give the user a moment to read the success message, then redirect.
      setTimeout(() => {
        router.replace('/dashboard')
      }, 1500)
    } catch {
      toast.error('Network error — check your connection and try again')
      setStep('project')
      setSubmitting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {step === 'welcome' && <Sparkles className="text-primary h-4 w-4" />}
            {step === 'profile' && <User className="text-primary h-4 w-4" />}
            {step === 'project' && <FolderPlus className="text-primary h-4 w-4" />}
            {step === 'assign' && <Loader2 className="h-4 w-4 animate-spin" />}
            {step === 'done' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            {step === 'welcome' && 'Welcome to OmniSite'}
            {step === 'profile' && 'Confirm your profile'}
            {step === 'project' && 'Create your first project'}
            {step === 'assign' && 'Setting up…'}
            {step === 'done' && "You're all set"}
          </CardTitle>
          <CardDescription>
            {step === 'welcome' && "Let's get you set up in 3 quick steps."}
            {step === 'profile' && "We'll use this name across the app."}
            {step === 'project' && "You'll be auto-assigned as Project Manager."}
            {step === 'assign' && 'Creating the project and assigning you as PM…'}
            {step === 'done' && 'Project created — redirecting to your dashboard.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'welcome' && (
            <div className="space-y-3">
              {!configured && (
                <div className="rounded-md border border-sky-500/30 bg-sky-500/10 p-2.5 text-[11px] text-sky-700 dark:text-sky-300">
                  Demo mode — Supabase not configured. You can walk through the wizard but no
                  project will be saved server-side.
                </div>
              )}
              <p className="text-muted-foreground text-xs leading-relaxed">
                Hi {name || 'there'}! You&apos;re new here. Let&apos;s set up your first
                construction project so you can start logging BOQ, schedule, DSR, and procurement
                data.
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                This takes about 30 seconds. You&apos;ll confirm your name, create a project (with
                code + start date), and we&apos;ll automatically assign you as the Project Manager —
                full access to every module.
              </p>
              <Button className="w-full gap-1.5" onClick={() => setStep('profile')}>
                Get started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 'profile' && (
            <div className="space-y-3">
              <div>
                <label className="text-muted-foreground text-xs font-medium">Display name</label>
                <Input
                  className="mt-1"
                  type="text"
                  placeholder="Ram Bahadur Thapa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
                <p className="text-muted-foreground mt-1 text-[10px]">
                  Shown in the top-right user menu, audit log, and chat.
                </p>
              </div>
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('welcome')}
                  className="gap-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={() => setStep('project')}
                  disabled={!name.trim()}
                  className="gap-1"
                >
                  Continue
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {step === 'project' && (
            <div className="space-y-3">
              <div>
                <label className="flex items-center gap-1 text-xs font-medium">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <Input
                  className="mt-1 h-8 text-xs"
                  placeholder="e.g. Kathmandu Ring Road — Package 3"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-xs font-medium">
                  Project Code <span className="text-red-500">*</span>
                </label>
                <Input
                  className="mt-1 h-8 font-mono text-xs uppercase"
                  placeholder="e.g. KRR-P3"
                  value={projectCode}
                  onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
                />
                <p className="text-muted-foreground mt-1 text-[10px]">
                  Short code used in BOQ items, tasks, and drawings.
                </p>
              </div>
              <div>
                <label className="text-xs font-medium">Location</label>
                <Input
                  className="mt-1 h-8 text-xs"
                  placeholder="e.g. Kathmandu"
                  value={projectLocation}
                  onChange={(e) => setProjectLocation(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Start Date</label>
                <Input
                  className="mt-1 h-8 text-xs"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <p className="text-muted-foreground mt-1 text-[10px]">
                  Drives the Gantt chart &ldquo;today&rdquo; line and S-curve baseline.
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--pane-divider)] pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('profile')}
                  className="gap-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={createProjectAndAssign}
                  disabled={!projectName.trim() || !projectCode.trim() || submitting}
                  className="gap-1"
                >
                  Create &amp; assign me as PM
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {step === 'assign' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
              <div className="text-sm font-medium">Creating {projectName}…</div>
              <div className="text-muted-foreground text-[11px]">
                Inserting project row + assigning you as PM in one transaction.
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <div className="text-sm font-semibold">{projectName} is ready</div>
              <div className="text-muted-foreground text-center text-xs">
                You&apos;re the PM. Redirecting to your dashboard…
              </div>
              {createdProjectId && (
                <div className="text-muted-foreground/60 mt-2 font-mono text-[10px]">
                  Project ID: {createdProjectId}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => router.replace('/dashboard')}
              >
                Go to dashboard now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skip link for users who already have projects (e.g. they were invited) */}
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
        OmniSite · Enterprise Construction Management · FIDIC-compliant audit trail
      </p>
    </div>
  )
}
