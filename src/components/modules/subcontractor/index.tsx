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
  const [scs, setScs] = usePersistentState<Subcontractor[]>('omnisite-scs', () => JSON.parse(JSON.stringify(INITIAL_SCS)))
  const [activeTab, setActiveTab] = useState('subboq')
  const [searchQuery, setSearchQuery] = useState('')

  const selected = scs.find(s => s.id === selectedId) ?? scs[0]
  const filteredScs = searchQuery.trim()
    ? scs.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.scope.toLowerCase().includes(searchQuery.toLowerCase()))
    : scs

  return (
    <>
      <Workspace2Pane
        leftPane={
          <>
            <PaneHeader title="Subcontractors">
              <Button variant="ghost" size="sm" className="h-7" onClick={() => toast.info('Not yet implemented', { description: 'This feature is planned but not yet built.' })}><Plus className="w-3.5 h-3.5" /></Button>
            </PaneHeader>
            <div className="px-3 py-2 border-b border-[var(--pane-divider)]">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search subcontractors…" className="h-8 pl-7 text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
            <PaneBody className="py-2">
              {filteredScs.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={cn('w-full text-left px-3 py-2 border-l-2', selectedId === s.id ? 'bg-accent border-l-primary' : 'border-l-transparent hover:bg-accent/50')}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{s.id}</span>
                    {s.isTunneling && <Badge variant="secondary" className="text-[9px] bg-violet-500/15 text-violet-700 dark:text-violet-300"><Mountain className="w-2 h-2 mr-0.5" />Tunneling</Badge>}
                    <Badge variant="secondary" className="text-[9px]">{s.status}</Badge>
                  </div>
                  <div className="text-xs font-medium mt-0.5 truncate">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{s.scope}</div>
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

function ScInspector({ sc, activeTab, setActiveTab }: { sc: Subcontractor; activeTab: string; setActiveTab: (t: string) => void }) {
  return (
    <>
      <PaneHeader title={`SC Inspector · ${sc.id}`} />
      <PaneBody>
        {/* Header */}
        <div className="p-4 border-b border-[var(--pane-divider)]">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="text-[10px]">{sc.status}</Badge>
            {sc.isTunneling && <Badge variant="secondary" className="text-[10px] bg-violet-500/15 text-violet-700 dark:text-violet-300"><Mountain className="w-2.5 h-2.5 mr-0.5" />Tunneling SC</Badge>}
          </div>
          <div className="text-sm font-semibold">{sc.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{sc.scope}</div>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
            <span>PAN: {sc.pan}</span>
            <span>·</span>
            <span>Insurance: {sc.insuranceExpiry}</span>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="px-3 pt-2">
            <TabsList className="grid h-8 w-full text-xs" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
              <TabsTrigger value="subboq" className="text-[9px] px-1">Sub-BOQ</TabsTrigger>
              <TabsTrigger value="material" className="text-[9px] px-1">Material</TabsTrigger>
              <TabsTrigger value="consumables" className="text-[9px] px-1">Consum.</TabsTrigger>
              <TabsTrigger value="bill" className="text-[9px] px-1">Bill</TabsTrigger>
              <TabsTrigger value="schedule" className="text-[9px] px-1">Schedule</TabsTrigger>
              <TabsTrigger value="performance" className="text-[9px] px-1">Perf.</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="subboq" className="mt-0"><SubBoqTab sc={sc} /></TabsContent>
          <TabsContent value="material" className="mt-0"><MaterialTab sc={sc} /></TabsContent>
          <TabsContent value="consumables" className="mt-0"><ConsumablesTab sc={sc} /></TabsContent>
          <TabsContent value="bill" className="mt-0"><RunningBillTab sc={sc} /></TabsContent>
          <TabsContent value="schedule" className="mt-0"><ScheduleTab sc={sc} /></TabsContent>
          <TabsContent value="performance" className="mt-0"><PerformanceTab sc={sc} /></TabsContent>
        </Tabs>
      </PaneBody>
    </>
  )
}

export default SubcontractorModule
