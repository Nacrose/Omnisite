'use client'

import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Fingerprint } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Worker } from './index'

// Fixed trade filter list — drives the left-pane trade filter. Includes the
// 'All Trades' synthetic entry plus every trade that appears in the seed data
// (or that the Admin module might create).
const TRADES = [
  'All Trades',
  'Mason (Skilled)',
  'Mazdoor (Unskilled)',
  'Bar bender',
  'Operator',
  'Helper',
  'Carpenter',
] as const

/**
 * WorkerList — the left-pane trade filter + search box for Time & Attendance.
 *
 * Renders the trade filter buttons with live counts per trade, plus the worker
 * search box at the top. The selected trade and search query are owned by the
 * parent module (TimeAttendanceModule) so they can drive the inspector's
 * derived `selected` worker.
 */
export function WorkerList({
  workers,
  selectedTrade,
  onSelectTrade,
  searchQuery,
  onSearchChange,
}: {
  workers: Worker[]
  selectedTrade: string
  onSelectTrade: (trade: string) => void
  searchQuery: string
  onSearchChange: (q: string) => void
}) {
  return (
    <>
      <div className="mb-2 px-3">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search workers…"
            className="h-8 pl-7 text-xs"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>
      {TRADES.map((t) => {
        const count =
          t === 'All Trades' ? workers.length : workers.filter((w) => w.trade === t).length
        return (
          <button
            key={t}
            onClick={() => onSelectTrade(t)}
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
    </>
  )
}
