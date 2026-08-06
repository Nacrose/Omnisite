'use client'

import { useState, useMemo } from 'react'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Link2, Calendar, Gauge, Package, MapPin, Plus, X, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { computeEVM, formatEVM } from '@/lib/evm'
import { computeProductivity, ROOT_CAUSE_LABELS, type RootCauseCode } from '@/lib/productivity'
import type { Task } from './types'
import { LocationPicker } from '@/components/ui/location-picker'
import { useSyncedState } from '@/lib/use-synced-state'
import { INITIAL_VENDORS } from '@/data/seed/vendors'
import type { ProjectLocation } from '@/lib/types/vendor'

// ─── Constraint code helpers ────────────────────────────────────────────────
//
// Constraints are stored as a single string on the task. The format is
// "CODE" for non-deadline constraints (ASAP, ALAP, SNET, FNLT) and
// "CODE: Wk N" for deadline constraints (MFO, MSO). The EOT breach
// detector in scheduler/index.tsx greps for /Wk (\d+)/ — without the
// "Wk N" suffix, MFO/MSO tasks never trigger breach detection even when
// they overrun (audit S1).
//
// The code set below lets the inspector both render the active button
// correctly (matching by prefix, not substring — audit S3) and prompt
// the user for a deadline week when they pick MFO/MSO.

/** All recognized constraint codes. */
const CONSTRAINT_CODES = ['ASAP', 'ALAP', 'SNET', 'FNLT', 'MFO', 'MSO'] as const

/** Constraint codes that require a deadline week suffix. */
const DEADLINE_CONSTRAINTS = new Set<string>(['MFO', 'MSO'])

/**
 * Match a stored constraint string against a code, accounting for both
 * the short form ("MFO") and the long form ("Must Finish On: Wk 32").
 * Returns true if the stored constraint starts with the code OR with the
 * long-form name corresponding to the code.
 */
function constraintMatches(stored: string | undefined, code: string): boolean {
  if (!stored) return false
  const s = stored.trim()
  if (s.startsWith(code)) return true
  // Long-form aliases for the deadline codes — the seed data uses these
  // ("Must Finish On: Wk 32" / "Must Start On: Wk 48"). Treat them as
  // equivalent to the short code so the active button highlights.
  const longAliases: Record<string, string[]> = {
    MFO: ['Must Finish On', 'MFO'],
    MSO: ['Must Start On', 'MSO'],
    ASAP: ['ASAP', 'As Soon As Possible'],
    ALAP: ['ALAP', 'As Late As Possible'],
    SNET: ['SNET', 'Start No Earlier Than'],
    FNLT: ['FNLT', 'Finish No Later Than'],
  }
  const aliases = longAliases[code]
  if (aliases) {
    for (const alias of aliases) {
      if (s.toLowerCase().startsWith(alias.toLowerCase())) return true
    }
  }
  return false
}

/**
 * Extract the deadline week from a constraint string. Returns null if the
 * constraint has no "Wk N" suffix (e.g. just "MFO" with no week).
 */
function extractDeadlineWeek(stored: string | undefined): number | null {
  if (!stored) return null
  const m = stored.match(/Wk\s*(\d+)/i)
  return m ? parseInt(m[1], 10) : null
}

/**
 * Build the canonical constraint string for a code. Deadline constraints
 * (MFO/MSO) require a week number — if `week` is null/undefined, returns
 * just the code (which the breach detector will silently skip — that's
 * correct behaviour for a constraint with no deadline).
 */
function buildConstraint(code: string, week: number | null | undefined): string {
  if (DEADLINE_CONSTRAINTS.has(code) && week != null && !Number.isNaN(week)) {
    return `${code}: Wk ${week}`
  }
  return code
}

