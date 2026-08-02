'use client'

// ─── Dashboard KPI strip ─────────────────────────────────────────────────────
// Extracted from the monolithic dashboard.tsx. Renders four KPI cards derived
// from live data passed in via the `live` prop (aggregated from BOQ / tasks /
// CBS by the parent DashboardModule).
//
// NOTE on SPI / CPI / EAC / Margin:
//   True EVM indices (SPI = BCWP/BCWS, CPI = BCWP/ACWP, EAC = BAC/CPI) require
//   week-by-week baseline (BCWS) and earned-value (BCWP) data, which the
//   Omnisite data model does not yet capture. Rather than render fabricated
//   numbers, we show four *proxies* computed from the data we DO have:
//
//     • Schedule Progress — completedTasks / totalTasks × 100  (proxy for SPI)
//     • Cost Variance     — (budget − actual) / budget × 100   (proxy for CPI)
//     • Forecast Cost     — sum of actual CBS rows             (proxy for EAC)
//     • Budget Margin     — (budget − actual) / budget × 100   (proxy for Margin)
//
//   When the underlying data is zero or unavailable, the card shows "—" rather
//   than a fake number. A "Live" pill in each card's top-right communicates
//   that the figure is computed from the current database state.

import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { ArrowRight } from 'lucide-react'
import { type ModuleId } from '@/lib/app-store'

/** Live KPI inputs — sourced from the dashboard's useSyncedState hooks. */
export interface DashboardKpiInput {
  /** Sum of (qty × rate) for non-heading BOQ rows. */
  contractTotal: number
  /** Flattened task count. */
  totalTasks: number
  /** Tasks whose progress >= 100. */
  completedTasks: number
  /** Sum of budget across root CBS nodes. */
  totalBudget: number
  /** Sum of actual across root CBS nodes. */
  totalActual: number
}

export interface DashboardKpi {
  label: string
  value: string
  desc: string
  module: ModuleId
}

/** Format a NPR amount using K/M suffixes for readability in the card. */
function fmtNpr(n: number): string {
  if (n >= 1_000_000) return `NPR ${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `NPR ${(n / 1_000).toFixed(1)}K`
  return `NPR ${n.toFixed(0)}`
}

/** Format a percentage with an explicit + sign on positive values. */
function fmtPct(p: number): string {
  const sign = p > 0 ? '+' : ''
  return `${sign}${p.toFixed(1)}%`
}

function buildKpis(input: DashboardKpiInput): DashboardKpi[] {
  const { totalTasks, completedTasks, totalBudget, totalActual } = input

  // Schedule Progress — proxy for SPI. Zero tasks ⇒ no signal.
  const scheduleProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : null

  // Cost Variance % = (budget − actual) / budget × 100. Zero budget ⇒ N/A.
  const costVariancePct = totalBudget > 0 ? ((totalBudget - totalActual) / totalBudget) * 100 : null

  // Forecast Cost — sum of actual CBS rows. Zero actual ⇒ nothing spent yet.
  const forecastCost = totalActual > 0 ? totalActual : null

  // Budget Margin % = (budget − actual) / budget × 100. Zero budget ⇒ N/A.
  const budgetMarginPct = totalBudget > 0 ? ((totalBudget - totalActual) / totalBudget) * 100 : null

  return [
    {
      label: 'Schedule Progress',
      value: scheduleProgress === null ? '—' : `${scheduleProgress}%`,
      desc: `${completedTasks} of ${totalTasks} tasks complete`,
      module: 'scheduler',
    },
    {
      label: 'Cost Variance',
      value: costVariancePct === null ? '—' : fmtPct(costVariancePct),
      desc: '(budget − actual) / budget',
      module: 'financials',
    },
    {
      label: 'Forecast Cost',
      value: forecastCost === null ? '—' : fmtNpr(forecastCost),
      desc: 'Sum of actual CBS rows',
      module: 'financials',
    },
    {
      label: 'Budget Margin',
      value: budgetMarginPct === null ? '—' : fmtPct(budgetMarginPct),
      desc: '(budget − actual) / budget',
      module: 'financials',
    },
  ]
}

export function KpiStrip({
  onNavigate,
  live,
}: {
  onNavigate: (id: ModuleId) => void
  live: DashboardKpiInput
}) {
  const kpis = buildKpis(live)
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {kpis.map((k, i) => (
        <motion.div
          key={k.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 60, duration: 0.4, ease: 'easeOut' }}
          onClick={() => onNavigate(k.module)}
        >
          <Card className="group hover:border-primary/40 cursor-pointer p-4 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                {k.label}
              </span>
              {/* "Live" pill replaces the previously-fabricated delta/trend.
                  Communicates that the value is computed from the current
                  database state rather than a static seed number. */}
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-emerald-600 uppercase dark:text-emerald-400">
                Live
              </span>
            </div>
            <div className="mt-1 origin-left text-2xl font-bold tracking-tight transition-transform group-hover:scale-[1.02]">
              {k.value}
            </div>
            <div className="text-muted-foreground mt-0.5 flex items-center justify-between text-xs">
              <span>{k.desc}</span>
              <ArrowRight className="text-primary h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}
