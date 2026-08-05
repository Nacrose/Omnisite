'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Mail, CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { addRfi } from './rfi-store'

interface RfiCreateModalProps {
  /** The RFI number suffix for the new RFI (e.g. 'a1b2c3d4' → 'RFI-a1b2c3d4'). */
  rfiId: string
  onClose: () => void
  onCreated: (newRfiId: string) => void
}

/**
 * Create-RFI modal — opened by the "+" button in the RFI Register header.
 *
 * Renders a form with Subject, Question (required), Impact (required), and
 * Background fields. On save, calls addRfi() to add the new RFI to the store,
 * shows a success state for 1.2s, then closes and selects the new RFI.
 *
 * Extracted from rfi-tab.tsx so the main component focuses on the list view.
 */
export function RfiCreateModal({ rfiId, onClose, onCreated }: RfiCreateModalProps) {
  const [createDraft, setCreateDraft] = useState({
    subject: '',
    question: '',
    impact: '',
    background: '',
  })
  const [createSaved, setCreateSaved] = useState(false)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="pane w-full max-w-lg overflow-hidden rounded-xl border border-[var(--pane-divider)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 items-center justify-between border-b border-[var(--pane-divider)] bg-sky-500/10 px-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-sky-500" />
            <span className="text-sm font-semibold">{createSaved ? 'RFI Created' : 'New RFI'}</span>
          </div>
          <button onClick={onClose} className="hover:bg-accent text-muted-foreground rounded p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {createSaved ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
            <div className="text-sm font-semibold">RFI-{rfiId} created</div>
            <div className="text-muted-foreground mt-1 text-xs">
              Added to the RFI Register as Open.
            </div>
          </div>
        ) : (
          <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
            <div>
              <label className="text-xs font-medium">Subject</label>
              <Input
                className="mt-1 h-8 text-xs"
                placeholder="Brief subject line…"
                value={createDraft.subject}
                onChange={(e) => setCreateDraft((d) => ({ ...d, subject: e.target.value }))}
                autoFocus
              />
            </div>
            <div>
              <label className="flex items-center gap-1 text-xs font-medium">
                Question <span className="text-red-500">*</span>
              </label>
              <Textarea
                className={cn(
                  'mt-1 min-h-[60px] text-xs',
                  !createDraft.question.trim() && 'border-amber-500/50 ring-1 ring-amber-500/20'
                )}
                placeholder="State the specific question for the consultant…"
                value={createDraft.question}
                onChange={(e) => setCreateDraft((d) => ({ ...d, question: e.target.value }))}
              />
            </div>
            <div>
              <label className="flex items-center gap-1 text-xs font-medium">
                Impact <span className="text-red-500">*</span>
              </label>
              <Textarea
                className={cn(
                  'mt-1 min-h-[60px] text-xs',
                  !createDraft.impact.trim() && 'border-amber-500/50 ring-1 ring-amber-500/20'
                )}
                placeholder="Describe cost/schedule impact…"
                value={createDraft.impact}
                onChange={(e) => setCreateDraft((d) => ({ ...d, impact: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Background</label>
              <Textarea
                className="mt-1 min-h-[60px] text-xs"
                placeholder="Context for the question…"
                value={createDraft.background}
                onChange={(e) => setCreateDraft((d) => ({ ...d, background: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between border-t border-[var(--pane-divider)] pt-2">
              <div className="text-muted-foreground text-[10px]">
                {!createDraft.question.trim() || !createDraft.impact.trim() ? (
                  <span className="text-amber-600">Fill mandatory fields to save</span>
                ) : (
                  <span className="text-emerald-600">Ready to save</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={!createDraft.question.trim() || !createDraft.impact.trim()}
                  onClick={() => {
                    const today = new Date().toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                    const replyBy = new Date(
                      Date.now() + 7 * 24 * 60 * 60 * 1000
                    ).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                    const newId = `r-manual-${crypto.randomUUID()}`
                    addRfi({
                      id: newId,
                      number: `RFI-${rfiId}`,
                      date: today,
                      subject: createDraft.subject || 'New RFI',
                      question: createDraft.question,
                      background: createDraft.background || 'No background provided.',
                      impact: createDraft.impact,
                      status: 'Open',
                      replyBy,
                      severity: 'medium',
                    })
                    setCreateSaved(true)
                    setTimeout(() => {
                      onCreated(newId)
                    }, 1200)
                    toast.success('RFI created', {
                      description: `RFI-${rfiId} added to the register.`,
                    })
                  }}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Save RFI
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
