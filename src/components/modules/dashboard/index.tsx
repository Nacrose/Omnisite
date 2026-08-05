'use client'

// ─── Dashboard module shell ──────────────────────────────────────────────────
// Extracted from the monolithic dashboard.tsx. Owns the live-data hooks
// (boq / tasks / cbs via useSyncedState), the per-second clock, the live
// aggregation chips in the header, and the "Daily Brief" card. The KPI
// strip, charts, and urgent-actions queue are imported from their own files.

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useSyncedState } from '@/lib/use-synced-state'
import { type BoqItem, BOQ_DATA, flatten as flattenBoq } from '@/components/modules/boq/types'
import { type Task, TASKS, flattenTasks } from '@/components/modules/scheduler/types'
import { type CbsNode, CBS } from '@/components/modules/financials/types'
import {
  type Po,
  type Grn,
  INITIAL_POS,
  INITIAL_GRNS,
} from '@/components/modules/procurement/types'
import { type QsItem, INITIAL_ITEMS } from '@/components/modules/qs/types'
import {
  Cloud,
  Users,
  Truck,
  ArrowRight,
  Clock,
  FileText,
  DollarSign,
  Gauge,
  Activity,
  Plus,
} from 'lucide-react'
import { KpiStrip } from './kpi-strip'
import { UrgentActionsQueue, type UrgentAction } from './urgent-actions'
import { MiniGanttChart, SCurveChart, CashFlowChart, BacklogChart } from './charts'
import { LocationStripMap } from './location-strip-map'
import { useApp } from '@/lib/app-store'
import { getTodayWeek } from '@/lib/project-constants'
import { PROJECTS } from '@/components/project-switcher'

