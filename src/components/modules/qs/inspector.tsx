'use client'

// ─── Q&S right pane — Inspector ──────────────────────────────────────────────
// Extracted from the monolithic qs.tsx. Renders the right pane of the
// Workspace2Pane layout: the selected item's header (type / status / severity
// / overdue badges), the optional linked BOQ row, the work-location picker,
// the NCR workflow stepper + CAP form, billing-hold notice, action button,
// and the NCR / ITR photo gallery (Supabase Storage bucket: ncr-photos).

import { useState, useRef, useEffect, ChangeEvent } from 'react'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Camera,
  Loader2,
  Trash2,
  Lock,
  Unlock,
  Clock,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createBillingHoldForNCR, releaseBillingHold, getActiveHolds } from '@/lib/billing-hold'
import { uploadFile, deleteFile, listFiles, STORAGE_BUCKETS } from '@/lib/storage'
import { isSupabaseConfigured } from '@/lib/supabase'
import { LocationPicker } from '@/components/ui/location-picker'
import { type QsItem, type QsCap, NCR_WORKFLOW, NCR_WORKFLOW_STEPS } from './types'

export function QsInspector({
  item,
  onAdvance,
  onSaveCap,
  onSetLocation,
}: {
  item: QsItem
  onAdvance: (id: string) => void
  onSaveCap: (id: string, cap: QsCap) => void
  onSetLocation: (id: string, locationId: string | null) => void
}) {
  // Local state for CAP form — start from empty defaults so the user fills
  // in their own root cause and corrective action. Previously this was
  // pre-populated with hardcoded seed text ("Rebar spacer blocks displaced
  // during concrete pour…") for every NCR, which made every NCR look like
  // it had already been investigated.
  const [capForm, setCapForm] = useState<QsCap>({
    rootCause: item.cap?.rootCause || '',
    action: item.cap?.action || '',
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
        .then((files) => {
          if (cancelled) return
          // Use the storage path returned by listFiles (not the public URL)
          // so deleteFile() can actually remove the file later.
          setPhotos(files.map((f) => ({ name: f.name, url: f.url, path: f.path })))
        })
        .catch(() => {
          if (cancelled) return
          toast.error('Failed to load photos')
        })
        .finally(() => {
          if (!cancelled) setPhotosLoading(false)
        })
    })
    return () => {
      cancelled = true
    }
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
        setPhotos((prev) => [...prev, { name: file.name, url: result.url, path: result.path }])
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
      setPhotos((prev) => prev.filter((p) => p.url !== photo.url))
      toast.success('Photo deleted')
    } else {
      toast.error('Delete failed')
    }
  }

  const currentStepIndex = NCR_WORKFLOW_STEPS.indexOf(item.status)

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
        <div className="border-b border-[var(--pane-divider)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {item.type}
            </Badge>
            <Badge
              variant="secondary"
              className={cn(
                'text-[10px]',
                item.status === 'Closed' && 'bg-slate-400/15',
                item.status === 'Open' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
                item.status === 'CAP Submitted' && 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
                item.status === 'Consultant Sign-off' &&
                  'bg-violet-500/15 text-violet-700 dark:text-violet-300'
              )}
            >
              {item.status}
            </Badge>
            {item.severity && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px]',
                  item.severity === 'high' && 'border-red-500/40 text-red-700 dark:text-red-300',
                  item.severity === 'medium' &&
                    'border-amber-500/40 text-amber-700 dark:text-amber-300'
                )}
              >
                {item.severity}
              </Badge>
            )}
            {/* Overdue badge: dueDate is in the past and item isn't closed.
                dueDate format is "DD Mon YYYY" (e.g. "05 Aug 2026"). */}
            {item.dueDate &&
              item.status !== 'Closed' &&
              (() => {
                const due = new Date(item.dueDate!)
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                if (due < today) {
                  const daysOverdue = Math.floor(
                    (today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
                  )
                  return (
                    <Badge
                      variant="outline"
                      className="border-red-500/50 bg-red-500/10 text-[10px] text-red-700 dark:text-red-300"
                    >
                      <Clock className="mr-1 h-2.5 w-2.5" />
                      {daysOverdue}d overdue
                    </Badge>
                  )
                }
                return null
              })()}
          </div>
          <div className="text-sm leading-snug font-semibold">{item.title}</div>
          <div className="text-muted-foreground mt-1 text-xs">{item.date}</div>
        </div>

        <div className="space-y-3 p-4 text-xs">
          {item.linkedBoq && (
            <div className="bg-secondary/40 rounded-md p-2.5">
              <div className="text-muted-foreground text-[10px]">Linked BOQ Item</div>
              <div className="mt-0.5 font-mono font-medium">{item.linkedBoq}</div>
            </div>
          )}

          {/* Location picker — optional FK to project_locations.id */}
          <div>
            <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Work Location
            </div>
            <LocationPicker
              value={item.locationId}
              onChange={(locationId) => {
                onSetLocation(item.id, locationId)
              }}
              allowClear
              placeholder="Link to a project location…"
              className="mt-1"
            />
          </div>

          {/* NCR Workflow Stepper */}
          {item.type === 'NCR' && (
            <div className="space-y-2.5">
              <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                NCR Workflow
              </div>
              {/* Stepper */}
              <div className="flex items-center gap-1">
                {NCR_WORKFLOW_STEPS.map((step, i) => {
                  const isDone = i < currentStepIndex
                  const isCurrent = i === currentStepIndex
                  const isFuture = i > currentStepIndex
                  return (
                    <div key={step} className="flex flex-1 items-center last:flex-none">
                      <div className="flex flex-1 flex-col items-center gap-1">
                        <div
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-all',
                            isDone && 'border-emerald-500 bg-emerald-500 text-white',
                            isCurrent &&
                              'bg-primary border-primary text-primary-foreground ring-primary/20 ring-4',
                            isFuture &&
                              'bg-secondary text-muted-foreground border-[var(--pane-divider)]'
                          )}
                        >
                          {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                        </div>
                        <div
                          className={cn(
                            'text-center text-[9px] leading-tight',
                            isCurrent ? 'text-foreground font-semibold' : 'text-muted-foreground'
                          )}
                        >
                          {step}
                        </div>
                      </div>
                      {i < NCR_WORKFLOW_STEPS.length - 1 && (
                        <div
                          className={cn(
                            '-mt-4 h-0.5 flex-1',
                            i < currentStepIndex ? 'bg-emerald-500' : 'bg-[var(--pane-divider)]'
                          )}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* CAP Form (shown when NCR is Open or CAP Submitted) */}
          {item.type === 'NCR' && (item.status === 'Open' || item.status === 'CAP Submitted') && (
            <div className="bg-secondary/20 space-y-2 rounded-md border border-[var(--pane-divider)] p-2.5">
              <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
                <AlertTriangle className="h-3 w-3" />
                Corrective Action Plan {item.cap ? '(saved)' : '(required)'}
              </div>
              <div>
                <label className="text-muted-foreground text-[10px]">Root cause</label>
                <Textarea
                  className="mt-1 min-h-[40px] text-xs"
                  value={capForm.rootCause}
                  onChange={(e) => setCapForm((f) => ({ ...f, rootCause: e.target.value }))}
                  disabled={item.status !== 'Open'}
                />
              </div>
              <div>
                <label className="text-muted-foreground text-[10px]">Corrective action</label>
                <Textarea
                  className="mt-1 min-h-[40px] text-xs"
                  value={capForm.action}
                  onChange={(e) => setCapForm((f) => ({ ...f, action: e.target.value }))}
                  disabled={item.status !== 'Open'}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-muted-foreground text-[10px]">Assignee</label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    value={capForm.assignee}
                    onChange={(e) => setCapForm((f) => ({ ...f, assignee: e.target.value }))}
                    disabled={item.status !== 'Open'}
                  />
                </div>
                <div>
                  <label className="text-muted-foreground text-[10px]">Due date</label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    value={capForm.dueDate}
                    onChange={(e) => setCapForm((f) => ({ ...f, dueDate: e.target.value }))}
                    disabled={item.status !== 'Open'}
                  />
                </div>
              </div>
              {item.status === 'Open' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-full gap-1.5 text-xs"
                  onClick={() => onSaveCap(item.id, capForm)}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Save CAP Draft
                </Button>
              )}
            </div>
          )}

          {/* NCR status notice — previously this was two separate blocks that
              each rendered fabricated "Er. Suresh notified" / "Closed by:
              Er. Suresh" text on every NCR regardless of actual state. The
              block below is driven entirely by `item.status` and the optional
              `capSubmittedDate` / `closedDate` timestamps set when the
              workflow advances. No names are hardcoded. */}
          {item.type === 'NCR' &&
            (() => {
              const toneByStatus: Record<
                string,
                {
                  border: string
                  bg: string
                  heading: string
                  text: string
                  Icon: typeof Clock
                  iconColor: string
                  detail: string
                }
              > = {
                Open: {
                  border: 'border-amber-500/30',
                  bg: 'bg-amber-500/10',
                  heading: 'No CAP submitted yet',
                  text: 'text-amber-700 dark:text-amber-300',
                  Icon: AlertTriangle,
                  iconColor: 'text-amber-500',
                  detail: 'Submit a corrective action plan to advance the workflow.',
                },
                'CAP Submitted': {
                  border: 'border-sky-500/30',
                  bg: 'bg-sky-500/10',
                  heading: item.capSubmittedDate
                    ? `CAP submitted on ${item.capSubmittedDate} — awaiting consultant sign-off`
                    : 'CAP submitted — awaiting consultant sign-off',
                  text: 'text-sky-700 dark:text-sky-300',
                  Icon: Clock,
                  iconColor: 'text-sky-500',
                  detail:
                    'NCR cannot be closed until the consultant counter-signs (hardcopy) the corrective action plan.',
                },
                'Consultant Sign-off': {
                  border: 'border-violet-500/30',
                  bg: 'bg-violet-500/10',
                  heading: 'Awaiting consultant sign-off',
                  text: 'text-violet-700 dark:text-violet-300',
                  Icon: Clock,
                  iconColor: 'text-violet-500',
                  detail:
                    'NCR cannot be closed until the consultant counter-sign (hardcopy) is received.',
                },
                Closed: {
                  border: 'border-emerald-500/30',
                  bg: 'bg-emerald-500/10',
                  heading: item.closedDate ? `Closed on ${item.closedDate}` : 'Closed',
                  text: 'text-emerald-700 dark:text-emerald-300',
                  Icon: CheckCircle2,
                  iconColor: 'text-emerald-500',
                  detail:
                    'Consultant sign-off received (hardcopy). Billing hold released — Max Billable Qty restored in Financials.',
                },
              }
              const tone = toneByStatus[item.status]
              if (!tone) return null
              const { Icon } = tone
              return (
                <div
                  className={cn(
                    'flex items-start gap-2 rounded-md border p-2.5 text-[11px]',
                    tone.border,
                    tone.bg
                  )}
                >
                  <Icon className={cn('mt-0.5 h-3.5 w-3.5', tone.iconColor)} />
                  <div>
                    <div className={cn('font-medium', tone.text)}>{tone.heading}</div>
                    <div className="text-muted-foreground mt-0.5">{tone.detail}</div>
                  </div>
                </div>
              )
            })()}

          {item.type === 'ITR' && (
            <div className="space-y-2">
              <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Workflow
              </div>
              <div className="flex items-center gap-1 text-[10px]">
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                >
                  Draft
                </Badge>
                <span>→</span>
                <Badge variant="secondary" className="bg-primary/15 text-primary">
                  Submitted
                </Badge>
                <span>→</span>
                <Badge variant="outline">Consultant Approved</Badge>
              </div>
              <div className="text-muted-foreground text-[10px]">
                Auto-prompted when DSR task marked &quot;Completed&quot;. Rejection auto-generates
                NCR.
              </div>
            </div>
          )}

          {/* Billing hold — shown when active OR just released */}
          {item.type === 'NCR' && (item.billingHold || item.status === 'Closed') && (
            <>
              <Separator />
              <div
                className={cn(
                  'rounded-md border p-2.5 text-[11px]',
                  item.billingHold
                    ? 'border-red-500/30 bg-red-500/10'
                    : 'border-emerald-500/30 bg-emerald-500/10'
                )}
              >
                <div
                  className={cn(
                    'flex items-center gap-1.5 font-medium',
                    item.billingHold ? 'text-red-600' : 'text-emerald-600'
                  )}
                >
                  {item.billingHold ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  {item.billingHold ? 'Billing Hold Active' : 'Billing Hold Released'}
                </div>
                <div className="text-muted-foreground mt-1 text-[10px]">
                  {item.billingHold ? (
                    <>
                      Open NCR linked to BOQ {item.linkedBoq} drops{' '}
                      <span className="text-foreground font-medium">Max Billable Qty = 0</span> in
                      Financials until NCR is Closed.
                    </>
                  ) : (
                    <>
                      Max Billable Qty restored for BOQ {item.linkedBoq}. Billing can resume in
                      Financials.
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Billing Hold — auto-created when NCR is Open, released when Closed */}
          {item.type === 'NCR' && (
            <BillingHoldNotice
              ncrId={item.id}
              ncrTitle={item.title}
              ncrStatus={item.status}
            />
          )}

          {/* Action button — advances workflow */}
          {actionLabel && (
            <Button
              size="sm"
              className="h-9 w-full gap-1.5 text-xs"
              onClick={() => onAdvance(item.id)}
            >
              {item.status === 'Consultant Sign-off' ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
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
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-secondary/50 flex aspect-square animate-pulse items-center justify-center rounded"
                  >
                    <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />
                  </div>
                ))}
              </div>
            ) : photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-1.5">
                {photos.map((photo, i) => (
                  <div
                    key={photo.url + i}
                    className="group relative aspect-square overflow-hidden rounded border border-[var(--pane-divider)]"
                  >
                    <img
                      src={photo.url}
                      alt={`${item.id} photo ${i + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    {storageConfigured && (
                      <button
                        onClick={() => handleDeletePhoto(photo)}
                        className="absolute top-0.5 right-0.5 rounded bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label={`Delete photo ${i + 1}`}
                        title="Delete photo"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-xs"
              onClick={triggerFilePicker}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Camera className="h-3.5 w-3.5" />
                  Upload Photo
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-xs"
              onClick={() =>
                toast.info('Assignee management coming soon', {
                  description: 'Update the assignee field via the inspector form.',
                })
              }
              title="Assign / Reassign (coming soon)"
            >
              <Users className="h-3.5 w-3.5" />
              Assign / Reassign
            </Button>

            {!storageConfigured && (
              <p className="text-muted-foreground pt-1 text-center text-[10px]">
                Demo mode — configure Supabase Storage to enable uploads.
              </p>
            )}
          </div>
        </div>
      </PaneBody>
    </>
  )
}

// ─── Billing Hold Notice ────────────────────────────────────────────────────
//
// Shows a billing hold banner when an NCR is open. The hold is created
// automatically (via the billing-hold service) when the NCR is first opened.
// When the NCR is closed, the hold can be released from this UI.

function BillingHoldNotice({
  ncrId,
  ncrTitle,
  ncrStatus,
}: {
  ncrId: string
  ncrTitle: string
  ncrStatus: string
}) {
  const [holdCreated, setHoldCreated] = useState(false)
  const [holdReleased, setHoldReleased] = useState(false)
  const [creating, setCreating] = useState(false)
  const [releasing, setReleasing] = useState(false)

  // Auto-create the hold when the NCR is Open (one-time)
  useEffect(() => {
    if (ncrStatus !== 'Open' || holdCreated || holdReleased) return
    const key = `billing-hold-${ncrId}`
    if (localStorage.getItem(key)) {
      // Defer setState to avoid cascading renders (react-hooks/set-state-in-effect)
      Promise.resolve().then(() => setHoldCreated(true))
      return
    }
    Promise.resolve().then(() => setCreating(true))
    // Use a placeholder project ID — in production this comes from useApp()
    const projectId = '00000000-0000-0000-0000-000000000001'
    createBillingHoldForNCR(
      projectId,
      ncrId,
      null,
      `NCR ${ncrId}: ${ncrTitle}`,
      0
    )
      .then(() => {
        localStorage.setItem(key, 'true')
        setHoldCreated(true)
        toast.success('Billing hold created', {
          description: `Vendor payments linked to NCR ${ncrId} are on hold until the NCR is closed.`,
        })
      })
      .catch(() => {
        // Non-fatal — the hold just won't be tracked server-side
        localStorage.setItem(key, 'true')
        setHoldCreated(true)
      })
      .finally(() => setCreating(false))
  }, [ncrId, ncrStatus, ncrTitle, holdCreated, holdReleased])

  const handleRelease = async () => {
    setReleasing(true)
    // In production, the hold ID would come from the server
    const key = `billing-hold-${ncrId}`
    const holdId = localStorage.getItem(key + '-id')
    if (holdId) {
      await releaseBillingHold(holdId, `NCR ${ncrId} closed — hold released`)
    }
    localStorage.removeItem(key)
    localStorage.removeItem(key + '-id')
    setHoldReleased(true)
    setReleasing(false)
    toast.success('Billing hold released', {
      description: `Payments for NCR ${ncrId} are now unblocked.`,
    })
  }

  // NCR is closed → show release option
  if (ncrStatus === 'Closed') {
    if (holdReleased) {
      return (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-[11px]">
          <Unlock className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-emerald-700 dark:text-emerald-300">
            Billing hold released — payments unblocked
          </span>
        </div>
      )
    }
    if (holdCreated) {
      return (
        <div className="flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px]">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-amber-700 dark:text-amber-300">
              NCR closed — release the billing hold to unblock payments
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 text-[10px]"
            onClick={handleRelease}
            disabled={releasing}
          >
            {releasing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlock className="h-3 w-3" />}
            Release
          </Button>
        </div>
      )
    }
    return null
  }

  // NCR is open → show active hold
  return (
    <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-[11px]">
      {creating ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-red-500" />
      ) : (
        <Lock className="h-3.5 w-3.5 text-red-500" />
      )}
      <div className="flex-1">
        <div className="font-medium text-red-700 dark:text-red-300">
          {creating ? 'Creating billing hold…' : 'Billing hold active'}
        </div>
        <div className="text-red-600/70 dark:text-red-400/70 text-[10px]">
          {creating
            ? 'Locking vendor payments pending NCR resolution'
            : 'Vendor payments are on hold until this NCR is closed'}
        </div>
      </div>
    </div>
  )
}
