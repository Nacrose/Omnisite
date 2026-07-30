'use client'

import { useState } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Plus, Search, Mail, FileText, AlertTriangle, ArrowRight, ArrowLeft, Calendar, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Letter {
  id: string; number: string; date: string; type: 'Incoming' | 'Outgoing' | 'Site Instruction'; from: string; to: string; subject: string; replyBy?: string; replyTo?: string; hasVariation?: boolean;
}

// Fixed "today" reference to avoid hydration mismatch from new Date() during render.
// In production this would come from the server context.
const TODAY = new Date('2026-07-30T10:00:00')

const LETTERS: Letter[] = [
  { id: 'L-001', number: 'CL/DOR/2026-087', date: '28 Jul 2026', type: 'Incoming', from: 'DoR — Supervision Consultant', to: 'OmniSite Contractor', subject: 'Approval — PCC mix design for foundation', replyBy: '02 Aug 2026' },
  { id: 'L-002', number: 'OMS/2026-142', date: '29 Jul 2026', type: 'Outgoing', from: 'OmniSite Contractor', to: 'DoR — Supervision Consultant', subject: 'RE: PCC mix design — additional test results attached', replyTo: 'L-001' },
  { id: 'L-003', number: 'SI/2026-022', date: '29 Jul 2026', type: 'Site Instruction', from: 'DoR Engineer', to: 'OmniSite Contractor', subject: 'SI: Extra excavation at chainage 2+850 due to soft soil', hasVariation: true },
  { id: 'L-004', number: 'CL/DOR/2026-088', date: '25 Jul 2026', type: 'Incoming', from: 'DoR — Supervision Consultant', to: 'OmniSite Contractor', subject: 'Request for clarification — rebar detailing at expansion joint', replyBy: '26 Jul 2026' },
  { id: 'L-005', number: 'OMS/2026-138', date: '20 Jul 2026', type: 'Outgoing', from: 'OmniSite Contractor', to: 'DoR — Supervision Consultant', subject: 'EOT claim — additional 14 days for unexpected rock excavation' },
  { id: 'L-006', number: 'CL/DOR/2026-085', date: '18 Jul 2026', type: 'Incoming', from: 'Client (DoR)', to: 'OmniSite Contractor', subject: 'Monthly progress review meeting minutes — July' },
]

