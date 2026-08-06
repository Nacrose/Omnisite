'use client'

import { useRouter } from 'next/navigation'
import { Users, Package, Monitor, LogOut, ChevronRight, Clock, Calendar } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useApp } from '@/lib/app-store'

export default function MobileMorePage() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { activeProject } = useApp()

  const items = [
    {
      label: 'Attendance',
      desc: 'Log worker hours for today',
      icon: Users,
      color: 'text-amber-500',
      action: () => router.push('/time-attendance'),
    },
    {
      label: 'Receive Material (GRN)',
      desc: 'Create a GRN from a PO',
      icon: Package,
      color: 'text-violet-500',
      action: () => router.push('/procurement'),
    },
    {
      label: 'Full Desktop App',
      desc: 'Open all modules (BOQ, Scheduler, Financials, etc.)',
      icon: Monitor,
      color: 'text-sky-500',
      action: () => router.push('/dashboard'),
    },
  ]

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-bold">More</h1>

      {/* User info */}
      <div className="border-border bg-card flex items-center gap-3 rounded-xl border p-3">
        <div className="from-primary to-accent-foreground flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white">
          {(user?.name || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{user?.name || 'User'}</div>
          <div className="text-muted-foreground truncate text-xs">{user?.email}</div>
        </div>
      </div>

      {/* Project context */}
      <div className="border-border bg-card flex items-center gap-2 rounded-xl border p-3 text-sm">
        <Calendar className="text-muted-foreground h-4 w-4" />
        <span className="text-muted-foreground">Project:</span>
        <span className="truncate font-medium">{activeProject || 'None selected'}</span>
      </div>

      {/* Menu items */}
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.label}
              onClick={item.action}
              className="border-border bg-card active:bg-accent flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors"
            >
              <div
                className={`bg-secondary flex h-9 w-9 items-center justify-center rounded-lg ${item.color}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-muted-foreground truncate text-xs">{item.desc}</div>
              </div>
              <ChevronRight className="text-muted-foreground h-4 w-4" />
            </button>
          )
        })}
      </div>

      {/* Sign out */}
      <button
        onClick={async () => {
          await signOut()
          router.replace('/login')
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600 transition-colors active:bg-red-500/10"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>

      {/* Footer */}
      <div className="text-muted-foreground pt-4 text-center text-[10px]">
        OmniSite v0.1.0-beta · Field Reporting Mode
      </div>
    </div>
  )
}
