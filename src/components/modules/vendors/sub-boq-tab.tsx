'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Layers, Mountain, AlertTriangle, X, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Subcontractor, ScItem, ItemType } from './types'
import { fmtNPR } from './types'

// ─── Sub-BOQ Tab (composite + conditional items + mapping) ───────────────────

export function SubBoqTab({
  sc,
  onAddItem,
}: {
  sc: Subcontractor
  /** Called when the user saves the Add SC BOQ Item form. The parent
   *  maps the new ScItem into the vendor's workItems array. */
  onAddItem?: (item: ScItem) => void
}) {
  const compositeItems = sc.items.filter((i) => i.type === 'composite')
  const conditionalItems = sc.items.filter((i) => i.type === 'conditional')
  const earned = sc.items.reduce((sum, it) => sum + it.actualQty * it.rate, 0)

  // Add-item modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [draft, setDraft] = useState<{
    code: string
    desc: string
    uom: string
    rate: string
    plannedQty: string
    type: ItemType
  }>({
    code: '',
    desc: '',
    uom: 'cum',
    rate: '',
    plannedQty: '',
    type: 'composite',
  })

  const openModal = () => {
    setDraft({
      code: '',
      desc: '',
      uom: 'cum',
      rate: '',
      plannedQty: '',
      type: 'composite',
    })
    setModalOpen(true)
  }

  const canSave =
    draft.code.trim().length > 0 &&
    draft.desc.trim().length > 0 &&
    draft.uom.trim().length > 0 &&
    draft.rate.trim() !== '' &&
    !Number.isNaN(Number(draft.rate))

  const handleSave = () => {
    if (!canSave) return
    const newItem: ScItem = {
      id: `SC-${Date.now().toString(36)}`,
      code: draft.code.trim(),
      desc: draft.desc.trim(),
      uom: draft.uom.trim(),
      rate: Number(draft.rate),
      plannedQty: draft.plannedQty.trim() === '' ? 0 : Number(draft.plannedQty),
      actualQty: 0,
      type: draft.type,
    }
    onAddItem?.(newItem)
    toast.success('SC BOQ item added', {
      description: `${newItem.code} · ${newItem.desc} · ${fmtNPR(newItem.rate)}/${newItem.uom}`,
    })
    setModalOpen(false)
  }

  return (
    <div className="space-y-4 p-4 text-xs">
      {/* Earned value summary */}
      <div className="bg-secondary/40 rounded-md p-2.5">
        <div className="text-muted-foreground text-[10px]">
          Total Earned Value (SC BOQ actuals × SC rates)
        </div>
        <div className="mt-0.5 text-lg font-bold tabular-nums">{fmtNPR(earned)}</div>
      </div>

      {/* Composite items */}
      <div>
        <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
          <Layers className="h-3 w-3" /> Composite Items ({compositeItems.length})
        </div>
        <div className="space-y-2">
          {compositeItems.map((it) => {
            const earnedItem = it.actualQty * it.rate
            const progress = it.plannedQty > 0 ? (it.actualQty / it.plannedQty) * 100 : 0
            return (
              <div
                key={it.id}
                className="overflow-hidden rounded-md border border-[var(--pane-divider)]"
              >
                <div className="p-2.5">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-muted-foreground font-mono text-[10px]">{it.code}</span>
                    <Badge variant="outline" className="text-[9px]">
                      {it.type}
                    </Badge>
                  </div>
                  <div className="text-xs font-medium">{it.desc}</div>
                  <div className="text-muted-foreground mt-1 flex items-center gap-3 text-[10px]">
                    <span>
                      Rate:{' '}
                      <span className="text-foreground font-mono">
                        {fmtNPR(it.rate)}/{it.uom}
                      </span>
                    </span>
                    <span>·</span>
                    <span>
                      Planned:{' '}
                      <span className="text-foreground font-mono">
                        {it.plannedQty > 0 ? it.plannedQty : 'Variable'} {it.uom}
                      </span>
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="bg-secondary h-1.5 flex-1 overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground font-mono text-[10px] whitespace-nowrap">
                      {it.actualQty} / {it.plannedQty > 0 ? it.plannedQty : '?'} {it.uom}
                      {it.plannedQty > 0 && ` (${progress.toFixed(0)}%)`}
                    </span>
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10px]">
                    <span className="text-muted-foreground">
                      Earned:{' '}
                      <span className="text-foreground font-mono font-medium">
                        {fmtNPR(earnedItem)}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Mapping table */}
                {it.mapping && it.mapping.length > 0 && (
                  <div className="bg-secondary/20 border-t border-[var(--pane-divider)] p-2.5">
                    <div className="text-muted-foreground mb-1.5 text-[9px] font-semibold tracking-wider uppercase">
                      Mapping → Main BOQ (coefficients per {it.uom})
                    </div>
                    <div className="space-y-1">
                      {it.mapping.map((m, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px]">
                          <span className="text-muted-foreground w-12 font-mono">{m.boqCode}</span>
                          <span className="flex-1 truncate">{m.boqDesc}</span>
                          <span className="text-muted-foreground font-mono">×{m.coefficient}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="w-16 text-right font-mono font-medium">
                            {(m.coefficient * it.actualQty).toFixed(2)} {m.uom}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="text-muted-foreground mt-1.5 border-t border-[var(--pane-divider)] pt-1.5 text-[9px]">
                      Derived BOQ quantities shown for {it.actualQty} {it.uom} actual completion
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Conditional items (tunneling) */}
      {conditionalItems.length > 0 && (
        <div>
          <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
            <Mountain className="h-3 w-3" /> Conditional Support Items ({conditionalItems.length})
          </div>
          <div className="text-muted-foreground mb-2 rounded-md border border-violet-500/30 bg-violet-500/10 p-2 text-[10px]">
            These items have 0 planned quantity — activated by face log entries. Payment is per
            actual installation.
          </div>
          <div className="space-y-1.5">
            {conditionalItems.map((it) => {
              const earnedItem = it.actualQty * it.rate
              const designQty = it.designPattern ? it.designPattern * 42.5 : 0 // 42.5 = total rm advanced
              const variance = it.actualQty - designQty
              const variancePct = designQty > 0 ? (variance / designQty) * 100 : 0
              const overSupport = variance > 0
              return (
                <div key={it.id} className="rounded-md border border-[var(--pane-divider)] p-2.5">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-muted-foreground font-mono text-[10px]">{it.code}</span>
                    <Badge
                      variant="secondary"
                      className="bg-violet-500/15 text-[9px] text-violet-700 dark:text-violet-300"
                    >
                      {it.rockClass}
                    </Badge>
                  </div>
                  <div className="text-xs font-medium">{it.desc}</div>
                  <div className="text-muted-foreground mt-1 flex items-center gap-3 text-[10px]">
                    <span>
                      Rate:{' '}
                      <span className="text-foreground font-mono">
                        {fmtNPR(it.rate)}/{it.uom}
                      </span>
                    </span>
                    <span>·</span>
                    <span>
                      Design:{' '}
                      <span className="text-foreground font-mono">
                        {it.designPattern}/{it.uom}/rm
                      </span>
                    </span>
                  </div>
                  {/* Variance row */}
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                    <div className="bg-secondary/40 rounded p-1.5 text-center">
                      <div className="text-muted-foreground">Design Qty</div>
                      <div className="font-mono font-medium">
                        {designQty.toFixed(1)} {it.uom}
                      </div>
                    </div>
                    <div className="bg-secondary/40 rounded p-1.5 text-center">
                      <div className="text-muted-foreground">Actual</div>
                      <div className="font-mono font-medium">
                        {it.actualQty} {it.uom}
                      </div>
                    </div>
                    <div
                      className={cn(
                        'rounded p-1.5 text-center',
                        overSupport ? 'bg-amber-500/10' : 'bg-emerald-500/10'
                      )}
                    >
                      <div className="text-muted-foreground">Variance</div>
                      <div
                        className={cn(
                          'font-mono font-bold',
                          overSupport ? 'text-amber-600' : 'text-emerald-600'
                        )}
                      >
                        {variance >= 0 ? '+' : ''}
                        {variance.toFixed(1)} ({variancePct >= 0 ? '+' : ''}
                        {variancePct.toFixed(0)}%)
                      </div>
                    </div>
                  </div>
                  {overSupport && (
                    <div className="mt-1.5 flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-1.5 text-[10px]">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0 text-amber-500" />
                      <span>
                        Over-support detected — RFI required for consultant approval before billing
                      </span>
                    </div>
                  )}
                  <div className="mt-1.5 flex justify-between text-[10px]">
                    <span className="text-muted-foreground">
                      Earned:{' '}
                      <span className="text-foreground font-mono font-medium">
                        {fmtNPR(earnedItem)}
                      </span>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        className="h-8 w-full gap-1.5 text-xs"
        onClick={openModal}
        title="Add SC BOQ Item"
      >
        <Plus className="h-3.5 w-3.5" />
        Add SC BOQ Item
      </Button>

      {/* Add SC BOQ Item modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sc-boq-add-title"
            className="pane w-full max-w-md overflow-hidden rounded-xl border border-[var(--pane-divider)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-primary/5 flex h-12 items-center justify-between border-b border-[var(--pane-divider)] px-4">
              <div className="flex items-center gap-2">
                <Layers className="text-primary h-4 w-4" />
                <span id="sc-boq-add-title" className="text-sm font-semibold">
                  Add SC BOQ Item
                </span>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="hover:bg-accent text-muted-foreground rounded p-1"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
              <div>
                <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Code
                </label>
                <Input
                  className="mt-1 h-8 text-xs"
                  placeholder="e.g. SC-DRAIN-001"
                  value={draft.code}
                  onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Description
                </label>
                <Input
                  className="mt-1 h-8 text-xs"
                  placeholder="e.g. Drain construction per RMT"
                  value={draft.desc}
                  onChange={(e) => setDraft((d) => ({ ...d, desc: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    UOM
                  </label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    placeholder="cum / RMT / MT"
                    value={draft.uom}
                    onChange={(e) => setDraft((d) => ({ ...d, uom: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Rate (NPR)
                  </label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    type="number"
                    placeholder="0"
                    value={draft.rate}
                    onChange={(e) => setDraft((d) => ({ ...d, rate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Planned Qty
                  </label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    type="number"
                    placeholder="0 (0 = variable)"
                    value={draft.plannedQty}
                    onChange={(e) => setDraft((d) => ({ ...d, plannedQty: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Type
                  </label>
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    {(['composite', 'conditional'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, type: t }))}
                        className={cn(
                          'h-8 rounded border text-[11px] transition-colors',
                          draft.type === t
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'hover:bg-accent border-[var(--pane-divider)]'
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--pane-divider)] p-3">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!canSave} className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Save Item
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
