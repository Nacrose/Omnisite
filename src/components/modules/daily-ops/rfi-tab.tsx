'use client'

import { useState, useMemo, useSyncExternalStore } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Search,
  Plus,
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
import { useSyncedState } from '@/lib/use-synced-state'

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
  /** Optional FK to project_locations.id — where the question physically
   *  applies (e.g. "Pier 3"). Persisted to localStorage alongside the
   *  RFI record. NOT yet backed by a DB table — see the persistence
   *  comment above (audit round 11). */
  locationId?: string
}

// ─── Shared RFI store ──────────────────────────────────────────────────────
// RFIs need to be mutable so the DSR Inspector can add new drafts that
// appear in the RFI Register. Using a module-level array + useSyncExternalStore
// so both components see the same state without prop drilling.
const INITIAL_RFIS: Rfi[] = [
  {
    id: 'r1',
    number: 'RFI-067',
    date: '22 Jul 2026',
    subject: 'Rebar detailing at expansion joint — chainage 4+200',
    question:
      'The contract drawings show lap splices of 40φ at the expansion joint, but the special detailing note on Sheet KRR-P3-DR-DR-008 Rev A calls for mechanical couplers in this zone. Please clarify which applies — and if couplers, what type (Type 1 vs Type 2 per ASTM A1035).',
    background:
      'DSR Entry D-087 — Foundation PCC at chainage 4+200 to 4+350. Rebar fabrication is scheduled to start 02 Aug 2026. The rebar shop drawings cannot be finalized until this is resolved.',
    impact:
      'Schedule: ~3 days of float on T-203 (Foundation). If delayed beyond 02 Aug, the critical path slips and the Substructure milestone (T-404, Wk 48) is at risk. Cost: couplers add ~NPR 850/ea × ~120 locations = NPR 102,000 if required.',
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
    question:
      'The geotechnical report flags sulphate exposure (Class 2) at chainage 3+100 to 3+400. The BOQ specifies 50mm cover for pile caps, but IS 456:2000 Table 4 recommends 75mm for Class 2 exposure. Which applies?',
    background:
      'Pile cap pour for Section 2 is scheduled for 05 Aug 2026. ~42 pile caps affected across the chainage range.',
    impact:
      'Cost: +25mm cover × 42 caps × nominal rebar increase ≈ NPR 145,000. No schedule impact — rebar already on site can be adjusted.',
    status: 'Replied',
    replyBy: '24 Jul 2026',
    reply:
      'Engineer confirms 75mm cover required per IS 456:2000 for Class 2 sulphate exposure. Additional cost treated as a Variation Order per FIDIC Clause 13. Please submit BOQ adjustment via the Variation Order module.',
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
    question:
      'The road profile drawing (KRR-P3-RD-PR-003) and the drainage drawing (KRR-P3-DR-DN-012) show conflicting invert levels for the outlet at ch. 2+100 (RL 1184.50 vs RL 1184.20). Which is correct?',
    background:
      'Drainage works at ch. 2+050 to 2+200 are underway. The excavation was paused at the outlet location pending clarification.',
    impact:
      'Schedule: 1 day of rework if the wrong invert is cast. Cost: ~NPR 18,000 for rework if needed.',
    status: 'Closed',
    replyBy: '18 Jul 2026',
    reply:
      'Engineer confirms RL 1184.20 (drainage drawing governs). Road profile will be revised in Rev B. No rework required as excavation was paused.',
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
    question:
      'The tunnel support drawing specifies 50mm nominal shotcrete with a +10/-0mm tolerance. At chainage 0+380 the rock face is irregular by up to 25mm. Do we apply min 50mm over the highest point, or over the nominal line?',
    background:
      'Tunnel face advance at ch. 0+380. The geological face log shows rock class III with local overbreak. Shotcrete application is scheduled for today.',
    impact:
      'Quantity: +15% shotcrete consumption if applying over the highest point = ~0.4 cum extra per linear meter × ~12m affected = NPR 21,000. No schedule impact.',
    status: 'Open',
    replyBy: '31 Jul 2026',
    linkedDsr: 'D-092',
    costImpact: 'NPR 21,000 (potential)',
    scheduleImpact: 'None',
    severity: 'medium',
  },
]

