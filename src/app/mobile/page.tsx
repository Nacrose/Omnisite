'use client'

import { useAuth } from '@/lib/auth'
import { useApp } from '@/lib/app-store'
import { useRouter } from 'next/navigation'
import { Camera, MessageSquare, Users, Package, ChevronRight, Clock, MapPin } from 'lucide-react'

export default function MobileHomePage() {
  const { user } = useAuth()
  const { activeProject } = useApp()
  const router = useRouter()

  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  const quickActions = [
    {
      label: 'Capture Photo',
      desc: 'Snap a site photo with GPS + timestamp',
      icon: Camera,
      route: '/mobile/capture',
      color: 'text-sky-500',
    },
    {
      label: 'Chat',
      desc: 'Message the project team',
      icon: MessageSquare,
      route: '/mobile/chat',
      color: 'text-emerald-500',
    },
    {
      label: 'Attendance',
      desc: 'Log worker hours for today',
      icon: Users,
      route: '/mobile/more',
      color: 'text-amber-500',
    },
    {
      label: 'Receive Material',
      desc: 'Create a GRN from a PO',
      icon: Package,
      route: '/mobile/more',
      color: 'text-violet-500',
    },
  ]

  return (
    <div className="space-y-4 p-4">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold">Hi, {user?.name?.split(' ')[0] || 'there'}</h1>
        <p className="text-muted-foreground text-sm">{activeProject || 'No project selected'}</p>
        <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
          <Clock className="h-3 w-3" />
          {today}
        </div>
      </div>

      {/* Quick actions */}
      <div className="space-y-2">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Quick Actions
        </h2>
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.label}
              onClick={() => router.push(action.route)}
              className="border-border bg-card active:bg-accent flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors"
            >
              <div
                className={`bg-secondary flex h-10 w-10 items-center justify-center rounded-lg ${action.color}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{action.label}</div>
                <div className="text-muted-foreground truncate text-xs">{action.desc}</div>
              </div>
              <ChevronRight className="text-muted-foreground h-4 w-4" />
            </button>
          )
        })}
      </div>

      {/* Desktop link */}
      <button
        onClick={() => router.push('/dashboard')}
        className="border-border text-muted-foreground active:bg-accent flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed p-3 text-xs transition-colors"
      >
        Open full desktop app →
      </button>
    </div>
  )
}
