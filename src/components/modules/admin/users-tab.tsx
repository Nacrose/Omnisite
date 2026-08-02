'use client'

import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useSyncedState } from '@/lib/use-synced-state'
import { ROLES, type Role } from './types'

// Demo users — used as a fallback when Supabase is configured but the
// `user_projects` table returns no rows for the active project, OR when
// Supabase is not configured at all (pure demo mode).
//
// NOTE: these are NOT real users. The /api/user-projects endpoint only
// returns the *current* user's own assignments (RLS-scoped), so unless the
// signed-in PM has their own row in `user_projects`, this list is what the
// Users tab will show. When real `user_projects` rows come back, they
// replace this list (see UsersView below).
const DEMO_USERS = [
  {
    name: 'Site Engineer',
    email: 'arjun@omnisite.com',
    role: 'Project Manager',
    status: 'Active',
  },
  {
    name: 'Bikash Rai',
    email: 'bikash@omnisite.com',
    role: 'Site Engineer',
    status: 'Active',
  },
  {
    name: 'Sita Gurung',
    email: 'sita@omnisite.com',
    role: 'Storekeeper',
    status: 'Active',
  },
  { name: 'Ram Bahadur', email: 'ram.b@omnisite.com', role: 'Foreman', status: 'Active' },
] as const

// Shape of a `user_projects` row after useSyncedState's snake_case → camelCase
// transform. We can't easily join `auth.users` from the client, so we surface
// the user_id (UUID) directly — admins recognise users by their auth id, and
// the email/name lookup can be done in the Supabase Dashboard.
interface UserProjectRow {
  id?: string
  userId?: string
  projectId?: string
  role?: string
}

// Normalised display shape — either a real DB row (user_id + role from
// `user_projects`) or a demo row (name + email from DEMO_USERS).
interface DisplayUser {
  name: string
  email: string
  role: string
  status: string
  /** true when this row came from `user_projects` (DB), false if demo. */
  fromDb: boolean
}

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

  // Read real `user_projects` rows from Supabase (falls back to localStorage
  // — and to the empty initial value — when Supabase isn't configured or the
  // table has no rows for the active project).
  const [userProjects, , loading] = useSyncedState<UserProjectRow[]>(
    'admin-active-users',
    'user_projects',
    () => []
  )

  // Real DB rows have a `userId` (camelCased from `user_id` by useSyncedState).
  const realUsers = userProjects.filter((u) => !!u.userId)

  // Show real data when available; otherwise fall back to the demo list.
  // When Supabase IS configured but no rows came back, label the demo list
  // explicitly so the PM doesn't mistake it for real users.
  const hasRealData = realUsers.length > 0
  const isDemoFallback = !hasRealData
  const showDemoLabel = isDemoFallback && supabaseConfigured

  const users: DisplayUser[] = hasRealData
    ? realUsers.map((up) => ({
        // We don't have the auth.users email here (no client-side join), so
        // surface the user_id directly. Admins recognise users by UUID.
        name: 'Supabase user',
        email: up.userId ?? '—',
        role: up.role ?? 'Unknown',
        status: 'Active',
        fromDb: true,
      }))
    : DEMO_USERS.map((u) => ({ ...u, fromDb: false }))

  const handleInvite = () => {
    toast.info('User invitation workflow', {
      description:
        'Create the user in Supabase Dashboard → Authentication → Users, then assign them to this project here (POST /api/user-projects with their user_id and role).',
      duration: 9000,
    })
  }

  return (
    <PaneBody className="space-y-3 p-4">
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
                      'h-4 px-1 text-[9px]',
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
      <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        Active Users on Project
        {loading && <span className="ml-2 normal-case opacity-60">loading…</span>}
      </div>
      {showDemoLabel && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] text-amber-700 dark:text-amber-300">
          Demo users (not from database) — no rows in <code>user_projects</code> for the active
          project yet. Use Invite User below to add one.
        </div>
      )}
      <div className="space-y-1.5">
        {users
          .filter((u) => !q || u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q))
          .map((u, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded border border-[var(--pane-divider)] p-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-400 to-slate-600 text-xs font-semibold text-white">
                {u.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium">{u.name}</div>
                <div className="text-muted-foreground truncate text-[10px]">
                  {u.email} · {u.role}
                </div>
              </div>
              <Badge
                variant="secondary"
                className="bg-emerald-500/15 text-[9px] text-emerald-700 dark:text-emerald-300"
              >
                {u.status}
              </Badge>
            </div>
          ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-full gap-1.5 text-xs"
        onClick={handleInvite}
        title="Invite user via Supabase Dashboard"
      >
        <Plus className="h-3.5 w-3.5" />
        Invite User
      </Button>
    </PaneBody>
  )
}

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
                    'text-[9px]',
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
      </PaneBody>
    </>
  )
}
