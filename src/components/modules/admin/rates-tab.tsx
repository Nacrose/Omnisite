'use client'

import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Edit3 } from 'lucide-react'
import { toast } from 'sonner'
import { MATERIALS } from './types'

// Tier 1 org baseline rates by district — read-only reference rows.
const TIER1_DISTRICT_RATES = [
  { dist: 'Kathmandu', cement: 918, sand: 3850, agg: 2950 },
  { dist: 'Lalitpur', cement: 925, sand: 3920, agg: 2980 },
  { dist: 'Bhaktapur', cement: 920, sand: 3870, agg: 2960 },
]

export function RatesView() {
  return (
    <PaneBody className="space-y-3 p-4">
      <div className="overflow-hidden rounded-lg border border-[var(--pane-divider)]">
        <div className="bg-secondary/30 text-muted-foreground px-3 py-2 text-xs font-semibold tracking-wider uppercase">
          Tier 1 · Org Baselines (District Rates · Read-only)
        </div>
        <div className="space-y-1.5 p-3">
          {TIER1_DISTRICT_RATES.map((r) => (
            <div
              key={r.dist}
              className="bg-secondary/20 grid grid-cols-4 gap-2 rounded p-1.5 text-xs"
            >
              <span className="font-medium">{r.dist}</span>
              <span className="text-right font-mono">NPR {r.cement}</span>
              <span className="text-right font-mono">NPR {r.sand}</span>
              <span className="text-right font-mono">NPR {r.agg}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--pane-divider)]">
        <div className="bg-secondary/30 text-muted-foreground flex items-center justify-between px-3 py-2 text-xs font-semibold tracking-wider uppercase">
          Tier 2 · Project Rate Library (snapshot · PM-editable inline)
          <Button
            size="sm"
            variant="ghost"
            className="h-6 gap-1 text-[10px]"
            onClick={() =>
              toast.info('Inline rate editing coming soon — use the BOQ Rate Analysis inspector.')
            }
            title="Inline edit in RA Builder"
          >
            <Edit3 className="h-3 w-3" />
            Inline edit in RA Builder
          </Button>
        </div>
        <div className="space-y-1.5 p-3">
          {MATERIALS.slice(0, 3).map((m) => (
            <div
              key={m.code}
              className="flex items-center gap-2 rounded border border-[var(--pane-divider)] p-1.5 text-xs"
            >
              <span className="text-muted-foreground w-24 font-mono text-[10px]">{m.code}</span>
              <span className="flex-1">{m.name}</span>
              <span className="text-muted-foreground line-through">NPR {m.rate}</span>
              <Input
                className="h-7 w-24 font-mono text-xs"
                defaultValue={(m.projectRate ?? m.rate).toLocaleString()}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--pane-divider)]">
        <div className="bg-secondary/30 text-muted-foreground px-3 py-2 text-xs font-semibold tracking-wider uppercase">
          Tier 3 · RA Preset Library (coefficients only · current rates fetched on load)
        </div>
        <div className="text-muted-foreground p-3 text-[11px]">
          See Presets tab. Loading a preset fetches current Project Rates dynamically — preset
          stores only coefficients and logic.
        </div>
      </div>
    </PaneBody>
  )
}

export function RateInspector() {
  return (
    <>
      <PaneHeader title="Rate Library Inspector" />
      <PaneBody className="text-muted-foreground p-4 text-xs">
        Select a rate tier to inspect.
      </PaneBody>
    </>
  )
}
