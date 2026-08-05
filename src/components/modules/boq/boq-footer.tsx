'use client'

import type { BoqItem } from './types'

interface BoqFooterProps {
  /** Flattened BOQ items (for counting line items by type). */
  allFlat: BoqItem[]
  /** Live contract total (sum of qty × rate for leaf non-heading items). */
  contractTotal: number
}

/**
 * BOQ grid footer — contract summary stats.
 *
 * Shows: line item count, priced count, PS count, daywork count, and the
 * live contract total (NPR).
 *
 * Extracted from `BoqModule` so the component body focuses on layout.
 */
export function BoqFooter({ allFlat, contractTotal }: BoqFooterProps) {
  return (
    <div className="text-muted-foreground bg-secondary/30 flex h-9 items-center gap-4 border-t border-[var(--pane-divider)] px-4 text-xs">
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        {allFlat.filter((i) => i.type !== 'Heading').length} line items · live totals
      </span>
      <span className="text-muted-foreground/50">·</span>
      <span>{allFlat.filter((i) => i.type === 'Priced').length} priced</span>
      <span className="text-muted-foreground/50">·</span>
      <span>{allFlat.filter((i) => i.type === 'Provisional Sum').length} PS</span>
      <span className="text-muted-foreground/50">·</span>
      <span>{allFlat.filter((i) => i.type === 'Daywork').length} daywork</span>
      <div className="flex-1" />
      <span>
        Contract Total:{' '}
        <span className="text-foreground font-mono font-bold tabular-nums">
          NPR {contractTotal.toLocaleString()}
        </span>
      </span>
    </div>
  )
}
