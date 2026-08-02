'use client'

import { useState } from 'react'
import { create } from 'zustand'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { LocationPicker } from '@/components/ui/location-picker'

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
   *  applies (e.g. "Pier 3"). Persisted to the `location_id` column
   *  (added in migration 12). */
  locationId?: string
}

// Real current date — captured once at module load so overdue calculations
// reflect the user's actual clock instead of a hardcoded demo date.
const TODAY = new Date()

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

// ─── Shared RFI store (Zustand) ─────────────────────────────────────────────
// RFIs need to be mutable so the DSR Inspector can add new drafts that
// appear in the RFI Register. A Zustand store centralizes the state and
// notifies all subscribers (RfiTab + DailyOpsModule's open-RFI counter)
// when addRfi() is called — no prop drilling required.
//
// The exported `subscribeRfis` / `getRfis` / `addRfi` helpers below wrap the
// store for backward compat with the previous hand-rolled useSyncExternalStore
// API used by `daily-ops/index.tsx`.

interface RfiStore {
  rfis: Rfi[]
  addRfi: (rfi: Rfi) => void
}

const useRfiStore = create<RfiStore>((set) => ({
  rfis: [...INITIAL_RFIS],
  addRfi: (rfi) => set((s) => ({ rfis: [rfi, ...s.rfis] })),
}))

/**
 * Subscribe to RFI store changes (for useSyncExternalStore callers).
 * Wraps Zustand's `subscribe` so existing imports in `daily-ops/index.tsx`
 * keep working without modification.
 */
export function subscribeRfis(listener: () => void): () => void {
  return useRfiStore.subscribe(listener)
}

/** Get the current RFI snapshot. Wraps Zustand's `getState` for back-compat. */
export function getRfis(): Rfi[] {
  return useRfiStore.getState().rfis
}

/** Add a new RFI to the store. Used by the DSR Inspector's saveRfi(). */
export function addRfi(rfi: Rfi): void {
  useRfiStore.getState().addRfi(rfi)
}

// Re-export RFIS for backward compat (components that read the initial array
// directly). This is a snapshot — for live updates, use the Zustand store via
// useRfiStore or the useSyncExternalStore-style wrappers above.
export const RFIS: Rfi[] = INITIAL_RFIS

// ─── RFI Tab (list + inspector) ─────────────────────────────────────────────

export function RfiTab() {
  // Subscribe to the Zustand store so the RFI list re-renders when addRfi()
  // is called from the DSR Inspector.
  const rfis = useRfiStore((s) => s.rfis)
  const [selectedId, setSelectedId] = useState('r1')
  const [filter, setFilter] = useState<'All' | 'Open' | 'Replied' | 'Closed'>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const selected = rfis.find((r) => r.id === selectedId) ?? rfis[0]
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
  const overdueCount = rfis.filter((r) => r.status === 'Open' && new Date(r.replyBy) < TODAY).length

  // Guard against an empty RFI store (e.g. fresh install with no seed data,
  // or all RFIs deleted). Without this, `selected` is undefined and
  // `<RfiInspector rfi={selected} />` below would crash dereferencing
  // `rfi.number` / `rfi.status`. Placed AFTER all hooks have been called so
  // we don't violate rules-of-hooks.
  if (!selected) {
    return <div className="text-muted-foreground p-4 text-sm">No RFI selected</div>
  }

  return (
    <Workspace2Pane
      leftPane={
        <>
          <PaneHeader title="RFI Register">
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() =>
                toast.info('Use the DSR Inspector to draft an RFI', {
                  description:
                    'RFIs are created from the DSR Inspector — switch to the DSR tab to draft one from a daily entry.',
                })
              }
              title="Add RFI (via DSR Inspector)"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </PaneHeader>
          <div className="space-y-2 border-b border-[var(--pane-divider)] px-3 py-2">
            {/* Status filter */}
            <div className="flex gap-1">
              {(['All', 'Open', 'Replied', 'Closed'] as const).map((f) => {
                const count = f === 'All' ? rfis.length : rfis.filter((r) => r.status === f).length
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
                <div className="text-muted-foreground mt-0.5">
                  Consultant reply pending — billing hold may apply.
                </div>
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="text-muted-foreground px-3 py-8 text-center text-[10px]">
                No RFIs match &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              filtered.map((r) => {
                const isOverdue = r.status === 'Open' && new Date(r.replyBy) < TODAY
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
                useRfiStore.setState((s) => ({
                  rfis: s.rfis.map((r) =>
                    r.id === rfi.id ? { ...r, locationId: locationId ?? undefined } : r
                  ),
                }))
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
                onClick={() =>
                  toast.info('Consultant reply logging coming soon', {
                    description: `Once wired, this will capture the reply text, mark ${rfi.number} as Replied, and stamp the replied date.`,
                  })
                }
                title="Log Consultant Reply (coming soon)"
              >
                <Mail className="h-3.5 w-3.5" />
                Log Consultant Reply
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
                onClick={() =>
                  toast.info('Linked DSR navigation coming soon', {
                    description: `Will switch the Daily Ops module to the DSR tab and select ${rfi.linkedDsr}. Cross-module deep-linking is not yet wired.`,
                  })
                }
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
    </>
  )
}