export function CorrespondenceModule() {
  const [selectedId, setSelectedId] = useState('L-001')
  const [filter, setFilter] = useState<'All' | 'Incoming' | 'Outgoing' | 'Site Instruction'>('All')
  const selected = LETTERS.find(l => l.id === selectedId) ?? LETTERS[0]
  const filtered = filter === 'All' ? LETTERS : LETTERS.filter(l => l.type === filter)

  return (
    <Workspace2Pane
      leftPane={
        <>
          <PaneHeader title="Categories">
            <Button variant="ghost" size="sm" className="h-7"><Plus className="w-3.5 h-3.5" /></Button>
          </PaneHeader>
          <PaneBody className="py-2">
            {(['All', 'Incoming', 'Outgoing', 'Site Instruction'] as const).map(f => {
              const count = f === 'All' ? LETTERS.length : LETTERS.filter(l => l.type === f).length
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn('w-full flex items-center justify-between px-3 py-1.5 text-xs', filter === f ? 'bg-accent border-l-2 border-primary' : 'hover:bg-accent/50 border-l-2 border-transparent')}
                >
                  <span className="flex items-center gap-2">
                    {f === 'Incoming' && <ArrowRight className="w-3 h-3 text-emerald-500" />}
                    {f === 'Outgoing' && <ArrowLeft className="w-3 h-3 text-sky-500" />}
                    {f === 'Site Instruction' && <FileText className="w-3 h-3 text-amber-500" />}
                    {f === 'All' && <Mail className="w-3 h-3 text-muted-foreground" />}
                    {f}
                  </span>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1">{count}</Badge>
                </button>
              )
            })}
            <div className="mt-4 px-3">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search letters…" className="h-8 pl-7 text-xs" />
              </div>
            </div>
          </PaneBody>
        </>
      }
      centerPane={
        <>
          <PaneHeader title={`Letter Register · ${filtered.length} items`}>
            <Button size="sm" className="h-7 text-xs gap-1.5"><Plus className="w-3.5 h-3.5" />New Letter</Button>
          </PaneHeader>
          <div className="flex items-center h-8 border-b border-[var(--pane-divider)] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/30">
            <div className="w-32 px-2">Letter #</div>
            <div className="w-24 px-2">Date</div>
            <div className="w-20 px-2">Type</div>
            <div className="flex-1 px-2">Subject</div>
            <div className="w-44 px-2">From / To</div>
            <div className="w-28 px-2">Reply Due</div>
          </div>
          <PaneBody className="px-0">
            {filtered.map(l => {
              const replyOverdue = l.replyBy && new Date(l.replyBy) < TODAY && l.type === 'Incoming' && !l.replyTo
              return (
                <div
                  key={l.id}
                  onClick={() => setSelectedId(l.id)}
                  className={cn('flex items-center h-12 border-b border-[var(--pane-divider)] text-xs cursor-pointer row-hover', selectedId === l.id && 'bg-accent', replyOverdue && 'bg-red-500/5')}
                >
                  <div className="w-32 px-2 font-mono text-[10px] text-muted-foreground truncate">{l.number}</div>
                  <div className="w-24 px-2 text-muted-foreground">{l.date}</div>
                  <div className="w-20 px-2">
                    <Badge variant="outline" className={cn('text-[9px]', l.type === 'Incoming' && 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300', l.type === 'Outgoing' && 'border-sky-500/40 text-sky-700 dark:text-sky-300', l.type === 'Site Instruction' && 'border-amber-500/40 text-amber-700 dark:text-amber-300')}>{l.type === 'Site Instruction' ? 'SI' : l.type}</Badge>
                  </div>
                  <div className="flex-1 px-2 min-w-0">
                    <div className="font-medium truncate">{l.subject}</div>
                    {l.hasVariation && <div className="text-[10px] text-amber-600 flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" />Carries variation cost/schedule impact</div>}
                  </div>
                  <div className="w-44 px-2 text-[10px] text-muted-foreground truncate">
                    <div>{l.from}</div>
                    <div className="opacity-70">→ {l.to}</div>
                  </div>
                  <div className="w-28 px-2">
                    {l.replyBy && (
                      <span className={cn('text-[10px] flex items-center gap-1', replyOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground')}>
                        {replyOverdue && <AlertTriangle className="w-2.5 h-2.5" />}
                        {l.replyBy}
                      </span>
                    )}
                    {l.replyTo && <span className="text-[10px] text-emerald-600">Replied → {l.replyTo}</span>}
                  </div>
                </div>
              )
            })}
          </PaneBody>
        </>
      }
      rightPane={
        <>
          <PaneHeader title={`Letter Inspector · ${selected.number}`} />
          <PaneBody>
            <div className="p-4 border-b border-[var(--pane-divider)]">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={cn('text-[10px]', selected.type === 'Incoming' && 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300', selected.type === 'Outgoing' && 'border-sky-500/40 text-sky-700 dark:text-sky-300', selected.type === 'Site Instruction' && 'border-amber-500/40 text-amber-700 dark:text-amber-300')}>{selected.type}</Badge>
                <Badge variant="secondary" className="text-[10px]">{selected.date}</Badge>
              </div>
              <div className="text-sm font-semibold leading-snug">{selected.subject}</div>
              <div className="text-xs text-muted-foreground mt-2 font-mono">{selected.number}</div>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">From</div>
                  <div className="font-medium mt-0.5">{selected.from}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">To</div>
                  <div className="font-medium mt-0.5">{selected.to}</div>
                </div>
              </div>

              <Separator />

              {selected.replyBy && (
                <div className={cn('p-2.5 rounded-md text-[11px]', selected.replyTo ? 'bg-emerald-500/10 border border-emerald-500/30' : new Date(selected.replyBy) < TODAY ? 'bg-red-500/10 border border-red-500/30' : 'bg-amber-500/10 border border-amber-500/30')}>
                  <div className="flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    {selected.replyTo ? `Replied via ${selected.replyTo}` : new Date(selected.replyBy) < TODAY ? `Overdue by ${Math.ceil((TODAY.getTime() - new Date(selected.replyBy).getTime()) / 86400000)} days` : `Reply required by ${selected.replyBy}`}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Letter body (preview)</div>
                <div className="p-3 rounded-md border border-[var(--pane-divider)] bg-secondary/20 text-[11px] leading-relaxed text-muted-foreground max-h-40 overflow-y-auto">
                  Dear Sir/Madam,{'\n\n'}
                  With reference to the above-mentioned subject, we would like to inform you that the PCC mix design (M15 grade) for the foundation works at chainage 4+200 to 4+500 has been finalized as per DoR Norms 2075. The mix proportions are 1:2:4 with water-cement ratio of 0.50. Trial mix results are attached for your review and approval.{'\n\n'}
                  Requesting your kind approval at the earliest to enable commencement of works scheduled for 02 Aug 2026.{'\n\n'}
                  Thank you,{'\n'}
                  Project Manager
                </div>
              </div>

              {selected.hasVariation && (
                <>
                  <Separator />
                  <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px]">
                    <div className="font-medium flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" />Convertible to Variation Order</div>
                    <div className="text-muted-foreground mt-0.5">This Site Instruction carries cost/schedule impact. Convert to formal Variation Order per FIDIC Clause 13.</div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 text-[10px] gap-1"
                      onClick={() => {
                        toast.success('Variation Order created', {
                          description: `${selected.number} → VO-2026-008 · Cost impact NPR 1.85M · 14-day schedule extension. Pushed to Financials.`,
                        })
                      }}
                    >
                      <ArrowRight className="w-3 h-3" />Convert to Variation Order
                    </Button>
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-1.5">
                <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start gap-2"><FileText className="w-3.5 h-3.5" />View PDF</Button>
                <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start gap-2"><Mail className="w-3.5 h-3.5" />Draft Reply</Button>
                <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start gap-2"><Calendar className="w-3.5 h-3.5" />Schedule follow-up</Button>
              </div>
            </div>
          </PaneBody>
        </>
      }
      leftPaneWidth="240px"
      rightPaneWidth="380px"
    />
  )
}
