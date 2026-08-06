'use client'

import { useState, useEffect, useCallback } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plus, Trash2, Mail, Loader2, RefreshCw, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useApp } from '@/lib/app-store'
import { ROLES, type Role } from './types'
import { InviteUserModal } from './invite-user-modal'
import { PermissionEditorModal } from './permission-editor-modal'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProjectUser {
  id: string
  user_id: string
  project_id: string
  role: string
  email: string | null
  name: string | null
}

// ─── Role display helpers ───────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  PM: 'Project Manager',
  SITE_ENGINEER: 'Site Engineer',
  STOREKEEPER: 'Storekeeper',
  FOREMAN: 'Foreman',
}

const ROLE_COLORS: Record<string, string> = {
  PM: 'border-primary/40 text-primary',
  SITE_ENGINEER: 'border-sky-500/40 text-sky-700 dark:text-sky-300',
  STOREKEEPER: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
  FOREMAN: 'border-slate-400/40 text-muted-foreground',
}

// ─── UsersView ──────────────────────────────────────────────────────────────

export function UsersView({
  selectedRole,
  onSelectRole,
  searchQuery,
}: {
  selectedRole: Role
  onSelectRole: (r: Role) => void
  searchQuery: string
}) {
  const q = searchQuery.toLowerCase()
  const filteredRoles = ROLES.filter((r) => r.name.toLowerCase().includes(q))
  const supabaseConfigured = isSupabaseConfigured()
  const { activeProjectDbId, activeProject } = useApp()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [permUser, setPermUser] = useState<ProjectUser | null>(null)
  const [users, setUsers] = useState<ProjectUser[]>([])
  const [loading, setLoading] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  // Fetch real users from /api/invites?projectId=...
  const fetchUsers = useCallback(async () => {
    if (!activeProjectDbId || !supabaseConfigured) return
    setLoading(true)
    try {
      const res = await fetch(`/api/invites?projectId=${activeProjectDbId}`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch {
      // Non-fatal — the list just stays empty
    } finally {
      setLoading(false)
    }
  }, [activeProjectDbId, supabaseConfigured])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleRemove = async (user: ProjectUser) => {
    if (!confirm(`Remove ${user.email || user.user_id} from ${activeProject}?`)) return
    setRemovingId(user.id)
    try {
      const res = await fetch(`/api/invites?id=${user.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to remove user')
        return
      }
      toast.success('User removed', {
        description: `${user.email || 'User'} no longer has access to ${activeProject}.`,
      })
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
    } catch {
      toast.error('Network error')
    } finally {
      setRemovingId(null)
    }
  }

  const hasRealData = users.length > 0

  return (
    <PaneBody className="space-y-3 p-4">
      {/* Role templates */}
      <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        Pre-configured Role Templates
      </div>
      <div className="grid grid-cols-1 gap-2">
        {filteredRoles.map((r) => (
          <div
            key={r.name}
            onClick={() => onSelectRole(r)}
            className={cn(
              'cursor-pointer rounded-lg border p-3 transition-colors',
              selectedRole.name === r.name
                ? 'border-primary bg-accent'
                : 'hover:bg-accent/30 border-[var(--pane-divider)]'
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium">{r.name}</div>
              <Badge variant="secondary" className="text-[10px]">
                {r.users} users
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              {Object.entries(r.perms).map(([k, v]) => (
                <div
                  key={k}
                  className="bg-secondary/40 flex items-center justify-between rounded p-1"
                >
                  <span className="text-muted-foreground">{k}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'h-4 px-1 text-[10px]',
                      v === 'Edit' &&
                        'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
                      v === 'None' && 'text-muted-foreground border-slate-400/40'
                    )}
                  >
                    {v}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Separator />

      {/* Active users on project */}
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          Active Users on Project
          {loading && <span className="ml-2 normal-case opacity-60">loading…</span>}
        </div>
        {hasRealData && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={fetchUsers}
            disabled={loading}
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            Refresh
          </Button>
        )}
      </div>

      {/* No Supabase configured */}
      {!supabaseConfigured && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] text-amber-700 dark:text-amber-300">
          Demo mode — configure Supabase to manage real users. The invite button won't work without
          a backend.
        </div>
      )}

      {/* No users yet */}
      {supabaseConfigured && !loading && !hasRealData && (
        <div className="text-muted-foreground rounded-md border border-dashed border-[var(--pane-divider)] p-4 text-center text-[11px]">
          No users assigned to this project yet. Click{' '}
          <span className="font-medium">Invite User</span> below to add one.
        </div>
      )}

      {/* User list */}
      {hasRealData && (
        <div className="space-y-1.5">
          {users
            .filter(
              (u) =>
                !q ||
                (u.email || '').toLowerCase().includes(q) ||
                (u.name || '').toLowerCase().includes(q) ||
                u.role.toLowerCase().includes(q)
            )
            .map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-2 rounded border border-[var(--pane-divider)] p-2"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-400 to-slate-600 text-xs font-semibold text-white">
                  {(u.name || u.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium">{u.name || 'Unknown'}</div>
                  <div className="text-muted-foreground truncate text-[10px]">
                    {u.email || u.user_id.slice(0, 8) + '…'}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn('text-[10px]', ROLE_COLORS[u.role] || ROLE_COLORS.FOREMAN)}
                >
                  {ROLE_LABELS[u.role] || u.role}
                </Badge>
                {/* Role change dropdown — calls the invite API's update path */}
                <select
                  value={u.role}
                  onChange={async (e) => {
                    const newRole = e.target.value
                    try {
                      const res = await fetch('/api/invites', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          email: u.email,
                          role: newRole,
                          projectId: activeProjectDbId,
                        }),
                      })
                      if (res.ok) {
                        toast.success('Role updated', {
                          description: `${u.email} → ${ROLE_LABELS[newRole] || newRole}`,
                        })
                        fetchUsers()
                      } else {
                        const data = await res.json()
                        toast.error(data.error || 'Failed to update role')
                      }
                    } catch {
                      toast.error('Network error')
                    }
                  }}
                  className="h-6 rounded border border-[var(--pane-divider)] bg-transparent px-1 text-[10px]"
                  title="Change role"
                >
                  <option value="PM">PM</option>
                  <option value="SITE_ENGINEER">Engineer</option>
                  <option value="STOREKEEPER">Storekeeper</option>
                  <option value="FOREMAN">Foreman</option>
                </select>
                <button
                  onClick={() => setPermUser(u)}
                  className="text-muted-foreground hover:text-primary rounded p-1 transition-colors"
                  title="Edit permissions"
                >
                  <Shield className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleRemove(u)}
                  disabled={removingId === u.id}
                  className="text-muted-foreground rounded p-1 transition-colors hover:text-red-500 disabled:opacity-40"
                  title="Remove from project"
                >
                  {removingId === u.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ))}
        </div>
      )}

      {/* Invite button */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-full gap-1.5 text-xs"
        onClick={() => {
          if (!supabaseConfigured) {
            toast.error('Demo mode', {
              description: 'Configure Supabase to invite real users.',
            })
            return
          }
          if (!activeProjectDbId) {
            toast.error('No project selected', {
              description: 'Pick a project from the switcher first.',
            })
            return
          }
          setInviteOpen(true)
        }}
        title="Invite a user to this project"
      >
        <Plus className="h-3.5 w-3.5" />
        Invite User
      </Button>

      {inviteOpen && (
        <InviteUserModal onClose={() => setInviteOpen(false)} onInvited={fetchUsers} />
      )}

      {permUser && (
        <PermissionEditorModal
          assignmentId={permUser.id}
          userName={permUser.name || permUser.email || 'User'}
          userEmail={permUser.email || permUser.user_id}
          onClose={() => setPermUser(null)}
        />
      )}
    </PaneBody>
  )
}

// ─── UsersInspector ─────────────────────────────────────────────────────────

export function UsersInspector({ role }: { role: Role }) {
  return (
    <>
      <PaneHeader title="Role Inspector" />
      <PaneBody className="p-4">
        <div className="rounded-md border border-[var(--pane-divider)] p-3">
          <div className="text-sm font-semibold">{role.name}</div>
          <div className="text-muted-foreground mt-0.5 text-[10px]">
            {role.users} user{role.users !== 1 ? 's' : ''} ·{' '}
            {Object.values(role.perms).every((v) => v === 'Edit') ? 'Full access' : 'Scoped access'}
          </div>
          <Separator className="my-2" />
          <div className="space-y-1.5 text-xs">
            {Object.entries(role.perms).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span>{k}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px]',
                    v === 'Edit' && 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
                    v === 'None' && 'text-muted-foreground border-slate-400/40',
                    v === 'Read' && 'border-sky-500/40 text-sky-700 dark:text-sky-300'
                  )}
                >
                  {v}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Invite flow help */}
        <div className="mt-4 rounded-md border border-[var(--pane-divider)] p-3">
          <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
            <Mail className="h-3 w-3" />
            How Invites Work
          </div>
          <ol className="text-muted-foreground list-decimal space-y-1 pl-4 text-[10px] leading-relaxed">
            <li>Click "Invite User" in the Users tab</li>
            <li>Enter the colleague's email and pick a role</li>
            <li>They get a login link by email (magic link)</li>
            <li>They click it, set a password, and land on the app</li>
            <li>Their role determines which modules they can see/edit</li>
          </ol>
        </div>
      </PaneBody>
    </>
  )
}
