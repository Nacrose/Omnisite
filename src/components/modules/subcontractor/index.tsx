'use client'

import { useState } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Plus, Search, Mountain } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePersistentState } from '@/lib/use-persistent-state'
import { useSyncedState } from '@/lib/use-synced-state'
import { LoadingState } from '@/components/ui/loading-state'
import { toast } from 'sonner'
import type { Subcontractor } from './types'
import { INITIAL_SCS } from './types'
import { SubBoqTab } from './sub-boq-tab'
import { MaterialTab } from './material-tab'
import { ConsumablesTab } from './consumables-tab'
import { RunningBillTab } from './running-bill-tab'
import { ScheduleTab } from './schedule-tab'
import { PerformanceTab } from './performance-tab'

// ─── Main Module ─────────────────────────────────────────────────────────────

export function SubcontractorModule() {
  const [selectedId, setSelectedId] = usePersistentState('omnisite-sc-selected', 'SC-01')
  const [scs, setScs, scsLoading] = useSyncedState<Subcontractor[]>(
    'omnisite-scs',
    'subcontractors',
    () => structuredClone(INITIAL_SCS) as typeof INITIAL_SCS,
    {
      fieldMap: {
        advancePaid: 'advance_paid',
        advancePct: 'advance_pct',
        retentionPct: 'retention_pct',
        reworkCost: 'rework_cost',
        insuranceExpiry: 'insurance_expiry',
        labourLicenseExpiry: 'labour_license_expiry',
        isTunneling: 'is_tunneling',
        materialIssues: 'material_issues',
        materialReturns: 'material_returns',
        customDeductibles: 'custom_deductibles',
        assignedTasks: 'assigned_tasks',
        ncrCount: 'ncr_count',
        agreementValue: 'agreement_value',
      },
      primaryKey: 'id',
    }
  )
  const [activeTab, setActiveTab] = useState('subboq')
  const [searchQuery, setSearchQuery] = useState('')

  const selected = scs.find((s) => s.id === selectedId) ?? scs[0]
  const filteredScs = searchQuery.trim()
    ? scs.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.scope.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : scs

  if (scsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState label="Loading subcontractors…" />
      </div>
    )
  }

  return (
    <>
      <Workspace2Pane
        leftPane={
          <>
            <PaneHeader title="Subcontractors">
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() =>
                  toast.info('Subcontractor creation requires PM role', {
                    description:
                      'Open the Admin module → Vendors to create a new subcontractor record.',
                  })
                }
                title="Add subcontractor (Admin module)"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </PaneHeader>
            <div className="border-b border-[var(--pane-divider)] px-3 py-2">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
                <Input
                  placeholder="Search subcontractors…"
                  className="h-8 pl-7 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <PaneBody className="py-2">
              {filteredScs.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={cn(
                    'w-full border-l-2 px-3 py-2 text-left',
                    selectedId === s.id
                      ? 'bg-accent border-l-primary'
                      : 'hover:bg-accent/50 border-l-transparent'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-mono text-[10px]">{s.id}</span>
                    {s.isTunneling && (
                      <Badge
                        variant="secondary"
                        className="bg-violet-500/15 text-[9px] text-violet-700 dark:text-violet-300"
                      >
                        <Mountain className="mr-0.5 h-2 w-2" />
                        Tunneling
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[9px]">
                      {s.status}
                    </Badge>
                  </div>
                  <div className="mt-0.5 truncate text-xs font-medium">{s.name}</div>
                  <div className="text-muted-foreground truncate text-[10px]">{s.scope}</div>
                </button>
              ))}
            </PaneBody>
          </>
        }
        rightPane={<ScInspector sc={selected} activeTab={activeTab} setActiveTab={setActiveTab} />}
        leftPaneWidth="240px"
        rightPaneWidth="440px"
      />
    </>
  )
}

// ─── SC Inspector (right pane with tabs) ─────────────────────────────────────

function ScInspector({
  sc,
  activeTab,
  setActiveTab,
}: {
  sc: Subcontractor
  activeTab: string
  setActiveTab: (t: string) => void
}) {
  return (
    <>
      <PaneHeader title={`SC Inspector · ${sc.id}`} />
      <PaneBody>
        {/* Header */}
        <div className="border-b border-[var(--pane-divider)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {sc.status}
            </Badge>
            {sc.isTunneling && (
              <Badge
                variant="secondary"
                className="bg-violet-500/15 text-[10px] text-violet-700 dark:text-violet-300"
              >
                <Mountain className="mr-0.5 h-2.5 w-2.5" />
                Tunneling SC
              </Badge>
            )}
          </div>
          <div className="text-sm font-semibold">{sc.name}</div>
          <div className="text-muted-foreground mt-0.5 text-xs">{sc.scope}</div>
          <div className="text-muted-foreground mt-2 flex items-center gap-3 text-[10px]">
            <span>PAN: {sc.pan}</span>
            <span>·</span>
            <span>Insurance: {sc.insuranceExpiry}</span>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="px-3 pt-2">
            <TabsList
              className="grid h-8 w-full text-xs"
              style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}
            >
              <TabsTrigger value="subboq" className="px-1 text-[9px]">
                Sub-BOQ
              </TabsTrigger>
              <TabsTrigger value="material" className="px-1 text-[9px]">
                Material
              </TabsTrigger>
              <TabsTrigger value="consumables" className="px-1 text-[9px]">
                Consum.
              </TabsTrigger>
              <TabsTrigger value="bill" className="px-1 text-[9px]">
                Bill
              </TabsTrigger>
              <TabsTrigger value="schedule" className="px-1 text-[9px]">
                Schedule
              </TabsTrigger>
              <TabsTrigger value="performance" className="px-1 text-[9px]">
                Perf.
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="subboq" className="mt-0">
            <SubBoqTab sc={sc} />
          </TabsContent>
          <TabsContent value="material" className="mt-0">
            <MaterialTab sc={sc} />
          </TabsContent>
          <TabsContent value="consumables" className="mt-0">
            <ConsumablesTab sc={sc} />
          </TabsContent>
          <TabsContent value="bill" className="mt-0">
            <RunningBillTab sc={sc} />
          </TabsContent>
          <TabsContent value="schedule" className="mt-0">
            <ScheduleTab sc={sc} />
          </TabsContent>
          <TabsContent value="performance" className="mt-0">
            <PerformanceTab sc={sc} />
          </TabsContent>
        </Tabs>
      </PaneBody>
    </>
  )
}

export default SubcontractorModule