// ─── RFI persistence ────────────────────────────────────────────────────────
// RFIs are persisted via usePersistentState (localStorage) so they survive
// page reloads. This is a stopgap — the proper solution is a dedicated
// `rfis` DB table + API route + useSyncedState wiring, matching how
// dsr_entries, qs_items, and letters are persisted. Until that table
// exists, usePersistentState gives us cross-reload persistence which the
// previous Zustand store did not (reload = back to seed data only).
//
// The store uses a module-level state + useSyncExternalStore pattern so
// the DSR Inspector (which lives in a different component tree) can add
// RFIs that immediately appear in the RFI Register without prop drilling.

let rfiState: Rfi[] = [...INITIAL_RFIS]
const rfiListeners = new Set<() => void>()

function notifyRfiListeners() {
  rfiListeners.forEach((l) => l())
}

// Load from localStorage on module init.
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem('omnisite-rfis')
    if (stored) {
      const parsed = JSON.parse(stored) as Rfi[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        rfiState = parsed
      }
    }
  } catch {
    // localStorage may be unavailable (SSR, privacy mode) — fall back to seed.
  }
}

function persistRfis() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('omnisite-rfis', JSON.stringify(rfiState))
    } catch {
      // Quota exceeded or localStorage unavailable — state still works in-memory.
    }
  }
}

/**
 * Subscribe to RFI store changes (for useSyncExternalStore callers).
 */
export function subscribeRfis(listener: () => void): () => void {
  rfiListeners.add(listener)
  return () => rfiListeners.delete(listener)
}

/** Get the current RFI snapshot. */
export function getRfis(): Rfi[] {
  return rfiState
}

/** Add a new RFI to the store. Used by the DSR Inspector's saveRfi(). */
export function addRfi(rfi: Rfi): void {
  rfiState = [rfi, ...rfiState]
  persistRfis()
  notifyRfiListeners()
}

/** Update an existing RFI by id. Used by the RFI Inspector's "Log Consultant
 *  Reply" action (audit D2-7). */
export function updateRfi(id: string, updates: Partial<Rfi>): void {
  rfiState = rfiState.map((r) => (r.id === id ? { ...r, ...updates } : r))
  persistRfis()
  notifyRfiListeners()
}

// Re-export RFIS for backward compat (components that read the initial array
// directly). This is a snapshot — for live updates, use subscribeRfis/getRfis.
export const RFIS: Rfi[] = INITIAL_RFIS

// ─── RFI Tab (list + inspector) ─────────────────────────────────────────────

