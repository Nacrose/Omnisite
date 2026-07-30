'use client'

import { useState, useEffect } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Plus, Search, Fingerprint, MapPin, Clock, DollarSign, Download, AlertTriangle, CheckCircle2, Smartphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSyncedState } from '@/lib/use-synced-state'

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
  const [workerList, setWorkerList] = useSyncedState<Worker[]>(
    'omnisite-workers',
    'workers',
    () => JSON.parse(JSON.stringify(WORKERS)),
    {
      fieldMap: { clockIn: 'clock_in', clockOut: 'clock_out', geoFence: 'geo_fence', todayHours: 'today_hours' },
      primaryKey: 'id',
    }
  ) as [Worker[], (v: Worker[] | ((prev: Worker[]) => Worker[])) => void, boolean]
  const selected = workerList.find(w => w.id === selectedId) ?? workerList[0]

  const totalOnSite = workerList.filter(w => w.status === 'on-site').length
  const totalHours = workerList.reduce((s, w) => s + (w.todayHours || 0), 0)
  const geoFenceBreaches = workerList.filter(w => w.geoFence === false && w.status === 'on-site').length

  return (
    <Workspace2Pane
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
              const count = t === 'All Trades' ? workerList.length : workerList.filter(w => w.trade === t).length
              return (
                <button key={t} className="w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-accent/50">
                  <span className="flex items-center gap-2"><Fingerprint className="w-3 h-3 text-muted-foreground" />{t}</span>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1">{count}</Badge>
                </button>
              )
            })}
          </PaneBody>
          {/* Mobile app preview — phone mockup */}
          <div className="border-t border-[var(--pane-divider)] p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Smartphone className="w-3 h-3" />Mobile App · Foreman view
            </div>
            <PhoneMockup />
          </div>
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
            {workerList.map(w => (
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

/**
 * Phone mockup — demonstrates the mobile-first Time & Attendance experience.
 * Foreman taps "Clock In" on mobile; GPS is captured; if outside site perimeter,
 * geo-fence alert fires.
 */
function PhoneMockup() {
  const [clockedIn, setClockedIn] = useState(false)
  const [time, setTime] = useState<Date | null>(null)
  useEffect(() => {
    const initial = setTimeout(() => setTime(new Date()), 0)
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => { clearTimeout(initial); clearInterval(t) }
  }, [])

  return (
    <div className="flex justify-center">
      <div className="w-[180px] rounded-[28px] border-[6px] border-slate-800 dark:border-slate-700 bg-slate-900 dark:bg-slate-950 shadow-xl overflow-hidden relative">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-slate-800 dark:bg-slate-700 rounded-b-2xl z-10" />

        {/* Screen */}
        <div className="bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-3 pt-5 h-[320px] flex flex-col">
          {/* Status bar */}
          <div className="flex items-center justify-between text-[8px] text-slate-600 dark:text-slate-300 font-medium mb-2">
            <span>{time ? time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
            <span className="flex items-center gap-0.5">
              <span className="w-2 h-1.5 bg-slate-600 dark:bg-slate-300 rounded-sm" />
              <span className="w-3 h-1.5 border border-slate-600 dark:border-slate-300 rounded-sm relative">
                <span className="absolute inset-0.5 bg-emerald-500 rounded-sm" />
              </span>
            </span>
          </div>

          {/* App header */}
          <div className="text-center mb-3">
            <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">OmniSite Mobile</div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5">Foreman · Ram Bahadur</div>
          </div>

          {/* Geo-fence status */}
          <div className={cn(
            'rounded-lg p-2 mb-2 text-center border',
            clockedIn
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
          )}>
            <MapPin className={cn('w-4 h-4 mx-auto mb-0.5', clockedIn ? 'text-emerald-600' : 'text-amber-600')} />
            <div className="text-[9px] font-medium text-slate-700 dark:text-slate-200">
              {clockedIn ? 'Within site perimeter' : 'GPS ready · 27.7°N 85.3°E'}
            </div>
            <div className="text-[8px] text-slate-500 mt-0.5">
              {clockedIn ? 'Distance: 35m from site center' : 'Site radius: 500m'}
            </div>
          </div>

          {/* Clock-in button */}
          <button
            onClick={() => setClockedIn(v => !v)}
            className={cn(
              'mx-auto w-32 h-32 rounded-full flex flex-col items-center justify-center text-white font-bold shadow-lg transition-all active:scale-95',
              clockedIn
                ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/30'
                : 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/30'
            )}
          >
            <div className="text-[9px] uppercase tracking-wider opacity-80">
              {clockedIn ? 'Tap to Clock Out' : 'Tap to Clock In'}
            </div>
            <div className="text-lg font-mono tabular-nums mt-0.5">
              {time ? time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
            </div>
            <div className="text-[8px] opacity-80 mt-0.5">
              {clockedIn ? 'On site · 4h 18m' : 'Shift starts 08:00'}
            </div>
            {/* Pulsing ring */}
            <span className={cn(
              'absolute inset-0 rounded-full animate-ping',
              clockedIn ? 'bg-red-500/20' : 'bg-emerald-500/20'
            )} />
          </button>

          {/* Status footer */}
          <div className="mt-auto text-center text-[8px] text-slate-500 dark:text-slate-400">
            {clockedIn ? (
              <div className="flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Clocked in at {time ? time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </div>
            ) : (
              <div>Tap the button to start your shift</div>
            )}
          </div>
        </div>

        {/* Home indicator */}
        <div className="bg-slate-900 dark:bg-slate-950 pt-1 pb-1.5 flex justify-center">
          <div className="w-20 h-1 bg-slate-600 rounded-full" />
        </div>
      </div>
    </div>
  )
}
