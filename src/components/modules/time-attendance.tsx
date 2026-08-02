'use client'

import { useState, useEffect } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Plus,
  Search,
  Fingerprint,
  MapPin,
  Clock,
  DollarSign,
  Download,
  AlertTriangle,
  CheckCircle2,
  Smartphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSyncedState } from '@/lib/use-synced-state'
import { LoadingState } from '@/components/ui/loading-state'
import { exportToCsv } from '@/lib/csv-export'
import { toast } from 'sonner'

interface Worker {
  id: string
  name: string
  trade: string
  phone: string
  status: 'on-site' | 'off-site' | 'break'
  clockIn?: string
  clockOut?: string
  geoFence?: boolean
  todayHours?: number
  allocated: { task: string; hours: number }[]
  /** Hourly wage rate in NPR. Used to compute labor cost for Financials. */
  wageRate?: number
  /** Overtime multiplier (e.g. 1.5 = time-and-a-half for hours > 8). */
  otMultiplier?: number
  /** Standard hours per day before OT kicks in. Defaults to 8. */
  standardHours?: number
}

const WORKERS: Worker[] = [
  {
    id: 'W-001',
    name: 'Ram Bahadur Thapa',
    trade: 'Mason (Skilled)',
    phone: '+977-9841234567',
    status: 'on-site',
    clockIn: '07:42',
    clockOut: undefined,
    geoFence: true,
    todayHours: 8,
    allocated: [
      { task: 'T-203 PCC M15', hours: 4 },
      { task: 'T-301 Base slab', hours: 4 },
    ],
  },
  {
    id: 'W-002',
    name: 'Sita Gurung',
    trade: 'Mazdoor (Unskilled)',
    phone: '+977-9852345678',
    status: 'on-site',
    clockIn: '07:55',
    clockOut: undefined,
    geoFence: true,
    todayHours: 8,
    allocated: [{ task: 'T-203 PCC M15', hours: 8 }],
  },
  {
    id: 'W-003',
    name: 'Hari Karki',
    trade: 'Bar bender',
    phone: '+977-9863456789',
    status: 'on-site',
    clockIn: '08:10',
    clockOut: undefined,
    geoFence: true,
    todayHours: 7.5,
    allocated: [
      { task: 'T-303 Wall & slab rebar', hours: 6 },
      { task: 'T-301 Base slab', hours: 1.5 },
    ],
  },
  {
    id: 'W-004',
    name: 'Bikas Tamang',
    trade: 'Mazdoor (Unskilled)',
    phone: '+977-9804567890',
    status: 'off-site',
    clockIn: '07:48',
    clockOut: '11:30',
    geoFence: false,
    todayHours: 3.5,
    allocated: [{ task: 'T-201 Excavation', hours: 3.5 }],
  },
  {
    id: 'W-005',
    name: 'Gopal Shrestha',
    trade: 'Operator',
    phone: '+977-9815678901',
    status: 'on-site',
    clockIn: '07:30',
    clockOut: undefined,
    geoFence: true,
    todayHours: 9,
    allocated: [
      { task: 'T-201 Excavation', hours: 8 },
      { task: 'T-202 Stone soling', hours: 1 },
    ],
  },
  {
    id: 'W-006',
    name: 'Anita Lama',
    trade: 'Helper',
    phone: '+977-9826789012',
    status: 'break',
    clockIn: '08:00',
    clockOut: undefined,
    geoFence: true,
    todayHours: 4,
    allocated: [{ task: 'T-204 Curing', hours: 4 }],
  },
]

