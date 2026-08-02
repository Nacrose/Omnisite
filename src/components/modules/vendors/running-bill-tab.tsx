'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  FileText,
  Truck,
  Package,
  AlertTriangle,
  Wallet,
  Percent,
  Zap,
  ShieldCheck,
  Wrench,
  Plus,
  X,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Subcontractor, CustomDeductible } from './types'
import { fmtNPR } from './types'

// ─── Running Bill Tab (expanded deductibles) ─────────────────────────────────

const DEDUCTIBLE_TYPES: CustomDeductible['type'][] = [
  'tds',
  'equipment',
  'penalty',
  'electricity',
  'insurance',
  'material_overuse',
  'other',
]

export function RunningBillTab({
  sc,
  onAddDeductible,
}: {
  sc: Subcontractor
  /** Called when the user saves the Add Custom Deductible form. The parent
   *  maps the new CustomDeductible into the vendor's customDeductibles array. */
  onAddDeductible?: (d: CustomDeductible) => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [draft, setDraft] = useState<{
    type: CustomDeductible['type']
    label: string
    amount: string
    ratePct: string
    notes: string
  }>({
    type: 'tds',
    label: '',
    amount: '',
    ratePct: '',
    notes: '',
  })

  const openModal = () => {
    setDraft({ type: 'tds', label: '', amount: '', ratePct: '', notes: '' })
    setModalOpen(true)
  }

  const canSave =
    draft.label.trim().length > 0 &&
    draft.amount.trim() !== '' &&
    !Number.isNaN(Number(draft.amount)) &&
    Number(draft.amount) >= 0

  const handleSave = () => {
    if (!canSave) return
    const d: CustomDeductible = {
      id: `DED-${Date.now().toString(36)}`,
      type: draft.type,
      label: draft.label.trim(),
      amount: Number(draft.amount),
      ratePct: draft.ratePct.trim() ? Number(draft.ratePct) : undefined,
      notes: draft.notes.trim() || undefined,
    }
    onAddDeductible?.(d)
    toast.success('Custom deductible added', {
      description: `${d.label} · ${fmtNPR(d.amount)} (${d.type})`,
    })
    setModalOpen(false)
  }

  const handleGenerateBill = () => {
    const earned = sc.items.reduce((sum, it) => sum + it.actualQty * it.rate, 0)
    const retention = earned * (sc.retentionPct / 100)
    const tds = sc.customDeductibles.find((d) => d.type === 'tds')
    const tdsAmount = tds ? earned * ((tds.ratePct || 0) / 100) : 0
    const otherDeductibles = sc.customDeductibles.filter((d) => d.type !== 'tds')
    const otherDeductibleTotal = otherDeductibles.reduce((sum, d) => sum + d.amount, 0)
    const totalDeductions =
      sc.advancePaid + retention + sc.reworkCost + tdsAmount + otherDeductibleTotal
    const netPayable = earned - totalDeductions
    toast.success('Running bill generated', {
      description: `Earned ${fmtNPR(earned)} · Net payable ${fmtNPR(netPayable)}`,
    })
  }

  const earned = sc.items.reduce((sum, it) => sum + it.actualQty * it.rate, 0)
  const retention = earned * (sc.retentionPct / 100)
  const tds = sc.customDeductibles.find((d) => d.type === 'tds')
  const tdsAmount = tds ? earned * ((tds.ratePct || 0) / 100) : 0
  const otherDeductibles = sc.customDeductibles.filter((d) => d.type !== 'tds')
  const otherDeductibleTotal = otherDeductibles.reduce((sum, d) => sum + d.amount, 0)

  // Material over-use chargeback
  let materialChargeback = 0
  const materialMap = new Map<
    string,
    { code: string; issued: number; returned: number; theoretical: number; rate: number }
  >()
  for (const mi of sc.materialIssues) {
    const e = materialMap.get(mi.materialCode) || {
      code: mi.materialCode,
      issued: 0,
      returned: 0,
      theoretical: 0,
      rate: mi.rate,
    }
    e.issued += mi.qty
    materialMap.set(mi.materialCode, e)
  }
  for (const mr of sc.materialReturns) {
    const e = materialMap.get(mr.materialCode)
    if (e) e.returned += mr.qty
  }
  const totalRmt = sc.items.find((i) => i.type === 'composite')?.actualQty || 0
  // Mirror the coefficients used in material-tab.tsx so the two tabs agree.
  // Previously this version only handled cement and steel, so aggregate and
  // sand were charged back in full (theoretical=0 → overQty=netUsed).
  for (const [, m] of materialMap) {
    if (m.code === 'M-CEM-OPC') {
      m.theoretical = totalRmt * 5.7
    } else if (m.code === 'M-STEEL-TMT16' || m.code === 'M-STEEL-ISMB150') {
      m.theoretical = totalRmt * 0.095
    } else if (m.code === 'M-AGG-20') {
      m.theoretical = totalRmt * (0.4 * 0.9 + 0.6 * 0.9)
    } else if (m.code === 'M-SAND-R') {
      m.theoretical = totalRmt * (0.4 * 0.45 + 0.6 * 0.45)
    } else if (sc.isTunneling) {
      // Tunneling-specific materials — use designPattern when available.
      if (m.code === 'M-SHOTCRETE') {
        const pattern = sc.items.find((i) => i.code === 'SC-TUN-SHOT')?.designPattern
        m.theoretical = pattern ? pattern * totalRmt : 0
      } else if (m.code === 'M-ROCKBOLT3') {
        const pattern = sc.items.find((i) => i.code === 'SC-TUN-BOLT')?.designPattern
        m.theoretical = pattern ? pattern * totalRmt : 0
      } else if (m.code === 'M-STEEL-ISMB150') {
        m.theoretical = totalRmt * 0.037
      }
    }
    const netUsed = m.issued - m.returned
    const overQty = Math.max(0, netUsed - m.theoretical)
    materialChargeback += overQty * m.rate
  }

  // Consumable chargeback
  let consumableChargeback = 0
  sc.consumables.forEach((c) => {
    const theoretical = c.normPerUnit && c.normBasis ? c.normPerUnit * c.normBasis : 0
    const overQty = Math.max(0, c.qty - theoretical)
    consumableChargeback += overQty * c.rate
  })

  const totalDeductions =
    sc.advancePaid +
    retention +
    sc.reworkCost +
    tdsAmount +
    otherDeductibleTotal +
    materialChargeback +
    consumableChargeback
  const netPayable = earned - totalDeductions

  const DEDUCTION_TYPE_ICONS: Record<string, typeof Wallet> = {
    advance: Wallet,
    retention: Percent,
    rework: AlertTriangle,
    tds: Percent,
    equipment: Truck,
    penalty: AlertTriangle,
    electricity: Zap,
    insurance: ShieldCheck,
    material_overuse: Package,
    other: FileText,
  }

  return (
    <div className="space-y-3 p-4 text-xs">
      <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        Running Bill Computation
      </div>

      {/* Earned value */}
      <div className="bg-primary/5 border-primary/20 rounded-md border p-2.5">
        <div className="flex justify-between">
          <span className="font-medium">Total Earned Value</span>
          <span className="font-mono text-base font-bold tabular-nums">{fmtNPR(earned)}</span>
        </div>
        <div className="text-muted-foreground mt-0.5 text-[10px]">
          Sum of SC BOQ actuals × SC rates
        </div>
      </div>

      {/* Deductions */}
      <div className="space-y-1.5">
        <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
          Deductions
        </div>

        {/* Advance recovery */}
        <BillRow
          icon={Wallet}
          label={`Advance recovery (${sc.advancePct}%)`}
          amount={-sc.advancePaid}
          color="text-red-600"
        />

        {/* Retention */}
        <BillRow
          icon={Percent}
          label={`Retention (${sc.retentionPct}%)`}
          amount={-retention}
          color="text-amber-600"
        />

        {/* Rework */}
        {sc.reworkCost > 0 && (
          <BillRow
            icon={AlertTriangle}
            label="Rework cost (NCR recovery)"
            amount={-sc.reworkCost}
            color="text-red-600"
          />
        )}

        {/* TDS */}
        {tds && (
          <BillRow icon={Percent} label={`${tds.label}`} amount={-tdsAmount} color="text-red-600" />
        )}

        {/* Material over-use chargeback */}
        {materialChargeback > 0 && (
          <BillRow
            icon={Package}
            label="Material over-use chargeback"
            amount={-materialChargeback}
            color="text-red-600"
          />
        )}

        {/* Consumable over-norm chargeback */}
        {consumableChargeback > 0 && (
          <BillRow
            icon={Wrench}
            label="Consumable over-norm chargeback"
            amount={-consumableChargeback}
            color="text-red-600"
          />
        )}

        {/* Other custom deductibles */}
        {otherDeductibles.map((d) => {
          const Icon = DEDUCTION_TYPE_ICONS[d.type] || FileText
          return (
            <BillRow
              key={d.id}
              icon={Icon}
              label={d.label}
              amount={-d.amount}
              color="text-red-600"
              notes={d.notes}
            />
          )
        })}
      </div>

      <Separator />

      {/* Net payable */}
      <div
        className={cn(
          'rounded-md p-3',
          netPayable >= 0
            ? 'border border-emerald-500/30 bg-emerald-500/10'
            : 'border border-amber-500/30 bg-amber-500/10'
        )}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-bold">
            <Wallet className="h-4 w-4" />
            Net Payable
          </span>
          <span
            className={cn(
              'font-mono text-lg font-bold tabular-nums',
              netPayable >= 0 ? 'text-emerald-600' : 'text-amber-600'
            )}
          >
            {fmtNPR(netPayable)}
          </span>
        </div>
        <div className="text-muted-foreground mt-0.5 text-[10px]">
          {netPayable < 0
            ? 'SC owes project (advance exceeds earned)'
            : 'Payable to SC after all deductions'}
        </div>
      </div>

      <Button className="h-9 w-full gap-1.5 text-xs" onClick={handleGenerateBill}>
        <FileText className="h-3.5 w-3.5" />
        Generate Running Bill
      </Button>

      {/* Add deductible */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-full gap-1.5 text-xs"
        onClick={openModal}
        title="Add Custom Deductible"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Custom Deductible
      </Button>

      {/* Add Custom Deductible modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sc-deductible-add-title"
            className="pane w-full max-w-md overflow-hidden rounded-xl border border-[var(--pane-divider)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 items-center justify-between border-b border-[var(--pane-divider)] bg-red-500/5 px-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span id="sc-deductible-add-title" className="text-sm font-semibold">
                  Add Custom Deductible
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
                  Type
                </label>
                <div className="mt-1 grid grid-cols-4 gap-1">
                  {DEDUCTIBLE_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, type: t }))}
                      className={cn(
                        'h-7 rounded border text-[10px] transition-colors',
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

              <div>
                <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Label
                </label>
                <Input
                  className="mt-1 h-8 text-xs"
                  placeholder="e.g. TDS @ 1.5% / Equipment rental / Penalty"
                  value={draft.label}
                  onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Amount (NPR)
                  </label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    type="number"
                    placeholder="0"
                    value={draft.amount}
                    onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Rate % (optional)
                  </label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    type="number"
                    placeholder="0"
                    value={draft.ratePct}
                    onChange={(e) => setDraft((d) => ({ ...d, ratePct: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Notes
                </label>
                <Textarea
                  className="mt-1 min-h-[50px] text-xs"
                  placeholder="Optional justification / reference…"
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--pane-divider)] p-3">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!canSave} className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Save Deductible
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BillRow({
  icon: Icon,
  label,
  amount,
  color,
  notes,
}: {
  icon: typeof Wallet
  label: string
  amount: number
  color: string
  notes?: string
}) {
  return (
    <div className="flex items-center gap-2 rounded border border-[var(--pane-divider)] p-1.5">
      <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', color)} />
      <div className="min-w-0 flex-1">
        <div className="text-xs">{label}</div>
        {notes && <div className="text-muted-foreground truncate text-[9px]">{notes}</div>}
      </div>
      <span className={cn('font-mono font-medium tabular-nums', color)}>
        {amount >= 0 ? '+' : ''}
        {fmtNPR(Math.abs(amount))}
      </span>
    </div>
  )
}
