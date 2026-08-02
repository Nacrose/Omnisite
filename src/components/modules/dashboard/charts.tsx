'use client'

// ─── Dashboard chart components + their static data ──────────────────────────
// Extracted from the monolithic dashboard.tsx. Each chart is a self-contained
// Card-wrapped component so the dashboard shell can compose them in the
// masonry grid without re-importing recharts / data arrays.
//
// Data here is illustrative seed data (the S-curve / cash flow / backlog /
// mini-gantt are PM-curated mocks); the live KPI numbers (SPI / CPI / EAC)
// live in the dashboard shell, which pulls them from useSyncedState hooks.

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Activity, Clock, DollarSign, Gauge } from 'lucide-react'
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from 'recharts'

export const S_CURVE_DATA = [
  { week: 'W1', planned: 5, earned: 4 },
  { week: 'W2', planned: 10, earned: 9 },
  { week: 'W3', planned: 16, earned: 14 },
  { week: 'W4', planned: 22, earned: 20 },
  { week: 'W5', planned: 28, earned: 25 },
  { week: 'W6', planned: 34, earned: 29 },
  { week: 'W7', planned: 40, earned: 35 },
  { week: 'W8', planned: 45, earned: 41 },
  { week: 'W9', planned: 50, earned: 47 },
  { week: 'W10', planned: 55, earned: 52 },
  { week: 'W11', planned: 60, earned: 58 },
  { week: 'W12', planned: 65, earned: 62 },
]

export const CASH_FLOW = [
  { month: 'Shrāwan', in: 12.4, out: 9.8 },
  { month: 'Bhādra', in: 15.2, out: 11.3 },
  { month: 'Āświn', in: 18.7, out: 14.1 },
  { month: 'Kārtik', in: 16.3, out: 17.2 },
  { month: 'Mangsir', in: 21.5, out: 18.6 },
  { month: 'Poush', in: 19.8, out: 20.1 },
]

export const BACKLOG = [
  { name: '0-3 days', value: 42, color: 'var(--success)' },
  { name: '4-7 days', value: 18, color: 'var(--warning)' },
  { name: '>14 days', value: 6, color: 'var(--critical)' },
]

export const GANTT_MINI_TASKS = [
  { name: 'Site Mobilization', start: 0, end: 8, progress: 100, baseline: [0, 8] },
  { name: 'Earthwork & Excavation', start: 6, end: 22, progress: 88, baseline: [4, 20] },
  { name: 'Foundation PCC', start: 18, end: 30, progress: 62, baseline: [16, 28] },
  { name: 'Box Culvert Construction', start: 24, end: 44, progress: 35, baseline: [22, 42] },
  { name: 'Pavement Works', start: 38, end: 56, progress: 8, baseline: [36, 54] },
  { name: 'Finishing & Signage', start: 52, end: 64, progress: 0, baseline: [52, 64] },
]

// ─── Mini Gantt (Project Health card) ────────────────────────────────────────
export function MiniGanttChart() {
  const totalWeeks = 16
  const miniCritical = GANTT_MINI_TASKS.filter((t) =>
    t.name.toLowerCase().includes('culvert')
  ).length
  return (
    <Card className="col-span-12 p-5 lg:col-span-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Gauge className="text-primary h-4 w-4" />
            Project Health · Mini Schedule
          </h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Baseline vs Actual · Today line marked in red
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {GANTT_MINI_TASKS.length} active · {miniCritical} critical
        </Badge>
      </div>
      <MiniGantt />
    </Card>
  )
}

