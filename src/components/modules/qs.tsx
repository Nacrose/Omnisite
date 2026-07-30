'use client'

import { useState } from 'react'
import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Plus, Search, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, FileText, Lock, Users, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface QsItem {
  id: string; type: 'ITR' | 'NCR' | 'Punch' | 'Incident' | 'Near-Miss'; title: string; linkedBoq?: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Closed' | 'Open';
  date: string; assignee?: string; dueDate?: string; severity?: 'low' | 'medium' | 'high'; billingHold?: boolean;
}

const ITEMS: QsItem[] = [
  { id: 'ITR-042', type: 'ITR', title: 'PCC M15 — footing at ch. 4+200 to 4+350', linkedBoq: '1.1.3', status: 'Submitted', date: '30 Jul 2026', assignee: 'Er. Suresh (Consultant)' },
  { id: 'ITR-041', type: 'ITR', title: 'Stone soling at pier P-4', linkedBoq: '1.1.2', status: 'Approved', date: '29 Jul 2026' },
  { id: 'NCR-034', type: 'NCR', title: 'Rebar cover < 40mm at box culvert base slab', linkedBoq: '3.2', status: 'Open', date: '28 Jul 2026', assignee: 'Bikash Rai', dueDate: '05 Aug 2026', severity: 'high', billingHold: true },
  { id: 'NCR-033', type: 'NCR', title: 'Honeycombing in PCC at ch. 4+050', linkedBoq: '1.1.4', status: 'Closed', date: '20 Jul 2026' },
  { id: 'PCH-018', type: 'Punch', title: 'Smooth edges at expansion joint', status: 'Open', date: '27 Jul 2026', assignee: 'Foreman Ram', dueDate: '15 Aug 2026', severity: 'low' },
  { id: 'PCH-017', type: 'Punch', title: 'Clean debris from drainage outlet', status: 'Closed', date: '22 Jul 2026' },
  { id: 'INC-005', type: 'Incident', title: 'Worker minor cut at rebar yard', status: 'Closed', date: '25 Jul 2026', severity: 'low' },
  { id: 'NM-012', type: 'Near-Miss', title: 'Tipper reversing without spotter', status: 'Open', date: '28 Jul 2026', severity: 'medium' },
]