export function TimeAttendanceModule() {
  const [selectedId, setSelectedId] = useState('W-001')
  const [selectedTrade, setSelectedTrade] = useState('All Trades')
  const [searchQuery, setSearchQuery] = useState('')
  const [workerList, setWorkerList, workersLoading] = useSyncedState<Worker[]>(
    'omnisite-workers',
    'workers',
    () => structuredClone(WORKERS) as typeof WORKERS,
    {
      fieldMap: {
        clockIn: 'clock_in',
        clockOut: 'clock_out',
        geoFence: 'geo_fence',
        todayHours: 'today_hours',
      },
      primaryKey: 'id',
    }
  )
  const filteredByTrade =
    selectedTrade === 'All Trades'
      ? workerList
      : workerList.filter((w) => w.trade === selectedTrade)
  const filteredWorkers = searchQuery.trim()
    ? filteredByTrade.filter(
        (w) =>
          w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          w.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          w.trade.toLowerCase().includes(searchQuery.toLowerCase()) ||
          w.phone.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredByTrade
  const selected =
    filteredWorkers.find((w) => w.id === selectedId) ?? filteredWorkers[0] ?? workerList[0]

  const totalOnSite = workerList.filter((w) => w.status === 'on-site').length
  const totalHours = workerList.reduce((s, w) => s + (w.todayHours || 0), 0)
  const geoFenceBreaches = workerList.filter(
    (w) => w.geoFence === false && w.status === 'on-site'
  ).length

  if (workersLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState label="Loading workers…" />
      </div>
    )
  }

  return (
    <Workspace2Pane
      leftPane={
        <>
          <PaneHeader title="Trades">
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() =>
                toast.info('Worker creation coming soon', {
                  description:
                    'Workers are created via the Admin module — open Admin → Workforce to add a new worker.',
                })
              }
              title="Add worker (Admin module)"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </PaneHeader>
          <PaneBody className="py-2">
            <div className="mb-2 px-3">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
                <Input
                  placeholder="Search workers…"
                  className="h-8 pl-7 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            {[
              'All Trades',
              'Mason (Skilled)',
              'Mazdoor (Unskilled)',
              'Bar bender',
              'Operator',
              'Helper',
              'Carpenter',
            ].map((t) => {
              const count =
                t === 'All Trades'
                  ? workerList.length
                  : workerList.filter((w) => w.trade === t).length
              return (
                <button
                  key={t}
                  onClick={() => setSelectedTrade(t)}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-1.5 text-xs',
                    selectedTrade === t
                      ? 'bg-accent border-l-primary border-l-2'
                      : 'hover:bg-accent/50 border-l-2 border-transparent'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Fingerprint className="text-muted-foreground h-3 w-3" />
                    {t}
                  </span>
                  <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                    {count}
                  </Badge>
                </button>
              )
            })}
          </PaneBody>
          {/* Mobile app preview — phone mockup */}
          <div className="border-t border-[var(--pane-divider)] p-3">
            <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
              <Smartphone className="h-3 w-3" />
              Mobile App · Foreman view
            </div>
            <PhoneMockup />
          </div>
          <div className="space-y-1.5 border-t border-[var(--pane-divider)] p-3 text-xs">
            <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Today&apos;s Snapshot
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">On site now</span>
              <span className="font-mono font-semibold text-emerald-600">{totalOnSite}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total hours logged</span>
              <span className="font-mono">{totalHours}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Geo-fence alerts</span>
              <span className={cn('font-mono', geoFenceBreaches > 0 ? 'text-amber-600' : '')}>
                {geoFenceBreaches}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 w-full gap-1.5 text-xs"
              onClick={() => {
                exportToCsv(
                  'omnisite-payroll.csv',
                  [
                    'ID',
                    'Name',
                    'Trade',
                    'Phone',
                    'Status',
                    'Clock In',
                    'Clock Out',
                    'Today Hours',
                  ],
                  workerList.map((w) => [
                    w.id,
                    w.name,
                    w.trade,
                    w.phone,
                    w.status,
                    w.clockIn ?? '',
                    w.clockOut ?? '',
                    w.todayHours ?? 0,
                  ])
                )
                toast.success('Payroll exported', {
                  description: `${workerList.length} workers exported to CSV`,
                })
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Payroll Export
            </Button>
          </div>
        </>
      }
      rightPane={<WorkerInspector worker={selected} />}
      leftPaneWidth="240px"
      rightPaneWidth="380px"
    />
  )
}

