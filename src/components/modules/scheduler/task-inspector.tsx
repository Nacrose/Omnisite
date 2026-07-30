'use client'

import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Link2, AlertTriangle, Calendar, Zap, Gauge,
  TrendingUp, TrendingDown, Package, Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Task } from './types'

export function TaskInspector({ task }: { task: Task }) {
  return (
    <>
      <PaneHeader title={`Task Inspector · ${task.id}`} />
      <PaneBody>
        <div className="p-4 border-b border-[var(--pane-divider)]">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-[10px]">{task.type}</Badge>
            {task.critical && <Badge variant="destructive" className="text-[10px]">Critical</Badge>}
            {task.constraints && <Badge variant="secondary" className="text-[10px]">{task.constraints}</Badge>}
          </div>
          <div className="text-sm font-semibold leading-snug">{task.name}</div>
        </div>

        <Tabs defaultValue="schedule">
          <div className="px-3 pt-2">
            <TabsList className="grid grid-cols-4 h-8 text-xs w-full">
              <TabsTrigger value="schedule" className="text-[11px]">Schedule</TabsTrigger>
              <TabsTrigger value="assign" className="text-[11px]">Assign</TabsTrigger>
              <TabsTrigger value="boq" className="text-[11px]">BOQ/RA</TabsTrigger>
              <TabsTrigger value="evm" className="text-[11px]">EVM</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="schedule" className="mt-0 px-4 py-3 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">Start</label>
                <div className="flex items-center gap-1.5 mt-1 p-2 rounded-md border border-[var(--pane-divider)]">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-mono">Wk {task.start + 1}</span>
                </div>
              </div>
              <div>
                <label className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">Finish</label>
                <div className="flex items-center gap-1.5 mt-1 p-2 rounded-md border border-[var(--pane-divider)]">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-mono">Wk {task.start + task.duration + 1}</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">Duration (days)</label>
              <Input className="mt-1 h-8 text-xs" defaultValue={task.duration} />
            </div>
            <div>
              <label className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">Constraint</label>
              <div className="mt-1 grid grid-cols-2 gap-1">
                {['ASAP', 'ALAP', 'SNET', 'FNLT', 'MFO', 'MSO'].map(c => (
                  <button key={c} className={cn(
                    'h-7 rounded text-[11px] border transition-colors',
                    task.constraints?.includes(c)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-[var(--pane-divider)] hover:bg-accent'
                  )}>{c}</button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 pt-1">
              <Switch defaultChecked />
              <span>Effort-driven scheduling</span>
            </label>
            <Separator />
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Dependencies</div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 p-1.5 rounded border border-[var(--pane-divider)]">
                <Link2 className="w-3 h-3 text-muted-foreground" />
                <span className="font-mono text-[10px]">T-201</span>
                <Badge variant="secondary" className="text-[9px]">FS</Badge>
                <span className="flex-1 text-[10px] text-muted-foreground">Excavation ch. 0+000</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded border border-[var(--pane-divider)]">
                <Link2 className="w-3 h-3 text-muted-foreground" />
                <span className="font-mono text-[10px]">T-204</span>
                <Badge variant="secondary" className="text-[9px]">SS+2</Badge>
                <span className="flex-1 text-[10px] text-muted-foreground">Curing period</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="assign" className="mt-0 px-4 py-3 space-y-3 text-xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Role → Name assignment</div>
            <AssignRow role="Site Engineer" name="Bikash Rai" hours={8} over={false} />
            <AssignRow role="Mason (Skilled)" name="Ram Bahadur" hours={6} over={false} />
            <AssignRow role="Mazdoor" name="3 workers" hours={8} over={false} />
            <AssignRow role="Mixer Operator" name="Hari K." hours={4} over={true} />
            <div className="mt-3 p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5" />
              <div>
                <div className="font-medium">Over-allocation detected</div>
                <div className="text-muted-foreground">Hari K. is assigned 12 hrs/day across T-203 + T-301. Auto-Level suggests delaying T-301 by 2 days.</div>
                <Button size="sm" variant="outline" className="h-6 mt-1.5 text-[10px] gap-1"><Zap className="w-3 h-3" />Auto-Level</Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="boq" className="mt-0 px-4 py-3 space-y-3 text-xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">BOQ Allocation</div>
            <div className="p-2.5 rounded-md border border-[var(--pane-divider)]">
              <div className="text-[10px] text-muted-foreground">Item 1.1.3 — PCC M15 (1:2:4) below footing</div>
              <div className="text-sm font-medium mt-0.5">145 cum allocated</div>
              <div className="mt-2 h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-primary" style={{ width: '60%' }} />
              </div>
              <div className="flex justify-between text-[10px] mt-1 text-muted-foreground">
                <span>Allocated: 145 cum</span>
                <span>Used: 87 / 145 cum</span>
              </div>
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Material Lead-Time Check</div>
            <div className="space-y-1.5">
              <LeadRow mat="Cement OPC 53" req="87 bags × 4.5 = 392 bags" status="ok" po="PO-018 · 1,200 bags on site" />
              <LeadRow mat="River Sand" req="39 cum" status="ok" po="PO-014 · delivered 12 Aug" />
              <LeadRow mat="Coarse Agg. 20mm" req="78 cum" status="warn" po="PO-022 · ETA 18 Aug" />
            </div>
            <div className="p-2 rounded-md bg-red-500/10 border border-red-500/30 text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5" />
              <div>
                <div className="font-medium">Resource Constrained</div>
                <div className="text-muted-foreground">Coarse Aggregate delivery (PO-022) slips past task start. Task delayed by 2 days.</div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="evm" className="mt-0 px-4 py-3 space-y-3 text-xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Earned Value Metrics</div>
            <div className="grid grid-cols-2 gap-2">
              <EvmCard label="BCWS" name="Planned Value" value="NPR 1.42M" icon={<TrendingUp className="w-3.5 h-3.5" />} />
              <EvmCard label="BCWP" name="Earned Value" value="NPR 0.88M" icon={<Activity className="w-3.5 h-3.5" />} />
              <EvmCard label="ACWP" name="Actual Cost" value="NPR 0.95M" icon={<TrendingDown className="w-3.5 h-3.5" />} />
              <EvmCard label="EAC" name="Estimate at Comp." value="NPR 1.58M" icon={<Gauge className="w-3.5 h-3.5" />} />
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-2">
              <Kpi label="SPI" value="0.62" trend="down" desc="Behind schedule" />
              <Kpi label="CPI" value="0.93" trend="down" desc="Over budget" />
            </div>
            <div className="p-2 rounded-md bg-secondary/40 text-[11px]">
              <div className="text-muted-foreground mb-1">Variance Analysis</div>
              <div className="flex justify-between"><span>Schedule Variance</span><span className="font-mono text-red-500">-540K</span></div>
              <div className="flex justify-between"><span>Cost Variance</span><span className="font-mono text-red-500">-70K</span></div>
              <div className="flex justify-between"><span>VAC (Forecast)</span><span className="font-mono text-red-500">-160K</span></div>
            </div>
            <div className="p-2.5 rounded-md border border-[var(--pane-divider)]">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">DSR Linkage (locked % done)</div>
              <div className="flex justify-between"><span>Planned qty</span><span className="font-mono">145 cum</span></div>
              <div className="flex justify-between"><span>Actual (DSR)</span><span className="font-mono">87 cum</span></div>
              <div className="flex justify-between font-medium"><span>Computed % done</span><span className="font-mono">60% (locked)</span></div>
            </div>
          </TabsContent>
        </Tabs>
      </PaneBody>
    </>
  )
}

function AssignRow({ role, name, hours, over }: { role: string; name: string; hours: number; over: boolean }) {
  return (
    <div className="flex items-center gap-2 p-1.5 rounded border border-[var(--pane-divider)]">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex-shrink-0 flex items-center justify-center text-white text-[10px] font-semibold">
        {name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-muted-foreground">{role}</div>
        <div className="font-medium truncate">{name}</div>
      </div>
      <div className={cn('text-[10px] font-mono', over && 'text-red-500')}>{hours}h/d</div>
    </div>
  )
}

function LeadRow({ mat, req, status, po }: { mat: string; req: string; status: 'ok' | 'warn' | 'block'; po: string }) {
  return (
    <div className="flex items-center gap-2 p-1.5 rounded border border-[var(--pane-divider)]">
      <Package className={cn('w-3.5 h-3.5', status === 'ok' && 'text-emerald-500', status === 'warn' && 'text-amber-500', status === 'block' && 'text-red-500')} />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{mat}</div>
        <div className="text-[10px] text-muted-foreground">{req} · {po}</div>
      </div>
    </div>
  )
}

function EvmCard({ label, name, value, icon }: { label: string; name: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="p-2.5 rounded-md border border-[var(--pane-divider)]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="text-sm font-bold mt-0.5">{value}</div>
      <div className="text-[10px] text-muted-foreground">{name}</div>
    </div>
  )
}

function Kpi({ label, value, trend, desc }: { label: string; value: string; trend: 'up' | 'down'; desc: string }) {
  return (
    <div className="p-2 rounded-md bg-secondary/40">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        {trend === 'up'
          ? <TrendingUp className="w-3 h-3 delta-up" />
          : <TrendingDown className="w-3 h-3 delta-down" />}
      </div>
      <div className="text-base font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{desc}</div>
    </div>
  )
}
