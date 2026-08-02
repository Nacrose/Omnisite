'use client'

import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Zap, Edit3, Copy, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  useColumnVisibility,
  ColumnToggle,
  StickyTableShell,
  StickyTableHeader,
  StickyTableBody,
  type ColumnDef,
} from '@/components/ui/table-utils'
import { MATERIALS, type Material } from './types'

export function MaterialsView({
  selectedMaterial,
  onSelectMaterial,
  searchQuery,
}: {
  selectedMaterial: Material
  onSelectMaterial: (m: Material) => void
  searchQuery: string
}) {
  const q = searchQuery.toLowerCase()
  const filtered = MATERIALS.filter(
    (m) => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q)
  )
  const COLS: ColumnDef[] = [
    { key: 'code', label: 'Code' },
    { key: 'material', label: 'Material' },
    { key: 'uom', label: 'UOM' },
    { key: 'orgrate', label: 'Org Rate' },
    { key: 'projectrate', label: 'Project Rate' },
    { key: 'tier', label: 'Tier' },
    { key: 'altuom', label: 'Alt UOM' },
  ]
  const { visible, isVisible, toggle } = useColumnVisibility(
    COLS.map((c) => c.key),
    [],
    'admin-materials'
  )
  return (
    <>
      <div className="bg-secondary/20 text-muted-foreground border-b border-[var(--pane-divider)] px-4 py-2 text-[11px]">
        Two-tier system: <span className="text-foreground font-medium">Org Master</span> (district
        rates, read-only) → <span className="text-foreground font-medium">Project List</span>{' '}
        (editable snapshot). Soft-archive only.
      </div>
      <StickyTableShell minWidth={800}>
        <StickyTableHeader>
          {isVisible('code') && <div className="w-28 px-2">Code</div>}
          {isVisible('material') && <div className="flex-1 px-2">Material</div>}
          {isVisible('uom') && <div className="w-16 px-2">UOM</div>}
          {isVisible('orgrate') && <div className="w-28 px-2 text-right">Org Rate</div>}
          {isVisible('projectrate') && <div className="w-28 px-2 text-right">Project Rate</div>}
          {isVisible('tier') && <div className="w-20 px-2">Tier</div>}
          {isVisible('altuom') && <div className="w-16 px-2 text-center">Alt UOM</div>}
          <div className="flex-shrink-0 pr-2">
            <ColumnToggle columns={COLS} visible={visible} onToggle={toggle} />
          </div>
        </StickyTableHeader>
        <StickyTableBody>
          {filtered.map((m) => (
            <div
              key={m.code}
              onClick={() => onSelectMaterial(m)}
              className={cn(
                'row-hover flex h-10 cursor-pointer items-center border-b border-[var(--pane-divider)] text-xs transition-colors',
                m.archived && 'opacity-50',
                selectedMaterial.code === m.code && 'bg-accent border-l-primary border-l-2'
              )}
            >
              {isVisible('code') && (
                <div className="text-muted-foreground w-28 px-2 font-mono">{m.code}</div>
              )}
              {isVisible('material') && (
                <div className="flex flex-1 items-center gap-1.5 px-2 font-medium">
                  {m.archived && (
                    <Badge variant="outline" className="text-[9px]">
                      Archived
                    </Badge>
                  )}
                  {m.name}
                </div>
              )}
              {isVisible('uom') && <div className="text-muted-foreground w-16 px-2">{m.uom}</div>}
              {isVisible('orgrate') && (
                <div className="w-28 px-2 text-right font-mono">{m.rate.toLocaleString()}</div>
              )}
              {isVisible('projectrate') && (
                <div className="text-primary w-28 px-2 text-right font-mono font-medium">
                  {(m.projectRate ?? m.rate).toLocaleString()}
                </div>
              )}
              {isVisible('tier') && (
                <div className="w-20 px-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[9px]',
                      m.org && 'border-sky-500/40 text-sky-700 dark:text-sky-300'
                    )}
                  >
                    {m.org ? 'Org' : 'Project'}
                  </Badge>
                </div>
              )}
              {isVisible('altuom') && (
                <div className="w-16 px-2 text-center">
                  {m.altUoms ? (
                    <Badge variant="secondary" className="text-[9px]">
                      {m.altUoms.length + 1}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </StickyTableBody>
      </StickyTableShell>
    </>
  )
}

export function MaterialInspector({
  material: m,
  onUpdateAltUomRate,
}: {
  material: Material
  /**
   * Fired when the user edits an alt-UOM rate in the inspector. The parent
   * mutates its `selectedMaterial` state (and any backing store) so the
   * change re-renders the inspector immediately. Previously the input used
   * `defaultValue={alt.rate}` with no onChange, so edits were silently
   * discarded on blur.
   */
  onUpdateAltUomRate?: (altIndex: number, rate: number) => void
}) {
  return (
    <>
      <PaneHeader title="Material Inspector" />
      <PaneBody className="space-y-3 p-4 text-xs">
        <div>
          <Badge variant="outline" className="text-[10px]">
            {m.org ? 'Org Master' : 'Project'}
          </Badge>
          {m.archived && (
            <Badge variant="outline" className="ml-1 text-[10px] text-amber-600">
              Archived
            </Badge>
          )}
          <div className="mt-2 text-sm font-semibold">{m.name}</div>
          <div className="text-muted-foreground font-mono text-[10px]">{m.code}</div>
        </div>
        <Separator />
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">UOM</span>
            <span className="font-mono">{m.uom}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Org Rate</span>
            <span className="font-mono">NPR {m.rate.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Project Rate</span>
            <span className="text-primary font-mono font-medium">
              NPR {(m.projectRate ?? m.rate).toLocaleString()}
            </span>
          </div>
        </div>
        {m.altUoms && (
          <>
            <Separator />
            <div>
              <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
                Alternate UOMs
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 rounded border border-[var(--pane-divider)] p-2">
                  <span className="flex-1">{m.uom} (primary)</span>
                  <span className="font-mono">NPR {m.rate.toLocaleString()}</span>
                </div>
                {m.altUoms.map((alt, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded border border-[var(--pane-divider)] p-2"
                  >
                    <span className="flex-1">
                      {alt.uom} (factor {alt.factor})
                    </span>
                    <Input
                      className="h-7 w-24 font-mono text-xs"
                      type="number"
                      value={alt.rate}
                      onChange={(e) => {
                        const num = Number(e.target.value)
                        onUpdateAltUomRate?.(i, Number.isFinite(num) ? num : 0)
                      }}
                    />
                    <button
                      className="hover:bg-accent rounded p-1"
                      onClick={() =>
                        toast.info(
                          'Auto-calc from primary UOM coming soon — enter the converted rate manually.'
                        )
                      }
                      title="Auto-calc (coming soon)"
                    >
                      <Zap className="h-3 w-3 text-amber-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        <Separator />
        <div>
          <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
            Actions
          </div>
          <div className="space-y-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-xs"
              onClick={() => toast.info('Material duplication coming soon.')}
              title="Duplicate material"
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicate
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-xs"
              onClick={() =>
                toast.info('Inline editing coming soon — edit fields directly in the table.')
              }
              title="Edit material"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-xs text-amber-600"
              onClick={() => toast.info('Archive coming soon — set the archived flag via the API.')}
              title="Soft archive material"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Soft Archive (no delete)
            </Button>
          </div>
        </div>
      </PaneBody>
    </>
  )
}
