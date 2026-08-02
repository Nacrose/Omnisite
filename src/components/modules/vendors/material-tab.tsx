'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Package, ArrowLeft, X, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Subcontractor, MaterialIssue } from './types'
import { fmtNPR } from './types'
import { getMaterialCoefficient } from './material-coefficients'
import { MATERIALS } from '@/data/seed/admin'
import {
  useColumnVisibility,
  ColumnToggle,
  StickyTableShell,
  StickyTableHeader,
  StickyTableBody,
  type ColumnDef,
} from '@/components/ui/table-utils'

// ─── Material Reconciliation Tab ─────────────────────────────────────────────

export function MaterialTab({
  sc,
  onAddMaterialIssue,
}: {
  sc: Subcontractor
  /** Called when the user saves the Issue Material form. The parent
   *  maps the new MaterialIssue into the vendor's materialIssues array. */
  onAddMaterialIssue?: (issue: MaterialIssue) => void
}) {
  // Aggregate by material
  const materialMap = new Map<
    string,
    {
      code: string
      name: string
      uom: string
      rate: number
      issued: number
      returned: number
      theoretical: number
    }
  >()

  // Sum issued
  for (const mi of sc.materialIssues) {
    const key = mi.materialCode
    const existing = materialMap.get(key) || {
      code: mi.materialCode,
      name: mi.materialName,
      uom: mi.uom,
      rate: mi.rate,
      issued: 0,
      returned: 0,
      theoretical: 0,
    }
    existing.issued += mi.qty
    materialMap.set(key, existing)
  }
  // Sum returns
  for (const mr of sc.materialReturns) {
    const key = mr.materialCode
    const existing = materialMap.get(key)
    if (existing) existing.returned += mr.qty
  }
  // Calculate theoretical from composite items mapping × RA coefficient.
  // Coefficients live in ./material-coefficients.ts so this tab agrees with
  // the running-bill and performance tabs by construction.
  const totalRmt = sc.items.find((i) => i.type === 'composite')?.actualQty || 0
  for (const [, m] of materialMap) {
    const coeff = getMaterialCoefficient(m.code, sc)
    m.theoretical = coeff ? coeff * totalRmt : 0
  }

  const materials = Array.from(materialMap.values())

  const COLS: ColumnDef[] = [
    { key: 'material', label: 'Material' },
    { key: 'theoretical', label: 'Theoretical' },
    { key: 'issued', label: 'Issued' },
    { key: 'returned', label: 'Ret.' },
    { key: 'netused', label: 'Net Used' },
    { key: 'variance', label: 'Var%' },
  ]
  const { visible, isVisible, toggle } = useColumnVisibility(
    COLS.map((c) => c.key),
    [],
    'sc-material-recon'
  )

  // Add-MIN modal state
  const [modalOpen, setModalOpen] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const [draft, setDraft] = useState<{
    materialCode: string
    date: string
    qty: string
    issuedBy: string
    notes: string
  }>({
    materialCode: '',
    date: today,
    qty: '',
    issuedBy: '',
    notes: '',
  })

  const openModal = () => {
    setDraft({
      materialCode: MATERIALS[0]?.code ?? '',
      date: today,
      qty: '',
      issuedBy: '',
      notes: '',
    })
    setModalOpen(true)
  }

  const selectedMaterial = MATERIALS.find((m) => m.code === draft.materialCode)
  // Auto-generate MIN id: MIN-YYYYMMDD-NNN where NNN counts existing MINs for that day.
  const generateMinId = () => {
    const ymd = draft.date.replace(/-/g, '')
    const count = sc.materialIssues.filter((mi) => mi.id.includes(`MIN-${ymd}`)).length + 1
    return `MIN-${ymd}-${String(count).padStart(3, '0')}`
  }

  const canSave =
    draft.materialCode.trim().length > 0 &&
    !!selectedMaterial &&
    draft.qty.trim() !== '' &&
    !Number.isNaN(Number(draft.qty)) &&
    Number(draft.qty) > 0 &&
    draft.issuedBy.trim().length > 0

  const handleSave = () => {
    if (!canSave || !selectedMaterial) return
    const issue: MaterialIssue = {
      id: generateMinId(),
      date: draft.date,
      materialCode: selectedMaterial.code,
      materialName: selectedMaterial.name,
      uom: selectedMaterial.uom,
      qty: Number(draft.qty),
      rate: selectedMaterial.projectRate ?? selectedMaterial.rate,
      issuedBy: draft.issuedBy.trim(),
      notes: draft.notes.trim() || undefined,
    }
    onAddMaterialIssue?.(issue)
    toast.success('Material Issue Note created', {
      description: `${issue.id} · ${issue.materialName} · ${issue.qty} ${issue.uom}`,
    })
    setModalOpen(false)
  }

  return (
    <div className="space-y-3 p-4 text-xs">
      <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        Material Issue & Reconciliation
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-secondary/40 rounded-md p-2 text-center">
          <div className="text-muted-foreground text-[10px]">Total Issued</div>
          <div className="text-sm font-bold">{sc.materialIssues.length} MINs</div>
        </div>
        <div className="bg-secondary/40 rounded-md p-2 text-center">
          <div className="text-muted-foreground text-[10px]">Total Returns</div>
          <div className="text-sm font-bold">{sc.materialReturns.length} MRNs</div>
        </div>
        <div className="bg-secondary/40 rounded-md p-2 text-center">
          <div className="text-muted-foreground text-[10px]">Materials Tracked</div>
          <div className="text-sm font-bold">{materials.length}</div>
        </div>
      </div>

      {/* Reconciliation table */}
      <div className="rounded-md border border-[var(--pane-divider)]">
        <StickyTableShell minWidth={700}>
          <StickyTableHeader>
            {isVisible('material') && <div className="w-44 px-2">Material</div>}
            {isVisible('theoretical') && <div className="w-24 px-2 text-right">Theoretical</div>}
            {isVisible('issued') && <div className="w-24 px-2 text-right">Issued</div>}
            {isVisible('returned') && <div className="w-16 px-2 text-right">Ret.</div>}
            {isVisible('netused') && <div className="w-24 px-2 text-right">Net Used</div>}
            {isVisible('variance') && <div className="w-16 px-2 text-right">Var%</div>}
            <div className="flex-shrink-0 pr-2">
              <ColumnToggle columns={COLS} visible={visible} onToggle={toggle} />
            </div>
          </StickyTableHeader>
          <StickyTableBody>
            {materials.map((m) => {
              const netUsed = m.issued - m.returned
              const hasTheoretical = m.theoretical > 0
              const variance = hasTheoretical
                ? ((netUsed - m.theoretical) / m.theoretical) * 100
                : 0
              const overVariance = hasTheoretical && Math.abs(variance) > 5
              return (
                <div
                  key={m.code}
                  className={cn(
                    'flex items-center border-t border-[var(--pane-divider)] px-2 py-1.5',
                    overVariance && 'bg-amber-500/5'
                  )}
                >
                  {isVisible('material') && (
                    <div className="w-44 min-w-0 px-2">
                      <div className="truncate font-medium">{m.name}</div>
                      <div className="text-muted-foreground font-mono text-[9px]">{m.code}</div>
                    </div>
                  )}
                  {isVisible('theoretical') && (
                    <div className="text-muted-foreground w-24 px-2 text-right font-mono">
                      {hasTheoretical ? (
                        `${m.theoretical.toFixed(1)} ${m.uom}`
                      ) : (
                        <span className="text-[9px] opacity-60">N/A</span>
                      )}
                    </div>
                  )}
                  {isVisible('issued') && (
                    <div className="w-24 px-2 text-right font-mono">{m.issued.toFixed(1)}</div>
                  )}
                  {isVisible('returned') && (
                    <div className="text-muted-foreground w-16 px-2 text-right font-mono">
                      {m.returned.toFixed(0)}
                    </div>
                  )}
                  {isVisible('netused') && (
                    <div className="w-24 px-2 text-right font-mono font-medium">
                      {netUsed.toFixed(1)}
                    </div>
                  )}
                  {isVisible('variance') && (
                    <div
                      className={cn(
                        'w-16 px-2 text-right font-mono font-bold',
                        overVariance
                          ? 'text-amber-600'
                          : hasTheoretical
                            ? 'text-emerald-600'
                            : 'text-muted-foreground/50'
                      )}
                    >
                      {hasTheoretical ? `${variance >= 0 ? '+' : ''}${variance.toFixed(0)}%` : '—'}
                    </div>
                  )}
                </div>
              )
            })}
          </StickyTableBody>
        </StickyTableShell>
      </div>

      <div className="text-muted-foreground rounded-md border border-blue-500/30 bg-blue-500/10 p-2 text-[10px]">
        Theoretical = mapped BOQ qty × RA coefficient. Net Used = Issued − Returned. Variance &gt;5%
        is flagged for chargeback.
      </div>

      {/* Issue register */}
      <div>
        <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
          Material Issue Notes (MIN)
        </div>
        <div className="space-y-1.5">
          {sc.materialIssues.map((mi) => (
            <div
              key={mi.id}
              className="flex items-center gap-2 rounded border border-[var(--pane-divider)] p-1.5"
            >
              <Package className="text-muted-foreground h-3 w-3 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-mono text-[10px]">{mi.id}</span>
                  <span className="text-muted-foreground text-[10px]">{mi.date}</span>
                  <span className="text-[10px]">{mi.materialName}</span>
                </div>
              </div>
              <span className="font-mono text-[10px]">
                {mi.qty} {mi.uom}
              </span>
              <span className="text-muted-foreground font-mono text-[10px]">
                {fmtNPR(mi.qty * mi.rate)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Returns */}
      {sc.materialReturns.length > 0 && (
        <div>
          <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
            Material Return Notes (MRN)
          </div>
          <div className="space-y-1.5">
            {sc.materialReturns.map((mr) => (
              <div
                key={mr.id}
                className="flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/5 p-1.5"
              >
                <ArrowLeft className="h-3 w-3 flex-shrink-0 text-emerald-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-mono text-[10px]">{mr.id}</span>
                    <span className="text-muted-foreground text-[10px]">{mr.date}</span>
                    <span className="text-[10px]">{mr.materialName}</span>
                  </div>
                  {mr.notes && (
                    <div className="text-muted-foreground truncate text-[9px]">{mr.notes}</div>
                  )}
                </div>
                <span className="font-mono text-[10px]">
                  {mr.qty} {mr.uom}
                </span>
                <span className="font-mono text-[10px] text-emerald-600">
                  −{fmtNPR(mr.qty * mr.rate)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        className="h-8 w-full gap-1.5 text-xs"
        onClick={openModal}
        title="Issue Material to SC"
      >
        <Plus className="h-3.5 w-3.5" />
        Issue Material to SC
      </Button>

      {/* Issue Material modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sc-material-issue-title"
            className="pane w-full max-w-md overflow-hidden rounded-xl border border-[var(--pane-divider)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 items-center justify-between border-b border-[var(--pane-divider)] bg-sky-500/5 px-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-sky-500" />
                <span id="sc-material-issue-title" className="text-sm font-semibold">
                  Issue Material to SC
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
                <span className="font-mono">{generateMinId()}</span>
                <span>·</span>
                <span>auto-generated MIN id</span>
              </div>

              <div>
                <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Material
                </label>
                <select
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 flex h-9 w-full rounded-md border px-3 py-1 text-xs shadow-xs outline-none focus-visible:ring-[3px]"
                  value={draft.materialCode}
                  onChange={(e) => setDraft((d) => ({ ...d, materialCode: e.target.value }))}
                >
                  {MATERIALS.filter((m) => !m.archived).map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.code} · {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedMaterial && (
                <div className="bg-secondary/40 rounded-md p-2 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Material Name</span>
                    <span className="font-medium">{selectedMaterial.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">UOM</span>
                    <span className="font-mono">{selectedMaterial.uom}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rate</span>
                    <span className="font-mono">
                      {fmtNPR(selectedMaterial.projectRate ?? selectedMaterial.rate)}/
                      {selectedMaterial.uom}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
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
                    Qty
                  </label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    type="number"
                    placeholder="0"
                    value={draft.qty}
                    onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value }))}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Issued By
                </label>
                <Input
                  className="mt-1 h-8 text-xs"
                  placeholder="e.g. Storekeeper"
                  value={draft.issuedBy}
                  onChange={(e) => setDraft((d) => ({ ...d, issuedBy: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Notes
                </label>
                <Textarea
                  className="mt-1 min-h-[50px] text-xs"
                  placeholder="Optional notes…"
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
                Save MIN
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
