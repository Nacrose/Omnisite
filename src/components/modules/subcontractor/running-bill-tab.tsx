'use client'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  FileText, Truck, Package, AlertTriangle, Wallet, Percent,
  Zap, ShieldCheck, Wrench, Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Subcontractor } from './types'
import { fmtNPR } from './types'

// ─── Running Bill Tab (expanded deductibles) ─────────────────────────────────

export function RunningBillTab({ sc }: { sc: Subcontractor }) {
  const earned = sc.items.reduce((sum, it) => sum + it.actualQty * it.rate, 0)
  const retention = earned * (sc.retentionPct / 100)
  const tds = sc.customDeductibles.find(d => d.type === 'tds')
  const tdsAmount = tds ? earned * ((tds.ratePct || 0) / 100) : 0
  const otherDeductibles = sc.customDeductibles.filter(d => d.type !== 'tds')
  const otherDeductibleTotal = otherDeductibles.reduce((sum, d) => sum + d.amount, 0)

  // Material over-use chargeback
  let materialChargeback = 0
  const materialMap = new Map<string, { code: string; issued: number; returned: number; theoretical: number; rate: number }>()
  for (const mi of sc.materialIssues) {
    const e = materialMap.get(mi.materialCode) || { code: mi.materialCode, issued: 0, returned: 0, theoretical: 0, rate: mi.rate }
    e.issued += mi.qty; materialMap.set(mi.materialCode, e)
  }
  for (const mr of sc.materialReturns) {
    const e = materialMap.get(mr.materialCode)
    if (e) e.returned += mr.qty
  }
  const totalRmt = sc.items.find(i => i.type === 'composite')?.actualQty || 0
  // Mirror the coefficients used in material-tab.tsx so the two tabs agree.
  // Previously this version only handled cement and steel, so aggregate and
  // sand were charged back in full (theoretical=0 → overQty=netUsed).
  for (const [, m] of materialMap) {
    if (m.code === 'M-CEM-OPC') {
      m.theoretical = totalRmt * 5.7
    } else if (m.code === 'M-STEEL-TMT16' || m.code === 'M-STEEL-ISMB150') {
      m.theoretical = totalRmt * 0.095
    } else if (m.code === 'M-AGG-20') {
      m.theoretical = totalRmt * (0.40 * 0.9 + 0.60 * 0.9)
    } else if (m.code === 'M-SAND-R') {
      m.theoretical = totalRmt * (0.40 * 0.45 + 0.60 * 0.45)
    } else if (sc.isTunneling) {
      // Tunneling-specific materials — use designPattern when available.
      if (m.code === 'M-SHOTCRETE') {
        const pattern = sc.items.find(i => i.code === 'SC-TUN-SHOT')?.designPattern
        m.theoretical = pattern ? pattern * totalRmt : 0
      } else if (m.code === 'M-ROCKBOLT3') {
        const pattern = sc.items.find(i => i.code === 'SC-TUN-BOLT')?.designPattern
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
  sc.consumables.forEach(c => {
    const theoretical = c.normPerUnit && c.normBasis ? c.normPerUnit * c.normBasis : 0
    const overQty = Math.max(0, c.qty - theoretical)
    consumableChargeback += overQty * c.rate
  })

  const totalDeductions = sc.advancePaid + retention + sc.reworkCost + tdsAmount + otherDeductibleTotal + materialChargeback + consumableChargeback
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
    <div className="p-4 space-y-3 text-xs">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Running Bill Computation</div>

      {/* Earned value */}
      <div className="p-2.5 rounded-md bg-primary/5 border border-primary/20">
        <div className="flex justify-between">
          <span className="font-medium">Total Earned Value</span>
          <span className="font-mono font-bold text-base tabular-nums">{fmtNPR(earned)}</span>
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">Sum of SC BOQ actuals × SC rates</div>
      </div>

      {/* Deductions */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Deductions</div>

        {/* Advance recovery */}
        <BillRow icon={Wallet} label={`Advance recovery (${sc.advancePct}%)`} amount={-sc.advancePaid} color="text-red-600" />

        {/* Retention */}
        <BillRow icon={Percent} label={`Retention (${sc.retentionPct}%)`} amount={-retention} color="text-amber-600" />

        {/* Rework */}
        {sc.reworkCost > 0 && (
          <BillRow icon={AlertTriangle} label="Rework cost (NCR recovery)" amount={-sc.reworkCost} color="text-red-600" />
        )}

        {/* TDS */}
        {tds && (
          <BillRow icon={Percent} label={`${tds.label}`} amount={-tdsAmount} color="text-red-600" />
        )}

        {/* Material over-use chargeback */}
        {materialChargeback > 0 && (
          <BillRow icon={Package} label="Material over-use chargeback" amount={-materialChargeback} color="text-red-600" />
        )}

        {/* Consumable over-norm chargeback */}
        {consumableChargeback > 0 && (
          <BillRow icon={Wrench} label="Consumable over-norm chargeback" amount={-consumableChargeback} color="text-red-600" />
        )}

        {/* Other custom deductibles */}
        {otherDeductibles.map(d => {
          const Icon = DEDUCTION_TYPE_ICONS[d.type] || FileText
          return <BillRow key={d.id} icon={Icon} label={d.label} amount={-d.amount} color="text-red-600" notes={d.notes} />
        })}
      </div>

      <Separator />

      {/* Net payable */}
      <div className={cn('p-3 rounded-md', netPayable >= 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-amber-500/10 border border-amber-500/30')}>
        <div className="flex justify-between items-center">
          <span className="font-bold flex items-center gap-1.5"><Wallet className="w-4 h-4" />Net Payable</span>
          <span className={cn('font-mono font-bold text-lg tabular-nums', netPayable >= 0 ? 'text-emerald-600' : 'text-amber-600')}>
            {fmtNPR(netPayable)}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {netPayable < 0 ? 'SC owes project (advance exceeds earned)' : 'Payable to SC after all deductions'}
        </div>
      </div>

      <Button className="w-full h-9 text-xs gap-1.5"><FileText className="w-3.5 h-3.5" />Generate Running Bill</Button>

      {/* Add deductible */}
      <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5"><Plus className="w-3.5 h-3.5" />Add Custom Deductible</Button>
    </div>
  )
}

function BillRow({ icon: Icon, label, amount, color, notes }: { icon: typeof Wallet; label: string; amount: number; color: string; notes?: string }) {
  return (
    <div className="flex items-center gap-2 p-1.5 rounded border border-[var(--pane-divider)]">
      <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', color)} />
      <div className="flex-1 min-w-0">
        <div className="text-xs">{label}</div>
        {notes && <div className="text-[9px] text-muted-foreground truncate">{notes}</div>}
      </div>
      <span className={cn('font-mono font-medium tabular-nums', color)}>
        {amount >= 0 ? '+' : ''}{fmtNPR(Math.abs(amount))}
      </span>
    </div>
  )
}
