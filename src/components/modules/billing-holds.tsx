'use client'

import { useState, useEffect, useCallback } from 'react'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lock, Unlock, Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Hold {
  id: string
  ncr_id: string | null
  vendor_id: string | null
  hold_type: string
  hold_reason: string
  hold_amount: number
  status: string
  created_at: string
}

export function BillingHoldsView() {
  const [holds, setHolds] = useState<Hold[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHolds = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/billing-holds?status=ACTIVE')
      if (res.ok) setHolds(await res.json())
    } catch {
      /* demo mode */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHolds()
  }, [fetchHolds])

  const release = async (id: string) => {
    try {
      // Use POST (upsert) instead of PATCH — createCrudHandler only exposes
      // GET / POST / DELETE. The POST path treats the call as an UPDATE
      // because the hold row already exists (matched by PK `id`), so
      // upsertWithAudit updates the status + release metadata.
      const res = await fetch('/api/billing-holds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: 'RELEASED',
          releasedAt: new Date().toISOString(),
        }),
      })
      if (res.ok) {
        toast.success('Hold released')
        fetchHolds()
      } else {
        toast.error('Failed to release', {
          description: `Server returned ${res.status}. The hold may have already been released.`,
        })
      }
    } catch {
      toast.error('Failed to release — network error')
    }
  }

  const totalLocked = holds.reduce((s, h) => s + h.hold_amount, 0)

  return (
    <>
      <PaneHeader title="Billing Holds">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={fetchHolds}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Refresh'}
        </Button>
      </PaneHeader>
      <PaneBody className="p-4">
        {holds.length > 0 && (
          <div
            className={cn(
              'mb-3 rounded-md p-3 text-xs',
              totalLocked > 0
                ? 'border border-amber-500/30 bg-amber-500/10'
                : 'border border-emerald-500/30 bg-emerald-500/10'
            )}
          >
            <div className="flex items-center gap-1.5 font-medium">
              {totalLocked > 0 ? (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              ) : (
                <Lock className="h-3.5 w-3.5 text-emerald-500" />
              )}
              {holds.length} active hold{holds.length !== 1 ? 's' : ''}
              {totalLocked > 0 && ` · NPR ${totalLocked.toLocaleString()} locked`}
            </div>
          </div>
        )}

        {holds.length === 0 && !loading && (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Lock className="h-8 w-8 opacity-30" />
            <div className="text-sm font-medium">No active billing holds</div>
            <p className="text-muted-foreground max-w-xs text-[11px]">
              Billing holds are created automatically when NCRs are opened. They block vendor
              payments until the NCR is closed.
            </p>
          </div>
        )}

        {holds.map((h) => (
          <div
            key={h.id}
            className="mb-1.5 flex items-center gap-3 rounded border border-[var(--pane-divider)] p-2"
          >
            <Lock className="h-3.5 w-3.5 text-amber-500" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium">{h.hold_reason}</div>
              <div className="text-muted-foreground text-[10px]">
                {h.hold_type} · {h.ncr_id || 'Manual'}
                {h.hold_amount > 0 && ` · NPR ${h.hold_amount.toLocaleString()}`}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-6 gap-1 px-2 text-[10px]"
              onClick={() => release(h.id)}
            >
              <Unlock className="h-3 w-3" /> Release
            </Button>
          </div>
        ))}
      </PaneBody>
    </>
  )
}

export default BillingHoldsView
