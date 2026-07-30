'use client'

import { useState } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Plus, Search, Fingerprint, MapPin, Clock, DollarSign, Download, AlertTriangle, CheckCircle2, Smartphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Worker {
  id: string; name: string; trade: string; phone: string; status: 'on-site' | 'off-site' | 'break';
  clockIn?: string; clockOut?: string; geoFence?: boolean; todayHours?: number; allocated: { task: string; hours: number }[]
}

const WORKERS: Worker[] = [
  {
    id: 'W-001', name: 'Ram Bahadur Thapa', trade: 'Mason (Skilled)', phone: '+977-98XXXXXXXX', status: 'on-site',
    clockIn: '07:42', clockOut: undefined, geoFence: true, todayHours: 8,
    allocated: [{ task: 'T-203 PCC M15', hours: 4 }, { task: 'T-301 Base slab', hours: 4 }],
  },
  {
    id: 'W-002', name: 'Sita Gurung', trade: 'Mazdoor (Unskilled)', phone: '+977-98XXXXXXXX', status: 'on-site',
    clockIn: '07:55', clockOut: undefined, geoFence: true, todayHours: 8,
    allocated: [{ task: 'T-203 PCC M15', hours: 8 }],
  },
  {
    id: 'W-003', name: 'Hari Karki', trade: 'Bar bender', phone: '+977-98XXXXXXXX', status: 'on-site',
    clockIn: '08:10', clockOut: undefined, geoFence: true, todayHours: 7.5,
    allocated: [{ task: 'T-303 Wall & slab rebar', hours: 6 }, { task: 'T-301 Base slab', hours: 1.5 }],
  },
  {
    id: 'W-004', name: 'Bikas Tamang', trade: 'Mazdoor (Unskilled)', phone: '+977-98XXXXXXXX', status: 'off-site',
    clockIn: '07:48', clockOut: '11:30', geoFence: false, todayHours: 3.5,
    allocated: [{ task: 'T-201 Excavation', hours: 3.5 }],
  },
  {
    id: 'W-005', name: 'Gopal Shrestha', trade: 'Operator', phone: '+977-98XXXXXXXX', status: 'on-site',
    clockIn: '07:30', clockOut: undefined, geoFence: true, todayHours: 9,
    allocated: [{ task: 'T-201 Excavation', hours: 8 }, { task: 'T-202 Stone soling', hours: 1 }],
  },
  {
    id: 'W-006', name: 'Anita Lama', trade: 'Helper', phone: '+977-98XXXXXXXX', status: 'break',
    clockIn: '08:00', clockOut: undefined, geoFence: true, todayHours: 4,
    allocated: [{ task: 'T-204 Curing', hours: 4 }],
  },
]

