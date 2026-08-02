// ─── Types & constants for the Daily Ops module ─────────────────────────────

import React from 'react'
import { cn } from '@/lib/utils'

// Today's date in ISO YYYY-MM-DD form. Seed DSR entries use this so the demo
// always shows "today" regardless of when the user opens the app, instead of
// being frozen on a hardcoded '2026-07-30'.
const TODAY_ISO = new Date().toISOString().slice(0, 10)

export interface DsrEntry {
  id: string
  task: string
  source: 'Sched' | 'Backlog' | 'RFI' | 'Manual'
  chainage: string
  planned: number
  actual: number
  uom: string
  status: 'in-progress' | 'completed' | 'blocked' | 'pending'
  hasRfi?: boolean
  hasPhotos?: boolean
  remarks?: string
  /** ISO date string (YYYY-MM-DD) for the day this DSR entry covers.
   *  Required — every DSR entry must belong to a specific day so users
   *  can navigate between historical reports. */
  date: string
  /** Optional FK to project_locations.id — the physical work-face / asset
   *  location this DSR entry pertains to (e.g. "Pier 3" or "0+200 to 0+400").
   *  Stored in local state for now; the DB column will land in a follow-up
   *  migration. */
  locationId?: string
}

export const DSR_ENTRIES: DsrEntry[] = [
  {
    id: 'D-087',
    task: 'PCC M15 pouring',
    source: 'Sched',
    chainage: '4+200 — 4+350',
    planned: 30,
    actual: 28.5,
    uom: 'cum',
    status: 'in-progress',
    hasPhotos: true,
    remarks: 'Concrete pump breakdown 2 hrs, recovered',
    date: TODAY_ISO,
  },
  {
    id: 'D-088',
    task: 'Rebar fixing — footing',
    source: 'Sched',
    chainage: '4+350 — 4+500',
    planned: 1.8,
    actual: 1.5,
    uom: 'MT',
    status: 'in-progress',
    hasPhotos: true,
    date: TODAY_ISO,
  },
  {
    id: 'D-089',
    task: 'Excavation',
    source: 'Backlog',
    chainage: '5+000 — 5+150',
    planned: 220,
    actual: 240,
    uom: 'cum',
    status: 'completed',
    hasPhotos: true,
    remarks: 'Hard rock encountered, used breaker',
    date: TODAY_ISO,
  },
  {
    id: 'D-090',
    task: 'Shuttering — column',
    source: 'Manual',
    chainage: 'Pier P-4',
    planned: 12,
    actual: 12,
    uom: 'sqm',
    status: 'completed',
    hasPhotos: true,
    date: TODAY_ISO,
  },
  {
    id: 'D-091',
    task: 'Dewatering',
    source: 'Manual',
    chainage: '4+200',
    planned: 0,
    actual: 6,
    uom: 'hr',
    status: 'in-progress',
    remarks: 'Water table higher than expected',
    date: TODAY_ISO,
  },
  {
    id: 'D-092',
    task: 'Hammock — tunnel support',
    source: 'RFI',
    chainage: 'Ch 0+875',
    planned: 0,
    actual: 4.5,
    uom: 'm',
    status: 'in-progress',
    hasRfi: true,
    hasPhotos: true,
    remarks: 'Rock class III encountered, installed steel ribs',
    date: TODAY_ISO,
  },
]

// StatusDot is a small React helper. Written with React.createElement so this
// file can remain `.ts` (no JSX) — consistent with other module `types.ts` files.
const STATUS_MAP: Record<DsrEntry['status'], { color: string; label: string }> = {
  'in-progress': { color: 'bg-amber-500', label: 'In progress' },
  completed: { color: 'bg-emerald-500', label: 'Completed' },
  blocked: { color: 'bg-red-500', label: 'Blocked' },
  pending: { color: 'bg-slate-400', label: 'Pending' },
}

export function StatusDot({ status }: { status: DsrEntry['status'] }) {
  const m = STATUS_MAP[status]
  return React.createElement(
    'span',
    { className: 'inline-flex items-center gap-1 text-[10px] text-muted-foreground' },
    React.createElement('span', { className: cn('w-1.5 h-1.5 rounded-full', m.color) }),
    m.label
  )
}
