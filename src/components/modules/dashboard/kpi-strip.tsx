'use client'

// ─── Dashboard KPI strip ─────────────────────────────────────────────────────
// Extracted from the monolithic dashboard.tsx. Renders the four KPI cards
// (SPI / CPI / EAC / Margin) in a responsive grid. Each card is clickable
// and routes to the relevant module via the onNavigate callback.

import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { type ModuleId } from '@/lib/app-store'

export interface DashboardKpi {
  label: string
  value: string
  delta: string
  trend: 'up' | 'down'
  desc: string
  module: ModuleId
  /** When true, a negative delta is good (e.g. EAC). */
  invertColor?: boolean
}

const KPIs: DashboardKpi[] = [
  {
    label: 'SPI',
    value: '0.97',
    delta: '-0.03',
    trend: 'down',
    desc: 'Schedule Performance',
    module: 'scheduler',
  },
  {
    label: 'CPI',
    value: '1.04',
    delta: '+0.02',
    trend: 'up',
    desc: 'Cost Performance',
    module: 'financials',
  },
  {
    label: 'EAC',
    value: 'NPR 487.2M',
    delta: '-12.4M',
    trend: 'down',
    desc: 'Estimate at Completion (lower is better)',
    module: 'financials',
    invertColor: true,
  },
  {
    label: 'Margin',
    value: '14.8%',
    delta: '+0.6%',
    trend: 'up',
    desc: 'Project gross margin',
    module: 'financials',
  },
]

export function KpiStrip({ onNavigate }: { onNavigate: (id: ModuleId) => void }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {KPIs.map((k, i) => (
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
              <span
                className={`flex items-center gap-0.5 text-xs font-medium ${(k.invertColor ? k.delta.startsWith('-') : k.trend === 'up') ? 'delta-up' : 'delta-down'}`}
              >
                {k.trend === 'up' ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {k.delta}
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
