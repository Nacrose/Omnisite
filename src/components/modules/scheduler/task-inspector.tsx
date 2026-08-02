'use client'

import { useState, useMemo } from 'react'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Link2, Calendar, Gauge, Package, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Task } from './types'
import { TOTAL_WEEKS } from './types'
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
  onUpdateDuration,
  onUpdateProgress,
  onUpdateLocation,
  onUpdateConstraint,
}: {
  task: Task
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
                  // Max = TOTAL_WEEKS - task.start so the task can't extend
                  // past the project horizon. The clamp is also enforced in
                  // updateTaskDuration, but setting it on the input prevents
                  // the visual "jump" where the user types 100, the input
                  // briefly shows 100, then re-renders with the clamped
                  // value (audit R4-7).
                  max={TOTAL_WEEKS - task.start}
                  value={task.duration}
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
                  value={task.progress}
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
                    max={52}
                    value={deadlineWeekInput}
                    onChange={(e) => {
                      const v = e.target.value
                      setDeadlineWeekInput(v)
                      const parsed = parseInt(v, 10)
                      if (
                        !Number.isNaN(parsed) &&
                        parsed >= 1 &&
                        parsed <= 52 &&
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
                task.dependencies.map((dep, i) => (
                  <div
                    key={`${dep.predecessorId}-${dep.linkType}-${i}`}
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
              Role → Name assignment
            </div>
            {/* Resource assignment is not wired into the task model yet —
                task.resources is a string[] of role names with no person
                attached, no hours/day, and no over-allocation detection.
                Showing fabricated "Bikash Rai / 8h" rows here would imply
                we have a resource database we don't actually have. */}
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--pane-divider)] py-6 text-center">
              <Package className="h-6 w-6 opacity-50" />
              <div className="text-xs font-medium">No resources assigned</div>
              <p className="text-muted-foreground max-w-xs text-[11px] leading-relaxed">
                Resource assignment (role → person, hours/day, over-allocation detection) is not
                configured for this task yet.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="boq" className="mt-0 space-y-3 px-4 py-3 text-xs">
            <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              BOQ Allocation
            </div>
            {/* task.boqAllocated / task.boqTotal exist on the type but are not
                populated for any seed task — and even when they are, we have
                no BOQ-item-code link to display "Item 1.1.3 — PCC M15".
                Showing the fabricated "145 cum allocated / 87 of 145 cum used"
                card here would mislead users into thinking cost is tracked
                per task when it isn't. */}
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--pane-divider)] py-6 text-center">
              <Link2 className="h-6 w-6 opacity-50" />
              <div className="text-xs font-medium">No BOQ items linked to this task</div>
              <p className="text-muted-foreground max-w-xs text-[11px] leading-relaxed">
                BOQ allocation (item code, qty allocated, qty used) will appear here once BOQ items
                are linked to this task.
              </p>
            </div>
            <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Material Lead-Time Check
            </div>
            {/* Lead-time check depends on requisitions/POs linked to this
                task — that linkage is not in the data model today. */}
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--pane-divider)] py-6 text-center">
              <Package className="h-6 w-6 opacity-50" />
              <div className="text-xs font-medium">No materials requisitioned</div>
              <p className="text-muted-foreground max-w-xs text-[11px] leading-relaxed">
                Material lead-time checks will appear here once requisitions are linked to this
                task.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="evm" className="mt-0 space-y-3 px-4 py-3 text-xs">
            <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Earned Value Metrics
            </div>
            {/* EVM requires three data sources this system doesn't wire
                together yet:
                  1. BCWS (Planned Value)  — baseline cost per task
                  2. ACWP (Actual Cost)    — actual quantities from DSR × rates
                  3. BCWP (Earned Value)   — % complete × baseline cost
                None of these are computed per task. The previously-shown
                numbers (BCWS NPR 1.42M, BCWP NPR 0.88M, ACWP NPR 0.95M,
                EAC NPR 1.58M, SPI 0.62, CPI 0.93, SV -540K, CV -70K,
                VAC -160K) were all fabricated and gave users false
                confidence in cost/schedule health.

                We point users at the Financials module, which DOES have
                real budget-vs-actual data at the CBS (project) level. */}
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--pane-divider)] py-6 text-center">
              <Gauge className="text-muted-foreground h-6 w-6 opacity-50" />
              <div className="text-xs font-medium">EVM data not configured</div>
              <p className="text-muted-foreground max-w-sm text-[11px] leading-relaxed">
                Earned Value Management requires baseline cost data (BCWS) and actual cost data
                (ACWP) that aren&apos;t wired into the system yet. This tab will show real EVM
                metrics once:
              </p>
              <ol className="text-muted-foreground mt-1 max-w-sm list-decimal space-y-0.5 pl-7 text-left text-[11px] leading-relaxed">
                <li>BOQ items have baseline cost per task</li>
                <li>DSR entries feed actual quantities into cost calculations</li>
                <li>CBS nodes track committed vs actual per task</li>
              </ol>
              <p className="text-muted-foreground mt-2 max-w-sm text-[11px] leading-relaxed">
                For now, see the Financials module for budget vs actual at the project level.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </PaneBody>
    </>
  )
}
