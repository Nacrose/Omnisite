'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCircle2, AlertTriangle, Clock, FileText, ShieldAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { type ModuleId } from '@/lib/app-store'
import { useSyncedState } from '@/lib/use-synced-state'
import { upsertOne } from '@/lib/api-client'

// Notification shape mirrors the `notifications` DB table (migration 30).
// Stored as snake_case from the DB; converted to camelCase by useSyncedState's
// generic field-name passthrough (the table has no fieldMap — names match
// 1:1, with snake_case coming through as-is since there's no fieldMap
// mapping them).
interface DbNotification {
  id: string
  user_id: string | null
  project_id: string
  type: 'rfi_overdue' | 'ncr_hold' | 'po_approval' | 'dsr_review' | 'variation_threshold'
  title: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  module?: string | null
  context?: Record<string, unknown> | null
  read_at: string | null
  created_at: string
  dispatch_status?: string | null
}

const ICONS = {
  rfi_overdue: Clock,
  ncr_hold: AlertTriangle,
  po_approval: FileText,
  dsr_review: FileText,
  variation_threshold: ShieldAlert,
}

const SEVERITY_COLORS = {
  info: 'text-sky-500',
  warning: 'text-amber-500',
  critical: 'text-red-500',
}

// Map the notification's `module` field (a string slug) to a route path
// so the bell can deep-link on click.
const MODULE_ROUTES: Record<string, string> = {
  'daily-ops': '/daily-ops',
  procurement: '/procurement',
  qs: '/qs',
  boq: '/boq',
  vendors: '/vendors',
  financials: '/financials',
  scheduler: '/scheduler',
  equipment: '/equipment',
  drawings: '/drawings',
  correspondence: '/correspondence',
  reports: '/reports',
  'time-attendance': '/time-attendance',
  admin: '/admin',
  chat: '/chat',
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all')
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // ─── Live notifications from the DB ──────────────────────────────────────
  // useSyncedState reads through /api/notifications (RLS-gated, only shows
  // notifications for the current user or broadcasts to projects they're
  // a member of). Realtime updates push new notifications into the bell
  // without a refresh.
  const [notifications, _setNotifications, loading] = useSyncedState<DbNotification[]>(
    'omnisite-notifications',
    'notifications',
    () => [] as DbNotification[],
    { primaryKey: 'id', maxPages: 2 } // 400 rows is plenty for a bell
  )

  const items = notifications || []
  const unreadCount = items.filter((n) => !n.read_at).length
  const visibleItems = items.filter((n) =>
    filter === 'all' ? true : filter === 'unread' ? !n.read_at : n.severity === 'critical'
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ─── Mark-all-read: persist read_at = now() to the DB ────────────────────
  // The previous implementation only updated local state — refresh erased
  // the read status. Now we POST each unread notification back with
  // read_at set, which the createCrudHandler POST path treats as an UPDATE
  // (RLS gates to user_id = auth.uid()). Fire-and-forget — the global
  // error toast (P2-7) handles failures.
  const markAllRead = () => {
    const now = new Date().toISOString()
    for (const n of items.filter((n) => !n.read_at)) {
      void upsertOne('notifications', { ...n, read_at: now, context: n.context ?? null }).catch(
        () => {
          // Global error toast already fired by api-client.
        }
      )
    }
    toast.success('All notifications marked as read')
  }

  const markRead = (id: string) => {
    const n = items.find((x) => x.id === id)
    if (!n || n.read_at) return
    const now = new Date().toISOString()
    void upsertOne('notifications', { ...n, read_at: now, context: n.context ?? null }).catch(
      () => {}
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="hover:bg-accent text-muted-foreground relative rounded-md p-2 transition-colors"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[var(--critical)] px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="pane absolute top-full right-0 z-50 mt-1 w-[380px] overflow-hidden rounded-lg border border-[var(--pane-divider)] shadow-2xl">
          {/* Header */}
          <div className="flex h-11 items-center justify-between border-b border-[var(--pane-divider)] px-4">
            <span className="text-sm font-semibold">Notifications</span>
            <div className="flex items-center gap-1">
              <button
                onClick={markAllRead}
                className="text-primary rounded px-1.5 py-0.5 text-[10px] hover:underline"
                disabled={unreadCount === 0}
              >
                Mark all read
              </button>
              <button
                onClick={() => setOpen(false)}
                className="hover:bg-accent text-muted-foreground rounded p-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 border-b border-[var(--pane-divider)] px-3 py-2">
            {(['All', 'Unread', 'Critical'] as const).map((tab) => {
              const f = tab.toLowerCase() as typeof filter
              const count =
                f === 'all'
                  ? items.length
                  : f === 'unread'
                    ? unreadCount
                    : items.filter((n) => n.severity === 'critical').length
              return (
                <button
                  key={tab}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'rounded px-2 py-1 text-[10px] transition-colors',
                    filter === f
                      ? 'bg-accent text-foreground font-medium'
                      : 'hover:bg-accent text-muted-foreground'
                  )}
                >
                  {tab}
                  {count > 0 && <span className="ml-1 text-[9px] opacity-70">{count}</span>}
                </button>
              )
            })}
          </div>

          {/* Items */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="text-muted-foreground flex items-center justify-center py-8 text-[11px]">
                Loading…
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-[11px]">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                {filter === 'all' ? 'No notifications' : `No ${filter} notifications`}
              </div>
            ) : (
              visibleItems.map((n) => {
                const Icon = ICONS[n.type] || Bell
                const route = n.module ? MODULE_ROUTES[n.module] : undefined
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      markRead(n.id)
                      if (route) {
                        router.push(route)
                        setOpen(false)
                      }
                    }}
                    className={cn(
                      'hover:bg-accent/50 flex w-full items-start gap-3 border-b border-[var(--pane-divider)] px-4 py-2.5 text-left transition-colors last:border-b-0',
                      !n.read_at && 'bg-primary/5'
                    )}
                  >
                    {/* Icon + unread dot */}
                    <div className="relative mt-0.5 flex-shrink-0">
                      <Icon className={cn('h-4 w-4', SEVERITY_COLORS[n.severity])} />
                      {!n.read_at && (
                        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[var(--primary)]" />
                      )}
                    </div>
                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-medium">{n.title}</span>
                        {n.severity === 'critical' && (
                          <span className="flex-shrink-0 rounded bg-red-500/15 px-1 py-0.5 text-[9px] font-semibold text-red-700 dark:text-red-300">
                            URGENT
                          </span>
                        )}
                      </div>
                      <div className="text-muted-foreground mt-0.5 line-clamp-2 text-[11px]">
                        {n.message}
                      </div>
                      <div className="text-muted-foreground/70 mt-1 text-[10px]">
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="bg-secondary/20 border-t border-[var(--pane-divider)] px-4 py-2">
            <div className="text-muted-foreground text-center text-[10px]">
              Notifications are scanned daily by cron.{' '}
              <span className="text-muted-foreground/70">Critical alerts email the PM.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
