'use client'

import { useState } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Search, Plus, Mail, FileText, AlertTriangle, ArrowRight, Clock,
  HelpCircle, CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Rfi {
  id: string
  number: string
  date: string
  subject: string
  question: string
  background: string
  impact: string
  status: 'Open' | 'Replied' | 'Closed'
  replyBy: string
  reply?: string
  repliedDate?: string
  linkedDsr?: string
  costImpact?: string
  scheduleImpact?: string
  severity: 'low' | 'medium' | 'high'
}

// Fixed "today" reference to avoid hydration mismatch from new Date() during render.
const TODAY = new Date('2026-07-30T10:00:00')

export const RFIS: Rfi[] = [
  {
    id: 'r1',
    number: 'RFI-067',
    date: '22 Jul 2026',
    subject: 'Rebar detailing at expansion joint — chainage 4+200',
    question: 'The contract drawings show lap splices of 40φ at the expansion joint, but the special detailing note on Sheet KRR-P3-DR-DR-008 Rev A calls for mechanical couplers in this zone. Please clarify which applies — and if couplers, what type (Type 1 vs Type 2 per ASTM A1035).',
    background: 'DSR Entry D-087 — Foundation PCC at chainage 4+200 to 4+350. Rebar fabrication is scheduled to start 02 Aug 2026. The rebar shop drawings cannot be finalized until this is resolved.',
    impact: 'Schedule: ~3 days of float on T-203 (Foundation). If delayed beyond 02 Aug, the critical path slips and the Substructure milestone (T-404, Wk 48) is at risk. Cost: couplers add ~NPR 850/ea × ~120 locations = NPR 102,000 if required.',
    status: 'Open',
    replyBy: '26 Jul 2026',
    linkedDsr: 'D-087',
    costImpact: 'NPR 102,000 (potential)',
    scheduleImpact: '3 days float on T-203',
    severity: 'high',
  },
  {
    id: 'r2',
    number: 'RFI-066',
    date: '20 Jul 2026',
    subject: 'Concrete cover for pile caps in aggressive soil zone',
    question: 'The geotechnical report flags sulphate exposure (Class 2) at chainage 3+100 to 3+400. The BOQ specifies 50mm cover for pile caps, but IS 456:2000 Table 4 recommends 75mm for Class 2 exposure. Which applies?',
    background: 'Pile cap pour for Section 2 is scheduled for 05 Aug 2026. ~42 pile caps affected across the chainage range.',
    impact: 'Cost: +25mm cover × 42 caps × nominal rebar increase ≈ NPR 145,000. No schedule impact — rebar already on site can be adjusted.',
    status: 'Replied',
    replyBy: '24 Jul 2026',
    reply: 'Engineer confirms 75mm cover required per IS 456:2000 for Class 2 sulphate exposure. Additional cost treated as a Variation Order per FIDIC Clause 13. Please submit BOQ adjustment via the Variation Order module.',
    repliedDate: '24 Jul 2026',
    linkedDsr: 'D-085',
    costImpact: 'NPR 145,000 (confirmed → VO)',
    scheduleImpact: 'None',
    severity: 'medium',
  },
  {
    id: 'r3',
    number: 'RFI-065',
    date: '15 Jul 2026',
    subject: 'Drainage outlet invert levels at chainage 2+100',
    question: 'The road profile drawing (KRR-P3-RD-PR-003) and the drainage drawing (KRR-P3-DR-DN-012) show conflicting invert levels for the outlet at ch. 2+100 (RL 1184.50 vs RL 1184.20). Which is correct?',
    background: 'Drainage works at ch. 2+050 to 2+200 are underway. The excavation was paused at the outlet location pending clarification.',
    impact: 'Schedule: 1 day of rework if the wrong invert is cast. Cost: ~NPR 18,000 for rework if needed.',
    status: 'Closed',
    replyBy: '18 Jul 2026',
    reply: 'Engineer confirms RL 1184.20 (drainage drawing governs). Road profile will be revised in Rev B. No rework required as excavation was paused.',
    repliedDate: '17 Jul 2026',
    linkedDsr: 'D-079',
    costImpact: 'None',
    scheduleImpact: '1 day saved (no rework)',
    severity: 'low',
  },
  {
    id: 'r4',
    number: 'RFI-068',
    date: '29 Jul 2026',
    subject: 'Shotcrete thickness tolerance for tunnel support',
    question: 'The tunnel support drawing specifies 50mm nominal shotcrete with a +10/-0mm tolerance. At chainage 0+380 the rock face is irregular by up to 25mm. Do we apply min 50mm over the highest point, or over the nominal line?',
    background: 'Tunnel face advance at ch. 0+380. The geological face log shows rock class III with local overbreak. Shotcrete application is scheduled for today.',
    impact: 'Quantity: +15% shotcrete consumption if applying over the highest point = ~0.4 cum extra per linear meter × ~12m affected = NPR 21,000. No schedule impact.',
    status: 'Open',
    replyBy: '31 Jul 2026',
    linkedDsr: 'D-092',
    costImpact: 'NPR 21,000 (potential)',
    scheduleImpact: 'None',
    severity: 'medium',
  },
]

