'use client'

import { useState, useRef, useEffect, ChangeEvent } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Plus, Search, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, FileText, Lock, Users, Clock, ArrowRight,
  Camera, Loader2, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useSyncedState } from '@/lib/use-synced-state'
import { uploadFile, deleteFile, listFiles, STORAGE_BUCKETS } from '@/lib/storage'
import { isSupabaseConfigured } from '@/lib/supabase'

interface QsItem {
  id: string; type: 'ITR' | 'NCR' | 'Punch' | 'Incident' | 'Near-Miss'; title: string; linkedBoq?: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Closed' | 'Open' | 'CAP Submitted' | 'Consultant Sign-off';
  date: string; assignee?: string; dueDate?: string; severity?: 'low' | 'medium' | 'high'; billingHold?: boolean;
  cap?: { rootCause: string; action: string; assignee: string; dueDate: string };
}

const INITIAL_ITEMS: QsItem[] = [
  { id: 'ITR-042', type: 'ITR', title: 'PCC M15 — footing at ch. 4+200 to 4+350', linkedBoq: '1.1.3', status: 'Submitted', date: '30 Jul 2026', assignee: 'Er. Suresh (Consultant)' },
  { id: 'ITR-041', type: 'ITR', title: 'Stone soling at pier P-4', linkedBoq: '1.1.2', status: 'Approved', date: '29 Jul 2026' },
  { id: 'NCR-034', type: 'NCR', title: 'Rebar cover < 40mm at box culvert base slab', linkedBoq: '3.2', status: 'Open', date: '28 Jul 2026', assignee: 'Bikash Rai', dueDate: '05 Aug 2026', severity: 'high', billingHold: true },
  { id: 'NCR-033', type: 'NCR', title: 'Honeycombing in PCC at ch. 4+050', linkedBoq: '1.1.4', status: 'Closed', date: '20 Jul 2026' },
  { id: 'PCH-018', type: 'Punch', title: 'Smooth edges at expansion joint', status: 'Open', date: '27 Jul 2026', assignee: 'Foreman Ram', dueDate: '15 Aug 2026', severity: 'low' },
  { id: 'PCH-017', type: 'Punch', title: 'Clean debris from drainage outlet', status: 'Closed', date: '22 Jul 2026' },
  { id: 'INC-005', type: 'Incident', title: 'Worker minor cut at rebar yard', status: 'Closed', date: '25 Jul 2026', severity: 'low' },
  { id: 'NM-012', type: 'Near-Miss', title: 'Tipper reversing without spotter', status: 'Open', date: '28 Jul 2026', severity: 'medium' },
]

// NCR workflow: Open → CAP Submitted → Consultant Sign-off → Closed
const NCR_WORKFLOW: Record<string, string | null> = {
  'Open': 'CAP Submitted',
  'CAP Submitted': 'Consultant Sign-off',
  'Consultant Sign-off': 'Closed',
  'Closed': null,
}

