'use client'

import { useState, useSyncExternalStore } from 'react'
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
import { DSR_ENTRIES, StatusDot, type DsrEntry } from './types'
import { useSyncedState } from '@/lib/use-synced-state'
import { WorkProgressView } from './work-progress'
import { DailySiteLogView } from './daily-site-log'
import { DsrInspector } from './dsr-inspector'
import { RfiTab, subscribeRfis, getRfis } from './rfi-tab'

type TopView = 'dsr' | 'rfi'

export function DailyOpsModule() {
  const [topView, setTopView] = useState<TopView>('dsr')
  const [view, setView] = useState<'progress' | 'log'>('progress')
  const [selectedId, setSelectedId] = useState('D-087')
  // Synced DSR entries — reads/writes go through the REST API client in
  // Supabase mode, falls back to localStorage otherwise. Previously this
  // imported `DSR_ENTRIES` directly, so the Daily Ops module was
  // disconnected from the store: edits never persisted in Supabase mode
  // and other tabs didn't see them in realtime. The `fieldMap` maps the
  // camelCase boolean flags on the client type (`hasRfi`, `hasPhotos`)
  // to the snake_case DB columns (`has_rfi`, `has_photos`).
  const [dsrEntries, , dsrLoading] = useSyncedState<DsrEntry[]>(
    'omnisite-dsr-entries',
    'dsr_entries',
    () => structuredClone(DSR_ENTRIES) as typeof DSR_ENTRIES,
    { fieldMap: { hasRfi: 'has_rfi', hasPhotos: 'has_photos' }, primaryKey: 'id' }
  )
  // Date for the DSR — defaults to the date of the first seed entry (today in
  // demo data). Users can navigate to previous/next days. Entries are filtered
  // to the selected date so you can actually pull up historical reports.
  const [selectedDate, setSelectedDate] = useState(
    dsrEntries[0]?.date || new Date().toISOString().slice(0, 10)
  )
  const dayEntries = dsrEntries.filter((d) => d.date === selectedDate)
  const selected = dayEntries.find((d) => d.id === selectedId) ?? dayEntries[0] ?? dsrEntries[0]

  // Live RFI count from the shared store — updates when DSR Inspector adds one.
  const rfis = useSyncExternalStore(subscribeRfis, getRfis, getRfis)
  const openRfis = rfis.filter((r) => r.status === 'Open').length

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
          {dsrEntries.length}
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

  if (dsrLoading) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        {headerStrip}
        <div className="text-muted-foreground flex min-h-0 flex-1 items-center justify-center text-xs">
          Loading DSR entries…
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
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value)
                      // Reset selection to first entry of the new day (if any)
                      const first = dsrEntries.find((d) => d.date === e.target.value)
                      if (first) setSelectedId(first.id)
                    }}
                    className="bg-transparent text-[10px] font-semibold tracking-wider uppercase outline-none"
                  />
                  <span className="ml-auto text-[9px] font-normal normal-case">
                    {dayEntries.length} {dayEntries.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
                {dayEntries.length === 0 ? (
                  <div className="text-muted-foreground px-3 py-8 text-center text-[10px]">
                    No DSR entries for {selectedDate}. Switch to the Work Progress tab to add one.
                  </div>
                ) : (
                  dayEntries.map((d) => (
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
                  ))
                )}
              </PaneBody>
            </>
          }
          centerPane={
            view === 'progress' ? (
              <WorkProgressView
                entries={dayEntries.length > 0 ? dayEntries : dsrEntries}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ) : (
              <DailySiteLogView date={selectedDate} />
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
