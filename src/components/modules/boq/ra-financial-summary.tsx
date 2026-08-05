'use client'

import { Separator } from '@/components/ui/separator'
import { TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SummaryRow } from './ra-section'
import type { RaCostResult } from './ra-cost-calc'

interface RaFinancialSummaryProps {
  costs: RaCostResult
  contractRate: number
  itemUom: string
}

/**
 * Financial Summary & Margin section of the RA builder.
 *
 * Shows: Direct Cost, % Costs, O&P, Total RA Cost, Contract BOQ Rate, Actual
 * Gross Margin (with trending icon + color), per-unit margin, and a visual
 * cost/margin bar.
 *
 * Extracted from ra-inspector.tsx so the main component focuses on layout.
 */
export function RaFinancialSummary({ costs, contractRate, itemUom }: RaFinancialSummaryProps) {
  const {
    directCost,
    pctCostBase,
    overheadAmount,
    totalCost,
    margin,
    marginPct,
    costBarPct,
    marginBarPct,
  } = costs

  return (
    <div className="bg-secondary/30 px-4 py-3">
      <div className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
        Financial Summary & Margin
        <span className="text-primary/70 text-[10px] font-normal tracking-normal normal-case">
          · recalculates live
        </span>
      </div>
      <div className="space-y-1.5 text-xs">
        <SummaryRow label="Direct Cost" value={`NPR ${directCost.toFixed(0)}`} />
        <SummaryRow label="% Costs" value={`NPR ${pctCostBase.toFixed(0)}`} muted />
        <SummaryRow label="O&P" value={`NPR ${overheadAmount.toFixed(0)}`} muted />
        <Separator className="my-2" />
        <SummaryRow label="Total RA Cost" value={`NPR ${totalCost.toFixed(0)}`} bold />
        <SummaryRow label="Contract BOQ Rate" value={`NPR ${contractRate.toLocaleString()}`} bold />
        <Separator className="my-2" />
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <TrendingUp className={cn('h-3.5 w-3.5', margin >= 0 ? 'delta-up' : 'delta-down')} />
            Actual Gross Margin
          </span>
          <span
            className={cn(
              'font-mono font-bold tabular-nums',
              margin >= 0 ? 'delta-up' : 'delta-down'
            )}
          >
            {marginPct >= 0 ? '+' : ''}
            {marginPct.toFixed(1)}%
          </span>
        </div>
        <div className="text-muted-foreground pl-5 text-[10px]">
          Margin per {itemUom}: NPR{' '}
          <span className="font-mono tabular-nums">{margin.toFixed(0)}</span> · No double-count of
          RA O&P
        </div>
        {/* Visual margin bar */}
        <div className="mt-2 border-t border-[var(--pane-divider)] pt-2">
          <div className="text-muted-foreground mb-1 flex items-center justify-between text-[10px]">
            <span>Cost</span>
            <span>Margin</span>
          </div>
          <div className="bg-secondary flex h-2 overflow-hidden rounded-full">
            <div
              className="bg-amber-500/70 transition-all duration-300"
              style={{ width: `${costBarPct}%` }}
            />
            <div
              className={cn(
                'transition-all duration-300',
                margin >= 0 ? 'bg-emerald-500/70' : 'bg-red-500/70'
              )}
              style={{ width: `${marginBarPct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px]">
            <span className="font-mono text-amber-600">NPR {totalCost.toFixed(0)}</span>
            <span className={cn('font-mono', margin >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {margin >= 0 ? '+' : ''}NPR {margin.toFixed(0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
