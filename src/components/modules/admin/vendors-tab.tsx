'use client'

import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useColumnVisibility,
  ColumnToggle,
  StickyTableShell,
  StickyTableHeader,
  StickyTableBody,
  type ColumnDef,
} from '@/components/ui/table-utils'
import { MATERIALS, VENDORS, type Vendor } from './types'

export function VendorsView({
  selectedVendor,
  onSelectVendor,
  searchQuery,
}: {
  selectedVendor: Vendor
  onSelectVendor: (v: Vendor) => void
  searchQuery: string
}) {
  const q = searchQuery.toLowerCase()
  const filtered = VENDORS.filter(
    (v) => v.name.toLowerCase().includes(q) || v.id.toLowerCase().includes(q)
  )
  const COLS: ColumnDef[] = [
    { key: 'id', label: 'ID' },
    { key: 'vendor', label: 'Vendor' },
    { key: 'pan', label: 'PAN' },
    { key: 'rating', label: 'Rating' },
    { key: 'brand', label: 'Brand / Material' },
    { key: 'compliance', label: 'Compliance' },
  ]
  const { visible, isVisible, toggle } = useColumnVisibility(
    COLS.map((c) => c.key),
    [],
    'admin-vendors'
  )
  return (
    <StickyTableShell minWidth={700}>
      <StickyTableHeader>
        {isVisible('id') && <div className="w-16 px-2">ID</div>}
        {isVisible('vendor') && <div className="flex-1 px-2">Vendor</div>}
        {isVisible('pan') && <div className="w-28 px-2">PAN</div>}
        {isVisible('rating') && <div className="w-20 px-2 text-center">Rating</div>}
        {isVisible('brand') && <div className="w-32 px-2">Brand / Material</div>}
        {isVisible('compliance') && <div className="w-16 px-2 text-center">Compliance</div>}
        <div className="flex-shrink-0 pr-2">
          <ColumnToggle columns={COLS} visible={visible} onToggle={toggle} />
        </div>
      </StickyTableHeader>
      <StickyTableBody>
        {filtered.map((v) => (
          <div
            key={v.id}
            onClick={() => onSelectVendor(v)}
            className={cn(
              'row-hover flex h-10 cursor-pointer items-center border-b border-[var(--pane-divider)] text-xs transition-colors',
              selectedVendor.id === v.id && 'bg-accent border-l-primary border-l-2'
            )}
          >
            {isVisible('id') && (
              <div className="text-muted-foreground w-16 px-2 font-mono">{v.id}</div>
            )}
            {isVisible('vendor') && <div className="flex-1 px-2 font-medium">{v.name}</div>}
            {isVisible('pan') && (
              <div className="text-muted-foreground w-28 px-2 font-mono text-[10px]">{v.pan}</div>
            )}
            {isVisible('rating') && (
              <div className="w-20 px-2 text-center">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px]',
                    v.rating.startsWith('A') &&
                      'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
                    v.rating.startsWith('B') &&
                      'border-amber-500/40 text-amber-700 dark:text-amber-300'
                  )}
                >
                  {v.rating}
                </Badge>
              </div>
            )}
            {isVisible('brand') && <div className="w-32 truncate px-2 text-[10px]">{v.brand}</div>}
            {isVisible('compliance') && (
              <div className="w-16 px-2 text-center">
                <ShieldCheck className="mx-auto h-4 w-4 text-emerald-500" />
              </div>
            )}
          </div>
        ))}
      </StickyTableBody>
    </StickyTableShell>
  )
}

export function VendorInspector({ vendor: v }: { vendor: Vendor }) {
  return (
    <>
      <PaneHeader title="Vendor Inspector" />
      <PaneBody className="space-y-3 p-4 text-xs">
        <div>
          <Badge variant="outline" className="text-[10px]">
            AVL · Approved
          </Badge>
          <div className="mt-2 text-sm font-semibold">{v.name}</div>
          <div className="text-muted-foreground font-mono text-[10px]">{v.id}</div>
        </div>
        <Separator />
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">PAN</span>
            <span className="font-mono">{v.pan}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">GST</span>
            <span className="font-mono">{v.gst}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rating</span>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px]',
                v.rating.startsWith('A') &&
                  'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
                v.rating.startsWith('B') && 'border-amber-500/40 text-amber-700 dark:text-amber-300'
              )}
            >
              {v.rating}
            </Badge>
          </div>
        </div>
        <Separator />
        <div>
          <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
            Material Catalog Mapping
          </div>
          <div className="space-y-1.5">
            {v.materials.map((mc) => {
              const mat = MATERIALS.find((m) => m.code === mc)
              return (
                <div
                  key={mc}
                  className="flex items-center justify-between rounded border border-[var(--pane-divider)] p-2"
                >
                  <span className="text-muted-foreground font-mono text-[10px]">{mc}</span>
                  <span className="text-xs">{mat?.name ?? mc}</span>
                  <span className="font-mono">
                    NPR {(mat?.projectRate ?? mat?.rate ?? 0).toLocaleString()}
                  </span>
                </div>
              )
            })}
            <div className="text-muted-foreground text-[10px]">Brand: {v.brand}</div>
          </div>
        </div>
      </PaneBody>
    </>
  )
}