export function TimeAttendanceModule() {
  const [selectedId, setSelectedId] = useState('W-001')
  const selected = WORKERS.find(w => w.id === selectedId) ?? WORKERS[0]

  const totalOnSite = WORKERS.filter(w => w.status === 'on-site').length
  const totalHours = WORKERS.reduce((s, w) => s + (w.todayHours || 0), 0)
  const geoFenceBreaches = WORKERS.filter(w => w.geoFence === false && w.status === 'on-site').length

  return (
    <Workspace3Pane
      leftPane={
        <>
          <PaneHeader title="Trades">
            <Button variant="ghost" size="sm" className="h-7"><Plus className="w-3.5 h-3.5" /></Button>
          </PaneHeader>
          <PaneBody className="py-2">
            <div className="px-3 mb-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search workers…" className="h-8 pl-7 text-xs" />
              </div>
            </div>
            {['All Trades', 'Mason (Skilled)', 'Mazdoor (Unskilled)', 'Bar bender', 'Operator', 'Helper', 'Carpenter'].map(t => {
              const count = t === 'All Trades' ? WORKERS.length : WORKERS.filter(w => w.trade === t).length
              return (
                <button key={t} className="w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-accent/50">
                  <span className="flex items-center gap-2"><Fingerprint className="w-3 h-3 text-muted-foreground" />{t}</span>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1">{count}</Badge>
                </button>
              )
            })}
          </PaneBody>
          <div className="border-t border-[var(--pane-divider)] p-3 space-y-1.5 text-xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Today&apos;s Snapshot</div>
            <div className="flex justify-between"><span className="text-muted-foreground">On site now</span><span className="font-mono font-semibold text-emerald-600">{totalOnSite}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total hours logged</span><span className="font-mono">{totalHours}h</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Geo-fence alerts</span><span className={cn('font-mono', geoFenceBreaches > 0 ? 'text-amber-600' : '')}>{geoFenceBreaches}</span></div>
            <Button variant="outline" size="sm" className="w-full h-7 mt-2 text-xs gap-1.5"><Download className="w-3.5 h-3.5" />Payroll Export</Button>
          </div>
        </>
      }
      centerPane={
        <>
          <PaneHeader title="Timecard Grid · Today">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5"><Smartphone className="w-3.5 h-3.5" />Mobile App</Button>
            <Button size="sm" className="h-7 text-xs gap-1.5"><Plus className="w-3.5 h-3.5" />Add Worker</Button>
          </PaneHeader>
          <div className="flex items-center h-8 border-b border-[var(--pane-divider)] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/30">
            <div className="w-16 px-2">ID</div>
            <div className="flex-1 px-2">Worker</div>
            <div className="w-32 px-2">Trade</div>
            <div className="w-16 px-2 text-center">Status</div>
            <div className="w-16 px-2 text-center">Clock In</div>
            <div className="w-16 px-2 text-center">Clock Out</div>
            <div className="w-16 px-2 text-right">Hours</div>
            <div className="w-20 px-2 text-center">Geo-fence</div>
            <div className="w-44 px-2">Task Allocation</div>
          </div>
          <PaneBody className="px-0">
            {WORKERS.map(w => (
              <div
                key={w.id}
                onClick={() => setSelectedId(w.id)}
                className={cn('flex items-center h-14 border-b border-[var(--pane-divider)] text-xs cursor-pointer row-hover', selectedId === w.id && 'bg-accent')}
              >
                <div className="w-16 px-2 font-mono text-muted-foreground">{w.id}</div>
                <div className="flex-1 px-2 min-w-0">
                  <div className="font-medium truncate">{w.name}</div>
                  <div className="text-[10px] text-muted-foreground">{w.phone}</div>
                </div>
                <div className="w-32 px-2 text-muted-foreground truncate">{w.trade}</div>
                <div className="w-16 px-2 text-center">
                  <Badge variant="secondary" className={cn('text-[9px]', w.status === 'on-site' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', w.status === 'off-site' && 'bg-slate-400/15', w.status === 'break' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300')}>{w.status}</Badge>
                </div>
                <div className="w-16 px-2 text-center font-mono">{w.clockIn || '—'}</div>
                <div className="w-16 px-2 text-center font-mono text-muted-foreground">{w.clockOut || '—'}</div>
                <div className="w-16 px-2 text-right font-mono font-medium">{w.todayHours}h</div>
                <div className="w-20 px-2 text-center">
                  {w.geoFence === false && w.status === 'on-site'
                    ? <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" />
                    : <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />}
                </div>
                <div className="w-44 px-2">
                  <div className="flex flex-wrap gap-0.5">
                    {w.allocated.map((a, i) => (
                      <Badge key={i} variant="outline" className="text-[9px] h-4 px-1">{a.hours}h · {a.task.split(' ')[0]}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </PaneBody>
        </>
      }
      rightPane={<WorkerInspector worker={selected} />}
      leftPaneWidth="240px"
      rightPaneWidth="380px"
    />
  )
}

function WorkerInspector({ worker }: { worker: Worker }) {
  const ratePerHour = worker.trade.includes('Mason') ? 1450 / 8 : worker.trade.includes('Operator') ? 1200 / 8 : 950 / 8
  const todayCost = (worker.todayHours || 0) * ratePerHour

  return (
    <>
      <PaneHeader title={`Worker Inspector · ${worker.id}`} />
      <PaneBody>
        <div className="p-4 border-b border-[var(--pane-divider)]">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className={cn('text-[10px]', worker.status === 'on-site' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', worker.status === 'off-site' && 'bg-slate-400/15', worker.status === 'break' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300')}>{worker.status}</Badge>
            <Badge variant="outline" className="text-[10px]">{worker.trade}</Badge>
          </div>
          <div className="text-sm font-semibold">{worker.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{worker.phone}</div>
        </div>

        <div className="p-4 space-y-3 text-xs">
          {/* Geo-fence card */}
          <div className={cn('p-2.5 rounded-md border', worker.geoFence === false && worker.status === 'on-site' ? 'border-amber-500/40 bg-amber-500/10' : 'border-[var(--pane-divider)] bg-secondary/30')}>
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin className={cn('w-3.5 h-3.5', worker.geoFence === false && worker.status === 'on-site' ? 'text-amber-500' : 'text-emerald-500')} />
              <span className="font-medium">Geo-fenced Attendance</span>
            </div>
            {worker.geoFence === false && worker.status === 'on-site' ? (
              <div className="text-[10px] text-amber-700 dark:text-amber-300">
                ⚠ Clock-in GPS outside site perimeter (450m). Foreman verification required.
              </div>
            ) : (
              <div className="text-[10px] text-muted-foreground">
                GPS captured at clock-in · within site perimeter
              </div>
            )}
            <div className="text-[10px] mt-1 font-mono">
              {worker.clockIn && <div>Clock-in: {worker.clockIn} · 27.7°N 85.3°E</div>}
              {worker.clockOut && <div>Clock-out: {worker.clockOut}</div>}
            </div>
          </div>

          <Separator />

          {/* Task allocation — the magic */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Clock className="w-3 h-3" />Task Allocation (8h split)</div>
            <div className="space-y-1.5">
              {worker.allocated.map((a, i) => (
                <div key={i} className="p-2 rounded border border-[var(--pane-divider)]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{a.task}</span>
                    <span className="font-mono">{a.hours}h</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${(a.hours / 8) * 100}%` }} />
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                <span>Total allocated</span>
                <span className="font-mono">{worker.allocated.reduce((s, a) => s + a.hours, 0)}h / 8h</span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full h-7 mt-2 text-xs gap-1"><Plus className="w-3 h-3" />Split hours to another task</Button>
          </div>

          <Separator />

          {/* Cost auto-calc */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><DollarSign className="w-3 h-3" />Labour Cost Auto-Calc</div>
            <div className="p-2.5 rounded-md border border-[var(--pane-divider)] space-y-1.5">
              <div className="flex justify-between"><span className="text-muted-foreground">Trade RA Rate</span><span className="font-mono">NPR {ratePerHour.toFixed(0)}/hr</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Today&apos;s hours</span><span className="font-mono">{worker.todayHours}h</span></div>
              <Separator />
              <div className="flex justify-between font-bold"><span>Today&apos;s labour cost</span><span className="font-mono">NPR {todayCost.toFixed(0)}</span></div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Auto-pushed to Financials (ACWP) against CBS nodes from allocated tasks.
              </div>
            </div>
          </div>

          <Separator />

          {/* Payroll summary */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Payroll Summary (this month)</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-md bg-secondary/40">
                <div className="text-[10px] text-muted-foreground">Days</div>
                <div className="text-sm font-bold">22</div>
              </div>
              <div className="p-2 rounded-md bg-secondary/40">
                <div className="text-[10px] text-muted-foreground">Hours</div>
                <div className="text-sm font-bold">176</div>
              </div>
              <div className="p-2 rounded-md bg-secondary/40">
                <div className="text-[10px] text-muted-foreground">Earned</div>
                <div className="text-sm font-bold">NPR 26.4K</div>
              </div>
            </div>
          </div>
        </div>
      </PaneBody>
    </>
  )
}
