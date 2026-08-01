'use client'

import { useState } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Plus,
  Mail,
  Camera,
  MapPin,
  Calendar,
  ClipboardList,
  HelpCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DSR_ENTRIES, StatusDot } from './types'
import { WorkProgressView } from './work-progress'
import { DailySiteLogView } from './daily-site-log'
import { DsrInspector } from './dsr-inspector'
import { RfiTab, RFIS } from './rfi-tab'

type TopView = 'dsr' | 'rfi'

export function DailyOpsModule() {
  const [topView, setTopView] = useState<TopView>('dsr')
  const [view, setView] = useState<'progress' | 'log'>('progress')
  const [selectedId, setSelectedId] = useState('D-087')
  const selected = DSR_ENTRIES.find((d) => d.id === selectedId) ?? DSR_ENTRIES[0]

  const openRfis = RFIS.filter((r) => r.status === 'Open').length

  // Shared header strip with the DSR/RFI toggle — always visible at the top.
  const headerStrip = (
    <div className="vibrancy flex h-11 flex-shrink-0 items-center gap-2 border-b border-[var(--pane-divider)] px-3">
      <Button
        variant={topView === 'dsr' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => setTopView('dsr')}
      >
        <ClipboardList className="h-3.5 w-3.5" />
        Daily Site Reports
        <span className="bg-secondary text-muted-foreground ml-1 rounded-full px-1 py-0.5 text-[9px] font-semibold">
          {DSR_ENTRIES.length}
        </span>
      </Button>
      <Button
        variant={topView === 'rfi' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => setTopView('rfi')}
      >
        <HelpCircle className="h-3.5 w-3.5" />
        RFI Register
        {openRfis > 0 && (
          <span className="ml-1 rounded-full bg-amber-500/20 px-1 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300">
            {openRfis} open
          </span>
        )}
      </Button>
    </div>
  )

  if (topView === 'rfi') {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        {headerStrip}
        <div className="min-h-0 flex-1">
          <RfiTab />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {headerStrip}
      <div className="min-h-0 flex-1">
        <Workspace2Pane
          leftPane={
            <>
              <PaneHeader title="Site Execution">
                <Button variant="ghost" size="sm" className="h-7">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </PaneHeader>
              <div className="space-y-2 border-b border-[var(--pane-divider)] px-3 py-2">
                <div className="flex gap-1">
                  <Button
                    variant={view === 'progress' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-6 flex-1 text-[11px]"
                    onClick={() => setView('progress')}
                  >
                    Work Progress
                  </Button>
                  <Button
                    variant={view === 'log' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-6 flex-1 text-[11px]"
                    onClick={() => setView('log')}
                  >
                    Daily Site Log
                  </Button>
                </div>
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
                  <Input placeholder="Filter by task / chainage…" className="h-8 pl-7 text-xs" />
                </div>
              </div>
              <PaneBody className="py-2">
                <div className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-[10px] font-semibold tracking-wider uppercase">
                  <Calendar className="h-3 w-3" />
                  Today · 30 Jul
                </div>
                <div className="text-muted-foreground mb-2 px-3 text-[10px]">
                  Auto-generated from Schedule + Backlog · 6 entries
                </div>
                {DSR_ENTRIES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    className={cn(
                      'hover:bg-accent/50 w-full border-l-2 px-3 py-2 text-left transition-colors',
                      selectedId === d.id ? 'bg-accent border-l-primary' : 'border-l-transparent'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground font-mono text-[10px]">{d.id}</span>
                      <Badge variant="outline" className="h-4 px-1 text-[9px]">
                        {d.source}
                      </Badge>
                      {d.hasRfi && <Mail className="h-3 w-3 text-sky-500" />}
                      {d.hasPhotos && <Camera className="h-3 w-3 text-violet-500" />}
                      <span className="ml-auto">
                        <StatusDot status={d.status} />
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs font-medium">{d.task}</div>
                    <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-[10px]">
                      <MapPin className="h-2.5 w-2.5" />
                      <span>{d.chainage}</span>
                    </div>
                  </button>
                ))}
              </PaneBody>
            </>
          }
          centerPane={
            view === 'progress' ? (
              <WorkProgressView
                entries={DSR_ENTRIES}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ) : (
              <DailySiteLogView />
            )
          }
          rightPane={<DsrInspector entry={selected} />}
          leftPaneWidth="280px"
          rightPaneWidth="380px"
        />
      </div>
    </div>
  )
}

export default DailyOpsModule
