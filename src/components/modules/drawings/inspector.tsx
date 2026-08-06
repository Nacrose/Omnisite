'use client'

import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Link2, History, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Dwg } from './types'
import { DrawingViewer } from './drawing-viewer'

/**
 * DrawingInspector — right-pane detail view for a single drawing.
 *
 * Composes the drawing header (title + status + revision badge), the
 * embedded `DrawingViewer` (real PDF viewer + Fabric.js markup overlay
 * for PDFs; download card for DWG/DXF/ZIP/RAR), and the bi-directional
 * links + revision history sections underneath.
 *
 * The `key={dwg.id}` prop is set by the parent module so page/zoom state
 * inside the viewer resets when switching drawings.
 */
export function DrawingInspector({ dwg }: { dwg: Dwg }) {
  return (
    <>
      <PaneHeader title={`PDF Inspector · ${dwg.number}`} />
      <PaneBody>
        <div className="border-b border-[var(--pane-divider)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {dwg.discipline}
            </Badge>
            <Badge
              variant="secondary"
              className={cn(
                'text-[10px]',
                dwg.status === 'Approved for Construction' &&
                  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                dwg.status === 'Pending' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
              )}
            >
              Rev {dwg.revision} · {dwg.status}
            </Badge>
          </div>
          <div className="text-sm leading-snug font-semibold">{dwg.title}</div>
          <div className="text-muted-foreground mt-1 font-mono text-xs">
            {dwg.number} · {dwg.size} · {dwg.date}
          </div>
        </div>

        {/* Drawing viewer — PDF + markup overlay for PDFs / images;
            download card for DWG / DXF / ZIP / RAR. */}
        <DrawingViewer dwg={dwg} />

        <div className="space-y-3 px-4 pb-4">
          <div>
            <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
              <Link2 className="h-3 w-3" />
              Bi-Directional Links
            </div>
            <div className="space-y-1.5">
              {dwg.links.map((l, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() =>
                    toast.info('Drawing links coming soon', {
                      description: 'Connect drawings to BOQ items, tasks, and NCRs.',
                    })
                  }
                  className="hover:bg-accent/30 flex w-full cursor-pointer items-center gap-2 rounded border border-[var(--pane-divider)] p-1.5 text-left text-xs"
                  title="Open link (coming soon)"
                >
                  <Badge variant="outline" className="text-[10px]">
                    {l.type}
                  </Badge>
                  <span className="flex-1 truncate">{l.ref}</span>
                  <Eye className="text-muted-foreground h-3 w-3" />
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
              <History className="h-3 w-3" />
              Revision History
            </div>
            <div className="space-y-1.5">
              {dwg.history
                .slice()
                .reverse()
                .map((h, i) => (
                  <div key={i} className="flex gap-2.5 text-xs">
                    <div
                      className={cn(
                        'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                        i === 0
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground'
                      )}
                    >
                      {h.rev}
                    </div>
                    <div className="-ml-3.5 flex-1 border-l-2 border-[var(--pane-divider)] pb-2 pl-3">
                      <div className="font-medium">Revision {h.rev}</div>
                      <div className="text-muted-foreground text-[10px]">{h.date}</div>
                      <div className="mt-0.5 text-[11px]">{h.note}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </PaneBody>
    </>
  )
}