// ─── RFI Tab (list + inspector) ─────────────────────────────────────────────

export function RfiTab() {
  const [selectedId, setSelectedId] = useState('r1')
  const [filter, setFilter] = useState<'All' | 'Open' | 'Replied' | 'Closed'>('All')
  const selected = RFIS.find(r => r.id === selectedId) ?? RFIS[0]
  const filtered = filter === 'All' ? RFIS : RFIS.filter(r => r.status === filter)
  const overdueCount = RFIS.filter(r => r.status === 'Open' && new Date(r.replyBy) < TODAY).length

  return (
    <Workspace2Pane
      leftPane={
        <>
          <PaneHeader title="RFI Register">
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => toast.info('Not yet implemented', { description: 'This feature is planned but not yet built.' })}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </PaneHeader>
          <div className="px-3 py-2 border-b border-[var(--pane-divider)] space-y-2">
            {/* Status filter */}
            <div className="flex gap-1">
              {(['All', 'Open', 'Replied', 'Closed'] as const).map(f => {
                const count = f === 'All' ? RFIS.length : RFIS.filter(r => r.status === f).length
                return (
                  <Button
                    key={f}
                    variant={filter === f ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 flex-1 text-xs"
                    onClick={() => setFilter(f)}
                  >
                    {f} <span className="ml-1 text-[9px] opacity-70">{count}</span>
                  </Button>
                )
              })}
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Filter by subject / number…" className="h-8 pl-7 text-xs" />
            </div>
          </div>
          <PaneBody className="py-2">
            {/* Overdue alert */}
            {overdueCount > 0 && (
              <div className="mx-3 mb-2 p-2 rounded-md bg-red-500/10 border border-red-500/30 text-[10px]">
                <div className="flex items-center gap-1.5 text-red-600 font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  {overdueCount} RFI overdue
                </div>
                <div className="text-muted-foreground mt-0.5">Consultant reply pending — billing hold may apply.</div>
              </div>
            )}
            {filtered.map(r => {
              const isOverdue = r.status === 'Open' && new Date(r.replyBy) < TODAY
              const isSelected = r.id === selectedId
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 border-l-2 hover:bg-accent/50 transition-colors',
                    isSelected ? 'bg-accent border-l-primary' : 'border-l-transparent',
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] text-muted-foreground">{r.number}</span>
                    <Badge variant="outline" className={cn('text-[9px] h-4 px-1',
                      r.status === 'Open' && 'border-amber-500/40 text-amber-700 dark:text-amber-300',
                      r.status === 'Replied' && 'border-sky-500/40 text-sky-700 dark:text-sky-300',
                      r.status === 'Closed' && 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
                    )}>{r.status}</Badge>
                    {r.severity === 'high' && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1 border-red-500/40 text-red-700 dark:text-red-300">HIGH</Badge>
                    )}
                    {isOverdue && (
                      <span className="text-[9px] text-red-600 font-medium ml-auto flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />Overdue
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-medium truncate">{r.subject}</div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                    <span>{r.date}</span>
                    {r.linkedDsr && (
                      <>
                        <span>·</span>
                        <span className="font-mono">DSR: {r.linkedDsr}</span>
                      </>
                    )}
                  </div>
                </button>
              )
            })}
          </PaneBody>
        </>
      }
      rightPane={<RfiInspector rfi={selected} />}
      leftPaneWidth="320px"
      rightPaneWidth="380px"
    />
  )
}

