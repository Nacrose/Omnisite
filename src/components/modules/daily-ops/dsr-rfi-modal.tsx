'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Mail, X, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { addRfi } from './rfi-store'
import type { DsrEntry } from './types'

interface DsrRfiModalProps {
  /** The DSR entry this RFI is being generated from. */
  entry: DsrEntry
  /** The stable RFI ID suffix (e.g. 'a1b2c3d4' → 'RFI-a1b2c3d4'). */
  rfiId: string
  /** Initial draft fields (subject + background are auto-populated). */
  initialDraft: {
    subject: string
    question: string
    impact: string
    background: string
  }
  onClose: () => void
}

/**
 * RFI Draft Modal — opened by "Generate RFI" from the DSR Inspector.
 *
 * Auto-populates Subject and Background from the DSR entry. Question and
 * Impact are mandatory (highlighted if empty). On save, calls addRfi() to
 * add the RFI to the shared store with linkedDsr set to the entry ID.
 *
 * Extracted from dsr-inspector.tsx so the main component focuses on layout.
 */
export function DsrRfiModal({ entry, rfiId, initialDraft, onClose }: DsrRfiModalProps) {
  const [rfiDraft, setRfiDraft] = useState(initialDraft)
  const [rfiSaved, setRfiSaved] = useState(false)

  const saveRfi = () => {
    if (!rfiDraft.question.trim() || !rfiDraft.impact.trim()) {
      return // validation handled in UI
    }
    addRfi({
      id: `r-dsr-${crypto.randomUUID()}`,
      number: `RFI-${rfiId}`,
      date: new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      subject: rfiDraft.subject || `RFI re: ${entry.task}`,
      question: rfiDraft.question,
      background: rfiDraft.background,
      impact: rfiDraft.impact,
      status: 'Open',
      replyBy: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      linkedDsr: entry.id,
      severity: 'medium',
    })
    setRfiSaved(true)
    setTimeout(() => onClose(), 1200)
    toast.success('RFI saved to register', {
      description: `${entry.id} → RFI-${rfiId} added to the RFI Register. Switch to the RFI tab to review.`,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="pane w-full max-w-lg overflow-hidden rounded-xl border border-[var(--pane-divider)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b border-[var(--pane-divider)] bg-sky-500/10 px-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-sky-500" />
            <span className="text-sm font-semibold">
              {rfiSaved ? 'RFI Draft Saved' : 'New RFI Draft — Auto-populated from DSR'}
            </span>
          </div>
          <button onClick={onClose} className="hover:bg-accent text-muted-foreground rounded p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {rfiSaved ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
            <div className="text-sm font-semibold">RFI-{rfiId} created</div>
            <div className="text-muted-foreground mt-1 text-xs">
              Draft saved — switch to the RFI Register tab to review and submit.
            </div>
          </div>
        ) : (
          <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
            {/* RFI number + linked DSR */}
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="text-[10px]">
                RFI-DRAFT
              </Badge>
              <span className="text-muted-foreground">
                Linked to: <span className="text-foreground font-mono">{entry.id}</span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{entry.chainage}</span>
            </div>

            {/* Subject — auto-populated */}
            <div>
              <label className="text-xs font-medium">Subject</label>
              <Input
                className="mt-1 h-8 text-xs"
                value={rfiDraft.subject}
                onChange={(e) => setRfiDraft((d) => ({ ...d, subject: e.target.value }))}
              />
            </div>

            {/* Background — auto-populated from DSR */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium">
                Background
                <span className="rounded bg-sky-500/15 px-1 py-0.5 text-[10px] font-normal text-sky-700 dark:text-sky-300">
                  auto-filled from DSR
                </span>
              </label>
              <Textarea
                className="mt-1 min-h-[80px] font-mono text-xs"
                value={rfiDraft.background}
                onChange={(e) => setRfiDraft((d) => ({ ...d, background: e.target.value }))}
              />
            </div>

            {/* Question — MANDATORY, highlighted if empty */}
            <div>
              <label className="flex items-center gap-1 text-xs font-medium">
                Question <span className="text-red-500">*</span>
                {!rfiDraft.question.trim() && (
                  <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
                    <AlertTriangle className="h-2.5 w-2.5" /> mandatory — missing
                  </span>
                )}
              </label>
              <Textarea
                className={cn(
                  'mt-1 min-h-[60px] text-xs',
                  !rfiDraft.question.trim() && 'border-amber-500/50 ring-1 ring-amber-500/20'
                )}
                placeholder="State the specific question for the consultant..."
                value={rfiDraft.question}
                onChange={(e) => setRfiDraft((d) => ({ ...d, question: e.target.value }))}
                autoFocus
              />
            </div>

            {/* Impact — MANDATORY, highlighted if empty */}
            <div>
              <label className="flex items-center gap-1 text-xs font-medium">
                Impact <span className="text-red-500">*</span>
                {!rfiDraft.impact.trim() && (
                  <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
                    <AlertTriangle className="h-2.5 w-2.5" /> mandatory — missing
                  </span>
                )}
              </label>
              <Textarea
                className={cn(
                  'mt-1 min-h-[60px] text-xs',
                  !rfiDraft.impact.trim() && 'border-amber-500/50 ring-1 ring-amber-500/20'
                )}
                placeholder="Describe cost/schedule impact if not resolved..."
                value={rfiDraft.impact}
                onChange={(e) => setRfiDraft((d) => ({ ...d, impact: e.target.value }))}
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[var(--pane-divider)] pt-2">
              <div className="text-muted-foreground text-[10px]">
                {!rfiDraft.question.trim() || !rfiDraft.impact.trim() ? (
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="h-3 w-3" /> Fill mandatory fields to save
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" /> Ready to save
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={!rfiDraft.question.trim() || !rfiDraft.impact.trim()}
                  onClick={saveRfi}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Save RFI Draft
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
