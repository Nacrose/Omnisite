'use client'

import { Badge } from '@/components/ui/badge'
import { PaneBody } from '@/components/workspace-3pane'
import { CheckCircle2, AlertTriangle, Boxes } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Po, Grn, StockItem, INITIAL_MINS } from './types'
import {
  useColumnVisibility,
  ColumnToggle,
  StickyTableShell,
  StickyTableHeader,
  StickyTableBody,
  type ColumnDef,
} from '@/components/ui/table-utils'

export function PoCenterView({ pos }: { pos: Po[] }) {
  const COLS: ColumnDef[] = [
    { key: 'po', label: 'PO #' },
    { key: 'vendor', label: 'Vendor' },
    { key: 'date', label: 'Date' },
    { key: 'items', label: 'Items' },
    { key: 'value', label: 'Value (NPR)' },
    { key: 'status', label: 'Status' },
    { key: 'grn', label: 'GRN' },
  ]
  const { visible, isVisible, toggle } = useColumnVisibility(
    COLS.map((c) => c.key),
    [],
    'po-list'
  )
  return (
    <StickyTableShell minWidth={820}>
      <StickyTableHeader>
        {isVisible('po') && <div className="w-32 px-2">PO #</div>}
        {isVisible('vendor') && <div className="flex-1 px-2">Vendor</div>}
        {isVisible('date') && <div className="w-24 px-2">Date</div>}
        {isVisible('items') && <div className="w-16 px-2 text-center">Items</div>}
        {isVisible('value') && <div className="w-28 px-2 text-right">Value (NPR)</div>}
        {isVisible('status') && <div className="w-24 px-2">Status</div>}
        {isVisible('grn') && <div className="w-16 px-2 text-center">GRN</div>}
        <div className="flex-shrink-0 pr-2">
          <ColumnToggle columns={COLS} visible={visible} onToggle={toggle} />
        </div>
      </StickyTableHeader>
      <StickyTableBody>
        {pos.map((p) => (
          <div
            key={p.id}
            className="row-hover flex h-10 cursor-pointer items-center border-b border-[var(--pane-divider)] text-xs"
          >
            {isVisible('po') && <div className="w-32 px-2 font-mono">{p.id}</div>}
            {isVisible('vendor') && (
              <div className="flex-1 truncate px-2 font-medium">{p.vendor}</div>
            )}
            {isVisible('date') && <div className="text-muted-foreground w-24 px-2">{p.date}</div>}
            {isVisible('items') && <div className="w-16 px-2 text-center">{p.items}</div>}
            {isVisible('value') && (
              <div className="w-28 px-2 text-right font-mono">{p.value.toLocaleString()}</div>
            )}
            {isVisible('status') && (
              <div className="w-24 px-2">
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-[10px]',
                    p.status === 'Delivered' &&
                      'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                    p.status === 'Pending' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  )}
                >
                  {p.status}
                </Badge>
              </div>
            )}
            {isVisible('grn') && (
              <div className="w-16 px-2 text-center">
                {p.grn ? (
                  <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
              </div>
            )}
          </div>
        ))}
      </StickyTableBody>
    </StickyTableShell>
  )
}

export function GrnCenterView({
  grns,
  onToggleApproval,
}: {
  grns: Grn[]
  onToggleApproval: (poId: string) => void
}) {
  // 3-way match check: PO qty === GRN qty === Invoice qty
  const isMatched = (g: Grn) => g.poQty === g.grnQty && g.grnQty === g.invoiceQty
  const lockedAmount = grns
    .filter((g) => !isMatched(g) && g.grnQty > 0)
    .reduce((sum, g) => sum + g.invoiceQty * g.rate, 0)

  const COLS: ColumnDef[] = [
    { key: 'po', label: 'PO #' },
    { key: 'vendor', label: 'Vendor' },
    { key: 'poq', label: 'PO Qty' },
    { key: 'grnq', label: 'GRN Qty' },
    { key: 'invq', label: 'Invoice Qty' },
    { key: 'match', label: 'Match' },
    { key: 'pay', label: 'Pay Status' },
    { key: 'action', label: 'Action' },
  ]
  const { visible, isVisible, toggle } = useColumnVisibility(
    COLS.map((c) => c.key),
    [],
    'grn-3way'
  )

  return (
    <PaneBody className="p-4">
      <div className="rounded-lg border border-[var(--pane-divider)]">
        <div className="bg-secondary/30 text-muted-foreground flex items-center justify-between border-b border-[var(--pane-divider)] px-3 py-2 text-xs font-semibold tracking-wider uppercase">
          <span>3-Way Match · PO vs GRN vs Invoice</span>
          <span className="text-[10px] font-normal normal-case">
            Click ✓ to approve — locked if mismatch
          </span>
        </div>
        <StickyTableShell minWidth={820}>
          <StickyTableHeader>
            {isVisible('po') && <div className="w-24 px-2">PO #</div>}
            {isVisible('vendor') && <div className="flex-1 px-2">Vendor</div>}
            {isVisible('poq') && <div className="w-20 px-2 text-right">PO Qty</div>}
            {isVisible('grnq') && <div className="w-20 px-2 text-right">GRN Qty</div>}
            {isVisible('invq') && <div className="w-20 px-2 text-right">Invoice Qty</div>}
            {isVisible('match') && <div className="w-20 px-2 text-center">Match</div>}
            {isVisible('pay') && <div className="w-28 px-2 text-right">Pay Status</div>}
            {isVisible('action') && <div className="w-24 px-2 text-center">Action</div>}
            <div className="flex-shrink-0 pr-2">
              <ColumnToggle columns={COLS} visible={visible} onToggle={toggle} />
            </div>
          </StickyTableHeader>
          <StickyTableBody>
            {grns.map((g) => {
              const matched = isMatched(g)
              return (
                <div
                  key={g.id}
                  className="row-hover flex h-9 items-center border-t border-[var(--pane-divider)] text-xs"
                >
                  {isVisible('po') && <div className="w-24 px-2 font-mono">{g.poId}</div>}
                  {isVisible('vendor') && <div className="flex-1 truncate px-2">{g.vendor}</div>}
                  {isVisible('poq') && (
                    <div className="w-20 px-2 text-right font-mono">{g.poQty}</div>
                  )}
                  {isVisible('grnq') && (
                    <div className="w-20 px-2 text-right font-mono">{g.grnQty}</div>
                  )}
                  {isVisible('invq') && (
                    <div className="w-20 px-2 text-right font-mono">{g.invoiceQty}</div>
                  )}
                  {isVisible('match') && (
                    <div className="w-20 px-2 text-center">
                      {matched ? (
                        <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="mx-auto h-4 w-4 text-amber-500" />
                      )}
                    </div>
                  )}
                  {isVisible('pay') && (
                    <div
                      className={cn(
                        'w-28 px-2 text-right text-[11px] font-medium',
                        g.payStatus === 'Cleared' ? 'text-emerald-600' : 'text-amber-600'
                      )}
                    >
                      {g.payStatus}
                    </div>
                  )}
                  {isVisible('action') && (
                    <div className="w-24 px-2 text-center">
                      <button
                        onClick={() => onToggleApproval(g.poId)}
                        disabled={!matched}
                        className={cn(
                          'rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
                          matched
                            ? g.payStatus === 'Cleared'
                              ? 'bg-red-500/15 text-red-600 hover:bg-red-500/25'
                              : 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25'
                            : 'bg-secondary text-muted-foreground/40 cursor-not-allowed'
                        )}
                        title={matched ? 'Toggle payment approval' : 'Locked — 3-way match fails'}
                      >
                        {matched ? (g.payStatus === 'Cleared' ? 'Hold' : 'Approve') : '🔒 Locked'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </StickyTableBody>
        </StickyTableShell>
      </div>
      <div
        className={cn(
          'mt-3 rounded-md p-3 text-xs',
          lockedAmount > 0
            ? 'border border-amber-500/30 bg-amber-500/10'
            : 'border border-emerald-500/30 bg-emerald-500/10'
        )}
      >
        <div
          className={cn(
            'flex items-center gap-1.5 font-medium',
            lockedAmount > 0 ? 'text-amber-600' : 'text-emerald-600'
          )}
        >
          {lockedAmount > 0 ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          {lockedAmount > 0 ? 'Payment gate active' : 'All payments cleared'}
        </div>
        <div className="text-muted-foreground mt-0.5">
          {lockedAmount > 0
            ? `${grns.filter((g) => !isMatched(g) && g.grnQty > 0).length} invoices on hold pending 3-way match reconciliation. NPR ${lockedAmount.toLocaleString()} locked.`
            : 'All 3-way matches verified. All payments approved.'}
        </div>
      </div>
    </PaneBody>
  )
}

export function StockCenterView({ stock }: { stock: StockItem[] }) {
  // Compute live stats from the synced stock state so the header never lies.
  const stockValue = stock.reduce((s, x) => s + x.onHand * x.avgCost, 0)
  const warehouseCount = new Set(stock.map((s) => s.warehouse)).size
  const COLS: ColumnDef[] = [
    { key: 'code', label: 'Code' },
    { key: 'material', label: 'Material' },
    { key: 'onhand', label: 'On Hand' },
    { key: 'reserved', label: 'Reserved' },
    { key: 'available', label: 'Available' },
    { key: 'avgcost', label: 'Avg Cost' },
    { key: 'warehouse', label: 'Warehouse' },
  ]
  const { visible, isVisible, toggle } = useColumnVisibility(
    COLS.map((c) => c.key),
    [],
    'stock-list'
  )
  return (
    <>
      <div className="bg-secondary/20 flex items-center gap-3 border-b border-[var(--pane-divider)] px-4 py-3 text-xs">
        <Badge variant="outline">
          <Boxes className="mr-1 h-3 w-3" />
          {stock.length} SKUs · {warehouseCount} warehouses
        </Badge>
        <span className="text-muted-foreground">
          Total stock value:{' '}
          <span className="text-foreground font-mono font-semibold">
            NPR {stockValue.toLocaleString('en-IN')}
          </span>
        </span>
      </div>
      <StickyTableShell minWidth={880}>
        <StickyTableHeader>
          {isVisible('code') && <div className="w-32 px-2">Code</div>}
          {isVisible('material') && <div className="flex-1 px-2">Material</div>}
          {isVisible('onhand') && <div className="w-20 px-2 text-right">On Hand</div>}
          {isVisible('reserved') && <div className="w-20 px-2 text-right">Reserved</div>}
          {isVisible('available') && <div className="w-20 px-2 text-right">Available</div>}
          {isVisible('avgcost') && <div className="w-28 px-2 text-right">Avg Cost</div>}
          {isVisible('warehouse') && <div className="flex-1 px-2">Warehouse</div>}
          <div className="flex-shrink-0 pr-2">
            <ColumnToggle columns={COLS} visible={visible} onToggle={toggle} />
          </div>
        </StickyTableHeader>
        <StickyTableBody>
          {stock.map((s) => {
            const available = s.onHand - s.reserved
            const lowStock = available < s.onHand * 0.3
            return (
              <div
                key={s.code}
                className={cn(
                  'row-hover flex h-9 items-center border-b border-[var(--pane-divider)] text-xs',
                  lowStock && 'bg-amber-500/5'
                )}
              >
                {isVisible('code') && (
                  <div className="text-muted-foreground w-32 px-2 font-mono">{s.code}</div>
                )}
                {isVisible('material') && <div className="flex-1 px-2 font-medium">{s.name}</div>}
                {isVisible('onhand') && (
                  <div className="w-20 px-2 text-right font-mono">{s.onHand.toLocaleString()}</div>
                )}
                {isVisible('reserved') && (
                  <div className="text-muted-foreground w-20 px-2 text-right font-mono">
                    {s.reserved.toLocaleString()}
                  </div>
                )}
                {isVisible('available') && (
                  <div
                    className={cn(
                      'w-20 px-2 text-right font-mono font-medium',
                      lowStock && 'text-amber-600'
                    )}
                  >
                    {available.toLocaleString()}
                  </div>
                )}
                {isVisible('avgcost') && (
                  <div className="w-28 px-2 text-right font-mono">{s.avgCost.toLocaleString()}</div>
                )}
                {isVisible('warehouse') && (
                  <div className="text-muted-foreground flex-1 truncate px-2 text-[10px]">
                    {s.warehouse}
                  </div>
                )}
              </div>
            )
          })}
        </StickyTableBody>
      </StickyTableShell>
    </>
  )
}

export function MinCenterView() {
  return (
    <PaneBody className="space-y-2 p-4">
      {INITIAL_MINS.map((m) => (
        <div
          key={m.id}
          className="hover:bg-accent/30 cursor-pointer rounded-lg border border-[var(--pane-divider)] p-3"
        >
          <div className="mb-1 flex items-center gap-2">
            <span className="text-muted-foreground font-mono text-xs">{m.id}</span>
            <span className="text-muted-foreground text-xs">{m.date}</span>
            <Badge variant="secondary" className="text-[9px]">
              {m.status}
            </Badge>
            <span className="ml-auto text-xs">{m.task}</span>
          </div>
          <div className="text-muted-foreground text-xs">{m.items}</div>
          <div className="text-muted-foreground mt-1 text-[10px]">Issued by: {m.issued}</div>
        </div>
      ))}
      <div className="text-muted-foreground border-t border-[var(--pane-divider)] p-3 text-[11px]">
        MIN links material issue to specific DSR task. Stock deducted in real-time. Variance vs
        theoretical tracked in DSR Inspector.
      </div>
    </PaneBody>
  )
}
