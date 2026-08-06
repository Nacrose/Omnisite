'use client'

import { useState } from 'react'
import { useSyncedState } from '@/lib/use-synced-state'
import { useApp } from '@/lib/app-store'
import { Loader2, Package, Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Po {
  id: string
  vendor: string
  vendorName?: string
  poQty: number
  grnQty: number
  invoiceQty: number
  rate: number
  poRate?: number
  status: string
  payStatus: string
}

interface Grn {
  id: string
  poId: string
  vendor: string
  poQty: number
  grnQty: number
  invoiceQty: number
  rate: number
  poRate?: number
  status: string
  payStatus: string
}

export default function MobileGrnPage() {
  const { activeProjectDbId } = useApp()
  const [pos] = useSyncedState<Po[]>(
    'omnisite-procurement-pos',
    'purchase_orders',
    () => [] as Po[],
    { primaryKey: 'id' }
  )
  const [grns, setGrns] = useSyncedState<Grn[]>(
    'omnisite-procurement-grns',
    'grns',
    () => [] as Grn[],
    { primaryKey: 'id' }
  )
  const [search, setSearch] = useState('')
  const [receivingPo, setReceivingPo] = useState<Po | null>(null)
  const [receivedQty, setReceivedQty] = useState('')

  const filteredPos = search.trim()
    ? pos.filter(
        (p) =>
          p.id.toLowerCase().includes(search.toLowerCase()) ||
          (p.vendorName || p.vendor || '').toLowerCase().includes(search.toLowerCase())
      )
    : pos

  const handleReceive = () => {
    if (!receivingPo) return
    const qty = parseFloat(receivedQty)
    if (Number.isNaN(qty) || qty <= 0) {
      toast.error('Invalid quantity', { description: 'Enter a positive number.' })
      return
    }

    const grn: Grn = {
      id: `GRN-${Date.now().toString(36)}`,
      poId: receivingPo.id,
      vendor: receivingPo.vendor,
      poQty: receivingPo.poQty,
      grnQty: qty,
      invoiceQty: qty,
      rate: receivingPo.poRate || receivingPo.rate,
      poRate: receivingPo.poRate,
      status: 'Received',
      payStatus: 'Hold',
    }

    setGrns((prev) => [grn, ...prev])
    toast.success('GRN created', {
      description: `${qty} units received against ${receivingPo.id}.`,
    })
    setReceivingPo(null)
    setReceivedQty('')
  }

  return (
    <div className="space-y-3 p-4">
      <div>
        <h1 className="text-lg font-bold">Receive Material</h1>
        <p className="text-muted-foreground text-sm">Create a GRN from a PO</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search PO number or vendor…"
          className="border-border bg-card focus:border-primary w-full rounded-xl border py-2 pr-3 pl-9 text-sm outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* PO list */}
      <div className="space-y-2">
        {filteredPos.map((po) => (
          <button
            key={po.id}
            onClick={() => {
              setReceivingPo(po)
              setReceivedQty(String(po.poQty))
            }}
            className="border-border bg-card active:bg-accent flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600">
              <Package className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-sm font-medium">{po.id}</div>
              <div className="text-muted-foreground truncate text-xs">
                {po.vendorName || po.vendor}
              </div>
              <div className="text-muted-foreground text-[11px]">
                PO: {po.poQty} · Received: {po.grnQty} · Rate: {po.rate}
              </div>
            </div>
          </button>
        ))}

        {filteredPos.length === 0 && !pos.length && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        )}

        {filteredPos.length === 0 && pos.length > 0 && (
          <div className="text-muted-foreground py-8 text-center text-sm">
            No POs match your search
          </div>
        )}
      </div>

      {/* Recent GRNs */}
      {grns.length > 0 && (
        <div>
          <h2 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
            Recent GRNs
          </h2>
          <div className="space-y-1.5">
            {grns.slice(0, 5).map((grn) => (
              <div
                key={grn.id}
                className="border-border bg-card flex items-center justify-between rounded-lg border p-2 text-xs"
              >
                <div>
                  <span className="font-mono font-medium">{grn.id}</span>
                  <span className="text-muted-foreground ml-2">← {grn.poId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{grn.grnQty} units</span>
                  <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-600">
                    {grn.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Receive modal (bottom sheet style) */}
      {receivingPo && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40"
          onClick={() => setReceivingPo(null)}
        >
          <div
            className="border-border bg-background safe-area-bottom w-full rounded-t-2xl border-t p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3">
              <div className="text-sm font-bold">Receive against {receivingPo.id}</div>
              <div className="text-muted-foreground text-xs">
                {receivingPo.vendorName || receivingPo.vendor} · PO qty: {receivingPo.poQty}
              </div>
            </div>

            <label className="text-muted-foreground text-xs font-medium">Received quantity</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="border-border bg-card focus:border-primary mt-1 mb-3 w-full rounded-xl border px-3 py-2.5 font-mono text-base outline-none"
              value={receivedQty}
              onChange={(e) => setReceivedQty(e.target.value)}
              autoFocus
            />

            <div className="flex gap-2">
              <button
                onClick={() => setReceivingPo(null)}
                className="border-border text-muted-foreground active:bg-accent flex-1 rounded-xl border py-2.5 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleReceive}
                className="bg-primary text-primary-foreground flex-1 rounded-xl py-2.5 text-sm font-medium active:opacity-80"
              >
                <Check className="mr-1 inline h-4 w-4" />
                Create GRN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