function MiniGantt() {
  const totalWeeks = 16
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground mb-1 flex items-center pl-44 text-[10px]">
        {Array.from({ length: totalWeeks }).map((_, i) => (
          <div
            key={i}
            className="flex-1 border-l border-[var(--pane-divider)] py-1 text-center first:border-l-0"
          >
            W{i + 1}
          </div>
        ))}
      </div>
      <div className="relative">
        {GANTT_MINI_TASKS.map((t, i) => {
          const leftPct = (t.start / totalWeeks) * 100
          const widthPct = ((t.end - t.start) / totalWeeks) * 100
          const baseLeftPct = (t.baseline[0] / totalWeeks) * 100
          const baseWidthPct = ((t.baseline[1] - t.baseline[0]) / totalWeeks) * 100
          const isCritical = t.name.includes('Culvert')
          return (
            <div key={i} className="group flex h-7 items-center">
              <div className="text-muted-foreground group-hover:text-foreground w-44 truncate pr-3 text-xs">
                {t.name}
              </div>
              <div className="relative h-5 flex-1">
                <div
                  className="border-muted-foreground/40 bg-muted-foreground/5 absolute top-1 h-3 rounded-sm border border-dashed"
                  style={{ left: `${baseLeftPct}%`, width: `${baseWidthPct}%` }}
                />
                <div
                  className="absolute top-0.5 flex h-4 items-center overflow-hidden rounded-sm px-1.5 text-[10px] font-medium text-white"
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    background: isCritical ? 'var(--critical)' : 'var(--primary)',
                  }}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-black/20"
                    style={{ width: `${t.progress}%` }}
                  />
                  <span className="relative z-10">{t.progress}%</span>
                </div>
              </div>
            </div>
          )
        })}
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-[var(--critical)]"
          style={{ left: `calc(11rem + ${8 / totalWeeks} * (100% - 11rem))` }}
        />
      </div>
    </div>
  )
}

// ─── S-Curve (Planned vs Earned) ─────────────────────────────────────────────
export function SCurveChart() {
  return (
    <Card className="col-span-12 p-5 lg:col-span-7">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="text-primary h-4 w-4" />
          S-Curve · Planned vs Earned
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="bg-muted-foreground/40 h-2.5 w-2.5 rounded-sm" />
            Planned (BCWS)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-primary h-2.5 w-2.5 rounded-sm" />
            Earned (BCWP)
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={S_CURVE_DATA} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="plannedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--muted-foreground)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="earnedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            unit="%"
          />
          <Tooltip
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--popover-foreground)',
            }}
          />
          <Area
            type="monotone"
            dataKey="planned"
            stroke="var(--muted-foreground)"
            strokeWidth={1.5}
            fill="url(#plannedGrad)"
          />
          <Area
            type="monotone"
            dataKey="earned"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#earnedGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  )
}

// ─── Backlog donut ───────────────────────────────────────────────────────────
export function BacklogChart() {
  const backlogTotal = BACKLOG.reduce((s, b) => s + b.value, 0)
  return (
    <Card className="col-span-12 p-5 lg:col-span-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Clock className="text-primary h-4 w-4" />
        Backlog Summary
      </h3>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie
              data={BACKLOG}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={65}
              paddingAngle={3}
            >
              {BACKLOG.map((b, i) => (
                <Cell key={i} fill={b.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-2">
          {BACKLOG.map((b) => (
            <div key={b.name} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: b.color }} />
              <span className="flex-1">{b.name}</span>
              <span className="font-semibold">{b.value}</span>
            </div>
          ))}
          <Separator className="my-2" />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground flex-1">Total open</span>
            <span className="font-bold">{backlogTotal}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── Cash flow bar chart ─────────────────────────────────────────────────────
export function CashFlowChart() {
  return (
    <Card className="col-span-12 p-5 lg:col-span-7">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <DollarSign className="text-primary h-4 w-4" />
          Cash Flow · NPR Crore
        </h3>
        <Badge variant="outline" className="text-xs">
          FY 2082/83 BS
        </Badge>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={CASH_FLOW} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            unit=" Cr"
          />
          <Tooltip
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--popover-foreground)',
            }}
          />
          <Bar dataKey="in" name="Cash In" fill="var(--success)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="out" name="Cash Out" fill="var(--critical)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}
