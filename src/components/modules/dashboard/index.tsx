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
  Cloud,
  Users,
  Truck,
  ArrowRight,
  Clock,
  FileText,
  ShieldAlert,
  DollarSign,
  Gauge,
  Activity,
  Plus,
} from 'lucide-react'
import { KpiStrip } from './kpi-strip'
import { UrgentActionsQueue } from './urgent-actions'
import { MiniGanttChart, SCurveChart, CashFlowChart, BacklogChart } from './charts'
import { LocationStripMap } from './location-strip-map'

export function DashboardModule() {
  const router = useRouter()
  const navigateToModule = (id: string) => router.push(`/${id}`)

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
      fieldMap: { desc: 'description', hasRA: 'has_ra', parentId: 'parent_id' },
      primaryKey: 'id',
    }
  )
  const [taskRows] = useSyncedState<Task[]>(
    'omnisite-scheduler-tasks',
    'tasks',
    () => structuredClone(TASKS) as typeof TASKS,
    { primaryKey: 'id' }
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

  // Live KPI aggregation. Memoized on the underlying arrays so unrelated
  // re-renders (e.g. the per-second clock tick) don't re-walk every row.
  const liveKpis = useMemo(() => {
    const flatBoq = flattenBoq(boqRows)
    const contractTotal = flatBoq
      .filter((i) => i.type !== 'Heading')
      .reduce((sum, i) => sum + i.qty * i.rate, 0)

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

  return (
    <div className="workspace-bg h-full overflow-y-auto">
      <div className="mx-auto max-w-[1600px] space-y-5 p-6">
        {/* Header strip */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Project Command Center</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Kathmandu Ring Road Expansion · Package 3 · FIDIC Red Book · DoR Norms 2075
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

        {/* KPI strip */}
        <KpiStrip onNavigate={navigateToModule} />

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
          <UrgentActionsQueue onNavigate={navigateToModule} />

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
                  <div className="mt-1 text-xl font-bold">83</div>
                  <div className="text-muted-foreground text-[10px]">5 trades · see Daily Ops</div>
                </div>
                <div className="bg-secondary/40 rounded-md p-3">
                  <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <Truck className="h-3.5 w-3.5" />
                    Equipment active
                  </div>
                  <div className="mt-1 text-xl font-bold">3</div>
                  <div className="text-muted-foreground text-[10px]">
                    1 idle · 1 breakdown · see Equipment
                  </div>
                </div>
              </div>
              <Separator />
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                  <span className="flex-1">Toolbox talk held — Excavation safety at ch. 4+200</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Cloud className="h-3.5 w-3.5 text-sky-500" />
                  <span className="flex-1">
                    Light rain forecast 14:00-16:00 · cover fresh concrete
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <FileText className="h-3.5 w-3.5 text-violet-500" />
                  <span className="flex-1">RA Bill #4 awaiting client approval · NPR 18.4 Cr</span>
                </div>
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