export function QsModule() {
  const [selectedId, setSelectedId] = useState('NCR-034')
  const [filter, setFilter] = useState<'All' | 'ITR' | 'NCR' | 'Punch' | 'Incident' | 'Near-Miss'>('All')
  const [items, setItems] = useSyncedState<QsItem[]>(
    'omnisite-qs-items',
    'qs_items',
    () => JSON.parse(JSON.stringify(INITIAL_ITEMS)),
    {
      fieldMap: { linkedBoq: 'linked_boq', dueDate: 'due_date', billingHold: 'billing_hold' },
      primaryKey: 'id',
    }
  ) as [QsItem[], (v: QsItem[] | ((prev: QsItem[]) => QsItem[])) => void, boolean]
  const filtered = filter === 'All' ? items : items.filter(i => i.type === filter)
  // Inspector should follow the filter — if the selected item isn't in the
  // filtered list, fall back to the first filtered item instead of showing
  // a stale selection from a different category.
  const selected = filtered.find(i => i.id === selectedId) ?? filtered[0]

  // Advance an NCR to the next workflow status.
  // Guarded: only NCR-type items can be advanced. Punch / Incident /
  // Near-Miss items have their own (simpler) lifecycle and must NOT be
  // pushed into NCR-only statuses like 'CAP Submitted'.
  const advanceNcr = (id: string) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it
      if (it.type !== 'NCR') return it
      const next = NCR_WORKFLOW[it.status]
      if (!next) return it
      // When closing, release the billing hold
      const newBillingHold = next === 'Closed' ? false : it.billingHold
      return { ...it, status: next as QsItem['status'], billingHold: newBillingHold }
    }))
    // Toast uses the latest `items` state (closure value). For a more accurate
    // message we look up the item being advanced.
    const target = items.find(i => i.id === id)
    if (target && target.type === 'NCR') {
      const next = NCR_WORKFLOW[target.status]
      if (next) {
        toast.success('NCR advanced', {
          description: `${target.id} → ${next}${next === 'Closed' ? ' · billing hold released' : ''}`,
        })
      }
    }
  }

  // Save CAP (corrective action plan) on an NCR
  const saveCap = (id: string, cap: { rootCause: string; action: string; assignee: string; dueDate: string }) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, cap } : it))
    toast.success('Corrective Action Plan saved', { description: `${id} ready for consultant submission` })
  }

  return (
    <Workspace2Pane
      leftPane={
        <>
          <PaneHeader title="Categories">
            <Button variant="ghost" size="sm" className="h-7"><Plus className="w-3.5 h-3.5" /></Button>
          </PaneHeader>
          <PaneBody className="py-2">
            {(['All', 'ITR', 'NCR', 'Punch', 'Incident', 'Near-Miss'] as const).map(f => {
              const count = f === 'All' ? items.length : items.filter(i => i.type === f).length
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
            {(() => {
              const holds = items.filter(i => i.billingHold)
              if (holds.length === 0) {
                return <div className="p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-[11px]">No active billing holds</div>
              }
              return holds.map(h => (
                <div key={h.id} className="p-2 rounded-md bg-red-500/10 border border-red-500/30">
                  <div className="flex items-center gap-1.5 text-red-600 font-medium"><Lock className="w-3 h-3" />{h.id} hold active</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{h.title}</div>
                </div>
              ))
            })()}
          </div>
        </>
      }
      rightPane={<QsInspector key={selected.id} item={selected} onAdvance={advanceNcr} onSaveCap={saveCap} />}
      leftPaneWidth="240px"
      rightPaneWidth="380px"
    />
  )
}

function QsInspector({ item, onAdvance, onSaveCap }: {
  item: QsItem
  onAdvance: (id: string) => void
  onSaveCap: (id: string, cap: { rootCause: string; action: string; assignee: string; dueDate: string }) => void
}) {
  // Local state for CAP form
  const [capForm, setCapForm] = useState({
    rootCause: item.cap?.rootCause || 'Rebar spacer blocks displaced during concrete pour due to inadequate fixing.',
    action: item.cap?.action || 'Reinstate cover with additional spacer blocks. Re-pour affected area after consultant re-inspection. Update method statement for future pours.',
    assignee: item.cap?.assignee || item.assignee || '',
    dueDate: item.cap?.dueDate || item.dueDate || '',
  })

  // ─── NCR / ITR photo upload state ────────────────────────────────────────
  // Photos live in the ncr-photos bucket under a folder named after the
  // item id (e.g. ncr-photos/NCR-034/<timestamp>-<rand>.jpg).
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<{ name: string; url: string; path?: string }[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const storageConfigured = isSupabaseConfigured()

  useEffect(() => {
    let cancelled = false
    // Defer state resets to an async microtask so the effect body itself
    // doesn't synchronously call setState (avoids cascading renders per
    // react-hooks/set-state-in-effect rule).
    Promise.resolve().then(() => {
      if (cancelled) return
      setPhotos([])
      if (!storageConfigured) return
      setPhotosLoading(true)
      listFiles(STORAGE_BUCKETS.NCR_PHOTOS, item.id)
        .then(files => {
          if (cancelled) return
          // Use the storage path returned by listFiles (not the public URL)
          // so deleteFile() can actually remove the file later.
          setPhotos(files.map(f => ({ name: f.name, url: f.url, path: f.path })))
        })
        .catch(() => {
          if (cancelled) return
          toast.error('Failed to load photos')
        })
        .finally(() => {
          if (!cancelled) setPhotosLoading(false)
        })
    })
    return () => { cancelled = true }
  }, [item.id, storageConfigured])

  const triggerFilePicker = () => fileInputRef.current?.click()

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    let ok = 0
    let fail = 0
    for (const file of Array.from(files)) {
      const result = await uploadFile(STORAGE_BUCKETS.NCR_PHOTOS, file, item.id)
      if (result.url) {
        setPhotos(prev => [...prev, { name: file.name, url: result.url, path: result.path }])
        ok++
      } else {
        fail++
      }
    }
    setUploading(false)
    e.target.value = ''
    if (ok > 0 && fail === 0) {
      toast.success(`Uploaded ${ok} photo${ok > 1 ? 's' : ''}`, {
        description: `Saved to ${STORAGE_BUCKETS.NCR_PHOTOS}/${item.id}/`,
      })
    } else if (ok > 0 && fail > 0) {
      toast.warning(`${ok} uploaded, ${fail} failed`)
    } else {
      toast.error('Upload failed', { description: 'Check Supabase Storage bucket permissions.' })
    }
  }

  const handleDeletePhoto = async (photo: { url: string; path?: string }) => {
    if (!photo.path) return
    const ok = await deleteFile(STORAGE_BUCKETS.NCR_PHOTOS, photo.path)
    if (ok) {
      setPhotos(prev => prev.filter(p => p.url !== photo.url))
      toast.success('Photo deleted')
    } else {
      toast.error('Delete failed')
    }
  }

  const nextStatus = item.type === 'NCR' ? NCR_WORKFLOW[item.status] : null
  const workflowSteps = ['Open', 'CAP Submitted', 'Consultant Sign-off', 'Closed']
  const currentStepIndex = workflowSteps.indexOf(item.status)

  // Determine the action button label based on current status.
  // Only NCR items have the CAP → Consultant → Close workflow; Punch /
  // Incident / Near-Miss items must NOT show the NCR action button.
  const actionLabel = (() => {
    if (item.type !== 'NCR') return null
    if (item.status === 'Open') return 'Submit Corrective Action Plan'
    if (item.status === 'CAP Submitted') return 'Request Consultant Sign-off'
    if (item.status === 'Consultant Sign-off') return 'Approve & Close NCR'
    return null
  })()

  return (
    <>
      <PaneHeader title={`Inspector · ${item.id}`} />
      <PaneBody>
        <div className="p-4 border-b border-[var(--pane-divider)]">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
            <Badge variant="secondary" className={cn('text-[10px]', item.status === 'Closed' && 'bg-slate-400/15', item.status === 'Open' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300', item.status === 'CAP Submitted' && 'bg-sky-500/15 text-sky-700 dark:text-sky-300', item.status === 'Consultant Sign-off' && 'bg-violet-500/15 text-violet-700 dark:text-violet-300')}>{item.status}</Badge>
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

          {/* NCR Workflow Stepper */}
          {item.type === 'NCR' && (
            <div className="space-y-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">NCR Workflow</div>
              {/* Stepper */}
              <div className="flex items-center gap-1">
                {workflowSteps.map((step, i) => {
                  const isDone = i < currentStepIndex
                  const isCurrent = i === currentStepIndex
                  const isFuture = i > currentStepIndex
                  return (
                    <div key={step} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center gap-1 flex-1">
                        <div className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all',
                          isDone && 'bg-emerald-500 border-emerald-500 text-white',
                          isCurrent && 'bg-primary border-primary text-primary-foreground ring-4 ring-primary/20',
                          isFuture && 'bg-secondary border-[var(--pane-divider)] text-muted-foreground'
                        )}>
                          {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                        </div>
                        <div className={cn(
                          'text-[9px] text-center leading-tight',
                          isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'
                        )}>
                          {step}
                        </div>
                      </div>
                      {i < workflowSteps.length - 1 && (
                        <div className={cn('h-0.5 flex-1 -mt-4', i < currentStepIndex ? 'bg-emerald-500' : 'bg-[var(--pane-divider)]')} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* CAP Form (shown when NCR is Open or CAP Submitted) */}
          {item.type === 'NCR' && (item.status === 'Open' || item.status === 'CAP Submitted') && (
            <div className="space-y-2 p-2.5 rounded-md border border-[var(--pane-divider)] bg-secondary/20">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                Corrective Action Plan {item.cap ? '(saved)' : '(required)'}
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Root cause</label>
                <Textarea
                  className="mt-1 text-xs min-h-[40px]"
                  value={capForm.rootCause}
                  onChange={(e) => setCapForm(f => ({ ...f, rootCause: e.target.value }))}
                  disabled={item.status !== 'Open'}
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Corrective action</label>
                <Textarea
                  className="mt-1 text-xs min-h-[40px]"
                  value={capForm.action}
                  onChange={(e) => setCapForm(f => ({ ...f, action: e.target.value }))}
                  disabled={item.status !== 'Open'}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Assignee</label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    value={capForm.assignee}
                    onChange={(e) => setCapForm(f => ({ ...f, assignee: e.target.value }))}
                    disabled={item.status !== 'Open'}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Due date</label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    value={capForm.dueDate}
                    onChange={(e) => setCapForm(f => ({ ...f, dueDate: e.target.value }))}
                    disabled={item.status !== 'Open'}
                  />
                </div>
              </div>
              {item.status === 'Open' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs gap-1.5"
                  onClick={() => onSaveCap(item.id, capForm)}
                >
                  <CheckCircle2 className="w-3 h-3" />Save CAP Draft
                </Button>
              )}
            </div>
          )}

          {/* Consultant sign-off notice */}
          {item.type === 'NCR' && item.status === 'Consultant Sign-off' && (
            <div className="p-2.5 rounded-md bg-violet-500/10 border border-violet-500/30 text-[11px] flex items-start gap-2">
              <Clock className="w-3.5 h-3.5 text-violet-500 mt-0.5" />
              <div>
                <div className="font-medium text-violet-700 dark:text-violet-300">Awaiting Consultant digital sign-off</div>
                <div className="text-muted-foreground mt-0.5">CAP submitted on 30 Jul 2026. Engineer Er. Suresh has been notified. NCR cannot be closed until counter-signature is received.</div>
                <div className="text-[10px] text-muted-foreground mt-1">Last activity: 2 hours ago</div>
              </div>
            </div>
          )}

          {/* Closed summary */}
          {item.type === 'NCR' && item.status === 'Closed' && (
            <div className="p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[11px] flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5" />
              <div>
                <div className="font-medium text-emerald-700 dark:text-emerald-300">NCR Closed</div>
                <div className="text-muted-foreground mt-0.5">Consultant sign-off received. Billing hold released — Max Billable Qty restored in Financials.</div>
                <div className="text-[10px] text-muted-foreground mt-1">Closed by: Er. Suresh · 30 Jul 2026 15:42</div>
              </div>
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

          {/* Billing hold — shown when active OR just released */}
          {item.type === 'NCR' && (item.billingHold || item.status === 'Closed') && (
            <>
              <Separator />
              <div className={cn(
                'p-2.5 rounded-md border text-[11px]',
                item.billingHold ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'
              )}>
                <div className={cn('flex items-center gap-1.5 font-medium', item.billingHold ? 'text-red-600' : 'text-emerald-600')}>
                  {item.billingHold ? <Lock className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {item.billingHold ? 'Billing Hold Active' : 'Billing Hold Released'}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {item.billingHold
                    ? <>Open NCR linked to BOQ {item.linkedBoq} drops <span className="font-medium text-foreground">Max Billable Qty = 0</span> in Financials until NCR is Closed.</>
                    : <>Max Billable Qty restored for BOQ {item.linkedBoq}. Billing can resume in Financials.</>
                  }
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Action button — advances workflow */}
          {actionLabel && (
            <Button
              size="sm"
              className="w-full h-9 text-xs gap-1.5"
              onClick={() => onAdvance(item.id)}
            >
              {item.status === 'Consultant Sign-off' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
              {actionLabel}
            </Button>
          )}

          <div className="space-y-1.5">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
              aria-label={`Upload photos for ${item.id}`}
            />

            {/* Photo gallery — existing NCR/ITR photos */}
            {photosLoading ? (
              <div className="grid grid-cols-3 gap-1.5">
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    className="aspect-square rounded bg-secondary/50 animate-pulse flex items-center justify-center"
                  >
                    <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
                  </div>
                ))}
              </div>
            ) : photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-1.5">
                {photos.map((photo, i) => (
                  <div
                    key={photo.url + i}
                    className="relative group aspect-square rounded overflow-hidden border border-[var(--pane-divider)]"
                  >
                    <img
                      src={photo.url}
                      alt={`${item.id} photo ${i + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {storageConfigured && (
                      <button
                        onClick={() => handleDeletePhoto(photo)}
                        className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Delete photo ${i + 1}`}
                        title="Delete photo"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs justify-start gap-2"
              onClick={triggerFilePicker}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5" />
                  Upload Photo
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start gap-2">
              <FileText className="w-3.5 h-3.5" />
              View Attachments ({photos.length} photos)
            </Button>
            <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start gap-2"><Users className="w-3.5 h-3.5" />Assign / Reassign</Button>

            {!storageConfigured && (
              <p className="text-[10px] text-muted-foreground text-center pt-1">
                Demo mode — configure Supabase Storage to enable uploads.
              </p>
            )}
          </div>
        </div>
      </PaneBody>
    </>
  )
}
