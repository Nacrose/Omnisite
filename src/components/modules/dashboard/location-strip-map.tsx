'use client'

// ─── Location Activity Map ──────────────────────────────────────────────────
//
// A horizontally-scrollable dashboard widget that lays out every active
// project location as a "station" on a connecting line, so the PM can scan
// the project footprint at a glance and see where work is happening and
// where issues cluster.
//
// Each station shows:
//   • A colored dot whose color encodes the location group (Bridge Structure
//     = blue, Superstructure = indigo, Approach Road = amber, Site Campus =
//     slate). Closed locations are excluded per the task spec (active only).
//   • The location name and group label.
//   • The assigned SC id (if any) as a small badge.
//   • Three activity rows: Tasks (green), Open NCRs (red), DSR entries today
//     (blue) — each rendered as a colored dot + count, dimmed when zero.
//
// Data sources:
//   • Locations  — `usePersistentState('omnisite-admin-locations', INITIAL_LOCATIONS)`
//                  (same store Admin → Work Locations writes to).
//   • Tasks      — `useSyncedState('omnisite-scheduler-tasks', 'tasks', …)`
//                  flattened with `flattenTasks` so children of Summary tasks
//                  also count toward their parent location.
//   • QS items   — `useSyncedState('omnisite-qs-items', 'qs_items', …)` —
//                  we count items of type 'NCR' whose status is not 'Closed'.
//   • DSR today  — `useSyncedState('omnisite-dsr-entries', 'dsr_entries', …)`
//                  so the count reflects whatever the Daily Ops module has
//                  written (Supabase or localStorage). Counted when
//                  `entry.date === todayISO` and `entry.locationId === loc.id`.
//
// Clicking a station raises a toast with the per-location counts — a quick
// "what's at Pier 3 right now" peek without leaving the dashboard. A full
// drill-down (routing into DSR / NCR / Task views pre-filtered by locationId)
// is left as a follow-up since each module would need to expose a
// `?locationId=` query param first.

import { useMemo } from 'react'
import { toast } from 'sonner'
import { MapPin } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { usePersistentState } from '@/lib/use-persistent-state'
import { useSyncedState } from '@/lib/use-synced-state'
import { INITIAL_LOCATIONS } from '@/data/seed/vendors'
import type { ProjectLocation } from '@/lib/types/vendor'
import { type Task, TASKS, flattenTasks } from '@/components/modules/scheduler/types'
import { type QsItem, INITIAL_ITEMS } from '@/components/modules/qs/types'
import { type DsrEntry } from '@/components/modules/daily-ops/types'

// ─── Group color tokens ─────────────────────────────────────────────────────
// Each group gets a tailwind color triplet: dot fill, ring halo, connector
// line tint, and label text color. The `line` color is a half-opacity fill
// so the line reads as part of the same group without overpowering the dots.

interface GroupColor {
  dot: string
  ring: string
  line: string
  text: string
}

const GROUP_COLORS: Record<string, GroupColor> = {
  'Bridge Structure': {
    dot: 'bg-blue-500',
    ring: 'ring-blue-500/20',
    line: 'bg-blue-400/40',
    text: 'text-blue-600 dark:text-blue-400',
  },
  Superstructure: {
    dot: 'bg-indigo-500',
    ring: 'ring-indigo-500/20',
    line: 'bg-indigo-400/40',
    text: 'text-indigo-600 dark:text-indigo-400',
  },
  'Approach Road': {
    dot: 'bg-amber-500',
    ring: 'ring-amber-500/20',
    line: 'bg-amber-400/40',
    text: 'text-amber-600 dark:text-amber-400',
  },
  'Site Campus': {
    dot: 'bg-slate-400',
    ring: 'ring-slate-400/20',
    line: 'bg-slate-400/40',
    text: 'text-slate-500 dark:text-slate-400',
  },
}

const DEFAULT_GROUP_COLOR: GroupColor = GROUP_COLORS['Site Campus']

function groupColor(group: string): GroupColor {
  return GROUP_COLORS[group] ?? DEFAULT_GROUP_COLOR
}

// ─── Per-station activity counts ────────────────────────────────────────────
interface LocationActivity {
  tasks: number
  ncrs: number
  dsrToday: number
  total: number
}

const EMPTY_ACTIVITY: LocationActivity = { tasks: 0, ncrs: 0, dsrToday: 0, total: 0 }

// ─── Component ──────────────────────────────────────────────────────────────

