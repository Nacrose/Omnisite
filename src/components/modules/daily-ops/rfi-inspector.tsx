'use client'

import { useState } from 'react'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Mail,
  FileText,
  AlertTriangle,
  ArrowRight,
  Clock,
  HelpCircle,
  CheckCircle2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { LocationPicker } from '@/components/ui/location-picker'
import { updateRfi, type Rfi } from './rfi-store'

// ─── RFI Inspector ──────────────────────────────────────────────────────────

export function RfiInspector({
  rfi,
  onOpenDsr,
}: {
  rfi: Rfi
  /** Fired when the user clicks "Open linked DSR". The parent switches to
   *  the DSR tab and selects the linked entry (audit D2-3). */
  onOpenDsr?: (dsrId: string) => void
}) {
  const isOverdue = rfi.status === 'Open' && new Date(rfi.replyBy) < new Date()
  // Reply modal state — opened by "Log Consultant Reply" (audit D2-2).
  const [replyModalOpen, setReplyModalOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replySaved, setReplySaved] = useState(false)

  const handleSaveReply = () => {
    if (!replyText.trim()) return
    const today = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    // Update the RFI in the store: set status to Replied, stamp the reply
    // text and date (audit D2-2/D2-7).
    updateRfi(rfi.id, {
      status: 'Replied',
      reply: replyText.trim(),
      repliedDate: today,
    })
    setReplySaved(true)
    setTimeout(() => {
      setReplyModalOpen(false)
      setReplySaved(false)
      setReplyText('')
    }, 1200)
    toast.success('Reply logged', {
      description: `${rfi.number} marked as Replied.`,
    })
  }
  return (
    <>
      <PaneHeader title={`RFI Inspector · ${rfi.number}`} />
      <PaneBody>
        <div className="border-b border-[var(--pane-divider)] p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'text-[10px]',
                rfi.status === 'Open' && 'border-amber-500/40 text-amber-700 dark:text-amber-300',
                rfi.status === 'Replied' && 'border-sky-500/40 text-sky-700 dark:text-sky-300',
                rfi.status === 'Closed' &&
                  'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
              )}
            >
              {rfi.status}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {rfi.date}
            </Badge>
            {rfi.severity === 'high' && (
              <Badge
                variant="outline"
                className="border-red-500/40 text-[10px] text-red-700 dark:text-red-300"
              >
                HIGH SEVERITY
              </Badge>
            )}
            {rfi.linkedDsr && (
              <Badge
                variant="outline"
                className="border-violet-500/40 text-[10px] text-violet-700 dark:text-violet-300"
              >
                Linked DSR: {rfi.linkedDsr}
              </Badge>
            )}
          </div>
          <div className="text-sm leading-snug font-semibold">{rfi.subject}</div>
          <div className="text-muted-foreground mt-2 font-mono text-xs">{rfi.number}</div>
        </div>

        <div className="space-y-3 p-4 text-xs">
          {/* Reply deadline */}
          <div
            className={cn(
              'rounded-md p-2.5 text-[11px]',
              rfi.status === 'Closed'
                ? 'border border-emerald-500/30 bg-emerald-500/10'
                : rfi.status === 'Replied'
                  ? 'border border-sky-500/30 bg-sky-500/10'
                  : isOverdue
                    ? 'border border-red-500/30 bg-red-500/10'
                    : 'border border-amber-500/30 bg-amber-500/10'
            )}
          >
            <div className="flex items-center gap-1.5 font-medium">
              <Clock className="h-3.5 w-3.5" />
              {rfi.status === 'Closed'
                ? `Closed ${rfi.repliedDate}`
                : rfi.status === 'Replied'
                  ? `Replied ${rfi.repliedDate}`
                  : isOverdue
                    ? `Overdue — reply was due ${rfi.replyBy}`
                    : `Consultant reply due by ${rfi.replyBy}`}
            </div>
          </div>

          {/* Question */}
          <div>
            <div className="text-muted-foreground mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase">
              <HelpCircle className="h-3 w-3" />
              Question
            </div>
            <div className="bg-secondary/20 rounded-md border border-[var(--pane-divider)] p-3 text-[11px] leading-relaxed">
              {rfi.question}
            </div>
          </div>

          {/* Background */}
          <div>
            <div className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wider uppercase">
              Background
            </div>
            <div className="bg-secondary/20 text-muted-foreground rounded-md border border-[var(--pane-divider)] p-3 text-[11px] leading-relaxed">
              {rfi.background}
            </div>
          </div>

          {/* Impact */}
          <div>
            <div className="text-muted-foreground mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase">
              <AlertTriangle className="h-3 w-3" />
              Impact (Cost / Schedule)
            </div>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] leading-relaxed">
              {rfi.impact}
            </div>
          </div>

          {/* Location picker — optional FK to project_locations.id */}
          <div>
            <div className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wider uppercase">
              Work Location
            </div>
            <LocationPicker
              value={rfi.locationId}
              onChange={(locationId) => {
                updateRfi(rfi.id, { locationId: locationId ?? undefined })
                toast.success('Location linked to RFI', {
                  description: locationId
                    ? `Linked ${rfi.number} → ${locationId}`
                    : `Cleared location on ${rfi.number}`,
                })
              }}
              allowClear
              placeholder="Link to a project location…"
            />
          </div>

          {/* Reply */}
          {rfi.reply && (
            <>
              <Separator />
              <div>
                <div className="text-muted-foreground mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  Consultant Reply
                </div>
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-[11px] leading-relaxed">
                  {rfi.reply}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Cost / Schedule summary */}
          {(rfi.costImpact || rfi.scheduleImpact) && (
            <div className="grid grid-cols-2 gap-2">
              {rfi.costImpact && (
                <div className="rounded-md border border-[var(--pane-divider)] p-2">
                  <div className="text-muted-foreground text-[10px] tracking-wider uppercase">
                    Cost Impact
                  </div>
                  <div className="mt-0.5 font-mono font-medium">{rfi.costImpact}</div>
                </div>
              )}
              {rfi.scheduleImpact && (
                <div className="rounded-md border border-[var(--pane-divider)] p-2">
                  <div className="text-muted-foreground text-[10px] tracking-wider uppercase">
                    Schedule Impact
                  </div>
                  <div className="mt-0.5 font-medium">{rfi.scheduleImpact}</div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-1.5 pt-1">
            {rfi.status === 'Open' && (
              <Button
                variant="default"
                size="sm"
                className="h-8 w-full justify-start gap-2 text-xs"
                onClick={() => {
                  setReplyText('')
                  setReplySaved(false)
                  setReplyModalOpen(true)
                }}
                title="Log Consultant Reply"
              >
                <Mail className="h-3.5 w-3.5" />
                Log Consultant Reply
              </Button>
            )}
            {rfi.status === 'Replied' && (
              <Button
                variant="default"
                size="sm"
                className="h-8 w-full justify-start gap-2 text-xs"
                onClick={() => {
                  // Mark the RFI as Closed (audit D4-2 — previously there
                  // was no way to close a Replied RFI).
                  const today = new Date().toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                  updateRfi(rfi.id, {
                    status: 'Closed',
                    repliedDate: rfi.repliedDate || today,
                  })
                  toast.success('RFI closed', {
                    description: `${rfi.number} marked as Closed.`,
                  })
                }}
                title="Close RFI"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Close RFI
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-xs"
              onClick={() =>
                toast.info('RFI PDF export coming soon', {
                  description: `Will render ${rfi.number} as a printable PDF using the question / background / impact fields above.`,
                })
              }
            >
              <FileText className="h-3.5 w-3.5" />
              View PDF
            </Button>
            {rfi.linkedDsr && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full justify-start gap-2 text-xs"
                onClick={() => {
                  if (onOpenDsr && rfi.linkedDsr) {
                    onOpenDsr(rfi.linkedDsr)
                  } else {
                    toast.info('Linked DSR navigation coming soon', {
                      description: `Will switch the Daily Ops module to the DSR tab and select ${rfi.linkedDsr}.`,
                    })
                  }
                }}
                title="Open linked DSR"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                Open linked DSR ({rfi.linkedDsr})
              </Button>
            )}
            {/* Show the Convert-to-VO button whenever there's a non-trivial cost impact
                (not just when the string contains 'VO' — "potential" costs are exactly
                the case where a VO would be filed). */}
            {rfi.costImpact && rfi.costImpact !== 'None' && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full justify-start gap-2 text-xs text-amber-600"
                onClick={() =>
                  toast.info('Convert to Variation Order coming soon', {
                    description: `Will create a VO draft from ${rfi.number} with the cost impact pre-filled. VO module is not yet wired.`,
                  })
                }
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Convert to Variation Order
              </Button>
            )}
          </div>
        </div>
      </PaneBody>

      {/* Reply Modal — opened by "Log Consultant Reply" (audit D2-2) */}
      {replyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setReplyModalOpen(false)}
        >
          <div
            className="pane w-full max-w-lg overflow-hidden rounded-xl border border-[var(--pane-divider)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 items-center justify-between border-b border-[var(--pane-divider)] bg-sky-500/10 px-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-sky-500" />
                <span className="text-sm font-semibold">
                  {replySaved ? 'Reply Saved' : `Log Consultant Reply — ${rfi.number}`}
                </span>
              </div>
              <button
                onClick={() => setReplyModalOpen(false)}
                className="hover:bg-accent text-muted-foreground rounded p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {replySaved ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
                <div className="text-sm font-semibold">Reply logged</div>
                <div className="text-muted-foreground mt-1 text-xs">
                  {rfi.number} marked as Replied.
                </div>
              </div>
            ) : (
              <div className="space-y-3 p-4">
                <div>
                  <label className="text-xs font-medium">Consultant Reply</label>
                  <Textarea
                    className="mt-1 min-h-[120px] text-xs"
                    placeholder="Paste or type the consultant's reply here…"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex items-center justify-between border-t border-[var(--pane-divider)] pt-2">
                  <div className="text-muted-foreground text-[10px]">
                    {!replyText.trim() ? (
                      <span className="text-amber-600">Reply text is required</span>
                    ) : (
                      <span className="text-emerald-600">Ready to save</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setReplyModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={!replyText.trim()}
                      onClick={handleSaveReply}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Save Reply
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
