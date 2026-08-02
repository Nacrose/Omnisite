'use client'

import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROLES, type Role } from './types'

// Active users on the project — kept inline (not in seed data) because
// this is a small demo list and is shown only in the Users tab's lower half.
const ACTIVE_USERS = [
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
]

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
      </div>
      <div className="space-y-1.5">
        {ACTIVE_USERS.filter(
          (u) => !q || u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
        ).map((u, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded border border-[var(--pane-divider)] p-2"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-400 to-slate-600 text-xs font-semibold text-white">
              {u.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium">{u.name}</div>
              <div className="text-muted-foreground text-[10px]">
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
        disabled
        title="Coming soon"
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
