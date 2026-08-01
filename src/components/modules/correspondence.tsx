'use client'

import { useState } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Plus, Search, Mail, FileText, AlertTriangle, ArrowRight, ArrowLeft, Calendar, Clock,
  HelpCircle, CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Letter {
  id: string; number: string; date: string; type: 'Incoming' | 'Outgoing' | 'Site Instruction'; from: string; to: string; subject: string; replyBy?: string; replyTo?: string; hasVariation?: boolean;
}

interface Rfi {
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

const RFIS: Rfi[] = [
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

type Filter = 'All' | 'Incoming' | 'Outgoing' | 'Site Instruction' | 'RFI'

export function CorrespondenceModule() {
  const [filter, setFilter] = useState<Filter>('All')
  const [selectedLetterId, setSelectedLetterId] = useState('L-001')
  const [selectedRfiId, setSelectedRfiId] = useState('r1')

  const filteredLetters = filter === 'All' || filter === 'RFI'
    ? []
    : LETTERS.filter(l => l.type === filter)
  const showRfis = filter === 'All' || filter === 'RFI'
  const selectedLetter = LETTERS.find(l => l.id === selectedLetterId) ?? LETTERS[0]
  const selectedRfi = RFIS.find(r => r.id === selectedRfiId) ?? RFIS[0]

  // When filter is RFI, show the RFI inspector. Otherwise show letters.
  const isRfiView = filter === 'RFI'

  return (
    <Workspace3Pane
      leftPane={
        <>
          <PaneHeader title="Categories">
            <Button variant="ghost" size="sm" className="h-7"><Plus className="w-3.5 h-3.5" /></Button>
          </PaneHeader>
          <PaneBody className="py-2">
            {(['All', 'Incoming', 'Outgoing', 'Site Instruction', 'RFI'] as const).map(f => {
              const letterCount = f === 'All' ? LETTERS.length : f === 'RFI' ? 0 : LETTERS.filter(l => l.type === f).length
              const rfiCount = f === 'All' ? RFIS.length + LETTERS.length : f === 'RFI' ? RFIS.length : 0
              const count = f === 'All' ? LETTERS.length + RFIS.length : letterCount + rfiCount
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
                    {f === 'RFI' && <HelpCircle className="w-3 h-3 text-violet-500" />}
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
                <Input placeholder="Search letters & RFIs…" className="h-8 pl-7 text-xs" />
              </div>
            </div>

            {/* RFI overdue alert */}
            {RFIS.some(r => r.status === 'Open' && new Date(r.replyBy) < TODAY) && (
              <div className="mt-3 mx-3 p-2 rounded-md bg-red-500/10 border border-red-500/30 text-[10px]">
                <div className="flex items-center gap-1.5 text-red-600 font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  {RFIS.filter(r => r.status === 'Open' && new Date(r.replyBy) < TODAY).length} RFI overdue
                </div>
                <div className="text-muted-foreground mt-0.5">Consultant reply pending — billing hold may apply.</div>
              </div>
            )}
          </PaneBody>
        </>
      }
      rightPane={
        isRfiView ? (
          <RfiInspector rfi={selectedRfi} onOpenReply={(r) => toast.info('Log reply', { description: `Reply form for ${r.number} — consultant response will be recorded and linked.` })} />
        ) : (
          <>
            <PaneHeader title={`Letter Inspector · ${selectedLetter.number}`} />
            <PaneBody>
              <div className="p-4 border-b border-[var(--pane-divider)]">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className={cn('text-[10px]', selectedLetter.type === 'Incoming' && 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300', selectedLetter.type === 'Outgoing' && 'border-sky-500/40 text-sky-700 dark:text-sky-300', selectedLetter.type === 'Site Instruction' && 'border-amber-500/40 text-amber-700 dark:text-amber-300')}>{selectedLetter.type}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{selectedLetter.date}</Badge>
                </div>
                <div className="text-sm font-semibold leading-snug">{selectedLetter.subject}</div>
                <div className="text-xs text-muted-foreground mt-2 font-mono">{selectedLetter.number}</div>
              </div>

              <div className="p-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">From</div>
                    <div className="font-medium mt-0.5">{selectedLetter.from}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">To</div>
                    <div className="font-medium mt-0.5">{selectedLetter.to}</div>
                  </div>
                </div>

                <Separator />

                {selectedLetter.replyBy && (
                  <div className={cn('p-2.5 rounded-md text-[11px]', selectedLetter.replyTo ? 'bg-emerald-500/10 border border-emerald-500/30' : new Date(selectedLetter.replyBy) < TODAY ? 'bg-red-500/10 border border-red-500/30' : 'bg-amber-500/10 border border-amber-500/30')}>
                    <div className="flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      {selectedLetter.replyTo ? `Replied via ${selectedLetter.replyTo}` : new Date(selectedLetter.replyBy) < TODAY ? `Overdue by ${Math.ceil((TODAY.getTime() - new Date(selectedLetter.replyBy).getTime()) / 86400000)} days` : `Reply required by ${selectedLetter.replyBy}`}
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

                {selectedLetter.hasVariation && (
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
                            description: `${selectedLetter.number} → VO-2026-008 · Cost impact NPR 1.85M · 14-day schedule extension. Pushed to Financials.`,
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
        )
      }
      centerPane={
        <>
      {/* Center list — shows letters OR RFIs depending on filter */}
      <PaneHeader title={isRfiView ? `RFI Register · ${RFIS.length} total` : `Correspondence · ${filteredLetters.length} letters`}>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5"><Search className="w-3.5 h-3.5" />Search</Button>
        {isRfiView && (
          <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => toast.info('New RFI', { description: 'Draft form — link a DSR entry, fill question + impact, route to consultant.' })}>
            <Plus className="w-3.5 h-3.5" />New RFI
          </Button>
        )}
      </PaneHeader>
      <PaneBody className="px-0">
        {isRfiView ? (
          <div className="flex flex-col">
            {/* RFI list rows */}
            {RFIS.map(r => {
              const isOverdue = r.status === 'Open' && new Date(r.replyBy) < TODAY
              const isSelected = r.id === selectedRfiId
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRfiId(r.id)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 border-b border-[var(--pane-divider)] hover:bg-accent/50 transition-colors',
                    isSelected && 'bg-accent border-l-2 border-l-primary',
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
                        <span className="font-mono">Linked: {r.linkedDsr}</span>
                      </>
                    )}
                    {r.costImpact && (
                      <>
                        <span>·</span>
                        <span>{r.costImpact}</span>
                      </>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredLetters.map(l => {
              const isSelected = l.id === selectedLetterId
              const isOverdue = l.replyBy && !l.replyTo && new Date(l.replyBy) < TODAY
              return (
                <button
                  key={l.id}
                  onClick={() => setSelectedLetterId(l.id)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 border-b border-[var(--pane-divider)] hover:bg-accent/50 transition-colors',
                    isSelected && 'bg-accent border-l-2 border-l-primary',
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] text-muted-foreground">{l.number}</span>
                    <Badge variant="outline" className={cn('text-[9px] h-4 px-1',
                      l.type === 'Incoming' && 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
                      l.type === 'Outgoing' && 'border-sky-500/40 text-sky-700 dark:text-sky-300',
                      l.type === 'Site Instruction' && 'border-amber-500/40 text-amber-700 dark:text-amber-300',
                    )}>{l.type}</Badge>
                    {isOverdue && (
                      <span className="text-[9px] text-red-600 font-medium ml-auto flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />Overdue
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-medium truncate">{l.subject}</div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                    <span>{l.date}</span>
                    <span>·</span>
                    <span className="truncate">{l.from}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </PaneBody>
        </>
      }
      leftPaneWidth="240px"
      rightPaneWidth="380px"
    />
  )
}

// ─── RFI Inspector ──────────────────────────────────────────────────────────

function RfiInspector({ rfi, onOpenReply }: { rfi: Rfi; onOpenReply: (r: Rfi) => void }) {
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
              <Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-700 dark:text-violet-300">Linked: {rfi.linkedDsr}</Badge>
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
              <Button variant="default" size="sm" className="w-full h-8 text-xs justify-start gap-2" onClick={() => onOpenReply(rfi)}>
                <Mail className="w-3.5 h-3.5" />Log Consultant Reply
              </Button>
            )}
            <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start gap-2"><FileText className="w-3.5 h-3.5" />View PDF</Button>
            {rfi.linkedDsr && (
              <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start gap-2">
                <ArrowRight className="w-3.5 h-3.5" />Open linked DSR ({rfi.linkedDsr})
              </Button>
            )}
            {rfi.costImpact && rfi.costImpact.includes('VO') && (
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