export function TaskInspector({
  task,
  totalWeeks,
  onUpdateDuration,
  onUpdateProgress,
  onUpdateLocation,
  onUpdateConstraint,
}: {
  task: Task
  /** Effective project weeks — replaces the hardcoded TOTAL_WEEKS=52. */
  totalWeeks: number
  onUpdateDuration?: (id: string, newDuration: number) => void
  /**
   * Fired when the user edits the progress input. The parent mutates the
   * synced tasks store so progress persists to Supabase and is visible
   * across modules (outline, dashboard, reports).
   */
  onUpdateProgress?: (id: string, newProgress: number) => void
  /**
   * Fired when the user picks (or clears) a work location in the
   * LocationPicker. The parent uses this to mutate its synced tasks state
   * so the link persists to Supabase and is visible across modules — the
   * inspector can't do that itself because it only owns a local mirror.
   */
  onUpdateLocation?: (locationId: string | null) => void
  /**
   * Fired when the user clicks one of the constraint-type buttons
   * (ASAP/ALAP/SNET/FNLT/MFO/MSO). The parent mutates the synced tasks
   * store so the chosen code persists to Supabase and is visible to the
   * EOT breach detector (which inspects the `constraints` string).
   */
  onUpdateConstraint?: (constraint: string) => void
}) {
  // Use task.locationId directly as the LocationPicker value — no local
  // mirror needed. The parent's onUpdateLocation callback propagates the
  // change, the task tree updates, and the new task prop flows back in the
  // same React batch. This is the standard controlled-component pattern and
  // avoids the stale-local-state bug that a useState mirror would cause
  // when the task prop changes externally (audit R5-1).
  //
  // The toast for the location link is fired in the onChange handler below.
  const locationId = task.locationId

  // ─── BOQ link + resource editor state ──────────────────────────────────
  // These are used in the BOQ tab and Assign tab below. Declared at the
  // top level (not inside IIFEs) to satisfy React's rules-of-hooks.
  const [boqPickerOpen, setBoqPickerOpen] = useState(false)
  const [boqQuery, setBoqQuery] = useState('')
  const [linkedBoqId, setLinkedBoqId] = useState<string | undefined>(task.boqItemId)
  const [taskResources, setTaskResources] = useState<string[]>(task.resources || [])
  const [newResource, setNewResource] = useState('')

  const boqItems = useMemo(() => {
    try {
      const stored = localStorage.getItem('omnisite-boq-data')
      if (stored) {
        const rows = JSON.parse(stored)
        return rows.filter((r: Record<string, unknown>) => r.type !== 'Heading')
      }
    } catch { /* ignore */ }
    return []
  }, [])

  const linkedBoqItem = boqItems.find((i: Record<string, unknown>) => i.id === linkedBoqId)

  // Read the live project-locations store (Supabase when configured, localStorage
  // otherwise) — same hook the Admin → Locations tab and the LocationPicker use.
  // Previously this looked up `INITIAL_LOCATIONS` (the seed array) which meant
  // admin edits to `assignedScId` never propagated to the suggested-SC badge
  // (audit S8). The seed is still the fallback inside useSyncedState.
  const [locations] = useSyncedState<ProjectLocation[]>(
    'omnisite-admin-locations',
    'project_locations',
    // Lazy seed — only used when localStorage and Supabase are both empty.
    () => [] as ProjectLocation[],
    {
      fieldMap: {
        group: 'group_name',
        assignedScId: 'assigned_vendor_id',
        sortOrder: 'sort_order',
      },
      primaryKey: 'id',
    }
  )

  // Resolve the suggested SC for the currently-selected location from the
  // LIVE locations store (so admin edits propagate in realtime). We look up
  // the location by id, then resolve its `assignedScId` against the seed
  // vendors (the persisted `omnisite-vendors` store is owned by the Vendors
  // module — we deliberately don't touch it here to avoid clobbering writes
  // from the Vendors module on first load; the SC id is still meaningful as
  // an opaque identifier even if we can't resolve the human-readable name).
  const suggestedLocation = useMemo(
    () => locations.find((l) => l.id === locationId),
    [locations, locationId]
  )
  const suggestedSc = suggestedLocation?.assignedScId
    ? (INITIAL_VENDORS.find((v) => v.id === suggestedLocation.assignedScId) ?? {
        id: suggestedLocation.assignedScId,
        name: suggestedLocation.assignedScId,
      })
    : null

  // Currently active constraint code, derived from the stored string via
  // prefix matching (so both "MFO" and "Must Finish On: Wk 32" map to MFO).
  const activeConstraintCode = useMemo(() => {
    if (!task.constraints) return null
    for (const code of CONSTRAINT_CODES) {
      if (constraintMatches(task.constraints, code)) return code
    }
    return null
  }, [task.constraints])

  // Local input state for the deadline-week picker shown when MFO/MSO is
  // active. Pre-filled from the stored constraint so existing seed rows
  // (e.g. "Must Finish On: Wk 32") show their week in the input.
  const [deadlineWeekInput, setDeadlineWeekInput] = useState<string>(() => {
    const w = extractDeadlineWeek(task.constraints)
    return w != null ? String(w) : ''
  })

  // Sync deadline-week input when the task's constraints change externally
  // (audit R5-1). Uses the "adjust state during render" pattern from the
  // React docs instead of useEffect+setState (which the linter flags as
  // react-hooks/set-state-in-effect). This pattern stores the previous prop
  // value and resets the local state during render when the prop changes —
  // no extra render, no lint violation.
  const [prevConstraints, setPrevConstraints] = useState(task.constraints)
  if (task.constraints !== prevConstraints) {
    setPrevConstraints(task.constraints)
    const w = extractDeadlineWeek(task.constraints)
    setDeadlineWeekInput(w != null ? String(w) : '')
  }

  const handleConstraintClick = (code: string) => {
    if (!onUpdateConstraint) return
    if (DEADLINE_CONSTRAINTS.has(code)) {
      // For MFO/MSO, build "CODE: Wk N" using the input value. If the input
      // is empty, fall back to the task's current finish week (MFO) or start
      // week (MSO) so the constraint is always actionable (the breach
      // detector needs a week). Previously MSO used the finish week as
      // fallback, but MSO means "Must Start On" — the deadline should be
      // the start week (audit R5-4).
      const parsed = parseInt(deadlineWeekInput, 10)
      const fallbackWeek = code === 'MFO' ? task.start + task.duration : task.start
      const week = Number.isNaN(parsed) ? fallbackWeek : parsed
      onUpdateConstraint(buildConstraint(code, week))
      if (Number.isNaN(parsed)) {
        // Pre-fill the input with the auto-derived week so the user sees
        // what was applied.
        setDeadlineWeekInput(String(week))
        toast.info(
          `Defaulted ${code} deadline to current ${code === 'MFO' ? 'finish' : 'start'} (Wk ${week})`,
          {
            description: 'Edit the week number to set a different deadline.',
          }
        )
      }
    } else {
      onUpdateConstraint(buildConstraint(code, null))
    }
  }

  return (
    <>
      <PaneHeader title={`Task Inspector · ${task.id}`} />
      <PaneBody>
        <div className="border-b border-[var(--pane-divider)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {task.type}
            </Badge>
            {task.critical && (
              <Badge variant="destructive" className="text-[10px]">
                Critical
              </Badge>
            )}
            {task.constraints && (
              <Badge variant="secondary" className="text-[10px]">
                {task.constraints}
              </Badge>
            )}
          </div>
          <div className="text-sm leading-snug font-semibold">{task.name}</div>

          {/* Location picker — optional FK to project_locations.id */}
          <div className="mt-3">
            <label className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase">
              <MapPin className="h-3 w-3" />
              Work Location
            </label>
            <LocationPicker
              value={locationId}
              onChange={(locId) => {
                // Propagate to the parent so the synced tasks store is
                // mutated — the location_id column added in migration 12 is
                // then persisted to Supabase and visible to other modules.
                // Without this, the link lived only in this inspector's
                // local state and was lost on remount / page reload.
                // (audit R5-1: no local mirror — task.locationId is the
                // source of truth, updated via the parent callback.)
                onUpdateLocation?.(locId)
                // Look up the location name from the LIVE synced store so
                // the toast reflects admin edits to location names (audit S8).
                const loc = locations.find((l) => l.id === locId)
                toast.success('Location linked to task', {
                  description: loc
                    ? `${task.id} → ${loc.name}${loc.assignedScId ? ` (assigned SC: ${loc.assignedScId})` : ''}`
                    : `Cleared location on ${task.id}`,
                })
              }}
              allowClear
              placeholder="Link to a project location…"
              className="mt-1"
            />
            {/* Auto-suggested SC from the selected location */}
            {suggestedSc && (
              <div className="mt-2 flex items-center gap-2 rounded-md border border-sky-500/30 bg-sky-500/5 p-1.5 text-[10px]">
                <Package className="h-3 w-3 text-sky-500" />
                <span className="text-muted-foreground">Suggested SC from location:</span>
                <Badge
                  variant="secondary"
                  className="bg-sky-500/15 text-[9px] text-sky-700 dark:text-sky-300"
                >
                  {suggestedSc.id}
                </Badge>
                <span className="truncate font-medium">{suggestedSc.name}</span>
              </div>
            )}
          </div>
        </div>

        <Tabs defaultValue="schedule">
          <div className="px-3 pt-2">
            <TabsList className="grid h-8 w-full grid-cols-4 text-xs">
              <TabsTrigger value="schedule" className="text-[11px]">
                Schedule
              </TabsTrigger>
              <TabsTrigger value="assign" className="text-[11px]">
                Assign
              </TabsTrigger>
              <TabsTrigger value="boq" className="text-[11px]">
                BOQ/RA
              </TabsTrigger>
              <TabsTrigger value="evm" className="text-[11px]">
                EVM
              </TabsTrigger>
              <TabsTrigger value="productivity" className="text-[11px]">
                Productivity
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="schedule" className="mt-0 space-y-3 px-4 py-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Start
                </label>
                <div className="mt-1 flex items-center gap-1.5 rounded-md border border-[var(--pane-divider)] p-2">
                  <Calendar className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="font-mono">Wk {task.start + 1}</span>
                </div>
              </div>
              <div>
                <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Finish
                </label>
                <div className="mt-1 flex items-center gap-1.5 rounded-md border border-[var(--pane-divider)] p-2">
                  <Calendar className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="font-mono">Wk {task.start + task.duration + 1}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Duration (weeks)
                </label>
                <Input
                  className="mt-1 h-8 text-xs"
                  type="number"
                  min={1}
                  // Max = totalWeeks - task.start so the task can't extend
                  // past the project horizon. The clamp is also enforced in
                  // updateTaskDuration, but setting it on the input prevents
                  // the visual "jump" where the user types 100, the input
                  // briefly shows 100, then re-renders with the clamped
                  // value (audit R4-7).
                  max={totalWeeks - task.start}
                  // Use `|| ''` so the input shows empty (not 0) when cleared
                  // — same pattern as the BOQ module's inputs (audit S7-1).
                  value={task.duration || ''}
                  placeholder="1"
                  onChange={(e) => {
                    const next = parseInt(e.target.value, 10)
                    // Only propagate when the user enters a valid positive
                    // integer. Empty / NaN input is ignored so the field
                    // doesn't temporarily store garbage in the task tree.
                    if (!Number.isNaN(next) && next >= 1 && onUpdateDuration) {
                      onUpdateDuration(task.id, next)
                    }
                  }}
                />
              </div>
              <div>
                <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Progress (%)
                </label>
                <Input
                  className="mt-1 h-8 text-xs"
                  type="number"
                  min={0}
                  max={100}
                  // Use a nullish check instead of || so a legitimate 0%
                  // progress shows "0" instead of blanking (the || operator
                  // treats 0 as falsy, which blanks the field).
                  value={task.progress === 0 ? '0' : task.progress || ''}
                  placeholder="0"
                  disabled={!onUpdateProgress}
                  onChange={(e) => {
                    const next = parseInt(e.target.value, 10)
                    // Clamp to [0, 100] and propagate. NaN (empty input) is
                    // ignored so the field doesn't momentarily store garbage
                    // in the task tree (audit S13 — previously progress was
                    // read-only with no input at all).
                    if (!Number.isNaN(next) && next >= 0 && next <= 100 && onUpdateProgress) {
                      onUpdateProgress(task.id, next)
                    }
                  }}
                />
              </div>
            </div>
            <div>
              <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Constraint
              </label>
              <div className="mt-1 grid grid-cols-3 gap-1">
                {CONSTRAINT_CODES.map((c) => (
                  <button
                    key={c}
                    onClick={() => handleConstraintClick(c)}
                    disabled={!onUpdateConstraint}
                    className={cn(
                      'h-7 rounded border font-mono text-[10px] transition-colors',
                      activeConstraintCode === c
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'hover:bg-accent border-[var(--pane-divider)]',
                      !onUpdateConstraint && 'cursor-not-allowed opacity-50'
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {/* Deadline-week input — only shown when MFO or MSO is active.
                  The stored constraint string carries the week as "CODE: Wk N"
                  so the EOT breach detector can parse it. Editing the week
                  here rebuilds the constraint string with the new value. */}
              {activeConstraintCode && DEADLINE_CONSTRAINTS.has(activeConstraintCode) && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Deadline Wk
                  </label>
                  <Input
                    className="h-7 w-20 text-xs"
                    type="number"
                    min={1}
                    max={totalWeeks}
                    value={deadlineWeekInput}
                    onChange={(e) => {
                      const v = e.target.value
                      setDeadlineWeekInput(v)
                      const parsed = parseInt(v, 10)
                      if (
                        !Number.isNaN(parsed) &&
                        parsed >= 1 &&
                        parsed <= totalWeeks &&
                        onUpdateConstraint
                      ) {
                        onUpdateConstraint(buildConstraint(activeConstraintCode, parsed))
                      }
                    }}
                  />
                  <span className="text-muted-foreground text-[10px]">
                    {activeConstraintCode === 'MFO' ? 'must finish by' : 'must start by'} this week
                  </span>
                </div>
              )}
            </div>
            <Separator />
            <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
              Dependencies ({task.dependencies?.length || 0})
            </div>
            <div className="space-y-1.5">
              {task.dependencies && task.dependencies.length > 0 ? (
                task.dependencies.map((dep) => (
                  <div
                    key={`${dep.predecessorId}-${dep.linkType}`}
                    className="flex items-center gap-2 rounded border border-[var(--pane-divider)] p-1.5"
                  >
                    <Link2 className="text-muted-foreground h-3 w-3" />
                    <span className="font-mono text-[10px]">{dep.predecessorId}</span>
                    <Badge variant="secondary" className="text-[9px]">
                      {dep.linkType}
                      {dep.lagWeeks !== 0 && (dep.lagWeeks > 0 ? `+${dep.lagWeeks}` : dep.lagWeeks)}
                    </Badge>
                    <span className="text-muted-foreground flex-1 truncate text-[10px]">
                      {dep.lagWeeks !== 0
                        ? `${dep.lagWeeks > 0 ? '+' : ''}${dep.lagWeeks}w lag`
                        : 'no lag'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground rounded border border-dashed border-[var(--pane-divider)] p-2 text-center text-[10px]">
                  No dependencies — ASAP scheduling
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="assign" className="mt-0 space-y-3 px-4 py-3 text-xs">
            <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Resource Assignment
            </div>
            <div className="space-y-1.5">
              {taskResources.length > 0 ? (
                taskResources.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md border border-[var(--pane-divider)] p-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-slate-400 to-slate-600 text-[10px] font-semibold text-white">
                      {r.charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 text-xs">{r}</span>
                    <button
                      onClick={() => {
                        const updated = taskResources.filter((_, idx) => idx !== i)
                        setTaskResources(updated)
                        try { localStorage.setItem("omnisite-scheduler-tasks", JSON.stringify(JSON.parse(localStorage.getItem("omnisite-scheduler-tasks") || "[]"))) } catch {}
                      }}
                      className="text-muted-foreground hover:text-red-500"
                      title="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground rounded-md border border-dashed border-[var(--pane-divider)] p-3 text-center text-[10px]">
                  No resources assigned yet
                </div>
              )}
            </div>
            <div className="flex gap-1.5">
              <Input
                className="h-7 flex-1 text-xs"
                placeholder="e.g. Mason (Cat I), Excavator Operator, Mazdoor x4"
                value={newResource}
                onChange={(e) => setNewResource(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (!newResource.trim()) return
                    const updated = [...taskResources, newResource.trim()]
                    setTaskResources(updated)
                    try { localStorage.setItem("omnisite-scheduler-tasks", JSON.stringify(JSON.parse(localStorage.getItem("omnisite-scheduler-tasks") || "[]"))) } catch {}
                    setNewResource('')
                    toast.success('Resource added', { description: newResource.trim() })
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                onClick={() => {
                  if (!newResource.trim()) return
                  const updated = [...taskResources, newResource.trim()]
                  setTaskResources(updated)
                  try { localStorage.setItem("omnisite-scheduler-tasks", JSON.stringify(JSON.parse(localStorage.getItem("omnisite-scheduler-tasks") || "[]"))) } catch {}
                  setNewResource('')
                  toast.success('Resource added', { description: newResource.trim() })
                }}
                disabled={!newResource.trim()}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-muted-foreground text-[10px]">
              Resource names drive the leveling tool's peak-load detection. Enter role + count (e.g. "Mason x2", "Mazdoor x4").
            </p>
          </TabsContent>

          <TabsContent value="boq" className="mt-0 space-y-3 px-4 py-3 text-xs">
            <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              BOQ Allocation
            </div>

            {linkedBoqItem ? (
              <>
                <div className="rounded-md border border-[var(--pane-divider)] p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-[10px] font-semibold">{String(linkedBoqItem.code || linkedBoqItem.id)}</span>
                    <button
                      onClick={() => setLinkedBoqId(undefined)}
                      className="text-muted-foreground hover:text-red-500"
                      title="Unlink BOQ item"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="text-xs font-medium">{String(linkedBoqItem.desc || linkedBoqItem.description || '—')}</div>
                  <div className="text-muted-foreground mt-1 flex items-center gap-3 text-[10px]">
                    <span>Qty: {String(linkedBoqItem.qty)} {String(linkedBoqItem.uom || '')}</span>
                    <span>·</span>
                    <span>Rate: NPR {Number(linkedBoqItem.rate || 0).toLocaleString()}</span>
                    <span>·</span>
                    <span className="font-semibold">Amount: NPR {(Number(linkedBoqItem.qty || 0) * Number(linkedBoqItem.rate || 0)).toLocaleString()}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setBoqPickerOpen(true)}>
                  <Search className="h-3 w-3" /> Change BOQ Item
                </Button>
              </>
            ) : (
              <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--pane-divider)] py-6 text-center">
                <Link2 className="h-6 w-6 opacity-50" />
                <div className="text-xs font-medium">No BOQ item linked</div>
                <p className="text-muted-foreground max-w-xs text-[11px] leading-relaxed">
                  Link this task to a BOQ line item to track cost, quantity, and rate analysis against the schedule.
                </p>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setBoqPickerOpen(true)}>
                  <Plus className="h-3 w-3" /> Link BOQ Item
                </Button>
              </div>
            )}

            {boqPickerOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setBoqPickerOpen(false)}>
                <div className="pane w-full max-w-lg overflow-hidden rounded-xl border border-[var(--pane-divider)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <div className="flex h-12 items-center justify-between border-b border-[var(--pane-divider)] px-4">
                    <span className="text-sm font-semibold">Link BOQ Item</span>
                    <button onClick={() => setBoqPickerOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
                  </div>
                  <div className="p-3">
                    <Input className="h-8 text-xs" placeholder="Search by code or description…" value={boqQuery} onChange={(e) => setBoqQuery(e.target.value)} autoFocus />
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {boqItems.filter((i: Record<string, unknown>) => {
                      const q = boqQuery.toLowerCase()
                      const code = String(i.code || '')
                      const desc = String(i.desc || i.description || '')
                      return !q || code.toLowerCase().includes(q) || desc.toLowerCase().includes(q)
                    }).map((item: Record<string, unknown>) => (
                      <button
                        key={String(item.id)}
                        onClick={() => {
                          const id = String(item.id)
                          setLinkedBoqId(id)
                          try { localStorage.setItem("omnisite-scheduler-tasks", JSON.stringify(JSON.parse(localStorage.getItem("omnisite-scheduler-tasks") || "[]"))) } catch {}
                          setBoqPickerOpen(false)
                          toast.success('BOQ item linked', {
                            description: `${String(item.code || '')} — ${String(item.desc || item.description || '')}`,
                          })
                        }}
                        className="hover:bg-accent flex w-full items-center gap-3 border-b border-[var(--pane-divider)] px-4 py-2 text-left transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium">{String(item.desc || item.description || '—')}</div>
                          <div className="text-muted-foreground text-[10px]">{String(item.code)} · {String(item.qty)} {String(item.uom || '')}</div>
                        </div>
                        <div className="font-mono text-xs font-semibold">NPR {Number(item.rate || 0).toLocaleString()}</div>
                      </button>
                    ))}
                    {boqItems.length === 0 && (
                      <div className="text-muted-foreground p-8 text-center text-xs">
                        No BOQ items found. Build the BOQ first in the BOQ module.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Material Lead-Time Check
            </div>
            {/* Read requisitions from localStorage (same key as Procurement module).
                Filter by task_id when the requisitions→task link is set. */}
            {(() => {
              const reqs = useMemo(() => {
                try {
                  const stored = localStorage.getItem('omnisite-procurement-requisitions')
                  if (stored) return JSON.parse(stored) as Array<Record<string, unknown>>
                } catch { /* ignore */ }
                return []
              }, [])
              const taskReqs = reqs.filter((r) => r.task_id === task.id || r.source === task.name)
              if (taskReqs.length === 0) {
                return (
                  <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--pane-divider)] py-6 text-center">
                    <Package className="h-6 w-6 opacity-50" />
                    <div className="text-xs font-medium">No materials requisitioned</div>
                    <p className="text-muted-foreground max-w-xs text-[11px] leading-relaxed">
                      Create a requisition in Procurement and link it to this task to see lead-time status here.
                    </p>
                  </div>
                )
              }
              return (
                <div className="space-y-1.5">
                  {taskReqs.map((req, i) => (
                    <div key={i} className="rounded-md border border-[var(--pane-divider)] p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{String(req.item || req.id || '—')}</span>
                        <Badge variant="outline" className="text-[9px]">{String(req.status || 'Draft')}</Badge>
                      </div>
                      <div className="text-muted-foreground text-[10px]">
                        {String(req.qty || 0)} {String(req.uom || '')}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </TabsContent>

          <TabsContent value="evm" className="mt-0 space-y-3 px-4 py-3 text-xs">
            <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Earned Value Metrics
            </div>
            {/* EVM computed via src/lib/evm.ts — computeEVM() service.
                BCWS = BOQ rate × qty, BCWP = BCWS × progress %,
                ACWP = actual cost from CBS (if available).
                When no BOQ item is linked, show honest "not linked" state. */}
            {(() => {
              if (!linkedBoqItem) {
                return (
                  <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--pane-divider)] py-6 text-center">
                    <Gauge className="text-muted-foreground h-6 w-6 opacity-50" />
                    <div className="text-xs font-medium">Link a BOQ item to compute EVM</div>
                    <p className="text-muted-foreground max-w-xs text-[11px] leading-relaxed">
                      EVM requires a BOQ item link (BCWS = rate × qty) and task progress (BCWP = BCWS × %).
                      Link one in the BOQ tab above.
                    </p>
                  </div>
                )
              }
              const evmResult = computeEVM({
                boqRate: Number(linkedBoqItem.rate || 0),
                boqQty: Number(linkedBoqItem.qty || 0),
                taskProgress: task.progress,
              })
              const metrics = formatEVM(evmResult)
              const statusColor = (s: string) =>
                s === 'good' ? 'text-emerald-500' : s === 'bad' ? 'text-red-500' : 'text-foreground'

              return (
                <div className="space-y-2">
                  <div className="rounded-md border border-[var(--pane-divider)] p-3">
                    <div className="text-muted-foreground mb-2 text-[10px]">
                      Computed from linked BOQ item: {String(linkedBoqItem.code)} · {String(linkedBoqItem.desc || linkedBoqItem.description || '')}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {metrics.map((m) => (
                        <div key={m.label} className="rounded bg-secondary/30 p-2">
                          <div className="text-muted-foreground text-[9px]">{m.label}</div>
                          <div className={cn('font-mono text-xs font-semibold', statusColor(m.status))}>
                            {m.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-muted-foreground text-[10px] leading-relaxed">
                    BCWS = BOQ rate × qty. BCWP = BCWS × task progress ({task.progress}%).
                    ACWP requires CBS linkage (actual cost tracking) — not yet wired per-task.
                    SPI &lt; 1 = behind schedule. CPI &lt; 1 = over budget.
                  </p>
                </div>
              )
            })()}
          </TabsContent>

          {/* Productivity tab — planned vs actual manhours */}
          <TabsContent value="productivity" className="mt-0 space-y-3 px-4 py-3 text-xs">
            <ProductivityTab taskId={task.id} taskResources={taskResources} taskProgress={task.progress} />
          </TabsContent>
        </Tabs>
      </PaneBody>
    </>
  )
}

// ─── Productivity Tab ───────────────────────────────────────────────────────
//
// Shows planned vs actual manhours, variance %, and root cause logging
// when variance exceeds 20%. Uses computeProductivity() from
// src/lib/productivity.ts.

function ProductivityTab({
  taskId,
  taskResources,
  taskProgress,
}: {
  taskId: string
  taskResources: string[]
  taskProgress: number
}) {
  const [plannedHours, setPlannedHours] = useState('')
  const [actualHours, setActualHours] = useState('')
  const [rootCause, setRootCause] = useState<RootCauseCode | ''>('')

  const hasInput = plannedHours && actualHours
  const result = hasInput
    ? computeProductivity(
        {
          taskId,
          calculationDate: new Date().toISOString().split('T')[0],
          plannedManhours: parseFloat(plannedHours),
          actualManhours: parseFloat(actualHours),
        },
        rootCause || null
      )
    : null

  return (
    <>
      <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        Productivity Variance
      </div>

      {/* Input fields */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-medium">Planned manhours</label>
          <Input
            className="mt-0.5 h-7 text-xs"
            type="number"
            placeholder="e.g. 100"
            value={plannedHours}
            onChange={(e) => setPlannedHours(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[10px] font-medium">Actual manhours</label>
          <Input
            className="mt-0.5 h-7 text-xs"
            type="number"
            placeholder="e.g. 130"
            value={actualHours}
            onChange={(e) => setActualHours(e.target.value)}
          />
        </div>
      </div>

      {/* Assigned resources reminder */}
      {taskResources.length > 0 && (
        <div className="text-muted-foreground text-[10px]">
          Assigned: {taskResources.join(', ')}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="rounded-md border border-[var(--pane-divider)] p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded bg-secondary/30 p-2">
              <div className="text-muted-foreground text-[9px]">Variance (hrs)</div>
              <div className={cn('font-mono text-xs font-semibold', result.varianceManhours > 0 ? 'text-red-500' : 'text-emerald-500')}>
                {result.varianceManhours >= 0 ? '+' : ''}{result.varianceManhours}
              </div>
            </div>
            <div className="rounded bg-secondary/30 p-2">
              <div className="text-muted-foreground text-[9px]">Variance %</div>
              <div className={cn('font-mono text-xs font-semibold', Math.abs(result.variancePercent) > 20 ? 'text-red-500' : 'text-emerald-500')}>
                {result.variancePercent >= 0 ? '+' : ''}{result.variancePercent}%
              </div>
            </div>
            <div className="rounded bg-secondary/30 p-2">
              <div className="text-muted-foreground text-[9px]">Productivity ratio</div>
              <div className="font-mono text-xs font-semibold">{result.productivityRatio.toFixed(2)}</div>
            </div>
            <div className="rounded bg-secondary/30 p-2">
              <div className="text-muted-foreground text-[9px]">Status</div>
              <div className={cn('text-xs font-semibold',
                result.status === 'OK' ? 'text-emerald-500' :
                result.status === 'ROOT_CAUSE_REQUIRED' ? 'text-red-500' :
                'text-amber-500'
              )}>
                {result.status === 'OK' ? 'OK' :
                 result.status === 'ROOT_CAUSE_REQUIRED' ? 'Root cause required' :
                 'Root cause logged'}
              </div>
            </div>
          </div>

          {/* Root cause selector — shown when variance > 20% */}
          {result.status !== 'OK' && (
            <div className="mt-2">
              <label className="text-[10px] font-medium">Root cause {result.status === 'ROOT_CAUSE_REQUIRED' && <span className="text-red-500">*</span>}</label>
              <select
                className="mt-0.5 h-7 w-full rounded border border-[var(--pane-divider)] bg-transparent px-2 text-xs"
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value as RootCauseCode)}
              >
                <option value="">— Select root cause —</option>
                {(Object.entries(ROOT_CAUSE_LABELS) as [RootCauseCode, string][]).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
              {result.status === 'ROOT_CAUSE_LOGGED' && (
                <div className="mt-1 text-[10px] text-emerald-600">
                  Root cause logged — productivity record saved for future rate analysis.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-muted-foreground text-[10px] leading-relaxed">
        Variance threshold: ±20%. Tasks exceeding this require root cause logging.
        Productivity ratio = planned ÷ actual (1.0 = on target, &lt;1 = over budget).
      </p>
    </>
  )
}
