'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCircle2, AlertTriangle, Clock, FileText, ShieldAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { type ModuleId } from '@/lib/app-store'
import { sendNotification, type NotificationType } from '@/lib/notifications'

interface Notification {
  id: string
  type: 'approval' | 'alert' | 'reminder' | 'document' | 'safety'
  title: string
  desc: string
  time: string
  unread: boolean
  severity: 'info' | 'warning' | 'critical'
  /** Maps the seeded notification to a sendNotification() type. */
  notifyType?: NotificationType
  /** A stable recipient identifier (user id, role, or email). */
  recipient?: string
  /** Module to deep-link to when the notification is clicked. */
  module?: ModuleId
}

// ─── Notifications seed ─────────────────────────────────────────────────────
//
// Notifications should be computed from live data (pending POs, overdue
// RFIs, billing-hold NCRs, etc.) — not yet wired. The hardcoded demo
// array below was emitting real emails/SMS via the sendNotification()
// dispatch in the mount effect, which meant every demo session was
// firing off fake "PO awaiting approval" / "RFI overdue" alerts to
// pm@omnisite. Until the live-data pipeline lands, we ship an EMPTY
// array AND gate the dispatch behind a separate flag so fake entries
// (added later for staging/demo) can't trigger emails.
const NOTIFICATIONS: Notification[] = []
// Flip to `true` ONLY when entries above are backed by real data.
// When false, the sendNotification() dispatch in the mount effect is
// a no-op — fake notifications never trigger emails/SMS.
const NOTIFICATIONS_DISPATCH_ENABLED = false

const ICONS = {
  approval: FileText,
  alert: AlertTriangle,
  reminder: Clock,
  document: FileText,
  safety: ShieldAlert,
}

const SEVERITY_COLORS = {
  info: 'text-sky-500',
  warning: 'text-amber-500',
  critical: 'text-red-500',
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>(NOTIFICATIONS)
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all')
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const unreadCount = items.filter((n) => n.unread).length
  const visibleItems = items.filter((n) =>
    filter === 'all' ? true : filter === 'unread' ? n.unread : n.severity === 'critical'
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ─── Fire server-side notifications for overdue / critical items ──────────
  // Runs once per session (guarded by sessionStorage) to avoid spamming the
  // console / email / SMS channels on every re-render.
  //
  // Gated behind NOTIFICATIONS_DISPATCH_ENABLED: when the seed array is
  // empty (the current state) or holds demo-only entries, this is a no-op
  // so fake notifications never trigger real emails/SMS. Flip the flag
  // only when the array is populated from live data (pending POs,
  // overdue RFIs, billing-hold NCRs, etc.).
  useEffect(() => {
    if (!NOTIFICATIONS_DISPATCH_ENABLED) return
    const SESSION_KEY = 'omnisite-notifications-dispatched'
    if (typeof window === 'undefined') return
    if (window.sessionStorage.getItem(SESSION_KEY)) return

    const overdue = items.filter(
      (n) =>
        n.unread &&
        (n.severity === 'critical' ||
          n.notifyType === 'rfi_overdue' ||
          n.notifyType === 'dsr_review')
    )
    if (overdue.length === 0) {
      window.sessionStorage.setItem(SESSION_KEY, '1')
      return
    }

    // Fire-and-forget — server side will log + dispatch via configured channels.
    Promise.all(
      overdue.map((n) =>
        n.notifyType
          ? sendNotification(n.notifyType, n.desc, n.recipient || 'pm@omnisite', n.title, {
              id: n.id,
            })
          : Promise.resolve({ console: false, email: false, sms: false })
      )
    )
      .then((results) => {
        const dispatched = results.filter((r) => r.console).length
        if (dispatched > 0) {
          console.log(`[NotificationsBell] dispatched ${dispatched} overdue notification(s)`)
        }
      })
      .catch(() => {
        // Swallow — notification dispatch failure should never break the UI.
      })

    window.sessionStorage.setItem(SESSION_KEY, '1')
  }, [items])

  const markAllRead = () => {
    setItems((prev) => prev.map((n) => ({ ...n, unread: false })))
    toast.success('All notifications marked as read')
  }

  const markRead = (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)))
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
            {unreadCount}
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
                    ? items.filter((n) => n.unread).length
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
            {visibleItems.length === 0 ? (
              <div className="text-muted-foreground flex items-center justify-center py-8 text-[11px]">
                {filter === 'all' ? 'No notifications' : `No ${filter} notifications`}
              </div>
            ) : (
              visibleItems.map((n) => {
                const Icon = ICONS[n.type]
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      markRead(n.id)
                      if (n.module) {
                        router.push(`/${n.module}`)
                        setOpen(false)
                      }
                    }}
                    className={cn(
                      'hover:bg-accent/50 flex w-full items-start gap-3 border-b border-[var(--pane-divider)] px-4 py-2.5 text-left transition-colors last:border-b-0',
                      n.unread && 'bg-primary/5'
                    )}
                  >
                    {/* Icon + unread dot */}
                    <div className="relative mt-0.5 flex-shrink-0">
                      <Icon className={cn('h-4 w-4', SEVERITY_COLORS[n.severity])} />
                      {n.unread && (
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
                        {n.desc}
                      </div>
                      <div className="text-muted-foreground/70 mt-1 text-[10px]">{n.time}</div>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="bg-secondary/20 border-t border-[var(--pane-divider)] px-4 py-2">
            <button
              className="text-muted-foreground w-full cursor-not-allowed text-center text-[11px]"
              disabled
              title="Coming soon"
            >
              View all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