function WorkerInspector({ worker }: { worker: Worker }) {
  // Wage rate: use worker.wageRate if set, otherwise derive from trade.
  // These are NPR per hour, based on DoR Norm 2075 daily rates / 8 hours.
  const ratePerHour =
    worker.wageRate ??
    (worker.trade.includes('Mason')
      ? 1450 / 8
      : worker.trade.includes('Operator')
        ? 1200 / 8
        : 950 / 8)
  const otMultiplier = worker.otMultiplier ?? 1.5
  const standardHours = worker.standardHours ?? 8
  const hours = worker.todayHours || 0
  const regHours = Math.min(hours, standardHours)
  const otHours = Math.max(0, hours - standardHours)
  const todayCost = regHours * ratePerHour + otHours * ratePerHour * otMultiplier

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
    return () => {
      clearTimeout(initial)
      clearInterval(t)
    }
  }, [])

  return (
    <div className="flex justify-center">
      <div className="relative w-[180px] overflow-hidden rounded-[28px] border-[6px] border-slate-800 bg-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-950">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 z-10 h-4 w-16 -translate-x-1/2 rounded-b-2xl bg-slate-800 dark:bg-slate-700" />

        {/* Screen */}
        <div className="flex h-[320px] flex-col bg-gradient-to-b from-slate-50 to-slate-100 p-3 pt-5 dark:from-slate-900 dark:to-slate-800">
          {/* Status bar */}
          <div className="mb-2 flex items-center justify-between text-[8px] font-medium text-slate-600 dark:text-slate-300">
            <span>
              {time
                ? time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                : '--:--'}
            </span>
            <span className="flex items-center gap-0.5">
              <span className="h-1.5 w-2 rounded-sm bg-slate-600 dark:bg-slate-300" />
              <span className="relative h-1.5 w-3 rounded-sm border border-slate-600 dark:border-slate-300">
                <span className="absolute inset-0.5 rounded-sm bg-emerald-500" />
              </span>
            </span>
          </div>

          {/* App header */}
          <div className="mb-3 text-center">
            <div className="text-[9px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              OmniSite Mobile
            </div>
            <div className="mt-0.5 text-xs font-bold text-slate-900 dark:text-slate-100">
              Foreman · Ram Bahadur
            </div>
          </div>

          {/* Geo-fence status */}
          <div
            className={cn(
              'mb-2 rounded-lg border p-2 text-center',
              clockedIn
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
            )}
          >
            <MapPin
              className={cn(
                'mx-auto mb-0.5 h-4 w-4',
                clockedIn ? 'text-emerald-600' : 'text-amber-600'
              )}
            />
            <div className="text-[9px] font-medium text-slate-700 dark:text-slate-200">
              {clockedIn ? 'Within site perimeter' : 'GPS ready · 27.7°N 85.3°E'}
            </div>
            <div className="mt-0.5 text-[8px] text-slate-500">
              {clockedIn ? 'Distance: 35m from site center' : 'Site radius: 500m'}
            </div>
          </div>

          {/* Clock-in button */}
          <button
            onClick={() => setClockedIn((v) => !v)}
            className={cn(
              'mx-auto flex h-32 w-32 flex-col items-center justify-center rounded-full font-bold text-white shadow-lg transition-all active:scale-95',
              clockedIn
                ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/30'
                : 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/30'
            )}
          >
            <div className="text-[9px] tracking-wider uppercase opacity-80">
              {clockedIn ? 'Tap to Clock Out' : 'Tap to Clock In'}
            </div>
            <div className="mt-0.5 font-mono text-lg tabular-nums">
              {time
                ? time.toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : '--:--:--'}
            </div>
            <div className="mt-0.5 text-[8px] opacity-80">
              {clockedIn ? 'On site · 4h 18m' : 'Shift starts 08:00'}
            </div>
            {/* Pulsing ring */}
            <span
              className={cn(
                'absolute inset-0 animate-ping rounded-full',
                clockedIn ? 'bg-red-500/20' : 'bg-emerald-500/20'
              )}
            />
          </button>

          {/* Status footer */}
          <div className="mt-auto text-center text-[8px] text-slate-500 dark:text-slate-400">
            {clockedIn ? (
              <div className="flex items-center justify-center gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Clocked in at{' '}
                {time
                  ? time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                  : '--:--'}
              </div>
            ) : (
              <div>Tap the button to start your shift</div>
            )}
          </div>
        </div>

        {/* Home indicator */}
        <div className="flex justify-center bg-slate-900 pt-1 pb-1.5 dark:bg-slate-950">
          <div className="h-1 w-20 rounded-full bg-slate-600" />
        </div>
      </div>
    </div>
  )
}
