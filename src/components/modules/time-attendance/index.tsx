'use client'

import { useState } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Download, Plus, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSyncedState } from '@/lib/use-synced-state'
import { LoadingState } from '@/components/ui/loading-state'
import { exportToCsv } from '@/lib/csv-export'
import { toast } from 'sonner'
import { WorkerList } from './worker-list'
import { WorkerInspector } from './inspector'
import { PhoneMockup } from './phone-mockup'

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
