'use client'

import { useState, useMemo, useSyncExternalStore } from 'react'
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
import { toast } from 'sonner'
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
  const [dsrEntries, setDsrEntries, dsrLoading] = useSyncedState<DsrEntry[]>(
    'omnisite-dsr-entries',
    'dsr_entries',
    () => structuredClone(DSR_ENTRIES) as typeof DSR_ENTRIES,
    {
      fieldMap: { hasRfi: 'has_rfi', hasPhotos: 'has_photos', locationId: 'location_id' },
      primaryKey: 'id',
    }
  )
  // Date for the DSR — defaults to the date of the first seed entry (today in
  // demo data). Users can navigate to previous/next days. Entries are filtered
  // to the selected date so you can actually pull up historical reports.
  const [selectedDate, setSelectedDate] = useState(
    dsrEntries[0]?.date || new Date().toISOString().slice(0, 10)
  )
  // Search query — filters the dayEntries list by task name or chainage.
  // Previously the input had no value/onChange, so typing did nothing (audit D1-2).
  const [searchQuery, setSearchQuery] = useState('')
  const dayEntries = dsrEntries.filter((d) => d.date === selectedDate)
  const filteredDayEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return dayEntries
    return dayEntries.filter(
      (d) => d.task.toLowerCase().includes(q) || d.chainage.toLowerCase().includes(q)
    )
  }, [dayEntries, searchQuery])
  const selected =
    filteredDayEntries.find((d) => d.id === selectedId) ?? dayEntries[0] ?? dsrEntries[0]

  // If selectedId points to a deleted entry (or an entry from a different
  // date that's no longer in dayEntries), `selected` falls back to
  // dayEntries[0] or dsrEntries[0] — but selectedId in state stays stale,
  // so the outline highlights NO row. Sync selectedId to the fallback so
  // the outline highlights the right row (audit D1-1 — same fix as BOQ
  // B4-4 and scheduler R6-6). Uses the "adjust state during render" pattern.
  if (selected && selected.id !== selectedId) {
    setSelectedId(selected.id)
  }

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
          <RfiTab
            onOpenDsr={(dsrId) => {
              // Switch to the DSR tab and select the linked entry (audit D2-3).
              // If the entry doesn't exist in the store (e.g. deleted), the
              // DSR view's selectedId sync will fall back to the first entry.
              setTopView('dsr')
              setSelectedId(dsrId)
            }}
          />
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

  // Guard against an empty DSR store (e.g. fresh install with no seed data,
  // or all entries deleted). Without this, `selected` is undefined and
  // `<DsrInspector entry={selected} … />` below would crash dereferencing
  // `entry.id` / `entry.task`. Placed AFTER all hooks have been called so
  // we don't violate rules-of-hooks.
  if (!selected) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        {headerStrip}
        <div className="min-h-0 flex-1">
          <Workspace2Pane
            leftPane={
              <>
                <PaneHeader title="Site Execution" />
                <PaneBody className="text-muted-foreground flex items-center justify-center text-sm">
                  No items to display
                </PaneBody>
              </>
            }
            centerPane={
              <PaneBody className="text-muted-foreground flex items-center justify-center text-sm">
                No items to display
              </PaneBody>
            }
            rightPane={
              <PaneBody className="text-muted-foreground flex items-center justify-center text-sm">
                No items to display
              </PaneBody>
            }
            leftPaneWidth="280px"
            rightPaneWidth="380px"
          />
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    // Add a new ad-hoc DSR entry for the selected date.
                    // Uses crypto.randomUUID for a collision-free id (audit D1-3 —
                    // previously the button had no onClick).
                    const newId = `D-${Date.now().toString(36)}`
                    const newEntry: DsrEntry = {
                      id: newId,
                      task: 'New DSR entry',
                      source: 'Manual',
                      chainage: '—',
                      planned: 0,
                      actual: 0,
                      uom: 'cum',
                      status: 'pending',
                      date: selectedDate,
                    }
                    setDsrEntries((prev) => [...prev, newEntry])
                    setSelectedId(newId)
                    toast.success('DSR entry added', {
                      description: `${newId} for ${selectedDate}`,
                    })
                  }}
                >
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
                  <Input
                    placeholder="Filter by task / chainage…"
                    className="h-8 pl-7 text-xs"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
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
                    {filteredDayEntries.length}{' '}
                    {filteredDayEntries.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
                {filteredDayEntries.length === 0 ? (
                  <div className="text-muted-foreground px-3 py-8 text-center text-[10px]">
                    {dayEntries.length === 0
                      ? `No DSR entries for ${selectedDate}. Switch to the Work Progress tab to add one.`
                      : `No entries match "${searchQuery}".`}
                  </div>
                ) : (
                  filteredDayEntries.map((d) => (
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
                onAddAdHoc={() => {
                  // Add a new ad-hoc DSR entry for the selected date
                  // (audit D1-4 — previously the button had no onClick).
                  const newId = `D-${Date.now().toString(36)}`
                  const newEntry: DsrEntry = {
                    id: newId,
                    task: 'New DSR entry',
                    source: 'Manual',
                    chainage: '—',
                    planned: 0,
                    actual: 0,
                    uom: 'cum',
                    status: 'pending',
                    date: selectedDate,
                  }
                  setDsrEntries((prev) => [...prev, newEntry])
                  setSelectedId(newId)
                  toast.success('Ad-hoc DSR entry added', {
                    description: `${newId} for ${selectedDate}`,
                  })
                }}
                onCopyYesterday={() => {
                  // Copy entries from the previous day. Parse selectedDate,
                  // subtract 1 day, and clone any entries from that date with
                  // new IDs and reset actual/planned (audit D1-4).
                  const prevDate = new Date(selectedDate + 'T00:00:00')
                  prevDate.setDate(prevDate.getDate() - 1)
                  const prevIso = prevDate.toISOString().slice(0, 10)
                  const prevEntries = dsrEntries.filter((d) => d.date === prevIso)
                  if (prevEntries.length === 0) {
                    toast.info(`No DSR entries found for ${prevIso} to copy.`)
                    return
                  }
                  const cloned = prevEntries.map((d) => ({
                    ...d,
                    id: `D-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 4)}`,
                    date: selectedDate,
                    actual: 0,
                    status: 'pending' as const,
                  }))
                  setDsrEntries((prev) => [...prev, ...cloned])
                  toast.success(`Copied ${cloned.length} entries from ${prevIso}`, {
                    description: `Actual quantities reset to 0, status set to pending.`,
                  })
                }}
              />
            ) : (
              <DailySiteLogView date={selectedDate} />
            )
          }
          rightPane={
            <DsrInspector
              entry={selected}
              onUpdateLocation={(locId) => {
                // Propagate the location link into the synced dsrEntries
                // store so it persists to Supabase (location_id column added
                // in migration 12) and is visible to other modules. Without
                // this the inspector only fired a toast and never persisted.
                setDsrEntries((prev) =>
                  prev.map((d) =>
                    d.id === selected.id ? { ...d, locationId: locId ?? undefined } : d
                  )
                )
              }}
              onUpdate={(field, value) => {
                // Persist planned/actual/remarks edits into the synced
                // dsrEntries store so they round-trip to Supabase and
                // immediately re-render the inspector (variance calc, etc.).
                // Without this the inspector's three inputs were uncontrolled
                // and edits were silently dropped on blur.
                setDsrEntries((prev) =>
                  prev.map((e) =>
                    e.id === selected.id ? ({ ...e, [field]: value } as DsrEntry) : e
                  )
                )
              }}
            />
          }
          leftPaneWidth="280px"
          rightPaneWidth="380px"
        />
      </div>
    </div>
  )
}

export default DailyOpsModule
