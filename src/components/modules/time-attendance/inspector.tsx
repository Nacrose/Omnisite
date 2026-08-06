'use client'

import { useState, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { MapPin, Clock, DollarSign, Plus, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/app-store'
import { useSyncedState } from '@/lib/use-synced-state'
import type { Worker } from './index'
import { computeDailyPayroll } from './payroll-calc'

// ─── Per-day attendance record (mirrors migration 31 worker_attendance table) ─
interface AttendanceRow {
  id: string
  project_id?: string
  worker_id: string
  date: string
  hours: number
  ot_hours: number
  wage_override?: number | null
  note?: string | null
  logged_by?: string | null
}

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

  // ─── Per-day attendance (migration 31) ──────────────────────────────────
  // The inspector loads all attendance rows for the active project + lets
  // the foreman log a new entry or edit an existing one. Each row is one
  // worker's attendance on one date. The (worker_id, date) pair is unique.
  const { activeProjectDbId } = useApp()
  const [allAttendance, setAllAttendance] = useSyncedState<AttendanceRow[]>(
    'omnisite-worker-attendance',
    'worker_attendance',
    () => [] as AttendanceRow[],
    { primaryKey: 'id' }
  )

  // Filter to just this worker's rows, newest first.
  const workerAttendance = useMemo(
    () =>
      allAttendance
        .filter((a) => a.worker_id === worker.id)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [allAttendance, worker.id]
  )

  // Last 30 days payroll summary (real history, not the previous
  // "requires daily attendance history — not yet implemented" placeholder).
  const todayIso = new Date().toISOString().slice(0, 10)
  const monthAgoIso = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })()
  const last30 = workerAttendance.filter((a) => a.date >= monthAgoIso && a.date <= todayIso)
  const last30Hours = last30.reduce((s, a) => s + a.hours, 0)
  const last30OtHours = last30.reduce((s, a) => s + a.ot_hours, 0)
  const last30Pay = last30.reduce((s, a) => {
    const p = computeDailyPayroll(worker, a.hours)
    return s + p.totalPay
  }, 0)

  // ─── Log-hours form state ────────────────────────────────────────────────
  const [logDate, setLogDate] = useState(todayIso)
  const [logHours, setLogHours] = useState('8')
  const [logNote, setLogNote] = useState('')

  // Reset the form when the worker changes (the inspector is keyed by
  // worker.id so it remounts, but the form fields would otherwise carry
  // over the previous worker's values).
  //
  // Deferred via Promise.resolve().then() to avoid the "set-state-in-effect"
  // lint rule that fires when setState is called synchronously inside an
  // effect (cascading renders). Same pattern used elsewhere in the app
  // (e.g. qs/inspector.tsx BillingHoldNotice).
  useEffect(() => {
    Promise.resolve().then(() => {
      setLogDate(todayIso)
      setLogHours(String(worker.todayHours ?? 8))
      setLogNote('')
    })
  }, [worker.id, worker.todayHours, todayIso])

  const saveAttendance = () => {
    const h = parseFloat(logHours)
    if (Number.isNaN(h) || h < 0 || h > 24) {
      toast.error('Invalid hours', { description: 'Enter a number between 0 and 24.' })
      return
    }
    if (!activeProjectDbId) {
      toast.error('No active project', { description: 'Pick a project first.' })
      return
    }
    // Deterministic id so re-inserting the same (worker, date) updates
    // instead of duplicating. The DB also has a UNIQUE constraint on
    // (worker_id, date) as a backstop.
    const id = `WA-${worker.id}-${logDate}`
    const ot = computeDailyPayroll(worker, h).otHours
    setAllAttendance((prev) => {
      const existing = prev.find((a) => a.id === id)
      const row: AttendanceRow = {
        id,
        project_id: activeProjectDbId,
        worker_id: worker.id,
        date: logDate,
        hours: h,
        ot_hours: ot,
        wage_override: null,
        note: logNote || null,
      }
      return existing ? prev.map((a) => (a.id === id ? row : a)) : [...prev, row]
    })
    toast.success('Attendance logged', {
      description: `${worker.name} · ${logDate} · ${h}h (${ot.toFixed(1)}h OT)`,
    })
    setLogNote('')
  }

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
              onClick={() =>
                toast.info('Task splitting coming soon — allocate hours across tasks manually.')
              }
              title="Split hours to another task"
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
              Labour cost (today)
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
            </div>
          </div>

          <Separator />

          {/* ─── Log per-day attendance (NEW — P1-13) ──────────────────────── */}
          <div>
            <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
              <Calendar className="h-3 w-3" />
              Log Attendance
            </div>
            <div className="space-y-2 rounded-md border border-[var(--pane-divider)] p-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-muted-foreground text-[9px] tracking-wider uppercase">
                    Date
                  </label>
                  <Input
                    type="date"
                    className="h-7 px-1.5 text-[11px]"
                    value={logDate}
                    max={todayIso}
                    onChange={(e) => setLogDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-muted-foreground text-[9px] tracking-wider uppercase">
                    Hours
                  </label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    className="h-7 px-1.5 text-[11px]"
                    value={logHours}
                    onChange={(e) => setLogHours(e.target.value)}
                  />
                </div>
              </div>
              <Input
                placeholder="Note (optional, e.g. 'half-day — personal leave')"
                className="h-7 text-[11px]"
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
              />
              <Button
                size="sm"
                className="h-7 w-full gap-1 text-[11px]"
                onClick={saveAttendance}
                disabled={!activeProjectDbId}
              >
                <Plus className="h-3 w-3" />
                Log / Update
              </Button>
              <div className="text-muted-foreground text-[9px]">
                OT hours auto-computed from the worker&apos;s standard-hours threshold. Re-logging
                the same date updates the existing entry.
              </div>
            </div>
          </div>

          {/* ─── Attendance history (newest 5) ────────────────────────────── */}
          {workerAttendance.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
                Attendance History
              </div>
              <div className="space-y-1">
                {workerAttendance.slice(0, 5).map((a) => {
                  const p = computeDailyPayroll(worker, a.hours)
                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded border border-[var(--pane-divider)] p-1.5 text-[10px]"
                    >
                      <div>
                        <div className="font-mono">{a.date}</div>
                        {a.note && <div className="text-muted-foreground truncate">{a.note}</div>}
                      </div>
                      <div className="text-right">
                        <div className="font-mono">
                          {a.hours.toFixed(1)}h
                          {a.ot_hours > 0 && (
                            <span className="ml-1 text-amber-600">
                              (+{a.ot_hours.toFixed(1)} OT)
                            </span>
                          )}
                        </div>
                        <div className="text-muted-foreground font-mono">
                          NPR {p.totalPay.toFixed(0)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <Separator />

          {/* ─── Payroll summary — real history (last 30 days) ─────────────── */}
          <div>
            <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
              Payroll Summary (last 30 days)
            </div>
            <div className="space-y-1.5 rounded-md border border-[var(--pane-divider)] p-2.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Days logged</span>
                <span className="font-mono">{last30.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total hours</span>
                <span className="font-mono">{last30Hours.toFixed(1)}h</span>
              </div>
              {last30OtHours > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">OT hours</span>
                  <span className="font-mono text-amber-600">{last30OtHours.toFixed(1)}h</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total pay (30 days)</span>
                <span className="font-mono">NPR {last30Pay.toFixed(0)}</span>
              </div>
            </div>
          </div>
        </div>
      </PaneBody>
    </>
  )
}
