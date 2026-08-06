'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, X, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RaRow } from './ra-types'

/**
 * A resource section (Materials / Labour / Equipment) in the RA builder.
 *
 * Renders a list of editable rows (name, code, UOM, qty, rate) with an
 * Add button and a section subtotal.
 *
 * Extracted from ra-inspector.tsx so the main component focuses on layout
 * + cost calculation.
 */
export function RaSection({
  title,
  icon,
  rows,
  itemUom,
  onUpdate,
  onAdd,
  onDelete,
  onAddFromLibrary,
}: {
  title: string
  icon: React.ReactNode
  rows: RaRow[]
  /** UOM of the BOQ item this section belongs to — used in the subtotal
   *  label so the per-unit cost is shown against the right unit. Previously
   *  this used the first resource row's UOM, which is wrong: a 'cum' BOQ
   *  item can have 'Bag' cement and 'day' labour rows, and the subtotal
   *  shouldn't inherit either of those. */
  itemUom: string
  onUpdate: (index: number, field: keyof RaRow, value: string | number) => void
  /** Append a blank row to the section's array. */
  onAdd: () => void
  /** Remove the row at the given index. */
  onDelete: (index: number) => void
  /** Open the material library picker (materials section only). */
  onAddFromLibrary?: () => void
}) {
  const sectionTotal = rows.reduce((s, r) => s + r.qty * r.rate, 0)
  return (
    <div className="border-b border-[var(--pane-divider)] px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
          {icon}
          {title}
        </div>
        <div className="flex items-center gap-1">
          {onAddFromLibrary && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-xs"
              onClick={onAddFromLibrary}
            >
              <Search className="h-3 w-3" />
              Library
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={onAdd}>
            <Plus className="h-3 w-3" />
            Add
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        {rows.length === 0 && (
          <div className="text-muted-foreground rounded-md border border-dashed border-[var(--pane-divider)] px-2 py-3 text-center text-[11px]">
            No {title.toLowerCase()} rows yet — click <span className="font-medium">Add</span> to
            create one.
          </div>
        )}
        {rows.map((r, i) => (
          <div
            key={r.id}
            className="hover:bg-accent/40 grid grid-cols-12 items-center gap-1.5 rounded p-1.5 text-xs"
          >
            {/* Name + source — name is an inline input so the user can fill
                in newly-added blank rows without a separate edit affordance. */}
            <div className="col-span-4">
              <Input
                className="h-6 px-1 text-xs"
                value={r.name}
                placeholder="Resource name"
                onChange={(e) => onUpdate(i, 'name', e.target.value)}
              />
              <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[10px]">
                <span className="font-mono">{r.code || '—'}</span>
                <span>·</span>
                <span>{r.source || 'Manual'}</span>
              </div>
            </div>
            {/* Code — also editable inline for new rows. */}
            <Input
              className="col-span-2 h-6 px-1 font-mono text-xs"
              value={r.code}
              placeholder="Code"
              onChange={(e) => onUpdate(i, 'code', e.target.value)}
            />
            {/* UOM — short text input. Tight on width but adequate for the
                typical DoR units (Bag, cum, day, hr, ltr). */}
            <Input
              className="col-span-1 h-6 px-1 text-xs"
              value={r.uom}
              placeholder="UOM"
              onChange={(e) => onUpdate(i, 'uom', e.target.value)}
            />
            <Input
              className="col-span-2 h-6 px-1 text-xs"
              type="number"
              // Use `|| ''` so the input shows empty (not 0) when cleared —
              // same pattern as the pct cost inputs (audit B6-5).
              value={r.qty || ''}
              placeholder="0"
              onChange={(e) => onUpdate(i, 'qty', parseFloat(e.target.value) || 0)}
            />
            <div className="col-span-2 flex items-center gap-0.5">
              <Input
                className="h-6 flex-1 px-1 font-mono text-xs"
                type="number"
                value={r.rate || ''}
                placeholder="0"
                onChange={(e) => onUpdate(i, 'rate', parseFloat(e.target.value) || 0)}
              />
              <button
                className="text-muted-foreground rounded p-0.5 hover:text-red-500"
                title={`Remove ${r.name || 'row'}`}
                onClick={() => onDelete(i)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-[var(--pane-divider)] pt-2 text-xs">
        <span className="text-muted-foreground">Section subtotal ({rows.length} resources)</span>
        <span className="font-mono font-semibold">
          NPR {sectionTotal.toFixed(0)}/{itemUom || 'unit'}
        </span>
      </div>
    </div>
  )
}

/**
 * A label/value row in the financial summary.
 */
export function SummaryRow({
  label,
  value,
  muted,
  bold,
}: {
  label: string
  value: string
  muted?: boolean
  bold?: boolean
}) {
  return (
    <div className="flex justify-between">
      <span className={cn(muted && 'text-muted-foreground', bold && 'font-semibold')}>{label}</span>
      <span className={cn('font-mono', bold && 'font-semibold')}>{value}</span>
    </div>
  )
}