export function QsModule() {
  const [selectedId, setSelectedId] = useState('NCR-034')
  const [filter, setFilter] = useState<'All' | 'ITR' | 'NCR' | 'Punch' | 'Incident' | 'Near-Miss'>('All')
  const selected = ITEMS.find(i => i.id === selectedId) ?? ITEMS[0]
  const filtered = filter === 'All' ? ITEMS : ITEMS.filter(i => i.type === filter)

  return (
    <Workspace3Pane
      leftPane={
        <>
          <PaneHeader title="Categories">
            <Button variant="ghost" size="sm" className="h-7"><Plus className="w-3.5 h-3.5" /></Button>
          </PaneHeader>
          <PaneBody className="py-2">
            {(['All', 'ITR', 'NCR', 'Punch', 'Incident', 'Near-Miss'] as const).map(f => {
              const count = f === 'All' ? ITEMS.length : ITEMS.filter(i => i.type === f).length
              return (
                <button key={f} onClick={() => setFilter(f)} className={cn('w-full flex items-center justify-between px-3 py-1.5 text-xs', filter === f ? 'bg-accent border-l-2 border-primary' : 'hover:bg-accent/50 border-l-2 border-transparent')}>
                  <span className="flex items-center gap-2">
                    {f === 'ITR' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                    {f === 'NCR' && <AlertTriangle className="w-3 h-3 text-red-500" />}
                    {f === 'Punch' && <FileText className="w-3 h-3 text-amber-500" />}
                    {f === 'Incident' && <XCircle className="w-3 h-3 text-red-500" />}
                    {f === 'Near-Miss' && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                    {f === 'All' && <ShieldCheck className="w-3 h-3 text-muted-foreground" />}
                    {f}
                  </span>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1">{count}</Badge>
                </button>
              )
            })}
            <div className="mt-4 px-3">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search register…" className="h-8 pl-7 text-xs" />
              </div>
            </div>
          </PaneBody>
          <div className="border-t border-[var(--pane-divider)] p-3 space-y-1.5 text-xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Billing Holds</div>
            <div className="p-2 rounded-md bg-red-500/10 border border-red-500/30">
              <div className="flex items-center gap-1.5 text-red-600 font-medium"><Lock className="w-3 h-3" />1 active hold</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">NCR-034 · BOQ 3.2 · Max billable = 0</div>
            </div>
          </div>
        </>
      }
      centerPane={
        <>
          <PaneHeader title="Q&S Register">
            <Button size="sm" className="h-7 text-xs gap-1.5"><Plus className="w-3.5 h-3.5" />New {filter === 'All' ? 'Record' : filter}</Button>
          </PaneHeader>
          <div className="flex items-center h-8 border-b border-[var(--pane-divider)] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/30">
            <div className="w-20 px-2">ID</div>
            <div className="w-20 px-2">Type</div>
            <div className="flex-1 px-2">Title</div>
            <div className="w-32 px-2">Linked BOQ</div>
            <div className="w-24 px-2">Date</div>
            <div className="w-24 px-2">Severity</div>
            <div className="w-28 px-2">Status</div>
          </div>
          <PaneBody className="px-0">
            {filtered.map(it => (
              <div
                key={it.id}
                onClick={() => setSelectedId(it.id)}
                className={cn('flex items-center h-12 border-b border-[var(--pane-divider)] text-xs cursor-pointer row-hover', selectedId === it.id && 'bg-accent', it.billingHold && 'bg-red-500/5')}
              >
                <div className="w-20 px-2 font-mono text-muted-foreground">{it.id}</div>
                <div className="w-20 px-2">
                  <Badge variant="outline" className={cn('text-[9px]', it.type === 'ITR' && 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300', it.type === 'NCR' && 'border-red-500/40 text-red-700 dark:text-red-300', it.type === 'Punch' && 'border-amber-500/40 text-amber-700 dark:text-amber-300', it.type === 'Incident' && 'border-red-500/40 text-red-700 dark:text-red-300', it.type === 'Near-Miss' && 'border-amber-500/40 text-amber-700 dark:text-amber-300')}>{it.type}</Badge>
                </div>
                <div className="flex-1 px-2 min-w-0">
                  <div className="font-medium truncate">{it.title}</div>
                  {it.billingHold && <div className="text-[10px] text-red-600 flex items-center gap-1"><Lock className="w-2.5 h-2.5" />Billing hold active · Max billable = 0</div>}
                </div>
                <div className="w-32 px-2 font-mono text-[10px] text-muted-foreground">{it.linkedBoq || '—'}</div>
                <div className="w-24 px-2 text-muted-foreground">{it.date}</div>
                <div className="w-24 px-2">
                  {it.severity && (
                    <Badge variant="outline" className={cn('text-[9px]', it.severity === 'high' && 'border-red-500/40 text-red-700 dark:text-red-300', it.severity === 'medium' && 'border-amber-500/40 text-amber-700 dark:text-amber-300', it.severity === 'low' && 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300')}>{it.severity}</Badge>
                  )}
                </div>
                <div className="w-28 px-2">
                  <Badge variant="secondary" className={cn('text-[10px]', it.status === 'Approved' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', it.status === 'Rejected' && 'bg-red-500/15 text-red-700 dark:text-red-300', it.status === 'Open' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300', it.status === 'Closed' && 'bg-slate-400/15')}>{it.status}</Badge>
                </div>
              </div>
            ))}
          </PaneBody>
        </>
      }
      rightPane={<QsInspector item={selected} />}
      leftPaneWidth="240px"
      rightPaneWidth="380px"
    />
  )
}

function QsInspector({ item }: { item: QsItem }) {
  return (
    <>
      <PaneHeader title={`Inspector · ${item.id}`} />
      <PaneBody>
        <div className="p-4 border-b border-[var(--pane-divider)]">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
            <Badge variant="secondary" className="text-[10px]">{item.status}</Badge>
            {item.severity && <Badge variant="outline" className={cn('text-[10px]', item.severity === 'high' && 'border-red-500/40 text-red-700 dark:text-red-300', item.severity === 'medium' && 'border-amber-500/40 text-amber-700 dark:text-amber-300')}>{item.severity}</Badge>}
          </div>
          <div className="text-sm font-semibold leading-snug">{item.title}</div>
          <div className="text-xs text-muted-foreground mt-1">{item.date}</div>
        </div>

        <div className="p-4 space-y-3 text-xs">
          {item.linkedBoq && (
            <div className="p-2.5 rounded-md bg-secondary/40">
              <div className="text-[10px] text-muted-foreground">Linked BOQ Item</div>
              <div className="font-mono font-medium mt-0.5">{item.linkedBoq}</div>
            </div>
          )}

          {item.type === 'ITR' && (
            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Workflow</div>
              <div className="flex items-center gap-1 text-[10px]">
                <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Draft</Badge>
                <span>→</span>
                <Badge variant="secondary" className="bg-primary/15 text-primary">Submitted</Badge>
                <span>→</span>
                <Badge variant="outline">Consultant Approved</Badge>
              </div>
              <div className="text-[10px] text-muted-foreground">Auto-prompted when DSR task marked &quot;Completed&quot;. Rejection auto-generates NCR.</div>
            </div>
          )}

          {item.type === 'NCR' && (
            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Corrective Action Plan (mandatory)</div>
              <div>
                <label className="text-[10px] text-muted-foreground">Root cause</label>
                <Textarea className="mt-1 text-xs min-h-[40px]" defaultValue="Rebar spacer blocks displaced during concrete pour due to inadequate fixing." />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Corrective action</label>
                <Textarea className="mt-1 text-xs min-h-[40px]" defaultValue="Reinstate cover with additional spacer blocks. Re-pour affected area after consultant re-inspection. Update method statement for future pours." />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Assignee</label>
                  <Input className="mt-1 h-8 text-xs" defaultValue={item.assignee} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Due date</label>
                  <Input className="mt-1 h-8 text-xs" defaultValue={item.dueDate} />
                </div>
              </div>
              <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] flex items-start gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-500 mt-0.5" />
                <div>
                  <div className="font-medium">Requires Consultant digital sign-off to close</div>
                  <div className="text-muted-foreground">NCR cannot be closed internally — Engineer&apos;s counter-signature required.</div>
                </div>
              </div>
            </div>
          )}

          {item.billingHold && (
            <>
              <Separator />
              <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/30">
                <div className="flex items-center gap-1.5 text-red-600 font-medium text-[11px]"><Lock className="w-3.5 h-3.5" />Billing Hold Active</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Open NCR linked to BOQ {item.linkedBoq} drops <span className="font-medium text-foreground">Max Billable Qty = 0</span> in Financials Module until NCR is &quot;Closed&quot;.
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Unbilled work alert sent to PM. Once closed, billing resumes automatically.
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-1.5">
            <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start gap-2"><FileText className="w-3.5 h-3.5" />View Attachments (3 photos)</Button>
            <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start gap-2"><Users className="w-3.5 h-3.5" />Assign / Reassign</Button>
            {item.type === 'NCR' && item.status === 'Open' && (
              <Button size="sm" className="w-full h-8 text-xs gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Submit for Consultant Sign-off</Button>
            )}
          </div>
        </div>
      </PaneBody>
    </>
  )
}
