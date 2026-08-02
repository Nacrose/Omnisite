import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmt, type CbsNode } from './types'

export function KpiCell({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div>
      <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        {label}
      </div>
      <div className={cn('mt-0.5 text-lg font-bold', muted && 'text-muted-foreground')}>
        {value}
      </div>
    </div>
  )
}

export function FinancialsInspector({ node }: { node: CbsNode }) {
  return (
    <>
      <PaneHeader title={`Financial Inspector · ${node.code}`} />
      <PaneBody>
        <div className="border-b border-[var(--pane-divider)] p-4">
          <Badge variant="outline" className="text-[10px]">
            CBS Node
          </Badge>
          <div className="mt-2 text-sm font-semibold">{node.name}</div>
        </div>

        <Tabs defaultValue="pl">
          <div className="px-3 pt-2">
            <TabsList className="grid h-8 w-full grid-cols-3 text-xs">
              <TabsTrigger value="pl" className="text-[11px]">
                P&L
              </TabsTrigger>
              <TabsTrigger value="billing" className="text-[11px]">
                Client Billing
              </TabsTrigger>
              <TabsTrigger value="expenses" className="text-[11px]">
                Expenses
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="pl" className="mt-0 space-y-3 px-4 py-3 text-xs">
            <Row label="Budgeted Cost (BOQ)" value={`NPR ${fmt(node.budget)}`} />
            <Row label="Committed Cost (POs)" value={`NPR ${fmt(node.committed)}`} muted />
            <Row label="Actual Cost (DSR + Manual)" value={`NPR ${fmt(node.actual)}`} />
            <Row label="Forecast (EAC)" value={`NPR ${fmt(node.forecast)}`} bold />
            <Separator />
            <Row
              label="Variance (Budget − Forecast)"
              value={`NPR ${fmt(node.budget - node.forecast)}`}
              className={node.budget - node.forecast >= 0 ? 'delta-up' : 'delta-down'}
            />
            <Row
              label="Node Margin"
              value={`${node.marginPct >= 0 ? '+' : ''}${node.marginPct.toFixed(1)}%`}
              className={node.marginPct >= 0 ? 'delta-up' : 'delta-down'}
              bold
            />

            <Separator />

            <div className="bg-secondary/20 text-muted-foreground rounded-md border border-[var(--pane-divider)] p-3 text-[11px] leading-relaxed">
              Cost breakdown by category requires RA Builder data — not yet available.
            </div>
          </TabsContent>

          <TabsContent value="billing" className="mt-0 space-y-3 px-4 py-3 text-xs">
            <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              RA Bills
            </div>
            <div className="bg-secondary/20 text-muted-foreground rounded-md border border-[var(--pane-divider)] p-3 text-[11px] leading-relaxed">
              RA Bills are uploaded via the Financials grid (Quick Expense → Upload RA Bill).
            </div>

            <Separator />

            <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              System Reconciliation
            </div>
            <div className="bg-secondary/20 text-muted-foreground rounded-md border border-[var(--pane-divider)] p-3 text-[11px] leading-relaxed">
              Reconciliation requires RA Bill data — not yet wired to this view.
            </div>
          </TabsContent>

          <TabsContent value="expenses" className="mt-0 space-y-2 px-4 py-3 text-xs">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Quick Expense Entries
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                disabled
                title="Use the Quick Expense button in the Financials grid toolbar"
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>
            <div className="bg-secondary/20 text-muted-foreground rounded-md border border-[var(--pane-divider)] p-3 text-[11px] leading-relaxed">
              No quick expenses recorded. Use the Quick Expense button to add one.
            </div>
          </TabsContent>
        </Tabs>
      </PaneBody>
    </>
  )
}

export function Row({
  label,
  value,
  muted,
  bold,
  className,
}: {
  label: string
  value: string
  muted?: boolean
  bold?: boolean
  className?: string
}) {
  return (
    <div className="flex justify-between">
      <span className={cn(muted && 'text-muted-foreground', bold && 'font-semibold')}>{label}</span>
      <span className={cn('font-mono', bold && 'font-bold', className)}>{value}</span>
    </div>
  )
}
