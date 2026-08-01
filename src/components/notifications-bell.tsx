'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, CheckCircle2, AlertTriangle, Clock, FileText, ShieldAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useApp, type ModuleId } from '@/lib/app-store'
import {
  sendNotification,
  type NotificationType,
} from '@/lib/notifications'

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

const NOTIFICATIONS: Notification[] = [
  { id: 'n1', type: 'alert', title: 'NCR billing hold active', desc: 'NCR-034 dropped Max Billable Qty to 0 for BOQ 3.2', time: '5 min ago', unread: true, severity: 'critical', notifyType: 'ncr_hold', recipient: 'pm@omnisite', module: 'qs' },
  { id: 'n2', type: 'approval', title: 'PO awaiting approval', desc: 'PO-2410-018 — Cement 1,200 bags · NPR 1,104,000', time: '12 min ago', unread: true, severity: 'warning', notifyType: 'po_approval', recipient: 'pm@omnisite', module: 'procurement' },
  { id: 'n3', type: 'reminder', title: 'RFI reply overdue', desc: 'RFI-067 — Rebar detailing at expansion joint · 4 days overdue', time: '1 hr ago', unread: true, severity: 'critical', notifyType: 'rfi_overdue', recipient: 'pm@omnisite', module: 'daily-ops' },
  { id: 'n4', type: 'approval', title: 'DSR review needed', desc: 'DSR #087 — Chainage 4+200 to 4+350 PCC submitted by Bikash R.', time: '2 hrs ago', unread: true, severity: 'warning', notifyType: 'dsr_review', recipient: 'pm@omnisite', module: 'daily-ops' },
  { id: 'n5', type: 'document', title: 'Drawing revision issued', desc: 'KRR-P3-DR-DR-008 Rev A — Box culvert rebar details (Pending)', time: '3 hrs ago', unread: false, severity: 'info', module: 'drawings' },
  { id: 'n6', type: 'safety', title: 'Near-miss reported', desc: 'NM-012 — Tipper reversing without spotter at ch. 4+200', time: '4 hrs ago', unread: false, severity: 'warning', module: 'qs' },
  { id: 'n7', type: 'reminder', title: 'Toolbox talk scheduled', desc: 'Today 15:00 — Excavation safety at ch. 4+200', time: '5 hrs ago', unread: false, severity: 'info', module: 'qs' },
  { id: 'n8', type: 'approval', title: 'RA Bill #4 submitted', desc: 'NPR 18.4 Cr — awaiting client approval', time: 'Yesterday', unread: false, severity: 'info', module: 'financials' },
]

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
  const { setActiveModule } = useApp()
  const unreadCount = items.filter(n => n.unread).length
  const visibleItems = items.filter(n =>
    filter === 'all' ? true : filter === 'unread' ? n.unread : n.severity === 'critical',
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
  useEffect(() => {
    const SESSION_KEY = 'omnisite-notifications-dispatched'
    if (typeof window === 'undefined') return
    if (window.sessionStorage.getItem(SESSION_KEY)) return

    const overdue = items.filter(
      n => n.unread && (n.severity === 'critical' || n.notifyType === 'rfi_overdue' || n.notifyType === 'dsr_review'),
    )
    if (overdue.length === 0) {
      window.sessionStorage.setItem(SESSION_KEY, '1')
      return
    }

    // Fire-and-forget — server side will log + dispatch via configured channels.
    Promise.all(
      overdue.map(n =>
        n.notifyType
          ? sendNotification(n.notifyType, n.desc, n.recipient || 'pm@omnisite', n.title, { id: n.id })
          : Promise.resolve({ console: false, email: false, sms: false }),
      ),
    ).then(results => {
      const dispatched = results.filter(r => r.console).length
      if (dispatched > 0) {
        console.log(`[NotificationsBell] dispatched ${dispatched} overdue notification(s)`)
      }
    }).catch(() => {
      // Swallow — notification dispatch failure should never break the UI.
    })

    window.sessionStorage.setItem(SESSION_KEY, '1')
  }, [items])

  const markAllRead = () => {
    setItems(prev => prev.map(n => ({ ...n, unread: false })))
    toast.success('All notifications marked as read')
  }

  const markRead = (id: string) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-md hover:bg-accent text-muted-foreground transition-colors"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-[var(--critical)] text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-[380px] pane border border-[var(--pane-divider)] rounded-lg shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-11 border-b border-[var(--pane-divider)]">
            <span className="text-sm font-semibold">Notifications</span>
            <div className="flex items-center gap-1">
              <button
                onClick={markAllRead}
                className="text-[10px] text-primary hover:underline px-1.5 py-0.5 rounded"
              >
                Mark all read
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-accent text-muted-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--pane-divider)]">
            {(['All', 'Unread', 'Critical'] as const).map(tab => {
              const f = tab.toLowerCase() as typeof filter
              const count =
                f === 'all' ? items.length :
                f === 'unread' ? items.filter(n => n.unread).length :
                items.filter(n => n.severity === 'critical').length
              return (
                <button
                  key={tab}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'text-[10px] px-2 py-1 rounded transition-colors',
                    filter === f
                      ? 'bg-accent text-foreground font-medium'
                      : 'hover:bg-accent text-muted-foreground',
                  )}
                >
                  {tab}{count > 0 && <span className="ml-1 text-[9px] opacity-70">{count}</span>}
                </button>
              )
            })}
          </div>

          {/* Items */}
          <div className="max-h-[400px] overflow-y-auto">
            {visibleItems.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-[11px] text-muted-foreground">
                {filter === 'all' ? 'No notifications' : `No ${filter} notifications`}
              </div>
            ) : (
              visibleItems.map(n => {
              const Icon = ICONS[n.type]
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    markRead(n.id)
                    if (n.module) {
                      setActiveModule(n.module)
                      setOpen(false)
                    }
                  }}
                  className={cn(
                    'w-full flex items-start gap-3 px-4 py-2.5 border-b border-[var(--pane-divider)] last:border-b-0 hover:bg-accent/50 transition-colors text-left',
                    n.unread && 'bg-primary/5'
                  )}
                >
                  {/* Icon + unread dot */}
                  <div className="relative flex-shrink-0 mt-0.5">
                    <Icon className={cn('w-4 h-4', SEVERITY_COLORS[n.severity])} />
                    {n.unread && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--primary)]" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate">{n.title}</span>
                      {n.severity === 'critical' && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/15 text-red-700 dark:text-red-300 font-semibold flex-shrink-0">
                          URGENT
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.desc}</div>
                    <div className="text-[10px] text-muted-foreground/70 mt-1">{n.time}</div>
                  </div>
                </button>
              )
            })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[var(--pane-divider)] bg-secondary/20">
            <button className="w-full text-center text-[11px] text-primary hover:underline" onClick={() => { setOpen(false); toast.info('Notifications log', { description: 'Opens the full notification history.' }) }}>
              View all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
