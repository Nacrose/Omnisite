'use client'

import { Badge } from '@/components/ui/badge'
import { Calendar, ShieldCheck, Package, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Subcontractor } from './types'
import { fmtNPR } from './types'
import { getMaterialCoefficient } from './material-coefficients'

// ─── Performance Dashboard Tab ───────────────────────────────────────────────

export function PerformanceTab({ sc }: { sc: Subcontractor }) {
  // On-time rate — null when there are no assigned tasks so the KPI shows
  // "N/A" instead of a misleading 100% (audit V3-3).
  const onTimeTasks = sc.assignedTasks.filter((t) => t.status === 'on-track').length
  const onTimeRate =
    sc.assignedTasks.length > 0 ? (onTimeTasks / sc.assignedTasks.length) * 100 : null

  const earned = sc.items.reduce((sum, it) => sum + it.actualQty * it.rate, 0)
  // Total composite RMT — used for both the material chargeback computation
  // and the material efficiency section below.
  const totalRmt = sc.items.find((i) => i.type === 'composite')?.actualQty || 0
  const retention = earned * (sc.retentionPct / 100)
  // Match the Running Bill tab's formula (includes TDS, other deductibles,
  // and material + consumable chargebacks) so the two tabs agree.
  // Advance recovery is PROPORTIONAL to earned (advancePct% × earned),
  // NOT the full outstanding advance balance — see running-bill-tab.tsx.
  // CAPPED at the remaining outstanding advance so cumulative recovery
  // across all bills never exceeds `advancePaid`. `sc.advanceRecovered`
  // is the running total recovered in prior bills (tracked in vendor
  // state until a bills table exists).
  const alreadyRecovered = sc.advanceRecovered ?? 0
  const proportionalRecovery = earned * (sc.advancePct / 100)
  const remainingAdvance = Math.max(0, sc.advancePaid - alreadyRecovered)
  const advanceRecovery = Math.min(proportionalRecovery, remainingAdvance)
  const tds = sc.customDeductibles.find((d) => d.type === 'tds')
  const tdsAmount = tds ? earned * ((tds.ratePct || 0) / 100) : 0
  const otherDeductibleTotal = sc.customDeductibles
    .filter((d) => d.type !== 'tds')
    .reduce((sum, d) => sum + d.amount, 0)

  // Material + consumable chargebacks — must match the Running Bill tab's
  // formula so the two tabs agree on net payable (audit V3-2). Previously
  // the performance tab omitted these, showing a higher net payable.
  let materialChargeback = 0
  const perfMaterialMap = new Map<
    string,
    { code: string; issued: number; returned: number; theoretical: number; rate: number }
  >()
  for (const mi of sc.materialIssues) {
    const e = perfMaterialMap.get(mi.materialCode) || {
      code: mi.materialCode,
      issued: 0,
      returned: 0,
      theoretical: 0,
      rate: mi.rate,
    }
    e.issued += mi.qty
    perfMaterialMap.set(mi.materialCode, e)
  }
  for (const mr of sc.materialReturns) {
    const e = perfMaterialMap.get(mr.materialCode)
    if (e) e.returned += mr.qty
  }
  for (const [, m] of perfMaterialMap) {
    const coeff = getMaterialCoefficient(m.code, sc)
    m.theoretical = coeff ? coeff * totalRmt : 0
    const netUsed = m.issued - m.returned
    const overQty = Math.max(0, netUsed - m.theoretical)
    materialChargeback += overQty * m.rate
  }
  let consumableChargeback = 0
  sc.consumables.forEach((c) => {
    const theoretical = c.normPerUnit && c.normBasis ? c.normPerUnit * c.normBasis : 0
    const overQty = Math.max(0, c.qty - theoretical)
    consumableChargeback += overQty * c.rate
  })

  const netPayable =
    earned -
    advanceRecovery -
    retention -
    sc.reworkCost -
    tdsAmount -
    otherDeductibleTotal -
    materialChargeback -
    consumableChargeback

  // Material efficiency
  let matEfficiency = 100
  let matCount = 0
  const materialMap = new Map<
    string,
    { code: string; issued: number; returned: number; theoretical: number }
  >()
  for (const mi of sc.materialIssues) {
    const e = materialMap.get(mi.materialCode) || {
      code: mi.materialCode,
      issued: 0,
      returned: 0,
      theoretical: 0,
    }
    e.issued += mi.qty
    materialMap.set(mi.materialCode, e)
  }
  for (const mr of sc.materialReturns) {
    const e = materialMap.get(mr.materialCode)
    if (e) e.returned += mr.qty
  }
  for (const [, m] of materialMap) {
    // Shared coefficient lookup — previously this was a stale copy that only
    // handled cement + steel, so aggregate and sand always showed as 0%
    // theoretical (and were flagged as 100% over-use). Now matches the
    // material-tab and running-bill-tab automatically.
    const coeff = getMaterialCoefficient(m.code, sc)
    m.theoretical = coeff ? coeff * totalRmt : 0
    const netUsed = m.issued - m.returned
    const variance =
      m.theoretical > 0 ? Math.abs(((netUsed - m.theoretical) / m.theoretical) * 100) : 0
    matEfficiency = Math.min(matEfficiency, 100 - variance)
    matCount++
  }

  const kpis = [
    {
      label: 'On-Time Delivery',
      value: onTimeRate !== null ? `${onTimeRate.toFixed(0)}%` : 'N/A',
      icon: Calendar,
      color:
        onTimeRate === null
          ? 'text-muted-foreground'
          : onTimeRate >= 80
            ? 'text-emerald-600'
            : onTimeRate >= 50
              ? 'text-amber-600'
              : 'text-red-600',
      desc:
        onTimeRate !== null
          ? `${onTimeTasks}/${sc.assignedTasks.length} tasks on track`
          : 'No tasks assigned',
    },
    {
      label: 'Quality (NCRs)',
      value: `${sc.ncrCount}`,
      icon: ShieldCheck,
      color:
        sc.ncrCount === 0
          ? 'text-emerald-600'
          : sc.ncrCount <= 1
            ? 'text-amber-600'
            : 'text-red-600',
      desc: 'Non-conformance reports linked to SC',
    },
    {
      label: 'Material Efficiency',
      value: `${matEfficiency.toFixed(0)}%`,
      icon: Package,
      color:
        matEfficiency >= 95
          ? 'text-emerald-600'
          : matEfficiency >= 85
            ? 'text-amber-600'
            : 'text-red-600',
      desc: `${matCount} materials tracked`,
    },
    {
      label: 'Safety (Incidents)',
      value: `${sc.incidents}`,
      icon: Activity,
      color: sc.incidents === 0 ? 'text-emerald-600' : 'text-red-600',
      desc: 'Incidents on SC tasks',
    },
  ]

  return (
    <div className="space-y-3 p-4 text-xs">
      <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        Performance Dashboard
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2">
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <div key={k.label} className="rounded-md border border-[var(--pane-divider)] p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  {k.label}
                </span>
                <Icon className={cn('h-3.5 w-3.5', k.color)} />
              </div>
              <div className={cn('mt-0.5 text-lg font-bold', k.color)}>{k.value}</div>
              <div className="text-muted-foreground text-[10px]">{k.desc}</div>
            </div>
          )
        })}
      </div>

      {/* Compliance */}
      <div>
        <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
          Compliance
        </div>
        <div className="space-y-1.5">
          <ComplianceRow label="PAN" value={sc.pan} status="ok" />
          <ComplianceRow label="GST" value={sc.gst} status="ok" />
          {/* Date-aware compliance status: 30-day amber window to match the
              dashboard and profile tab (audit V3-1 — previously used
              90/180-day thresholds which disagreed with the other views). */}
          {(() => {
            const daysTo = (iso: string) => (Date.parse(iso) - Date.now()) / 86_400_000
            const insStatus =
              daysTo(sc.insuranceExpiry) < 0
                ? 'exp'
                : daysTo(sc.insuranceExpiry) <= 30
                  ? 'warn'
                  : 'ok'
            const licStatus =
              daysTo(sc.labourLicenseExpiry) < 0
                ? 'exp'
                : daysTo(sc.labourLicenseExpiry) <= 30
                  ? 'warn'
                  : 'ok'
            return (
              <>
                <ComplianceRow
                  label="Insurance"
                  value={`Expires ${sc.insuranceExpiry}`}
                  status={insStatus as 'ok' | 'warn' | 'exp'}
                />
                <ComplianceRow
                  label="Labour License"
                  value={`Expires ${sc.labourLicenseExpiry}`}
                  status={licStatus as 'ok' | 'warn' | 'exp'}
                />
              </>
            )
          })()}
        </div>
      </div>

      {/* Financial summary */}
      <div>
        <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
          Financial Summary
        </div>
        <div className="bg-secondary/40 space-y-1 rounded-md p-2.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Agreement value</span>
            <span className="font-mono">
              {sc.agreementValue > 0 ? fmtNPR(sc.agreementValue) : 'Variable'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Earned to date</span>
            <span className="font-mono font-medium">{fmtNPR(earned)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Advance paid</span>
            <span className="font-mono text-red-600">{fmtNPR(sc.advancePaid)}</span>
          </div>
          {sc.advancePaid > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Advance recovered</span>
              <span
                className={cn(
                  'font-mono',
                  alreadyRecovered >= sc.advancePaid ? 'text-emerald-600' : 'text-amber-600'
                )}
              >
                {fmtNPR(alreadyRecovered)}
                {alreadyRecovered >= sc.advancePaid ? ' · fully recovered' : ''}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Net payable</span>
            <span className="font-mono font-bold text-emerald-600">{fmtNPR(netPayable)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ComplianceRow({
  label,
  value,
  status,
}: {
  label: string
  value: string
  status: 'ok' | 'warn' | 'exp'
}) {
  return (
    <div className="flex items-center gap-2 rounded border border-[var(--pane-divider)] p-1.5">
      <div
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'ok' && 'bg-emerald-500',
          status === 'warn' && 'bg-amber-500',
          status === 'exp' && 'bg-red-500'
        )}
      />
      <span className="text-muted-foreground w-24 text-[10px]">{label}</span>
      <span className="flex-1 truncate text-[10px]">{value}</span>
      {status === 'warn' && (
        <Badge
          variant="secondary"
          className="bg-amber-500/15 text-[9px] text-amber-700 dark:text-amber-300"
        >
          Expiring
        </Badge>
      )}
    </div>
  )
}
