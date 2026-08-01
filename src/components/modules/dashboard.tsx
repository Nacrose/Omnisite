'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useApp, ModuleId } from '@/lib/app-store'
import { Separator } from '@/components/ui/separator'
import {
  TrendingUp, TrendingDown, Calendar, Cloud, Users, Truck, AlertTriangle,
  ArrowRight, Clock, FileText, ShieldAlert, DollarSign, Gauge, Activity, Plus,
} from 'lucide-react'
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell, PieChart, Pie, Legend,
} from 'recharts'

const S_CURVE_DATA = [
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

const CASH_FLOW = [
  { month: 'Shrāwan', in: 12.4, out: 9.8 },
  { month: 'Bhādra', in: 15.2, out: 11.3 },
  { month: 'Āświn', in: 18.7, out: 14.1 },
  { month: 'Kārtik', in: 16.3, out: 17.2 },
  { month: 'Mangsir', in: 21.5, out: 18.6 },
  { month: 'Poush', in: 19.8, out: 20.1 },
]

const BACKLOG = [
  { name: '0-3 days', value: 42, color: 'var(--success)' },
  { name: '4-7 days', value: 18, color: 'var(--warning)' },
  { name: '>14 days', value: 6, color: 'var(--critical)' },
]

const KPIs: { label: string; value: string; delta: string; trend: 'up' | 'down'; desc: string; module: ModuleId }[] = [
  { label: 'SPI', value: '0.97', delta: '-0.03', trend: 'down', desc: 'Schedule Performance', module: 'scheduler' },
  { label: 'CPI', value: '1.04', delta: '+0.02', trend: 'up', desc: 'Cost Performance', module: 'financials' },
  { label: 'EAC', value: 'NPR 487.2M', delta: '-12.4M', trend: 'up', desc: 'Estimate at Completion', module: 'financials' },
  { label: 'Margin', value: '14.8%', delta: '+0.6%', trend: 'up', desc: 'Project gross margin', module: 'financials' },
]

const URGENT_ACTIONS: { type: string; desc: string; who: string; due: string; severity: 'high' | 'critical' | 'medium'; module: ModuleId }[] = [
  { type: 'PO Approval', desc: 'PO-2410-018 — Cement (Ordinary) 1,200 bags', who: 'Arjun S.', due: 'Today', severity: 'high', module: 'procurement' },
  { type: 'DSR Review', desc: 'DSR #087 — Chainage 4+200 to 4+350 PCC', who: 'Bikash R.', due: 'Today', severity: 'high', module: 'daily-ops' },
  { type: 'NCR Hold', desc: 'NCR-034 — Box culvert rebar cover < 40mm', who: 'Engineer', due: 'Open', severity: 'critical', module: 'qs' },
  { type: 'Variation', desc: 'SI-022 — Extra excavation at chainage 2+850', who: 'PM', due: '2 days', severity: 'medium', module: 'correspondence' },
  { type: 'RFI Reply', desc: 'RFI-067 — Rebar detailing at expansion joint', who: 'Consultant', due: 'Overdue 3d', severity: 'critical', module: 'daily-ops' },
]

const GANTT_MINI_TASKS = [
  { name: 'Site Mobilization', start: 0, end: 8, progress: 100, baseline: [0, 8] },
  { name: 'Earthwork & Excavation', start: 6, end: 22, progress: 88, baseline: [4, 20] },
  { name: 'Foundation PCC', start: 18, end: 30, progress: 62, baseline: [16, 28] },
  { name: 'Box Culvert Construction', start: 24, end: 44, progress: 35, baseline: [22, 42] },
  { name: 'Pavement Works', start: 38, end: 56, progress: 8, baseline: [36, 54] },
  { name: 'Finishing & Signage', start: 52, end: 64, progress: 0, baseline: [52, 64] },
]

export function DashboardModule() {
  const { setActiveModule } = useApp()
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    // Use setTimeout to defer the initial time set — avoids synchronous setState in effect
    const initial = setTimeout(() => setNow(new Date()), 0)
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => { clearTimeout(initial); clearInterval(t) }
  }, [])

  return (
    <div className="h-full overflow-y-auto workspace-bg">
      <div className="max-w-[1600px] mx-auto p-6 space-y-5">
        {/* Header strip */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Project Command Center</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Kathmandu Ring Road Expansion · Package 3 · FIDIC Red Book · DoR Norms 2075
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 h-8 px-3 rounded-md border border-[var(--pane-divider)] bg-card text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono font-medium tabular-nums">
                {now ? now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
              </span>
              <span className="text-muted-foreground">·</span>
              <span>{now ? now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
            </div>
            <Button variant="outline" size="sm"><Cloud className="w-4 h-4 mr-1.5" />24°C · Partly Cloudy</Button>
            <Button size="sm"><Plus className="w-4 h-4 mr-1.5" />New Report</Button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {KPIs.map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 60, duration: 0.4, ease: 'easeOut' }}
              onClick={() => setActiveModule(k.module)}
            >
              <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer group hover:border-primary/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{k.label}</span>
                  <span className={`text-xs font-medium flex items-center gap-0.5 ${k.trend === 'up' ? 'delta-up' : 'delta-down'}`}>
                    {k.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {k.delta}
                  </span>
                </div>
                <div className="text-2xl font-bold mt-1 tracking-tight group-hover:scale-[1.02] origin-left transition-transform">{k.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-between">
                  <span>{k.desc}</span>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Main masonry */}
        <div className="grid grid-cols-12 gap-5">
          {/* Project Health - Mini Gantt */}
          <Card className="col-span-12 lg:col-span-8 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2"><Gauge className="w-4 h-4 text-primary" />Project Health · Mini Schedule</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Baseline vs Actual · Today line marked in red</p>
              </div>
              <Badge variant="outline" className="text-xs">6 active · 1 critical</Badge>
            </div>
            <MiniGantt />
          </Card>

          {/* Urgent actions */}
          <Card className="col-span-12 lg:col-span-4 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />Urgent Actions Queue</h3>
              <Badge variant="secondary" className="text-xs">{URGENT_ACTIONS.length}</Badge>
            </div>
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {URGENT_ACTIONS.map((a, i) => (
                <div key={i} onClick={() => setActiveModule(a.module)} className="p-2.5 rounded-md border border-[var(--pane-divider)] hover:bg-accent/50 hover:border-primary/30 transition-colors cursor-pointer group">
                  <div className="flex items-start gap-2">
                    <div className={`w-1 self-stretch rounded-full ${
                      a.severity === 'critical' ? 'bg-[var(--critical)]' : a.severity === 'high' ? 'bg-[var(--warning)]' : 'bg-[var(--info)]'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium">{a.type}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{a.who}</span>
                        <span className="ml-auto text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />{a.due}
                        </span>
                      </div>
                      <div className="text-xs mt-0.5 line-clamp-2">{a.desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* S-Curve */}
          <Card className="col-span-12 lg:col-span-7 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Activity className="w-4 h-4 text-primary" />S-Curve · Planned vs Earned</h3>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/40" />Planned (BCWS)</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary" />Earned (BCWP)</span>
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
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{
                    background: 'var(--popover)', border: '1px solid var(--border)',
                    borderRadius: 8, fontSize: 12, color: 'var(--popover-foreground)'
                  }}
                />
                <Area type="monotone" dataKey="planned" stroke="var(--muted-foreground)" strokeWidth={1.5} fill="url(#plannedGrad)" />
                <Area type="monotone" dataKey="earned" stroke="var(--primary)" strokeWidth={2} fill="url(#earnedGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Backlog donut */}
          <Card className="col-span-12 lg:col-span-5 p-5">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><Clock className="w-4 h-4 text-primary" />Backlog Summary</h3>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={BACKLOG} dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={3}>
                    {BACKLOG.map((b, i) => <Cell key={i} fill={b.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {BACKLOG.map(b => (
                  <div key={b.name} className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: b.color }} />
                    <span className="flex-1">{b.name}</span>
                    <span className="font-semibold">{b.value}</span>
                  </div>
                ))}
                <Separator className="my-2" />
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex-1 text-muted-foreground">Total open</span>
                  <span className="font-bold">66</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Cash flow */}
          <Card className="col-span-12 lg:col-span-7 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" />Cash Flow · NPR Crore</h3>
              <Badge variant="outline" className="text-xs">FY 2082/83 BS</Badge>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={CASH_FLOW} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} unit=" Cr" />
                <Tooltip
                  contentStyle={{
                    background: 'var(--popover)', border: '1px solid var(--border)',
                    borderRadius: 8, fontSize: 12, color: 'var(--popover-foreground)'
                  }}
                />
                <Bar dataKey="in" name="Cash In" fill="var(--success)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="out" name="Cash Out" fill="var(--critical)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Daily brief */}
          <Card className="col-span-12 lg:col-span-5 p-5">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><FileText className="w-4 h-4 text-primary" />Daily Brief · Today</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-md bg-secondary/40">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="w-3.5 h-3.5" />Manpower on site</div>
                  <div className="text-xl font-bold mt-1">186</div>
                  <div className="text-[10px] text-muted-foreground">+12 vs yesterday</div>
                </div>
                <div className="p-3 rounded-md bg-secondary/40">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Truck className="w-3.5 h-3.5" />Active equipment</div>
                  <div className="text-xl font-bold mt-1">14</div>
                  <div className="text-[10px] text-muted-foreground">2 idle · 1 breakdown</div>
                </div>
              </div>
              <Separator />
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                  <span className="flex-1">Toolbox talk held — Excavation safety at ch. 4+200</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Cloud className="w-3.5 h-3.5 text-sky-500" />
                  <span className="flex-1">Light rain forecast 14:00-16:00 · cover fresh concrete</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <FileText className="w-3.5 h-3.5 text-violet-500" />
                  <span className="flex-1">RA Bill #4 awaiting client approval · NPR 18.4 Cr</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setActiveModule('daily-ops')}>
                Open Daily Operations <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function MiniGantt() {
  const totalWeeks = 16
  return (
    <div className="space-y-1">
      <div className="flex items-center text-[10px] text-muted-foreground mb-1 pl-44">
        {Array.from({ length: totalWeeks }).map((_, i) => (
          <div key={i} className="flex-1 text-center border-l border-[var(--pane-divider)] first:border-l-0 py-1">
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
            <div key={i} className="flex items-center h-7 group">
              <div className="w-44 pr-3 text-xs truncate text-muted-foreground group-hover:text-foreground">{t.name}</div>
              <div className="flex-1 relative h-5">
                <div
                  className="absolute h-3 top-1 rounded-sm border border-dashed border-muted-foreground/40 bg-muted-foreground/5"
                  style={{ left: `${baseLeftPct}%`, width: `${baseWidthPct}%` }}
                />
                <div
                  className="absolute h-4 top-0.5 rounded-sm flex items-center px-1.5 text-[10px] text-white font-medium overflow-hidden"
                  style={{
                    left: `${leftPct}%`, width: `${widthPct}%`,
                    background: isCritical ? 'var(--critical)' : 'var(--primary)',
                  }}
                >
                  <div className="absolute inset-y-0 left-0 bg-black/20" style={{ width: `${t.progress}%` }} />
                  <span className="relative z-10">{t.progress}%</span>
                </div>
              </div>
            </div>
          )
        })}
        <div
          className="absolute top-0 bottom-0 w-px bg-[var(--critical)] pointer-events-none"
          style={{ left: `calc(11rem + ${(8 / totalWeeks)} * (100% - 11rem))` }}
        />
      </div>
    </div>
  )
}
