'use client'

import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Fingerprint } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Worker } from './index'

/**
 * WorkerList — the left-pane trade filter + search box for Time & Attendance.
 *
 * Renders the trade filter buttons with live counts per trade, plus the worker
 * search box at the top. The selected trade and search query are owned by the
 * parent module (TimeAttendanceModule) so they can drive the inspector's
 * derived `selected` worker.
 *
 * The trade list is derived from the actual `workers` array so empty trades
 * (e.g. 'Carpenter' when no carpenter is on-site) never show as a 0-count
 * category. 'All Trades' is always first and aggregates every trade.
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
  // Derive trades from the actual worker list so empty categories don't show.
  // 'All Trades' is always first and aggregates every trade.
  const trades = useMemo(
    () => ['All Trades', ...Array.from(new Set(workers.map((w) => w.trade)))],
    [workers]
  )
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
      {trades.map((t) => {
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
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {count}
            </Badge>
          </button>
        )
      })}
    </>
  )
}
