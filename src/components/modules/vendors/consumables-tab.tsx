'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Subcontractor, ConsumableIssue } from './types'
import { fmtNPR } from './types'
import {
  useColumnVisibility,
  ColumnToggle,
  StickyTableShell,
  StickyTableHeader,
  StickyTableBody,
  type ColumnDef,
} from '@/components/ui/table-utils'

// ─── Consumables Tab ─────────────────────────────────────────────────────────

export function ConsumablesTab({
  sc,
  onAddConsumable,
}: {
  sc: Subcontractor
  /** Called when the user saves the Add Consumable Issue form. The parent
   *  maps the new ConsumableIssue into the vendor's consumables array. */
  onAddConsumable?: (issue: ConsumableIssue) => void
}) {
  const COLS: ColumnDef[] = [
    { key: 'item', label: 'Consumable' },
    { key: 'issued', label: 'Issued' },
    { key: 'norm', label: 'Norm' },
    { key: 'theoretical', label: 'Theoretical' },
    { key: 'variance', label: 'Variance' },
  ]
  const { visible, isVisible, toggle } = useColumnVisibility(
    COLS.map((c) => c.key),
    [],
    'sc-consumables'
  )

  // Add-Consumable modal state
  const [modalOpen, setModalOpen] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const [draft, setDraft] = useState<{
    date: string
    name: string
    uom: string
    qty: string
    rate: string
    normPerUnit: string
    normUnit: string
    normBasis: string
  }>({
    date: today,
    name: '',
    uom: 'kg',
    qty: '',
    rate: '',
    normPerUnit: '',
    normUnit: 'MT',
    normBasis: '',
  })

  const openModal = () => {
    setDraft({
      date: today,
      name: '',
      uom: 'kg',
      qty: '',
      rate: '',
      normPerUnit: '',
      normUnit: 'MT',
      normBasis: '',
    })
    setModalOpen(true)
  }

  // Auto-generate id: CON-YYYYMMDD-NNN
  const generateConId = () => {
    const ymd = draft.date.replace(/-/g, '')
    const count = sc.consumables.filter((c) => c.id.includes(`CON-${ymd}`)).length + 1
    return `CON-${ymd}-${String(count).padStart(3, '0')}`
  }

  const canSave =
    draft.name.trim().length > 0 &&
    draft.uom.trim().length > 0 &&
    draft.qty.trim() !== '' &&
    !Number.isNaN(Number(draft.qty)) &&
    Number(draft.qty) > 0 &&
    draft.rate.trim() !== '' &&
    !Number.isNaN(Number(draft.rate))

  const handleSave = () => {
    if (!canSave) return
    const issue: ConsumableIssue = {
      id: generateConId(),
      date: draft.date,
      name: draft.name.trim(),
      uom: draft.uom.trim(),
      qty: Number(draft.qty),
      rate: Number(draft.rate),
      normPerUnit: draft.normPerUnit.trim() ? Number(draft.normPerUnit) : undefined,
      normUnit: draft.normUnit.trim() || undefined,
      normBasis: draft.normBasis.trim() ? Number(draft.normBasis) : undefined,
    }
    onAddConsumable?.(issue)
    toast.success('Consumable issue added', {
      description: `${issue.id} · ${issue.name} · ${issue.qty} ${issue.uom}`,
    })
    setModalOpen(false)
  }

  return (
    <div className="space-y-3 p-4 text-xs">
      <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        Consumables Tracking (norm-based chargeback)
      </div>

      <div className="rounded-md border border-[var(--pane-divider)]">
        <StickyTableShell minWidth={660}>
          <StickyTableHeader>
            {isVisible('item') && <div className="w-44 px-2">Consumable</div>}
            {isVisible('issued') && <div className="w-24 px-2 text-right">Issued</div>}
            {isVisible('norm') && <div className="w-24 px-2 text-right">Norm</div>}
            {isVisible('theoretical') && <div className="w-24 px-2 text-right">Theoretical</div>}
            {isVisible('variance') && <div className="w-24 px-2 text-right">Variance</div>}
            <div className="flex-shrink-0 pr-2">
              <ColumnToggle columns={COLS} visible={visible} onToggle={toggle} />
            </div>
          </StickyTableHeader>
          <StickyTableBody>
            {sc.consumables.map((c) => {
              const theoretical = c.normPerUnit && c.normBasis ? c.normPerUnit * c.normBasis : 0
              const variance = c.qty - theoretical
              const variancePct = theoretical > 0 ? (variance / theoretical) * 100 : 0
              const overNorm = variance > 0
              return (
                <div
                  key={c.id}
                  className="flex items-center border-t border-[var(--pane-divider)] px-2 py-1.5"
                >
                  {isVisible('item') && (
                    <div className="w-44 min-w-0 px-2">
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="text-muted-foreground text-[10px]">
                        {c.date} · {fmtNPR(c.rate)}/{c.uom}
                      </div>
                    </div>
                  )}
                  {isVisible('issued') && (
                    <div className="w-24 px-2 text-right font-mono">
                      {c.qty} {c.uom}
                    </div>
                  )}
                  {isVisible('norm') && (
                    <div className="text-muted-foreground w-24 px-2 text-right font-mono">
                      {c.normPerUnit ? `${c.normPerUnit}/${c.normUnit}` : '—'}
                    </div>
                  )}
                  {isVisible('theoretical') && (
                    <div className="text-muted-foreground w-24 px-2 text-right font-mono">
                      {theoretical > 0 ? `${theoretical.toFixed(1)} ${c.uom}` : '—'}
                    </div>
                  )}
                  {isVisible('variance') && (
                    <div
                      className={cn(
                        'w-24 px-2 text-right font-mono font-medium',
                        overNorm ? 'text-amber-600' : 'text-emerald-600'
                      )}
                    >
                      {variance >= 0 ? '+' : ''}
                      {variance.toFixed(1)} ({variancePct >= 0 ? '+' : ''}
                      {variancePct.toFixed(0)}%)
                    </div>
                  )}
                </div>
              )
            })}
          </StickyTableBody>
        </StickyTableShell>
      </div>

      <div className="text-muted-foreground rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[10px]">
        Over-norm consumption is charged back to the SC at cost. E.g., if binding wire norm is 0.5
        kg/MT and SC used 6.5 kg for 12.5 MT (norm = 6.25 kg), the extra 0.25 kg is charged.
      </div>

      {/* Chargeback summary */}
      <div className="bg-secondary/40 rounded-md p-2.5">
        <div className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
          Chargeback Summary
        </div>
        {(() => {
          let totalChargeback = 0
          sc.consumables.forEach((c) => {
            const theoretical = c.normPerUnit && c.normBasis ? c.normPerUnit * c.normBasis : 0
            const overQty = Math.max(0, c.qty - theoretical)
            totalChargeback += overQty * c.rate
          })
          return (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total over-norm chargeback</span>
              <span className="font-mono font-bold text-amber-600">{fmtNPR(totalChargeback)}</span>
            </div>
          )
        })()}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="h-8 w-full gap-1.5 text-xs"
        onClick={openModal}
        title="Add Consumable Issue"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Consumable Issue
      </Button>

      {/* Add Consumable modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sc-consumable-add-title"
            className="pane w-full max-w-md overflow-hidden rounded-xl border border-[var(--pane-divider)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 items-center justify-between border-b border-[var(--pane-divider)] bg-amber-500/5 px-4">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-amber-500" />
                <span id="sc-consumable-add-title" className="text-sm font-semibold">
                  Add Consumable Issue
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
              <div className="text-muted-foreground flex items-center gap-2 text-[10px]">
                <span className="font-mono">{generateConId()}</span>
                <span>·</span>
                <span>auto-generated id</span>
              </div>

              <div>
                <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Consumable Name
                </label>
                <Input
                  className="mt-1 h-8 text-xs"
                  placeholder="e.g. Curing compound / Binding wire / Diesel"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Date
                  </label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    type="date"
                    value={draft.date}
                    onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    UOM
                  </label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    placeholder="kg / ltr / m"
                    value={draft.uom}
                    onChange={(e) => setDraft((d) => ({ ...d, uom: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Qty
                  </label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    type="number"
                    placeholder="0"
                    value={draft.qty}
                    onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value }))}
                  />
                </div>
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

              <div className="border-t border-[var(--pane-divider)] pt-2">
                <div className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
                  Consumption Norm (optional)
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-muted-foreground text-[10px]">Norm / Unit</label>
                    <Input
                      className="mt-1 h-8 text-xs"
                      type="number"
                      placeholder="0.5"
                      value={draft.normPerUnit}
                      onChange={(e) => setDraft((d) => ({ ...d, normPerUnit: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground text-[10px]">Norm Unit</label>
                    <Input
                      className="mt-1 h-8 text-xs"
                      placeholder="MT"
                      value={draft.normUnit}
                      onChange={(e) => setDraft((d) => ({ ...d, normUnit: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground text-[10px]">Basis Qty</label>
                    <Input
                      className="mt-1 h-8 text-xs"
                      type="number"
                      placeholder="12.5"
                      value={draft.normBasis}
                      onChange={(e) => setDraft((d) => ({ ...d, normBasis: e.target.value }))}
                    />
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
                Save Issue
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
