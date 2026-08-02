'use client'

import { useState } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Plus,
  Search,
  Mail,
  FileText,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useSyncedState } from '@/lib/use-synced-state'

interface Letter {
  id: string
  number: string
  date: string
  type: 'Incoming' | 'Outgoing' | 'Site Instruction'
  from: string
  to: string
  subject: string
  replyBy?: string
  replyTo?: string
  hasVariation?: boolean
  /** Optional body text — persisted to the `letters.body` column. */
  body?: string
}

// Real current date — captured once at module load so overdue calculations
// reflect the user's actual clock instead of a hardcoded demo date.
const TODAY = new Date()

const INITIAL_LETTERS: Letter[] = [
  {
    id: 'L-001',
    number: 'CL/DOR/2026-087',
    date: '28 Jul 2026',
    type: 'Incoming',
    from: 'DoR — Supervision Consultant',
    to: 'OmniSite Contractor',
    subject: 'Approval — PCC mix design for foundation',
    replyBy: '02 Aug 2026',
  },
  {
    id: 'L-002',
    number: 'OMS/2026-142',
    date: '29 Jul 2026',
    type: 'Outgoing',
    from: 'OmniSite Contractor',
    to: 'DoR — Supervision Consultant',
    subject: 'RE: PCC mix design — additional test results attached',
    replyTo: 'L-001',
  },
  {
    id: 'L-003',
    number: 'SI/2026-022',
    date: '29 Jul 2026',
    type: 'Site Instruction',
    from: 'DoR Engineer',
    to: 'OmniSite Contractor',
    subject: 'SI: Extra excavation at chainage 2+850 due to soft soil',
    hasVariation: true,
  },
  {
    id: 'L-004',
    number: 'CL/DOR/2026-088',
    date: '25 Jul 2026',
    type: 'Incoming',
    from: 'DoR — Supervision Consultant',
    to: 'OmniSite Contractor',
    subject: 'Request for clarification — rebar detailing at expansion joint',
    replyBy: '26 Jul 2026',
  },
  {
    id: 'L-005',
    number: 'OMS/2026-138',
    date: '20 Jul 2026',
    type: 'Outgoing',
    from: 'OmniSite Contractor',
    to: 'DoR — Supervision Consultant',
    subject: 'EOT claim — additional 14 days for unexpected rock excavation',
  },
  {
    id: 'L-006',
    number: 'CL/DOR/2026-085',
    date: '18 Jul 2026',
    type: 'Incoming',
    from: 'Client (DoR)',
    to: 'OmniSite Contractor',
    subject: 'Monthly progress review meeting minutes — July',
  },
]

type Filter = 'All' | 'Incoming' | 'Outgoing' | 'Site Instruction'

