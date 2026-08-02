'use client'

import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { PRESETS } from '@/data/seed/admin'

export function PresetsView() {
  return (
    <PaneBody className="space-y-2 p-4">
      {PRESETS.map((p, i) => (
        <div
          key={i}
          className="hover:bg-accent/30 cursor-pointer rounded-lg border border-[var(--pane-divider)] p-3"
          onClick={() =>
            toast.info(
              `Preset ‘${p.name}’ loading coming soon — presets are loaded from the RA Builder.`
            )
          }
          title="Load preset"
        >
          <div className="mb-1 flex items-center justify-between">
            <div className="text-sm font-medium">{p.name}</div>
            <Badge variant="secondary" className="text-[10px]">
              Used {p.used}×
            </Badge>
          </div>
          <div className="text-muted-foreground text-[11px]">
            {p.items} resources · coefficients &amp; logic only
          </div>
        </div>
      ))}
    </PaneBody>
  )
}

export function PresetInspector() {
  return (
    <>
      <PaneHeader title="Preset Inspector" />
      <PaneBody className="text-muted-foreground p-4 text-xs">
        Select a preset to view coefficient details.
      </PaneBody>
    </>
  )
}
