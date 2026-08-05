'use client'

import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

/**
 * A material reconciliation row in the DSR Inspector's "Material" tab.
 *
 * Shows theoretical (from BOQ coefficients) vs issued (from Material Issue
 * Notes / MIN) vs variance. When `issued` is null (no MIN data linked),
 * shows "—" instead of a fabricated number.
 *
 * Extracted from dsr-inspector.tsx so the main component focuses on layout.
 */
export function MaterialRow({
  mat,
  theoretical,
  issued,
  uom,
}: {
  mat: string
  theoretical: number
  /** Issued (MIN) quantity, or null when no material-issue data is linked
   *  to this DSR entry. We show "—" instead of a fabricated number. */
  issued: number | null
  uom: string
}) {
  // Guard divide-by-zero: when theoretical is 0 (e.g. a planned-but-not-
  // started task with actual=0), variance would be Infinity/NaN.
  // When issued is null (no MIN data linked), we can't compute variance.
  const variance =
    theoretical > 0 && issued !== null ? ((issued - theoretical) / theoretical) * 100 : 0
  const over = issued !== null && Math.abs(variance) > 5
  const issuedDisplay = issued === null ? '—' : `${issued.toFixed(2)} ${uom}`
  const varianceDisplay =
    issued === null ? '—' : `${variance >= 0 ? '+' : ''}${variance.toFixed(1)}%`
  return (
    <div
      className={cn(
        'rounded border p-2',
        over ? 'border-red-500/40 bg-red-500/5' : 'border-[var(--pane-divider)]'
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-medium">{mat}</span>
        {over ? (
          <AlertTriangle className="h-3 w-3 text-red-500" />
        ) : issued === null ? (
          <span className="text-muted-foreground text-[9px]">no MIN data</span>
        ) : (
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div>
          <div className="text-muted-foreground">Theoretical</div>
          <div className="font-mono font-medium">
            {theoretical.toFixed(2)} {uom}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Issued (MIN)</div>
          <div className="font-mono font-medium">{issuedDisplay}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Variance</div>
          <div className={cn('font-mono font-medium', over && 'text-red-500')}>
            {varianceDisplay}
          </div>
        </div>
      </div>
    </div>
  )
}