export function RfiTab({
  onOpenDsr,
}: {
  /** Fired when the user clicks "Open linked DSR" in the RFI Inspector.
   *  The parent switches to the DSR tab and selects the linked entry
   *  (audit D2-3). */
  onOpenDsr?: (dsrId: string) => void
}) {
  // Subscribe to the module-level RFI store via useSyncExternalStore
  // so the list re-renders when addRfi() or updateRfi() is called.
  const rfis = useSyncExternalStore(subscribeRfis, getRfis, getRfis)
  const [selectedId, setSelectedId] = useState('r1')
  const [filter, setFilter] = useState<'All' | 'Open' | 'Replied' | 'Closed'>('All')
  const [searchQuery, setSearchQuery] = useState('')
  // Create-RFI modal state — opened by the "+" button in the register
  // header (audit D5-1 — previously the button showed a toast telling the
  // user to switch to the DSR tab, which was unnecessarily restrictive).
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createDraft, setCreateDraft] = useState({
    subject: '',
    question: '',
    impact: '',
    background: '',
  })
  const [createSaved, setCreateSaved] = useState(false)
  const [createRfiId] = useState(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  )
  const selected = rfis.find((r) => r.id === selectedId) ?? rfis[0]

  // If selectedId points to a deleted RFI, `selected` falls back to rfis[0]
  // but selectedId stays stale — the outline highlights NO row. Sync it
  // (audit D1-6 — same fix as BOQ B4-4, scheduler R6-6, DSR D1-1).
  if (selected && selected.id !== selectedId) {
    setSelectedId(selected.id)
  }
  // Filter by status first, then by the search query (matches RFI number,
  // subject, or question text — the most common lookups).
  const filtered = (filter === 'All' ? rfis : rfis.filter((r) => r.status === filter)).filter(
    (r) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        r.number.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q) ||
        r.question.toLowerCase().includes(q)
      )
    }
  )
  const overdueCount = rfis.filter(
    (r) => r.status === 'Open' && new Date(r.replyBy) < new Date()
  ).length

  // Guard against an empty RFI store (e.g. fresh install with no seed data,
  // or all RFIs deleted). Without this, `selected` is undefined and
  // `<RfiInspector rfi={selected} />` below would crash dereferencing
  // `rfi.number` / `rfi.status`. Placed AFTER all hooks have been called so
  // we don't violate rules-of-hooks.
  if (!selected) {
    return <div className="text-muted-foreground p-4 text-sm">No RFI selected</div>
  }

  return (
    <>
      <Workspace2Pane
        leftPane={
          <>
            <PaneHeader title="RFI Register">
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => {
                  setCreateDraft({ subject: '', question: '', impact: '', background: '' })
                  setCreateSaved(false)
                  setCreateModalOpen(true)
                }}
                title="Add RFI"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </PaneHeader>
            <div className="space-y-2 border-b border-[var(--pane-divider)] px-3 py-2">
              {/* Status filter */}
              <div className="flex gap-1">
                {(['All', 'Open', 'Replied', 'Closed'] as const).map((f) => {
                  const count =
                    f === 'All' ? rfis.length : rfis.filter((r) => r.status === f).length
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
                <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
                <Input
                  placeholder="Filter by number / subject / question…"
                  className="h-8 pl-7 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <PaneBody className="py-2">
              {/* Overdue alert */}
              {overdueCount > 0 && (
                <div className="mx-3 mb-2 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-[10px]">
                  <div className="flex items-center gap-1.5 font-medium text-red-600">
                    <AlertTriangle className="h-3 w-3" />
                    {overdueCount} RFI overdue
                  </div>
                  <div className="text-muted-foreground mt-0.5">Consultant reply pending.</div>
                </div>
              )}
              {filtered.length === 0 ? (
                <div className="text-muted-foreground px-3 py-8 text-center text-[10px]">
                  No RFIs match &ldquo;{searchQuery}&rdquo;.
                </div>
              ) : (
                filtered.map((r) => {
                  const isOverdue = r.status === 'Open' && new Date(r.replyBy) < new Date()
                  const isSelected = r.id === selectedId
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={cn(
                        'hover:bg-accent/50 w-full border-l-2 px-3 py-2 text-left transition-colors',
                        isSelected ? 'bg-accent border-l-primary' : 'border-l-transparent'
                      )}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-muted-foreground font-mono text-[10px]">
                          {r.number}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'h-4 px-1 text-[9px]',
                            r.status === 'Open' &&
                              'border-amber-500/40 text-amber-700 dark:text-amber-300',
                            r.status === 'Replied' &&
                              'border-sky-500/40 text-sky-700 dark:text-sky-300',
                            r.status === 'Closed' &&
                              'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                          )}
                        >
                          {r.status}
                        </Badge>
                        {r.severity === 'high' && (
                          <Badge
                            variant="outline"
                            className="h-4 border-red-500/40 px-1 text-[9px] text-red-700 dark:text-red-300"
                          >
                            HIGH
                          </Badge>
                        )}
                        {isOverdue && (
                          <span className="ml-auto flex items-center gap-0.5 text-[9px] font-medium text-red-600">
                            <Clock className="h-2.5 w-2.5" />
                            Overdue
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs font-medium">{r.subject}</div>
                      <div className="text-muted-foreground mt-1 flex items-center gap-2 text-[10px]">
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
                })
              )}
            </PaneBody>
          </>
        }
        rightPane={<RfiInspector rfi={selected} onOpenDsr={onOpenDsr} />}
        leftPaneWidth="320px"
        rightPaneWidth="380px"
      />

      {/* Create RFI Modal — opened by the "+" button (audit D5-1) */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setCreateModalOpen(false)}
        >
          <div
            className="pane w-full max-w-lg overflow-hidden rounded-xl border border-[var(--pane-divider)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 items-center justify-between border-b border-[var(--pane-divider)] bg-sky-500/10 px-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-sky-500" />
                <span className="text-sm font-semibold">
                  {createSaved ? 'RFI Created' : 'New RFI'}
                </span>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="hover:bg-accent text-muted-foreground rounded p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {createSaved ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
                <div className="text-sm font-semibold">RFI-{createRfiId} created</div>
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
                    <Button variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>
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
                          number: `RFI-${createRfiId}`,
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
                          setCreateModalOpen(false)
                          setSelectedId(newId)
                        }, 1200)
                        toast.success('RFI created', {
                          description: `RFI-${createRfiId} added to the register.`,
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
      )}
    </>
  )
}

// ─── RFI Inspector ──────────────────────────────────────────────────────────

function RfiInspector({
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
