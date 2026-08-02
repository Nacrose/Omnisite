'use client'

import { useState } from 'react'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Link2, Calendar, Gauge, Package, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Task } from './types'
import { LocationPicker } from '@/components/ui/location-picker'
import { INITIAL_LOCATIONS, INITIAL_VENDORS } from '@/data/seed/vendors'

export function TaskInspector({
  task,
  onUpdateDuration,
  onUpdateLocation,
}: {
  task: Task
  onUpdateDuration?: (id: string, newDuration: number) => void
  /**
   * Fired when the user picks (or clears) a work location in the
   * LocationPicker. The parent uses this to mutate its synced tasks state
   * so the link persists to Supabase and is visible across modules — the
   * inspector can't do that itself because it only owns a local mirror.
   */
  onUpdateLocation?: (locationId: string | null) => void
}) {
  // Local mirror of the task's locationId so the inspector reflects the
  // selection immediately. The parent owns the source of truth (the task
  // tree); mutating `task.locationId` here lets other components reading
  // the same tree instance see the link right away.
  const [locationId, setLocationId] = useState<string | undefined>(task.locationId)

  // Resolve the suggested SC for the currently-selected location. We look
  // up the location by id, then resolve its `assignedScId` against the
  // seed vendors (the persisted `omnisite-vendors` store is owned by the
  // Vendors module — we deliberately don't touch it here to avoid
  // clobbering writes from the Vendors module on first load).
  const suggestedLocation = INITIAL_LOCATIONS.find((l) => l.id === locationId)
  const suggestedSc = suggestedLocation?.assignedScId
    ? (INITIAL_VENDORS.find((v) => v.id === suggestedLocation.assignedScId) ?? {
        id: suggestedLocation.assignedScId,
        name: suggestedLocation.assignedScId,
      })
    : null

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
                setLocationId(locId ?? undefined)
                // Propagate to the parent so the synced tasks store is
                // mutated — the location_id column added in migration 12 is
                // then persisted to Supabase and visible to other modules.
                // Without this, the link lived only in this inspector's
                // local state and was lost on remount / page reload.
                onUpdateLocation?.(locId)
                const loc = INITIAL_LOCATIONS.find((l) => l.id === locId)
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
            <div>
              <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Duration (weeks)
              </label>
              <Input
                className="mt-1 h-8 text-xs"
                type="number"
                min={1}
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
                Constraint
              </label>
              <div className="mt-1 grid grid-cols-2 gap-1">
                {['ASAP', 'ALAP', 'SNET', 'FNLT', 'MFO', 'MSO'].map((c) => (
                  <button
                    key={c}
                    className={cn(
                      'h-7 rounded border text-[11px] transition-colors',
                      task.constraints?.includes(c)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'hover:bg-accent border-[var(--pane-divider)]'
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 pt-1">
              <Switch defaultChecked />
              <span>Effort-driven scheduling</span>
            </label>
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