export function LocationStripMap() {
  // Locations are stored in the persisted admin store — same one the
  // Admin → Work Locations tab edits. We filter to status === 'active'
  // below so closed locations (e.g. "0+200 to 0+400" which has been
  // handed over to traffic) drop out of the strip entirely.
  const [locations] = usePersistentState<ProjectLocation[]>(
    'omnisite-admin-locations',
    INITIAL_LOCATIONS
  )

  // Tasks (scheduler) — useSyncedState so we read whatever is in the live
  // store (Supabase or localStorage), not the stale seed array. The fieldMap
  // mirrors the scheduler module's so `start: number` lands on the
  // `start_week` DB column (without it the camelToSnake auto-convert would
  // produce `start: 'start'` and break reads of the project's schedule).
  const [taskRows] = useSyncedState<Task[]>(
    'omnisite-scheduler-tasks',
    'tasks',
    () => structuredClone(TASKS) as typeof TASKS,
    { fieldMap: { start: 'start_week' }, primaryKey: 'id' }
  )

  // QS items — same store the Q&S module reads. This fieldMap is a subset
  // of qs/index.tsx's fieldMap — only the fields this component actually
  // reads for filtering (locationId, status, type) need correct mapping.
  // `capSubmittedDate` / `closedDate` are intentionally omitted: this view
  // never reads those columns, and `useSyncedState` only needs the subset
  // used for read filtering to be mapped correctly.
  const [qsRows] = useSyncedState<QsItem[]>(
    'omnisite-qs-items',
    'qs_items',
    () => structuredClone(INITIAL_ITEMS) as typeof INITIAL_ITEMS,
    {
      fieldMap: {
        linkedBoq: 'linked_boq',
        dueDate: 'due_date',
        billingHold: 'billing_hold',
        locationId: 'location_id',
      },
      primaryKey: 'id',
    }
  )

  // DSR entries — same store the Daily Ops module writes to. The fieldMap
  // mirrors the camelCase → snake_case columns on the `dsr_entries` table
  // (has_rfi, has_photos, location_id) so rows from Supabase land correctly
  // on the DsrEntry shape. We start with an empty array — the daily-ops
  // module seeds its own store, so by the time the dashboard renders there
  // is usually data; if not, the DSR today count simply shows 0.
  const [dsrEntries] = useSyncedState<DsrEntry[]>('omnisite-dsr-entries', 'dsr_entries', () => [], {
    fieldMap: { hasRfi: 'has_rfi', hasPhotos: 'has_photos', locationId: 'location_id' },
  })

  // Today's date — memoized once per mount so the DSR filter doesn't flicker
  // on re-renders (e.g. the per-second clock tick in the dashboard header).
  // We compare against the YYYY-MM-DD slice the DSR `date` field uses.
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), [])

  // Flatten the task tree so children of Summary tasks count too. A summary
  // task on "Bridge Structure" with five child pier tasks will correctly
  // surface all five at their own locations, even though the summary itself
  // has no locationId.
  const flatTasks = useMemo(() => flattenTasks(taskRows), [taskRows])

  // Active locations, sorted by sortOrder (then by name as a tie-break).
  const sortedLocations = useMemo(() => {
    return [...locations]
      .filter((l) => l.status === 'active')
      .sort((a, b) => {
        const sa = a.sortOrder ?? 0
        const sb = b.sortOrder ?? 0
        if (sa !== sb) return sa - sb
        return a.name.localeCompare(b.name)
      })
  }, [locations])

  // Per-location activity map. Built once per data change so an unrelated
  // re-render (e.g. parent's per-second clock tick) doesn't re-walk every
  // row.
  const activity = useMemo(() => {
    const map = new Map<string, LocationActivity>()
    for (const loc of sortedLocations) {
      const tasks = flatTasks.filter((t) => t.task.locationId === loc.id).length
      const ncrs = qsRows.filter(
        (q) => q.type === 'NCR' && q.locationId === loc.id && q.status !== 'Closed'
      ).length
      const dsrToday = dsrEntries.filter(
        (d: DsrEntry) => d.locationId === loc.id && d.date === todayISO
      ).length
      map.set(loc.id, { tasks, ncrs, dsrToday, total: tasks + ncrs + dsrToday })
    }
    return map
  }, [sortedLocations, flatTasks, qsRows, dsrEntries, todayISO])

  // Total counts for the footer roll-up — quick "across all stations" tally.
  const totals = useMemo(() => {
    let tasks = 0,
      ncrs = 0,
      dsrToday = 0
    for (const loc of sortedLocations) {
      const a = activity.get(loc.id) ?? EMPTY_ACTIVITY
      tasks += a.tasks
      ncrs += a.ncrs
      dsrToday += a.dsrToday
    }
    return { tasks, ncrs, dsrToday }
  }, [sortedLocations, activity])

  // Click handler — for now, raise a toast with the per-location counts.
  // A full drill-down (routing into DSR / NCR / Task views pre-filtered by
  // locationId) is left as a follow-up since each module needs to expose
  // a `?locationId=` query param first.
  const handleClick = (loc: ProjectLocation) => {
    const a = activity.get(loc.id) ?? EMPTY_ACTIVITY
    toast.info(`Location: ${loc.name}`, {
      description: `${a.tasks} task${a.tasks === 1 ? '' : 's'} · ${a.ncrs} open NCR${a.ncrs === 1 ? '' : 's'} · ${a.dsrToday} DSR entr${a.dsrToday === 1 ? 'y' : 'ies'} today`,
    })
  }

  return (
    <Card className="col-span-12 p-5">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="text-primary h-4 w-4" />
          Location Activity Map
        </h3>
        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="text-muted-foreground hidden items-center gap-3 text-[10px] sm:flex">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Tasks
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Open NCRs
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              DSR today
            </span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {sortedLocations.length} active
          </Badge>
        </div>
      </div>

      {sortedLocations.length === 0 ? (
        <div className="text-muted-foreground py-8 text-center text-xs">
          No active work locations. Add locations in Admin → Work Locations.
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div
            className="flex min-w-full items-stretch"
            style={{ minWidth: sortedLocations.length * 150 }}
          >
            {sortedLocations.map((loc, i) => {
              const c = groupColor(loc.group)
              const a = activity.get(loc.id) ?? EMPTY_ACTIVITY
              const isLast = i === sortedLocations.length - 1
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => handleClick(loc)}
                  title={loc.description || loc.name}
                  className="group relative flex w-[150px] flex-shrink-0 flex-col items-stretch px-1.5 text-center outline-none"
                >
                  {/* Dot row with connector line */}
                  <div className="relative flex h-6 w-full items-center justify-center">
                    {/* Connector to next station: spans from this dot's
                        center (left: 50%) to the next station's center
                        (width: 100% → right edge lands at 150% of this
                        station's width, which is the next station's
                        center). Skipped on the last station. */}
                    {!isLast && (
                      <div
                        className={cn(
                          'absolute top-1/2 left-1/2 h-0.5 w-full -translate-y-1/2',
                          c.line
                        )}
                      />
                    )}
                    {/* The dot itself — drawn above the connector with z-10
                        and a ring halo so it visually "punches through" the
                        line. */}
                    <span
                      className={cn(
                        'relative z-10 inline-block h-3 w-3 rounded-full ring-4',
                        c.dot,
                        c.ring
                      )}
                    />
                  </div>

                  {/* Station card */}
                  <div className="bg-card/40 group-hover:border-primary/40 group-hover:bg-accent/40 mt-1.5 w-full rounded-md border border-[var(--pane-divider)] p-2 transition-colors">
                    {/* Name */}
                    <div className="truncate text-xs font-semibold" title={loc.name}>
                      {loc.name}
                    </div>
                    {/* Group label */}
                    <div
                      className={cn('mt-0.5 truncate text-[9px] tracking-wider uppercase', c.text)}
                      title={loc.group}
                    >
                      {loc.group}
                    </div>
                    {/* Assigned SC badge */}
                    {loc.assignedScId && (
                      <div className="mt-1.5">
                        <span className="inline-block rounded bg-slate-500/10 px-1 py-px text-[9px] font-medium text-slate-600 dark:text-slate-300">
                          {loc.assignedScId}
                        </span>
                      </div>
                    )}
                    {!loc.assignedScId && (
                      <div className="text-muted-foreground/60 mt-1.5 text-[9px] italic">no SC</div>
                    )}
                    {/* Activity rows */}
                    <div className="mt-1.5 space-y-0.5">
                      <ActivityRow dotClass="bg-emerald-500" label="Tasks" count={a.tasks} />
                      <ActivityRow dotClass="bg-red-500" label="NCR" count={a.ncrs} />
                      <ActivityRow dotClass="bg-blue-500" label="DSR" count={a.dsrToday} />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          {/* Footer roll-up — quick "across all stations" totals. */}
          <div className="text-muted-foreground mt-2 flex items-center justify-end gap-3 text-[10px]">
            <span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {totals.tasks}
              </span>{' '}
              tasks
            </span>
            <span>·</span>
            <span>
              <span className="font-medium text-red-600 dark:text-red-400">{totals.ncrs}</span> open
              NCRs
            </span>
            <span>·</span>
            <span>
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {totals.dsrToday}
              </span>{' '}
              DSR today
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Activity row helper ────────────────────────────────────────────────────
//
// Renders a single colored dot + label + count line inside the station card.
// When the count is zero, the row is dimmed so non-zero counts "pop" visually.

function ActivityRow({
  dotClass,
  label,
  count,
}: {
  dotClass: string
  label: string
  count: number
}) {
  const hasActivity = count > 0
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-1 text-[10px] transition-opacity',
        hasActivity ? 'opacity-100' : 'opacity-40'
      )}
    >
      <span className={cn('inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full', dotClass)} />
      <span
        className={cn(
          'tabular-nums',
          hasActivity ? 'text-foreground font-medium' : 'text-muted-foreground'
        )}
      >
        {count}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  )
}
