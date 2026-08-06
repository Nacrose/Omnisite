'use client'

import { useState, useEffect, useCallback } from 'react'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Gauge, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROOT_CAUSE_LABELS, type RootCauseCode } from '@/lib/productivity'

interface ProductivityRow {
  id: string
  task_id: string
  calculation_date: string
  planned_manhours: number
  actual_manhours: number
  variance_manhours: number
  variance_percent: number
  productivity_ratio: number
  root_cause_code: RootCauseCode | null
  status: string
}

export function ProductivityView() {
  const [rows, setRows] = useState<ProductivityRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/productivity-results')
      if (res.ok) setRows(await res.json())
    } catch { /* demo mode */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const totalVariance = rows.reduce((s, r) => s + r.variance_manhours, 0)
  const avgRatio = rows.length > 0 ? rows.reduce((s, r) => s + r.productivity_ratio, 0) / rows.length : 1
  const requiringAttention = rows.filter((r) => r.status === 'ROOT_CAUSE_REQUIRED').length

  return (
    <>
      <PaneHeader title="Productivity Variance">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={fetchData} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Refresh'}
        </Button>
      </PaneHeader>
      <PaneBody className="p-4">
        {rows.length > 0 && (
          <div className="mb-3 grid grid-cols-3 gap-2">
            <div className="rounded-md border border-[var(--pane-divider)] p-2 text-center">
              <div className="text-muted-foreground text-[9px]">Total Variance</div>
              <div className={cn('font-mono text-sm font-bold', totalVariance > 0 ? 'text-red-500' : 'text-emerald-500')}>
                {totalVariance > 0 ? '+' : ''}{totalVariance.toFixed(0)} hrs
              </div>
            </div>
            <div className="rounded-md border border-[var(--pane-divider)] p-2 text-center">
              <div className="text-muted-foreground text-[9px]">Avg Productivity</div>
              <div className={cn('font-mono text-sm font-bold', avgRatio < 1 ? 'text-red-500' : 'text-emerald-500')}>
                {avgRatio.toFixed(2)}
              </div>
            </div>
            <div className="rounded-md border border-[var(--pane-divider)] p-2 text-center">
              <div className="text-muted-foreground text-[9px]">Need Root Cause</div>
              <div className={cn('font-mono text-sm font-bold', requiringAttention > 0 ? 'text-amber-500' : 'text-emerald-500')}>
                {requiringAttention}
              </div>
            </div>
          </div>
        )}

        {rows.length === 0 && !loading && (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Gauge className="h-8 w-8 opacity-30" />
            <div className="text-sm font-medium">No productivity records</div>
            <p className="text-muted-foreground max-w-xs text-[11px]">
              Log planned vs actual manhours per task in the Scheduler's Productivity tab. Results appear here for project-wide analysis.
            </p>
          </div>
        )}

        {rows.map((r) => (
          <div key={r.id} className="mb-1.5 rounded border border-[var(--pane-divider)] p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{r.task_id}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn('text-[9px]',
                  r.status === 'OK' ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300' :
                  r.status === 'ROOT_CAUSE_REQUIRED' ? 'border-red-500/40 text-red-700 dark:text-red-300' :
                  'border-amber-500/40 text-amber-700 dark:text-amber-300'
                )}>
                  {r.status === 'OK' ? 'OK' : r.status === 'ROOT_CAUSE_REQUIRED' ? 'Action needed' : 'Logged'}
                </Badge>
              </div>
            </div>
            <div className="mt-1 grid grid-cols-4 gap-2 text-[10px]">
              <div>
                <span className="text-muted-foreground">Planned: </span>
                <span className="font-mono">{r.planned_manhours}h</span>
              </div>
              <div>
                <span className="text-muted-foreground">Actual: </span>
                <span className="font-mono">{r.actual_manhours}h</span>
              </div>
              <div>
                <span className="text-muted-foreground">Var: </span>
                <span className={cn('font-mono font-semibold', r.variance_manhours > 0 ? 'text-red-500' : 'text-emerald-500')}>
                  {r.variance_manhours > 0 ? '+' : ''}{r.variance_manhours}h ({r.variance_percent}%)
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Ratio: </span>
                <span className={cn('font-mono font-semibold', r.productivity_ratio < 1 ? 'text-red-500' : 'text-emerald-500')}>
                  {r.productivity_ratio.toFixed(2)}
                </span>
              </div>
            </div>
            {r.root_cause_code && (
              <div className="text-muted-foreground mt-1 text-[10px]">
                Root cause: {ROOT_CAUSE_LABELS[r.root_cause_code]}
              </div>
            )}
          </div>
        ))}
      </PaneBody>
    </>
  )
}

export default ProductivityView