export function DashboardModule() {
  const router = useRouter()
  const navigateToModule = (id: string) => router.push(`/${id}`)
  const { activeProject, activeProjectId } = useApp()
  const projectEpoch = PROJECTS.find((p) => p.id === activeProjectId)?.startDate

  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    // Use setTimeout to defer the initial time set — avoids synchronous setState in effect
    const initial = setTimeout(() => setNow(new Date()), 0)
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => {
      clearTimeout(initial)
      clearInterval(t)
    }
  }, [])

  // ─── Live data hooks ──────────────────────────────────────────────────────
  // These three useSyncedState calls fetch from Supabase when configured, and
  // fall back to localStorage (with the seed data as initial state) otherwise.
  // The dashboard's header KPIs then aggregate from these arrays so the
  // numbers always reflect what's in the database — not the seed arrays.
  const [boqRows] = useSyncedState<BoqItem[]>(
    'omnisite-boq-data',
    'boq_items',
    () => structuredClone(BOQ_DATA) as typeof BOQ_DATA,
    {
      // `locationId: 'location_id'` mirrors the BOQ module's own fieldMap so
      // the dashboard's synced store can read the same column the inspector
      // writes (migration 12 added the FK). Without this, the auto camel→snake
      // converter would produce `location_id` anyway, but making it explicit
      // keeps the dashboard in lockstep with the BOQ module's mapping — and
      // documents the column's existence for future readers.
      fieldMap: {
        desc: 'description',
        hasRA: 'has_ra',
        parentId: 'parent_id',
        locationId: 'location_id',
      },
      primaryKey: 'id',
    }
  )
  const [taskRows] = useSyncedState<Task[]>(
    'omnisite-scheduler-tasks',
    'tasks',
    () => structuredClone(TASKS) as typeof TASKS,
    {
      // `start: number` on the Task app type maps to the `start_week` DB
      // column. Without this fieldMap the camelToSnake auto-convert would
      // produce `start: 'start'` (no such column) and the task's scheduled
      // start week would be silently dropped on every POST. The scheduler
      // module's own useSyncedState call has the same mapping.
      fieldMap: { start: 'start_week' },
      primaryKey: 'id',
    }
  )
  const [cbsRows] = useSyncedState<CbsNode[]>(
    'omnisite-financials-cbs',
    'cbs_nodes',
    () => structuredClone(CBS) as typeof CBS,
    {
      fieldMap: { marginPct: 'margin_pct', parentCode: 'parent_code' },
      primaryKey: 'code',
    }
  )

  // Procurement + Q&S data — same synced stores the Procurement / Q&S modules
  // read from. Used to derive the urgent-actions queue (pending POs, GRNs on
  // hold, open NCRs past their due date) so the dashboard never shows a
  // stale fabricated list.
  const [poRows] = useSyncedState<Po[]>(
    'omnisite-procurement-pos',
    'purchase_orders',
    () => structuredClone(INITIAL_POS) as typeof INITIAL_POS,
    {
      fieldMap: {
        // `grn: boolean` on the Po app type maps to the `has_grn` DB
        // column. (See the matching comment in procurement/index.tsx.)
        grn: 'has_grn',
        reqId: 'req_id',
        materialCode: 'material_code',
        poQty: 'po_qty',
      },
      primaryKey: 'id',
    }
  )
  const [grnRows] = useSyncedState<Grn[]>(
    'omnisite-procurement-grns',
    'grns',
    () => structuredClone(INITIAL_GRNS) as typeof INITIAL_GRNS,
    {
      fieldMap: {
        poId: 'po_id',
        poQty: 'po_qty',
        grnQty: 'grn_qty',
        invoiceQty: 'invoice_qty',
        payStatus: 'pay_status',
        materialCode: 'material_code',
      },
      primaryKey: 'id',
    }
  )
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
        capSubmittedDate: 'cap_submitted_date',
        closedDate: 'closed_date',
      },
      primaryKey: 'id',
    }
  )

  // Live KPI aggregation. Memoized on the underlying arrays so unrelated
  // re-renders (e.g. the per-second clock tick) don't re-walk every row.
  const liveKpis = useMemo(() => {
    const flatBoq = flattenBoq(boqRows)
    // Contract total = sum of qty × rate over LEAF non-Heading items only.
    // Excluding headings isn't enough: a Priced item with children would
    // otherwise contribute both itself AND its children's qty × rate,
    // double-counting the subtree. The leaf check (!children || length===0)
    // is the same guard the BOQ module's own contractTotal uses.
    const contractTotal = flatBoq
      .filter((b) => b.type !== 'Heading' && (!b.children || b.children.length === 0))
      .reduce((sum, b) => sum + b.qty * b.rate, 0)

    const flatTasks = flattenTasks(taskRows)
    const totalTasks = flatTasks.length
    const criticalTasks = flatTasks.filter((t) => t.task.critical).length
    const completedTasks = flatTasks.filter((t) => t.task.progress >= 100).length
    const overallProgress =
      totalTasks > 0
        ? Math.round(flatTasks.reduce((s, t) => s + t.task.progress, 0) / totalTasks)
        : 0

    // CBS totals — only roots (no parentCode) to avoid double-counting.
    const totalBudget = cbsRows.filter((c) => !c.parentCode).reduce((s, c) => s + c.budget, 0)
    const totalActual = cbsRows.filter((c) => !c.parentCode).reduce((s, c) => s + c.actual, 0)

    return {
      contractTotal,
      totalTasks,
      criticalTasks,
      completedTasks,
      overallProgress,
      totalBudget,
      totalActual,
    }
  }, [boqRows, taskRows, cbsRows])

  // Urgent actions — derived from live PO / GRN / QS / task data instead of
  // the previously-hardcoded list (PO-2410-018, DSR #087, NCR-034, etc.).
  //
  // Rules:
  //   • Pending POs → "PO {id} awaiting delivery" (severity: high)
  //   • Open NCRs past their dueDate → "NCR {id} open" (severity: critical)
  //   • Tasks at 0% progress past their scheduled start week → "Task {id}
  //     stalled" (severity: high)
  //   • GRNs whose payment is on Hold → "GRN {id} payment on hold"
  //     (severity: medium)
  //
  // The "current week" for stalled-task detection mirrors the scheduler's
  // own `todayWeek` constant (scheduler/index.tsx) so the dashboard and
  // the Gantt canvas agree on where "today" is.
  const urgentActions = useMemo<UrgentAction[]>(() => {
    const actions: UrgentAction[] = []

    // Pending POs — awaiting delivery / GRN.
    for (const p of poRows) {
      if (p.status === 'Pending') {
        actions.push({
          type: 'PO Approval',
          desc: `${p.id} awaiting delivery · ${p.vendor} · NPR ${p.value.toLocaleString()}`,
          who: p.vendor,
          due: 'Today',
          severity: 'high',
          module: 'procurement',
        })
      }
    }

    // Open NCRs whose dueDate has passed (or has no dueDate and is open).
    // dueDate format on QsItem is "DD Mon YYYY" (e.g. "05 Aug 2026").
    const nowMs = Date.now()
    for (const q of qsRows) {
      if (q.type === 'NCR' && q.status === 'Open') {
        const dueMs = q.dueDate ? Date.parse(q.dueDate) : NaN
        const overdue = !Number.isNaN(dueMs) && dueMs < nowMs
        if (overdue) {
          actions.push({
            type: 'NCR Hold',
            desc: `${q.id} open — overdue (due ${q.dueDate})`,
            who: q.assignee || 'Engineer',
            due: `Overdue`,
            severity: 'critical',
            module: 'qs',
          })
        } else if (!q.dueDate) {
          // Open NCR with no due date — still urgent (no SLA).
          actions.push({
            type: 'NCR Hold',
            desc: `${q.id} open — no due date set`,
            who: q.assignee || 'Engineer',
            due: 'Open',
            severity: 'critical',
            module: 'qs',
          })
        }
      }
    }

    // Tasks at 0% progress past their scheduled start week. The scheduler
    // computes `todayWeek` from the active project's start date (see
    // scheduler/index.tsx) — we mirror that same formula here so "past start
    // week" matches what the Gantt canvas shows as TODAY. A task with
    // progress === 0 whose `start` is before this week is genuinely stalled
    // (it should have begun).
    const flatTasks = flattenTasks(taskRows)
    // Use the shared project constants so the dashboard's "today" agrees
    // with the Gantt canvas's red TODAY line (previously both files
    // independently defined `new Date('2026-04-01')` — a drift risk).
    const SCHEDULER_TODAY_WEEK = getTodayWeek(undefined, projectEpoch)
    for (const { task } of flatTasks) {
      if (task.type === 'Work' && task.progress === 0 && task.start < SCHEDULER_TODAY_WEEK) {
        actions.push({
          type: 'Task Stalled',
          desc: `${task.id} · ${task.name} — 0% progress past start (wk ${task.start + 1})`,
          who: 'PM',
          due: `Start wk ${task.start + 1}`,
          severity: 'high',
          module: 'scheduler',
        })
      }
    }

    // GRNs on Hold — payment blocked.
    for (const g of grnRows) {
      if (g.payStatus === 'Hold' || g.payStatus === 'Partial Hold') {
        actions.push({
          type: 'GRN Hold',
          desc: `${g.id} payment on hold · ${g.vendor}`,
          who: g.vendor,
          due: 'Review',
          severity: 'medium',
          module: 'procurement',
        })
      }
    }

    return actions
  }, [poRows, qsRows, grnRows, taskRows, projectEpoch])

  return (
    <div className="workspace-bg h-full overflow-y-auto">
      <div className="mx-auto max-w-[1600px] space-y-5 p-6">
        {/* Header strip */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Project Command Center</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {activeProject ?? 'No project selected'} · FIDIC Red Book · DoR Norms 2075
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-card flex h-8 items-center gap-2 rounded-md border border-[var(--pane-divider)] px-3 text-sm">
              <Clock className="text-muted-foreground h-4 w-4" />
              <span className="font-mono font-medium tabular-nums">
                {now
                  ? now.toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : '--:--:--'}
              </span>
              <span className="text-muted-foreground">·</span>
              <span>
                {now
                  ? now.toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'}
              </span>
            </div>
            {/* Live aggregation chips — sourced from useSyncedState hooks */}
            <div className="bg-card text-muted-foreground hidden items-center gap-3 rounded-md border border-[var(--pane-divider)] px-3 text-xs sm:flex">
              <span
                className="flex items-center gap-1.5"
                title="Contract total (sum of qty × rate for non-heading BOQ items)"
              >
                <DollarSign className="h-3.5 w-3.5" />
                NPR {(liveKpis.contractTotal / 1_000_000).toFixed(2)}M
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span
                className="flex items-center gap-1.5"
                title={`${liveKpis.totalTasks} total · ${liveKpis.completedTasks} done · ${liveKpis.criticalTasks} critical`}
              >
                <Activity className="h-3.5 w-3.5" />
                {liveKpis.totalTasks} tasks · {liveKpis.criticalTasks} crit
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span
                className="flex items-center gap-1.5"
                title="Overall progress (average % across all tasks)"
              >
                <Gauge className="h-3.5 w-3.5" />
                {liveKpis.overallProgress}%
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigateToModule('daily-ops')}>
              <Cloud className="mr-1.5 h-4 w-4" />
              24°C · Partly Cloudy
            </Button>
            <Button size="sm" onClick={() => navigateToModule('reports')}>
              <Plus className="mr-1.5 h-4 w-4" />
              New Report
            </Button>
          </div>
        </div>

        {/* KPI strip — values derived from the live BOQ / tasks / CBS data
            above. See kpi-strip.tsx for the proxy formulas (SPI/CPI/EAC/Margin
            are not directly computable without EVM baseline data). */}
        <KpiStrip
          onNavigate={navigateToModule}
          live={{
            contractTotal: liveKpis.contractTotal,
            totalTasks: liveKpis.totalTasks,
            completedTasks: liveKpis.completedTasks,
            totalBudget: liveKpis.totalBudget,
            totalActual: liveKpis.totalActual,
          }}
        />

        {/* Location Activity Map — horizontal strip of all active work
            locations with per-station counts of tasks, open NCRs, and DSR
            entries today. Placed between the KPI strip and the main masonry
            so the PM sees "where work is happening" before drilling into
            the chart cards. */}
        <LocationStripMap />

        {/* Main masonry */}
        <div className="grid grid-cols-12 gap-5">
          {/* Project Health - Mini Gantt */}
          <MiniGanttChart />

          {/* Urgent actions */}
          <UrgentActionsQueue onNavigate={navigateToModule} urgentActions={urgentActions} />

          {/* S-Curve */}
          <SCurveChart />

          {/* Backlog donut */}
          <BacklogChart />

          {/* Cash flow */}
          <CashFlowChart />

          {/* Daily brief */}
          <Card className="col-span-12 p-5 lg:col-span-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <FileText className="text-primary h-4 w-4" />
              Daily Brief · Today
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary/40 rounded-md p-3">
                  <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <Users className="h-3.5 w-3.5" />
                    Manpower on site
                  </div>
                  <div className="text-muted-foreground mt-1 text-[11px] leading-snug">
                    Open Daily Ops to log today&apos;s site status
                  </div>
                </div>
                <div className="bg-secondary/40 rounded-md p-3">
                  <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <Truck className="h-3.5 w-3.5" />
                    Equipment active
                  </div>
                  <div className="text-muted-foreground mt-1 text-[11px] leading-snug">
                    Open Equipment to view fleet status
                  </div>
                </div>
              </div>
              <Separator />
              <div className="text-muted-foreground text-[11px] leading-relaxed">
                No daily brief data — open Daily Ops to log today&apos;s site status.
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => navigateToModule('daily-ops')}
              >
                Open Daily Operations <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
