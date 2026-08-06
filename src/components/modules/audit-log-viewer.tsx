'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/ui/loading-state'
import { X, AlertCircle, History, Plus, Pencil, Trash2 } from 'lucide-react'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { cn } from '@/lib/utils'

interface AuditEntry {
  id?: string
  table_name: string
  record_id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE' | string
  changed_by: string
  changed_fields?: Record<string, { old: unknown; new: unknown }> | null
  timestamp: string
}

interface AuditLogViewerProps {
  /** The table whose audit trail to show (e.g. 'boq_items'). */
  tableName: string
  /** The specific record id within that table. */
  recordId: string
  /** Friendly title for the modal header (e.g. 'BOQ Item 1.1.3'). */
  recordLabel?: string
  /** Called when the user dismisses the modal. */
  onClose: () => void
}

interface ActionBadge {
  label: string
  icon: typeof Plus
  className: string
}

const ACTION_STYLES: Record<string, ActionBadge> = {
  INSERT: {
    label: 'INSERT',
    icon: Plus,
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  UPDATE: {
    label: 'UPDATE',
    icon: Pencil,
    className: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  DELETE: {
    label: 'DELETE',
    icon: Trash2,
    className: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
}

function getActionStyle(action: string): ActionBadge {
  return (
    ACTION_STYLES[action] ?? {
      label: action,
      icon: AlertCircle,
      className: 'border-muted-foreground/40 bg-secondary text-muted-foreground',
    }
  )
}

/** Format an ISO timestamp as "Today · 14:32" / "Yesterday · 09:01" / "12 Jul 2025 · 14:32". */
function formatTimestamp(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: iso, time: '' }
  const now = new Date()
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const thatMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dayDiff = Math.round(
    (todayMidnight.getTime() - thatMidnight.getTime()) / (24 * 60 * 60 * 1000)
  )
  const time = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
  let date: string
  if (dayDiff === 0) date = 'Today'
  else if (dayDiff === 1) date = 'Yesterday'
  else
    date = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  return { date, time }
}

/** Group audit entries by their date label (Today / Yesterday / 12 Jul 2025). */
function groupByDate(entries: AuditEntry[]): { date: string; items: AuditEntry[] }[] {
  const groups = new Map<string, AuditEntry[]>()
  for (const e of entries) {
    const { date } = formatTimestamp(e.timestamp)
    const arr = groups.get(date) ?? []
    arr.push(e)
    groups.set(date, arr)
  }
  // Preserve insertion order (entries are already DESC by timestamp from the API).
  return Array.from(groups.entries()).map(([date, items]) => ({ date, items }))
}

/** Render a single changed field as a row of "field: old → new". */
function ChangedFieldRow({
  field,
  oldVal,
  newVal,
}: {
  field: string
  oldVal: unknown
  newVal: unknown
}) {
  const fmt = (v: unknown): string => {
    if (v === null || v === undefined) return '∅'
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
  }
  const isInsert = oldVal === null || oldVal === undefined
  const isDelete = newVal === null || newVal === undefined
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-2 py-1 text-[11px]">
      <span className="text-foreground font-mono text-xs font-semibold">{field}</span>
      <span className="text-muted-foreground">:</span>
      {!isInsert && (
        <>
          <span
            className={cn(
              'rounded bg-rose-500/10 px-1.5 py-0.5 font-mono',
              isDelete && 'line-through opacity-60'
            )}
          >
            {fmt(oldVal)}
          </span>
          <span className="text-muted-foreground">→</span>
        </>
      )}
      <span
        className={cn(
          'rounded px-1.5 py-0.5 font-mono',
          isInsert && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
          isDelete
            ? 'bg-rose-500/10 text-rose-700 line-through dark:text-rose-300'
            : !isInsert && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
        )}
      >
        {fmt(newVal)}
      </span>
    </div>
  )
}

export function AuditLogViewer({ tableName, recordId, recordLabel, onClose }: AuditLogViewerProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, true)

  // Lock body scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Close on Escape (in addition to the focus-trap's tab handling).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        table_name: tableName,
        record_id: recordId,
        limit: '200',
      })
      const res = await fetch(`/api/audit-log?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(
          (body && typeof body.error === 'string' ? body.error : null) ??
            `HTTP ${res.status} ${res.statusText}`
        )
      }
      const json = await res.json()
      const data: AuditEntry[] = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
          ? json.data
          : []
      setEntries(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit log')
    } finally {
      setLoading(false)
    }
  }, [tableName, recordId])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => groupByDate(entries), [entries])
  const titleId = 'audit-log-viewer-title'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="pane flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--pane-divider)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-[var(--pane-divider)] px-4">
          <div className="flex items-center gap-2">
            <History className="text-primary h-4 w-4" />
            <h2 id={titleId} className="text-sm font-semibold">
              Audit Trail · {recordLabel ?? recordId}
            </h2>
            <Badge variant="outline" className="text-[10px]">
              {tableName}
            </Badge>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-accent text-muted-foreground rounded p-1"
            aria-label="Close audit log"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <LoadingState label="Loading audit entries…" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <AlertCircle className="h-6 w-6 text-rose-500" />
              <div className="text-sm font-medium">Couldn&apos;t load the audit log</div>
              <div className="text-muted-foreground text-xs">{error}</div>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          ) : grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <History className="text-muted-foreground h-6 w-6" />
              <div className="text-sm font-medium">No audit entries yet</div>
              <div className="text-muted-foreground text-xs">
                Changes to this record will appear here with a timestamp and the user who made them.
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map((group) => (
                <div key={group.date}>
                  <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
                    {group.date}
                  </div>
                  <div className="space-y-3">
                    {group.items.map((entry, idx) => {
                      const style = getActionStyle(entry.action)
                      const ActionIcon = style.icon
                      const { time } = formatTimestamp(entry.timestamp)
                      const changedFields = entry.changed_fields ?? null
                      const fieldEntries = changedFields ? Object.entries(changedFields) : []
                      return (
                        <div
                          key={entry.id ?? `${entry.timestamp}-${idx}`}
                          className="rounded-md border border-[var(--pane-divider)] p-3"
                        >
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn('gap-1 text-[10px]', style.className)}
                            >
                              <ActionIcon className="h-3 w-3" />
                              {style.label}
                            </Badge>
                            <span className="font-mono text-[11px] font-medium tabular-nums">
                              {time}
                            </span>
                            <span className="text-muted-foreground ml-auto truncate text-[11px]">
                              by {entry.changed_by || 'unknown'}
                            </span>
                          </div>
                          {fieldEntries.length > 0 && (
                            <div className="bg-secondary/30 mt-2 divide-y divide-[var(--pane-divider)] rounded-md border border-[var(--pane-divider)]">
                              {fieldEntries.map(([field, diff]) => (
                                <ChangedFieldRow
                                  key={field}
                                  field={field}
                                  oldVal={diff?.old}
                                  newVal={diff?.new}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-muted-foreground flex h-11 flex-shrink-0 items-center justify-between border-t border-[var(--pane-divider)] px-4 text-[10px]">
          <span>
            {loading
              ? 'Loading…'
              : error
                ? 'Error'
                : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}
          </span>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs">
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AuditLogViewer