export function CorrespondenceModule() {
  const [filter, setFilter] = useState<Filter>('All')
  const [selectedId, setSelectedId] = useState('L-001')
  const [searchQuery, setSearchQuery] = useState('')
  // Letters are synced via useSyncedState so they persist to localStorage
  // (and Supabase `letters` table when configured) and can be edited.
  const [letters] = useSyncedState<Letter[]>('omnisite-letters', 'letters', () => INITIAL_LETTERS, {
    fieldMap: {
      from: 'from_party',
      to: 'to_party',
      replyBy: 'reply_by',
      replyTo: 'reply_to',
      hasVariation: 'has_variation',
    },
    primaryKey: 'id',
  })
  const filteredByType = filter === 'All' ? letters : letters.filter((l) => l.type === filter)
  const filtered = searchQuery.trim()
    ? filteredByType.filter(
        (l) =>
          l.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.to.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredByType
  // Inspector should follow the filter — if the selected letter isn't in the
  // filtered list, fall back to the first filtered letter.
  const selected = filtered.find((l) => l.id === selectedId) ?? filtered[0]

  // Guard: when the filter produces no letters (e.g. a category with no
  // entries, or a search query that matches nothing), `selected` is
  // `undefined`. The rightPane below dereferences `selected.number`,
  // `selected.type`, etc. — without this guard it would crash with a
  // TypeError. Show an honest empty state instead.
  if (!selected) {
    return (
      <Workspace3Pane
        leftPane={
          <>
            <PaneHeader title="Categories">
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() =>
                  toast.info('Custom categories coming soon', {
                    description: 'Use the existing Incoming/Outgoing/Site Instruction types.',
                  })
                }
                title="New category (coming soon)"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </PaneHeader>
            <PaneBody className="py-2">
              {(['All', 'Incoming', 'Outgoing', 'Site Instruction'] as const).map((f) => {
                const count =
                  f === 'All' ? letters.length : letters.filter((l) => l.type === f).length
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-1.5 text-xs',
                      filter === f
                        ? 'bg-accent border-primary border-l-2'
                        : 'hover:bg-accent/50 border-l-2 border-transparent'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {f === 'Incoming' && <ArrowRight className="h-3 w-3 text-emerald-500" />}
                      {f === 'Outgoing' && <ArrowLeft className="h-3 w-3 text-sky-500" />}
                      {f === 'Site Instruction' && <FileText className="h-3 w-3 text-amber-500" />}
                      {f === 'All' && <Mail className="text-muted-foreground h-3 w-3" />}
                      {f}
                    </span>
                    <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                      {count}
                    </Badge>
                  </button>
                )
              })}
              <div className="mt-4 px-3">
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
                  <Input
                    placeholder="Search letters…"
                    className="h-8 pl-7 text-xs"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </PaneBody>
          </>
        }
        centerPane={
          <>
            <PaneHeader title={`Correspondence · ${filtered.length} letters`}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => toast.info('Use the search box above to filter letters.')}
              >
                <Search className="h-3.5 w-3.5" />
                Search
              </Button>
              <Button
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() =>
                  toast.info('New letter creation coming soon', {
                    description:
                      'Use the API for now — POST to /api/letters with the letter payload.',
                  })
                }
                title="New Letter (coming soon)"
              >
                <Plus className="h-3.5 w-3.5" />
                New Letter
              </Button>
            </PaneHeader>
            <PaneBody className="px-0">
              <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 p-12 text-xs">
                <Mail className="h-6 w-6 opacity-40" />
                <div className="font-medium">No letters match the current filter</div>
                <div className="text-[11px]">
                  Try a different category or clear the search query.
                </div>
              </div>
            </PaneBody>
          </>
        }
        rightPane={
          <>
            <PaneHeader title="Letter Inspector" />
            <PaneBody>
              <div className="text-muted-foreground p-6 text-xs">
                Select a letter from the list to view details.
              </div>
            </PaneBody>
          </>
        }
        leftPaneWidth="240px"
        rightPaneWidth="380px"
      />
    )
  }

  return (
    <Workspace3Pane
      leftPane={
        <>
          <PaneHeader title="Categories">
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() =>
                toast.info('Custom categories coming soon', {
                  description: 'Use the existing Incoming/Outgoing/Site Instruction types.',
                })
              }
              title="New category (coming soon)"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </PaneHeader>
          <PaneBody className="py-2">
            {(['All', 'Incoming', 'Outgoing', 'Site Instruction'] as const).map((f) => {
              const count =
                f === 'All' ? letters.length : letters.filter((l) => l.type === f).length
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-1.5 text-xs',
                    filter === f
                      ? 'bg-accent border-primary border-l-2'
                      : 'hover:bg-accent/50 border-l-2 border-transparent'
                  )}
                >
                  <span className="flex items-center gap-2">
                    {f === 'Incoming' && <ArrowRight className="h-3 w-3 text-emerald-500" />}
                    {f === 'Outgoing' && <ArrowLeft className="h-3 w-3 text-sky-500" />}
                    {f === 'Site Instruction' && <FileText className="h-3 w-3 text-amber-500" />}
                    {f === 'All' && <Mail className="text-muted-foreground h-3 w-3" />}
                    {f}
                  </span>
                  <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                    {count}
                  </Badge>
                </button>
              )
            })}
            <div className="mt-4 px-3">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
                <Input
                  placeholder="Search letters…"
                  className="h-8 pl-7 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </PaneBody>
        </>
      }
      centerPane={
        <>
          <PaneHeader title={`Correspondence · ${filtered.length} letters`}>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => toast.info('Use the search box above to filter letters.')}
            >
              <Search className="h-3.5 w-3.5" />
              Search
            </Button>
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() =>
                toast.info('New letter creation coming soon', {
                  description:
                    'Use the API for now — POST to /api/letters with the letter payload.',
                })
              }
              title="New Letter (coming soon)"
            >
              <Plus className="h-3.5 w-3.5" />
              New Letter
            </Button>
          </PaneHeader>
          <PaneBody className="px-0">
            <div className="flex flex-col">
              {filtered.map((l) => {
                const isSelected = l.id === selectedId
                const isOverdue = l.replyBy && !l.replyTo && new Date(l.replyBy) < TODAY
                return (
                  <button
                    key={l.id}
                    onClick={() => setSelectedId(l.id)}
                    className={cn(
                      'hover:bg-accent/50 w-full border-b border-[var(--pane-divider)] px-4 py-2.5 text-left transition-colors',
                      isSelected && 'bg-accent border-l-primary border-l-2'
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-muted-foreground font-mono text-[10px]">
                        {l.number}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'h-4 px-1 text-[9px]',
                          l.type === 'Incoming' &&
                            'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
                          l.type === 'Outgoing' &&
                            'border-sky-500/40 text-sky-700 dark:text-sky-300',
                          l.type === 'Site Instruction' &&
                            'border-amber-500/40 text-amber-700 dark:text-amber-300'
                        )}
                      >
                        {l.type}
                      </Badge>
                      {isOverdue && (
                        <span className="ml-auto flex items-center gap-0.5 text-[9px] font-medium text-red-600">
                          <Clock className="h-2.5 w-2.5" />
                          Overdue
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs font-medium">{l.subject}</div>
                    <div className="text-muted-foreground mt-1 flex items-center gap-2 text-[10px]">
                      <span>{l.date}</span>
                      <span>·</span>
                      <span className="truncate">{l.from}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </PaneBody>
        </>
      }
      rightPane={
        <>
          <PaneHeader title={`Letter Inspector · ${selected.number}`} />
          <PaneBody>
            <div className="border-b border-[var(--pane-divider)] p-4">
              <div className="mb-2 flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px]',
                    selected.type === 'Incoming' &&
                      'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
                    selected.type === 'Outgoing' &&
                      'border-sky-500/40 text-sky-700 dark:text-sky-300',
                    selected.type === 'Site Instruction' &&
                      'border-amber-500/40 text-amber-700 dark:text-amber-300'
                  )}
                >
                  {selected.type}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {selected.date}
                </Badge>
              </div>
              <div className="text-sm leading-snug font-semibold">{selected.subject}</div>
              <div className="text-muted-foreground mt-2 font-mono text-xs">{selected.number}</div>
            </div>

            <div className="space-y-3 p-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    From
                  </div>
                  <div className="mt-0.5 font-medium">{selected.from}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    To
                  </div>
                  <div className="mt-0.5 font-medium">{selected.to}</div>
                </div>
              </div>

              <Separator />

              {selected.replyBy && (
                <div
                  className={cn(
                    'rounded-md p-2.5 text-[11px]',
                    selected.replyTo
                      ? 'border border-emerald-500/30 bg-emerald-500/10'
                      : new Date(selected.replyBy) < TODAY
                        ? 'border border-red-500/30 bg-red-500/10'
                        : 'border border-amber-500/30 bg-amber-500/10'
                  )}
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <Clock className="h-3.5 w-3.5" />
                    {selected.replyTo
                      ? `Replied via ${selected.replyTo}`
                      : new Date(selected.replyBy) < TODAY
                        ? `Overdue by ${Math.ceil((TODAY.getTime() - new Date(selected.replyBy).getTime()) / 86400000)} days`
                        : `Reply required by ${selected.replyBy}`}
                  </div>
                </div>
              )}

              <div>
                <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
                  Letter body (preview)
                </div>
                <div className="bg-secondary/20 text-muted-foreground max-h-40 overflow-y-auto rounded-md border border-[var(--pane-divider)] p-3 text-[11px] leading-relaxed">
                  {selected.body && selected.body.trim().length > 0
                    ? selected.body
                    : 'No body text recorded for this letter.'}
                </div>
              </div>

              {selected.hasVariation && (
                <>
                  <Separator />
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px]">
                    <div className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      Convertible to Variation Order
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      This Site Instruction carries cost/schedule impact. Convert to formal
                      Variation Order per FIDIC Clause 13.
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 gap-1 text-[10px]"
                      onClick={() =>
                        toast.info('Variation Order creation coming soon', {
                          description:
                            'Document VOs in Correspondence and link them to this letter.',
                        })
                      }
                      title="Convert to Variation Order (coming soon)"
                    >
                      <ArrowRight className="h-3 w-3" />
                      Convert to Variation Order
                    </Button>
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-full justify-start gap-2 text-xs"
                  onClick={() =>
                    toast.info('PDF viewer coming soon', {
                      description: 'Open the attached PDF from your file system.',
                    })
                  }
                  title="View PDF (coming soon)"
                >
                  <FileText className="h-3.5 w-3.5" />
                  View PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-full justify-start gap-2 text-xs"
                  onClick={() =>
                    toast.info('Draft reply coming soon', {
                      description: 'Compose replies externally and log them here.',
                    })
                  }
                  title="Draft Reply (coming soon)"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Draft Reply
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-full justify-start gap-2 text-xs"
                  onClick={() =>
                    toast.info('Follow-up scheduling coming soon', {
                      description: 'Set reminders in your calendar app.',
                    })
                  }
                  title="Schedule follow-up (coming soon)"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Schedule follow-up
                </Button>
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
