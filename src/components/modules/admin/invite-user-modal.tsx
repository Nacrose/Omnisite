'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mail, X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useApp } from '@/lib/app-store'

interface InviteUserModalProps {
  onClose: () => void
  onInvited: () => void
}

const ROLE_OPTIONS = [
  {
    value: 'PM',
    label: 'Project Manager',
    description: 'Full access — all modules, admin, financials',
  },
  {
    value: 'SITE_ENGINEER',
    label: 'Site Engineer',
    description: 'All modules except Admin and Financials',
  },
  {
    value: 'STOREKEEPER',
    label: 'Storekeeper',
    description: 'Dashboard, DSR, Procurement, Reports, Chat',
  },
  { value: 'FOREMAN', label: 'Foreman', description: 'Dashboard, DSR, Time & Attendance, Chat' },
] as const

export function InviteUserModal({ onClose, onInvited }: InviteUserModalProps) {
  const { activeProjectDbId, activeProject } = useApp()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<string>('SITE_ENGINEER')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const projectId = activeProjectDbId
  const projectName = activeProject ?? 'this project'

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Email is required')
      return
    }
    if (!projectId) {
      setError('No active project selected — pick a project first')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          role,
          projectId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to invite user')
        return
      }

      setSuccess(true)
      toast.success('User invited', {
        description: data.isNewUser
          ? `${email} created and assigned to ${projectName} as ${role}. They'll get a login link by email.`
          : `${email} already had an account — role updated to ${role} on ${projectName}.`,
      })
      setTimeout(() => {
        onInvited()
        onClose()
      }, 1500)
    } catch {
      setError('Network error — check your connection and try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="pane w-full max-w-md overflow-hidden rounded-xl border border-[var(--pane-divider)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-primary/5 flex h-12 items-center justify-between border-b border-[var(--pane-divider)] px-4">
          <div className="flex items-center gap-2">
            <Mail className="text-primary h-4 w-4" />
            <span className="text-sm font-semibold">
              {success ? 'User Invited' : 'Invite User'}
            </span>
          </div>
          <button onClick={onClose} className="hover:bg-accent text-muted-foreground rounded p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
            <div className="text-sm font-semibold">{email} invited</div>
            <div className="text-muted-foreground mt-1 text-xs">
              Assigned to {projectName} as {ROLE_OPTIONS.find((r) => r.value === role)?.label}
            </div>
          </div>
        ) : (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
            {/* Project context */}
            <div className="bg-secondary/40 rounded-md p-2.5 text-[11px]">
              <span className="text-muted-foreground">Project: </span>
              <span className="font-medium">{projectName}</span>
            </div>

            {/* Email */}
            <div>
              <label className="flex items-center gap-1 text-xs font-medium">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                className="mt-1 h-8 text-xs"
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                disabled={submitting}
              />
              <p className="text-muted-foreground mt-1 text-[10px]">
                They'll get a login link by email. If they already have an account, their role will
                be updated.
              </p>
            </div>

            {/* Name (optional) */}
            <div>
              <label className="text-xs font-medium">Name (optional)</label>
              <Input
                className="mt-1 h-8 text-xs"
                placeholder="Ram Bahadur"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
              />
            </div>

            {/* Role */}
            <div>
              <label className="text-xs font-medium">Role</label>
              <div className="mt-1 space-y-1.5">
                {ROLE_OPTIONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRole(r.value)}
                    disabled={submitting}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-md border p-2 text-left transition-colors',
                      role === r.value
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-accent/30 border-[var(--pane-divider)]'
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 h-3 w-3 flex-shrink-0 rounded-full border-2',
                        role === r.value
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground/40'
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium">{r.label}</div>
                      <div className="text-muted-foreground text-[10px]">{r.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-700 dark:text-red-300">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[var(--pane-divider)] pt-3">
              <div className="text-muted-foreground text-[10px]">
                {!projectId && <span className="text-amber-600">No project selected</span>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={submitting || !email.trim() || !projectId}
                  onClick={handleSubmit}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Inviting…
                    </>
                  ) : (
                    <>
                      <Mail className="h-3.5 w-3.5" />
                      Send Invite
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
