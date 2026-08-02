'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { MapPin, Clock, DollarSign, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Worker } from './index'
import { computeDailyPayroll } from './payroll-calc'

/**
 * WorkerInspector — right-pane detail view for a single worker.
 *
 * Shows the worker's geo-fence status, task allocation breakdown (the
 * "8h split" — how many hours were allocated to which task IDs), the
 * auto-computed labour cost (wage × hours, OT multiplier after standard
 * hours), and a static payroll-summary strip.
 *
 * The labour-cost calc uses `computeDailyPayroll` from ./payroll-calc —
 * the SAME helper used by the payroll CSV export — so the inspector's
 * "Today's labour cost" can never drift away from what the CSV reports.
 */
export function WorkerInspector({ worker }: { worker: Worker }) {
  const hours = worker.todayHours || 0
  const payroll = computeDailyPayroll(worker, hours)
  const {
    wageRate: ratePerHour,
    otMultiplier,
    standardHours,
    regularHours: regHours,
    otHours,
  } = payroll
  const todayCost = payroll.totalPay

  return (
    <>
      <PaneHeader title={`Worker Inspector · ${worker.id}`} />
      <PaneBody>
        <div className="border-b border-[var(--pane-divider)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge
              variant="secondary"
              className={cn(
                'text-[10px]',
                worker.status === 'on-site' &&
                  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                worker.status === 'off-site' && 'bg-slate-400/15',
                worker.status === 'break' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
              )}
            >
              {worker.status}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {worker.trade}
            </Badge>
          </div>
          <div className="text-sm font-semibold">{worker.name}</div>
          <div className="text-muted-foreground mt-0.5 text-xs">{worker.phone}</div>
        </div>

        <div className="space-y-3 p-4 text-xs">
          {/* Geo-fence card */}
          <div
            className={cn(
              'rounded-md border p-2.5',
              worker.geoFence === false && worker.status === 'on-site'
                ? 'border-amber-500/40 bg-amber-500/10'
                : 'bg-secondary/30 border-[var(--pane-divider)]'
            )}
          >
            <div className="mb-1 flex items-center gap-1.5">
              <MapPin
                className={cn(
                  'h-3.5 w-3.5',
                  worker.geoFence === false && worker.status === 'on-site'
                    ? 'text-amber-500'
                    : 'text-emerald-500'
                )}
              />
              <span className="font-medium">Geo-fenced Attendance</span>
            </div>
            {worker.geoFence === false && worker.status === 'on-site' ? (
              <div className="text-[10px] text-amber-700 dark:text-amber-300">
                ⚠ Clock-in GPS outside site perimeter (500m). Foreman verification required.
              </div>
            ) : (
              <div className="text-muted-foreground text-[10px]">
                GPS captured at clock-in · within site perimeter
              </div>
            )}
            <div className="mt-1 font-mono text-[10px]">
              {worker.clockIn && <div>Clock-in: {worker.clockIn} · 27.7°N 85.3°E</div>}
              {worker.clockOut && <div>Clock-out: {worker.clockOut}</div>}
            </div>
          </div>

          <Separator />

          {/* Task allocation — the magic */}
          <div>
            <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
              <Clock className="h-3 w-3" />
              Task Allocation (8h split)
            </div>
            <div className="space-y-1.5">
              {worker.allocated.map((a, i) => (
                <div key={i} className="rounded border border-[var(--pane-divider)] p-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{a.task}</span>
                    <span className="font-mono">{a.hours}h</span>
                  </div>
                  <div className="bg-secondary mt-1 h-2 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full"
                      style={{ width: `${(a.hours / 8) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="text-muted-foreground flex justify-between px-1 text-[10px]">
                <span>Total allocated</span>
                <span className="font-mono">
                  {worker.allocated.reduce((s, a) => s + a.hours, 0)}h / 8h
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 w-full gap-1 text-xs"
              disabled
              title="Coming soon"
            >
              <Plus className="h-3 w-3" />
              Split hours to another task
            </Button>
          </div>

          <Separator />

          {/* Cost auto-calc */}
          <div>
            <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
              <DollarSign className="h-3 w-3" />
              Labour Cost Auto-Calc
            </div>
            <div className="space-y-1.5 rounded-md border border-[var(--pane-divider)] p-2.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Wage rate</span>
                <span className="font-mono">NPR {ratePerHour.toFixed(0)}/hr</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">OT multiplier</span>
                <span className="font-mono">
                  {otMultiplier}× after {standardHours}h
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Regular hours</span>
                <span className="font-mono">
                  {regHours.toFixed(1)}h × NPR {ratePerHour.toFixed(0)}
                </span>
              </div>
              {otHours > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overtime</span>
                  <span className="font-mono text-amber-600">
                    {otHours.toFixed(1)}h × NPR {(ratePerHour * otMultiplier).toFixed(0)}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Today&apos;s labour cost</span>
                <span className="font-mono">NPR {todayCost.toFixed(0)}</span>
              </div>
              <div className="text-muted-foreground mt-1 text-[10px]">
                Auto-pushed to Financials (ACWP) against CBS nodes from allocated tasks.
              </div>
            </div>
          </div>

          <Separator />

          {/* Payroll summary */}
          <div>
            <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
              Payroll Summary (this month)
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-secondary/40 rounded-md p-2">
                <div className="text-muted-foreground text-[10px]">Days</div>
                <div className="text-sm font-bold">22</div>
              </div>
              <div className="bg-secondary/40 rounded-md p-2">
                <div className="text-muted-foreground text-[10px]">Hours</div>
                <div className="text-sm font-bold">176</div>
              </div>
              <div className="bg-secondary/40 rounded-md p-2">
                <div className="text-muted-foreground text-[10px]">Earned</div>
                <div className="text-sm font-bold">NPR 26.4K</div>
              </div>
            </div>
          </div>
        </div>
      </PaneBody>
    </>
  )
}
