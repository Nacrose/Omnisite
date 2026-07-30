'use client'

import { useState } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search, Plus, Mail, Camera, MapPin, Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DSR_ENTRIES, StatusDot } from './types'
import { WorkProgressView } from './work-progress'
import { DailySiteLogView } from './daily-site-log'
import { DsrInspector } from './dsr-inspector'

export function DailyOpsModule() {
  const [view, setView] = useState<'progress' | 'log'>('progress')
  const [selectedId, setSelectedId] = useState('D-087')
  const selected = DSR_ENTRIES.find(d => d.id === selectedId) ?? DSR_ENTRIES[0]

  return (
    <Workspace2Pane
      leftPane={
        <>
          <PaneHeader title="Site Execution">
            <Button variant="ghost" size="sm" className="h-7"><Plus className="w-3.5 h-3.5" /></Button>
          </PaneHeader>
          <div className="px-3 py-2 border-b border-[var(--pane-divider)] space-y-2">
            <div className="flex gap-1">
              <Button
                variant={view === 'progress' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 flex-1 text-xs"
                onClick={() => setView('progress')}
              >Work Progress</Button>
              <Button
                variant={view === 'log' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 flex-1 text-xs"
                onClick={() => setView('log')}
              >Daily Site Log</Button>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Filter by task / chainage…" className="h-8 pl-7 text-xs" />
            </div>
          </div>
          <PaneBody className="py-2">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              Today · 30 Jul
            </div>
            <div className="text-[10px] text-muted-foreground px-3 mb-2">Auto-generated from Schedule + Backlog · 6 entries</div>
            {DSR_ENTRIES.map(d => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={cn(
                  'w-full text-left px-3 py-2 border-l-2 hover:bg-accent/50 transition-colors',
                  selectedId === d.id ? 'bg-accent border-l-primary' : 'border-l-transparent'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground">{d.id}</span>
                  <Badge variant="outline" className="text-[9px] h-4 px-1">{d.source}</Badge>
                  {d.hasRfi && <Mail className="w-3 h-3 text-sky-500" />}
                  {d.hasPhotos && <Camera className="w-3 h-3 text-violet-500" />}
                  <span className="ml-auto">
                    <StatusDot status={d.status} />
                  </span>
                </div>
                <div className="text-xs font-medium mt-0.5 truncate">{d.task}</div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  <MapPin className="w-2.5 h-2.5" />
                  <span>{d.chainage}</span>
                </div>
              </button>
            ))}
          </PaneBody>
        </>
      }
      centerPane={
        view === 'progress' ? (
          <WorkProgressView entries={DSR_ENTRIES} selectedId={selectedId} onSelect={setSelectedId} />
        ) : (
          <DailySiteLogView />
        )
      }
      rightPane={<DsrInspector entry={selected} />}
      leftPaneWidth="280px"
      rightPaneWidth="380px"
    />
  )
}

export default DailyOpsModule
