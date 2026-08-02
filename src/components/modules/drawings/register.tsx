'use client'

import { Badge } from '@/components/ui/badge'
import {
  useColumnVisibility,
  ColumnToggle,
  StickyTableShell,
  StickyTableHeader,
  StickyTableBody,
  type ColumnDef,
} from '@/components/ui/table-utils'
import { cn } from '@/lib/utils'
import type { Dwg } from './types'

/**
 * DrawingsRegister — center-pane table listing all drawings matching the
 * active discipline/search filter.
 *
 * Each row is a button that sets the parent module's `selectedId`, which
 * drives the right-pane DrawingInspector. The column set is user-togglable
 * via the ColumnToggle control anchored to the right of the header row;
 * column-visibility state is owned here (persisted via useColumnVisibility
 * under the 'drawings-register' namespace) so it survives remounts.
 */
export function DrawingsRegister({
  drawings,
  selectedId,
  onSelectId,
}: {
  drawings: Dwg[]
  selectedId: string
  onSelectId: (id: string) => void
}) {
  const COLS: ColumnDef[] = [
    { key: 'number', label: 'Number' },
    { key: 'title', label: 'Title' },
    { key: 'discipline', label: 'Discipline' },
    { key: 'rev', label: 'Rev' },
    { key: 'size', label: 'Size' },
    { key: 'status', label: 'Status' },
  ]
  const { visible, isVisible, toggle } = useColumnVisibility(
    COLS.map((c) => c.key),
    [],
    'drawings-register'
  )

  return (
    <StickyTableShell minWidth={680}>
      <StickyTableHeader>
        {isVisible('number') && <div className="w-32 px-2">Number</div>}
        {isVisible('title') && <div className="flex-1 px-2">Title</div>}
        {isVisible('discipline') && <div className="w-16 px-2">Discipline</div>}
        {isVisible('rev') && <div className="w-20 px-2">Rev</div>}
        {isVisible('size') && <div className="w-12 px-2">Size</div>}
        {isVisible('status') && <div className="w-24 px-2">Status</div>}
        <div className="flex-shrink-0 pr-2">
          <ColumnToggle columns={COLS} visible={visible} onToggle={toggle} />
        </div>
      </StickyTableHeader>
      <StickyTableBody>
        {drawings.length === 0 ? (
          <div className="text-muted-foreground flex items-center justify-center py-12 text-xs">
            No drawings match this filter.
          </div>
        ) : (
          drawings.map((d) => (
            <button
              key={d.id}
              onClick={() => onSelectId(d.id)}
              className={cn(
                'hover:bg-accent/50 flex h-10 w-full items-center border-b border-[var(--pane-divider)] text-left text-xs transition-colors',
                selectedId === d.id && 'bg-accent border-l-primary border-l-2'
              )}
            >
              {isVisible('number') && (
                <div className="text-muted-foreground w-32 px-2 font-mono">{d.number}</div>
              )}
              {isVisible('title') && (
                <div className="flex-1 truncate px-2 font-medium">{d.title}</div>
              )}
              {isVisible('discipline') && (
                <div className="text-muted-foreground w-16 px-2">{d.discipline}</div>
              )}
              {isVisible('rev') && <div className="w-20 px-2 font-mono">{d.revision}</div>}
              {isVisible('size') && <div className="w-12 px-2">{d.size}</div>}
              {isVisible('status') && (
                <div className="w-24 px-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[9px]',
                      d.status === 'Approved for Construction' &&
                        'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
                      d.status === 'Pending' &&
                        'border-amber-500/40 text-amber-700 dark:text-amber-300'
                    )}
                  >
                    {d.status === 'Approved for Construction' ? 'AFC' : d.status}
                  </Badge>
                </div>
              )}
            </button>
          ))
        )}
      </StickyTableBody>
    </StickyTableShell>
  )
}
