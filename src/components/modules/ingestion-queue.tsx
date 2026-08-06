'use client'

import { useState, useEffect, useCallback } from 'react'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, X, Loader2, Inbox, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Draft {
  id: string
  draft_type: string
  extracted_data: Record<string, unknown>
  confidence_score: number | null
  validation_status: string
  created_at: string
}

export function IngestionQueueView() {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const fetchDrafts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ingestion/drafts')
      if (res.ok) {
        const data = await res.json()
        setDrafts(data)
      }
    } catch { /* demo mode */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchDrafts() }, [fetchDrafts])

  const approve = async (id: string) => {
    try {
      const res = await fetch(`/api/ingestion/drafts?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validation_status: 'VALIDATED' }),
      })
      if (res.ok) {
        toast.success('Draft approved', { description: 'Official record will be created.' })
        fetchDrafts()
      }
    } catch { toast.error('Failed to approve') }
  }

  const reject = async (id: string) => {
    try {
      const res = await fetch(`/api/ingestion/drafts?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validation_status: 'REJECTED' }),
      })
      if (res.ok) {
        toast.info('Draft rejected')
        fetchDrafts()
      }
    } catch { toast.error('Failed to reject') }
  }

  const pending = drafts.filter((d) => d.validation_status === 'PENDING_VALIDATION')
  const validated = drafts.filter((d) => d.validation_status === 'VALIDATED')
  const rejected = drafts.filter((d) => d.validation_status === 'REJECTED')

  return (
    <>
      <PaneHeader title="Ingestion Queue">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={fetchDrafts} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Refresh'}
        </Button>
      </PaneHeader>
      <PaneBody className="p-4">
        {drafts.length === 0 && !loading && (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Inbox className="h-8 w-8 opacity-30" />
            <div className="text-sm font-medium">No drafts in queue</div>
            <p className="text-muted-foreground max-w-xs text-[11px]">
              Drafts from field data ingestion (DSR, attendance, material receipts) will appear here for validation.
            </p>
          </div>
        )}

        {pending.length > 0 && (
          <div className="mb-4">
            <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
              Pending Validation ({pending.length})
            </div>
            {pending.map((d) => (
              <DraftRow key={d.id} draft={d} onApprove={approve} onReject={reject} />
            ))}
          </div>
        )}

        {validated.length > 0 && (
          <div className="mb-4">
            <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
              Validated ({validated.length})
            </div>
            {validated.map((d) => <DraftRow key={d.id} draft={d} onApprove={() => {}} onReject={() => {}} />)}
          </div>
        )}

        {rejected.length > 0 && (
          <div>
            <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
              Rejected ({rejected.length})
            </div>
            {rejected.map((d) => <DraftRow key={d.id} draft={d} onApprove={() => {}} onReject={() => {}} />)}
          </div>
        )}
      </PaneBody>
    </>
  )
}

function DraftRow({ draft, onApprove, onReject }: {
  draft: Draft
  onApprove: (id: string) => void
  onReject: (id: string) => void
}) {
  const STATUS_COLORS: Record<string, string> = {
    PENDING_VALIDATION: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
    VALIDATED: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
    REJECTED: 'border-red-500/40 text-red-700 dark:text-red-300',
    CONVERTED: 'border-sky-500/40 text-sky-700 dark:text-sky-300',
  }

  return (
    <div className="mb-1.5 flex items-center gap-3 rounded border border-[var(--pane-divider)] p-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{draft.draft_type}</span>
          <Badge variant="outline" className={cn('text-[9px]', STATUS_COLORS[draft.validation_status])}>
            {draft.validation_status}
          </Badge>
          {draft.confidence_score !== null && (
            <span className="text-muted-foreground text-[9px]">
              {Math.round(draft.confidence_score * 100)}% confidence
            </span>
          )}
        </div>
        <div className="text-muted-foreground text-[10px] truncate">
          {Object.entries(draft.extracted_data).slice(0, 3).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}
        </div>
      </div>
      {draft.validation_status === 'PENDING_VALIDATION' && (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-[10px] text-emerald-600" onClick={() => onApprove(draft.id)}>
            <CheckCircle2 className="h-3 w-3" /> Approve
          </Button>
          <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-[10px] text-red-600" onClick={() => onReject(draft.id)}>
            <X className="h-3 w-3" /> Reject
          </Button>
        </div>
      )}
    </div>
  )
}

export default IngestionQueueView
