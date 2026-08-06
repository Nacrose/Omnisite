'use client'

import { useState } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Download, Plus, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSyncedState } from '@/lib/use-synced-state'
import { LoadingState } from '@/components/ui/loading-state'
import { exportToCsv } from '@/lib/csv-export'
import { toast } from 'sonner'
import { WorkerList } from './worker-list'
import { WorkerInspector } from './inspector'
import { PhoneMockup } from './phone-mockup'
import { computeDailyPayroll, formatPayPeriodLabel, enumeratePayPeriodDays } from './payroll-calc'

export interface Worker {
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

  // Pay period for the payroll CSV export. Defaults to the last 7 days
  // (today inclusive of the start, exclusive of the day AFTER today — i.e.
  // the 7-day window ending today). Stored as YYYY-MM-DD strings so the
  // <Input type="date"> binding is straightforward.
  const todayIso = new Date().toISOString().slice(0, 10)
  const weekAgoIso = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 6) // 7 days incl. today
    return d.toISOString().slice(0, 10)
  })()
  const [payPeriodStart, setPayPeriodStart] = useState(weekAgoIso)
  const [payPeriodEnd, setPayPeriodEnd] = useState(todayIso)

  const [workerList, , workersLoading] = useSyncedState<Worker[]>(
    'omnisite-workers',
    'workers',
    () => structuredClone(WORKERS) as typeof WORKERS,
    {
      fieldMap: {
        clockIn: 'clock_in',
        clockOut: 'clock_out',
        geoFence: 'geo_fence',
        todayHours: 'today_hours',
        // Wage fields (migration 20) — without these the wageRate /
        // otMultiplier / standardHours edits in the inspector would
        // silently vanish on reload in Supabase mode (camelToSnake
        // auto-convert produces matching names for these three, but
        // listing them here is explicit and matches the pattern used
        // for the other fields).
        wageRate: 'wage_rate',
        otMultiplier: 'ot_multiplier',
        standardHours: 'standard_hours',
      },
      primaryKey: 'id',
    }
  )

  // Per-day attendance (migration 31). Loaded once here so the payroll
  // CSV export can walk the pay-period range without re-fetching per
  // worker. The inspector also reads from this store via its own
  // useSyncedState call (the shared channel cache dedupes the
  // Supabase realtime subscription).
  interface AttendanceRow {
    id: string
    worker_id: string
    date: string
    hours: number
    ot_hours: number
  }
  const [attendanceRows] = useSyncedState<AttendanceRow[]>(
    'omnisite-worker-attendance',
    'worker_attendance',
    () => [] as AttendanceRow[],
    { primaryKey: 'id' }
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

  // Guard against an empty worker list (e.g. fresh install with no seed
  // data, or all workers deleted). Without this, `selected` is undefined
  // and `<WorkerInspector worker={selected} />` below would crash
  // dereferencing `worker.id` / `worker.name`. Placed AFTER all hooks have
  // been called so we don't violate rules-of-hooks.
  if (!selected) {
    return (
      <Workspace2Pane
        leftPane={
          <>
            <PaneHeader title="Trades" />
            <PaneBody className="text-muted-foreground flex items-center justify-center text-sm">
              No items to display
            </PaneBody>
          </>
        }
        rightPane={
          <PaneBody className="text-muted-foreground flex items-center justify-center text-sm">
            No items to display
          </PaneBody>
        }
        leftPaneWidth="240px"
        rightPaneWidth="380px"
      />
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
            <WorkerList
              workers={workerList}
              selectedTrade={selectedTrade}
              onSelectTrade={setSelectedTrade}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
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
                // Multi-day payroll CSV export — walks the pay-period
                // range and reads each worker's per-day attendance from
                // the worker_attendance table (migration 31).
                //
                // Before P1-13, this exported ONLY today's snapshot
                // (one row per worker) and the comment admitted
                // "multi-day payroll requires per-day attendance
                // tracking (not yet implemented)". Now we have the
                // table — emit one row per (worker, day) where hours
                // were logged.
                //
                // Workers with no attendance in the range get a single
                // zero-hours row so they're not silently dropped from
                // the export (a foreman can spot the gap and backfill).
                const days = enumeratePayPeriodDays(payPeriodStart, payPeriodEnd)
                if (days.length === 0) {
                  toast.error('Invalid pay period', {
                    description: 'Start date must be on or before end date.',
                  })
                  return
                }
                const rows: (string | number)[][] = []
                for (const w of workerList) {
                  const workerRows = attendanceRows.filter(
                    (a) =>
                      a.worker_id === w.id && a.date >= payPeriodStart && a.date <= payPeriodEnd
                  )
                  if (workerRows.length === 0) {
                    // No attendance logged in the period — emit a
                    // single zero-hours row so the gap is visible.
                    const p = computeDailyPayroll(w, 0)
                    rows.push([
                      w.name,
                      w.trade,
                      `${payPeriodStart}→${payPeriodEnd}`,
                      '0.00',
                      '0.00',
                      p.wageRate.toFixed(2),
                      '0.00',
                      '0.00',
                      '0.00',
                    ])
                    continue
                  }
                  for (const a of workerRows) {
                    const p = computeDailyPayroll(w, a.hours)
                    rows.push([
                      w.name,
                      w.trade,
                      a.date,
                      p.regularHours.toFixed(2),
                      p.otHours.toFixed(2),
                      p.wageRate.toFixed(2),
                      p.regularPay.toFixed(2),
                      p.otPay.toFixed(2),
                      p.totalPay.toFixed(2),
                    ])
                  }
                }
                exportToCsv(
                  `omnisite-payroll-${payPeriodStart}-to-${payPeriodEnd}.csv`,
                  [
                    'Worker',
                    'Trade',
                    'Date',
                    'Regular Hours',
                    'OT Hours',
                    'Wage Rate',
                    'Regular Pay',
                    'OT Pay',
                    'Total Pay',
                  ],
                  rows,
                  [
                    `# Pay period: ${formatPayPeriodLabel(payPeriodStart, payPeriodEnd)} (${days.length} days)`,
                    `# Workers: ${workerList.length}`,
                    `# Rows: ${rows.length} (one per worker-day with logged hours)`,
                    '# Workers with no logged attendance appear as a single 0-hours row.',
                  ]
                )
                toast.success('Payroll exported', {
                  description: `${rows.length} rows across ${workerList.length} workers for ${days.length} days.`,
                })
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Payroll Export
            </Button>
            {/* Pay period selector — drives the CSV export above */}
            <div className="mt-2 space-y-1">
              <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Pay Period
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Input
                  type="date"
                  className="h-7 px-1.5 text-[10px]"
                  value={payPeriodStart}
                  max={payPeriodEnd}
                  onChange={(e) => setPayPeriodStart(e.target.value)}
                  aria-label="Pay period start date"
                />
                <Input
                  type="date"
                  className="h-7 px-1.5 text-[10px]"
                  value={payPeriodEnd}
                  min={payPeriodStart}
                  max={todayIso}
                  onChange={(e) => setPayPeriodEnd(e.target.value)}
                  aria-label="Pay period end date"
                />
              </div>
              <div className="text-muted-foreground text-[10px]">
                {formatPayPeriodLabel(payPeriodStart, payPeriodEnd)}
              </div>
            </div>
          </div>
        </>
      }
      rightPane={<WorkerInspector worker={selected} />}
      leftPaneWidth="240px"
      rightPaneWidth="380px"
    />
  )
}