// ─── RFI Inspector ──────────────────────────────────────────────────────────

function RfiInspector({ rfi }: { rfi: Rfi }) {
  const isOverdue = rfi.status === 'Open' && new Date(rfi.replyBy) < TODAY
  return (
    <>
      <PaneHeader title={`RFI Inspector · ${rfi.number}`} />
      <PaneBody>
        <div className="p-4 border-b border-[var(--pane-divider)]">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant="outline" className={cn('text-[10px]',
              rfi.status === 'Open' && 'border-amber-500/40 text-amber-700 dark:text-amber-300',
              rfi.status === 'Replied' && 'border-sky-500/40 text-sky-700 dark:text-sky-300',
              rfi.status === 'Closed' && 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
            )}>{rfi.status}</Badge>
            <Badge variant="secondary" className="text-[10px]">{rfi.date}</Badge>
            {rfi.severity === 'high' && (
              <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-700 dark:text-red-300">HIGH SEVERITY</Badge>
            )}
            {rfi.linkedDsr && (
              <Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-700 dark:text-violet-300">Linked DSR: {rfi.linkedDsr}</Badge>
            )}
          </div>
          <div className="text-sm font-semibold leading-snug">{rfi.subject}</div>
          <div className="text-xs text-muted-foreground mt-2 font-mono">{rfi.number}</div>
        </div>

        <div className="p-4 space-y-3 text-xs">
          {/* Reply deadline */}
          <div className={cn('p-2.5 rounded-md text-[11px]',
            rfi.status === 'Closed' ? 'bg-emerald-500/10 border border-emerald-500/30'
            : rfi.status === 'Replied' ? 'bg-sky-500/10 border border-sky-500/30'
            : isOverdue ? 'bg-red-500/10 border border-red-500/30'
            : 'bg-amber-500/10 border border-amber-500/30',
          )}>
            <div className="flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5" />
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
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
              <HelpCircle className="w-3 h-3" />Question
            </div>
            <div className="p-3 rounded-md border border-[var(--pane-divider)] bg-secondary/20 text-[11px] leading-relaxed">
              {rfi.question}
            </div>
          </div>

          {/* Background */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Background</div>
            <div className="p-3 rounded-md border border-[var(--pane-divider)] bg-secondary/20 text-[11px] leading-relaxed text-muted-foreground">
              {rfi.background}
            </div>
          </div>

          {/* Impact */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />Impact (Cost / Schedule)
            </div>
            <div className="p-3 rounded-md border border-amber-500/30 bg-amber-500/5 text-[11px] leading-relaxed">
              {rfi.impact}
            </div>
          </div>

          {/* Reply */}
          {rfi.reply && (
            <>
              <Separator />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />Consultant Reply
                </div>
                <div className="p-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 text-[11px] leading-relaxed">
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
                <div className="p-2 rounded-md border border-[var(--pane-divider)]">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Cost Impact</div>
                  <div className="font-mono font-medium mt-0.5">{rfi.costImpact}</div>
                </div>
              )}
              {rfi.scheduleImpact && (
                <div className="p-2 rounded-md border border-[var(--pane-divider)]">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Schedule Impact</div>
                  <div className="font-medium mt-0.5">{rfi.scheduleImpact}</div>
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
                className="w-full h-8 text-xs justify-start gap-2"
                onClick={() => toast.info('Not yet implemented', { description: 'This feature is planned but not yet built.' })}
              >
                <Mail className="w-3.5 h-3.5" />Log Consultant Reply
              </Button>
            )}
            <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start gap-2"><FileText className="w-3.5 h-3.5" />View PDF</Button>
            {rfi.linkedDsr && (
              <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start gap-2">
                <ArrowRight className="w-3.5 h-3.5" />Open linked DSR ({rfi.linkedDsr})
              </Button>
            )}
            {/* Show the Convert-to-VO button whenever there's a non-trivial cost impact
                (not just when the string contains 'VO' — "potential" costs are exactly
                the case where a VO would be filed). */}
            {rfi.costImpact && rfi.costImpact !== 'None' && (
              <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start gap-2 text-amber-600">
                <AlertTriangle className="w-3.5 h-3.5" />Convert to Variation Order
              </Button>
            )}
          </div>
        </div>
      </PaneBody>
    </>
  )
}
