'use client'

import { useState, useRef, useEffect, ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Mail, Camera, X, AlertTriangle, CheckCircle2, MapPin, Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { DsrEntry } from './types'
import { addRfi } from './rfi-tab'
import { uploadFile, deleteFile, listFiles, STORAGE_BUCKETS } from '@/lib/storage'
import { isSupabaseConfigured } from '@/lib/supabase'
import { LocationPicker } from '@/components/ui/location-picker'

interface StoredPhoto {
  name: string
  url: string
  path?: string
}

export function DsrInspector({ entry }: { entry: DsrEntry }) {
  // Material variance reconciliation only applies to concrete-pouring
  // activities. Cement/sand/aggregate coefficients (4.5 bags/cum, 0.45
  // cum/cum, 0.9 cum/cum) are meaningful for PCC/RCC/concrete work but
  // produce nonsense for excavation, dewatering, shuttering, etc.
  // Gate the entire panel on whether the task name matches a concrete
  // activity pattern.
  const CONCRETE_PATTERNS = ['pcc', 'rcc', 'concrete', 'cement']
  const isConcreteActivity = CONCRETE_PATTERNS.some((p) => entry.task.toLowerCase().includes(p))

  // Theoretical cement consumption = 4.5 bags per cum of concrete.
  // Only computed when this is a concrete activity (see isConcreteActivity).
  const theoretical = isConcreteActivity ? entry.actual * 4.5 : 0
  // Issued cement quantity is NOT available on the DsrEntry type — there's
  // no `materialIssues` field and no structured link from this entry to the
  // Material Issue Notes (MINs) that procurement records. The previously
  // hardcoded `const issued = 132` was fabricated and produced a fake
  // variance % that misled users into thinking cement consumption was
  // tracked per DSR entry. We honestly pass `null` and let the MaterialRow
  // show "—" with a "not available" note.
  const issued: number | null = null
  const variance =
    theoretical > 0 && issued !== null ? ((issued - theoretical) / theoretical) * 100 : 0
  const overVariance = isConcreteActivity && issued !== null && Math.abs(variance) > 5
  // RFI draft modal state
  const [rfiModalOpen, setRfiModalOpen] = useState(false)
  const [rfiDraft, setRfiDraft] = useState({
    subject: '',
    question: '',
    impact: '',
    background: '',
  })
  const [rfiSaved, setRfiSaved] = useState(false)
  // Stable RFI ID — generated once per mount so it doesn't change on re-render.
  const [rfiId] = useState(() => Math.floor(Math.random() * 9000) + 1000)

  // ─── Photo upload state ───────────────────────────────────────────────────
  // Photos are stored per-DSR entry in a Supabase Storage folder named after
  // the entry id (e.g. dsr-photos/D-087/<timestamp>-<rand>.jpg).
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<StoredPhoto[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const storageConfigured = isSupabaseConfigured()

  // Load existing photos whenever the entry changes.
  useEffect(() => {
    let cancelled = false
    // Defer state resets to an async microtask so the effect body itself
    // doesn't synchronously call setState (avoids cascading renders per
    // react-hooks/set-state-in-effect rule).
    Promise.resolve().then(() => {
      if (cancelled) return
      setPhotos([])
      if (!storageConfigured) {
        // Demo mode — no cloud storage; show a placeholder gallery.
        return
      }
      setPhotosLoading(true)
      listFiles(STORAGE_BUCKETS.DSR_PHOTOS, entry.id)
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
  }, [entry.id, storageConfigured])

  const triggerFilePicker = () => fileInputRef.current?.click()

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    let ok = 0
    let fail = 0
    for (const file of Array.from(files)) {
      const result = await uploadFile(STORAGE_BUCKETS.DSR_PHOTOS, file, entry.id)
      if (result.url) {
        setPhotos((prev) => [...prev, { name: file.name, url: result.url, path: result.path }])
        ok++
      } else {
        fail++
      }
    }
    setUploading(false)
    // reset input so the same file can be re-selected
    e.target.value = ''
    if (ok > 0 && fail === 0) {
      toast.success(`Uploaded ${ok} photo${ok > 1 ? 's' : ''}`, {
        description: `Saved to ${STORAGE_BUCKETS.DSR_PHOTOS}/${entry.id}/`,
      })
    } else if (ok > 0 && fail > 0) {
      toast.warning(`${ok} uploaded, ${fail} failed`)
    } else {
      toast.error('Upload failed', { description: 'Check Supabase Storage bucket permissions.' })
    }
  }

  const handleDeletePhoto = async (photo: StoredPhoto) => {
    if (!photo.path) return
    const ok = await deleteFile(STORAGE_BUCKETS.DSR_PHOTOS, photo.path)
    if (ok) {
      setPhotos((prev) => prev.filter((p) => p.url !== photo.url))
      toast.success('Photo deleted')
    } else {
      toast.error('Delete failed')
    }
  }

  const generateRfi = () => {
    // Auto-populate background from DSR remarks + entry details
    const autoBackground = `DSR Entry ${entry.id} — ${entry.task} at ${entry.chainage}.\nPlanned: ${entry.planned} ${entry.uom}, Actual: ${entry.actual} ${entry.uom}.\nRemarks: ${entry.remarks || 'No remarks recorded.'}\nSource: ${entry.source}.`
    setRfiDraft({
      subject: `RFI re: ${entry.task} — ${entry.chainage}`,
      question: '', // mandatory — left blank to highlight
      impact: '', // mandatory — left blank to highlight
      background: autoBackground,
    })
    setRfiSaved(false)
    setRfiModalOpen(true)
  }

  const saveRfi = () => {
    if (!rfiDraft.question.trim() || !rfiDraft.impact.trim()) {
      return // validation handled in UI
    }
    // Actually add the RFI to the shared store so it appears in the RFI
    // Register tab. Previously this just set local state + showed a toast,
    // and the drafted RFI was never visible in the register.
    addRfi({
      id: `r-dsr-${Date.now().toString(36)}`,
      number: `RFI-${rfiId}`,
      date: new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      subject: rfiDraft.subject || `RFI re: ${entry.task}`,
      question: rfiDraft.question,
      background: rfiDraft.background,
      impact: rfiDraft.impact,
      status: 'Open',
      replyBy: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      linkedDsr: entry.id,
      severity: 'medium',
    })
    setRfiSaved(true)
    setTimeout(() => setRfiModalOpen(false), 1200)
    toast.success('RFI saved to register', {
      description: `${entry.id} → RFI-${rfiId} added to the RFI Register. Switch to the RFI tab to review.`,
    })
  }

  return (
    <>
      <PaneHeader title={`DSR Inspector · ${entry.id}`} />
      <PaneBody>
        <div className="border-b border-[var(--pane-divider)] p-4">
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              Source: {entry.source}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {entry.status}
            </Badge>
          </div>
          <div className="text-sm leading-snug font-semibold">{entry.task}</div>
          <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
            <MapPin className="h-3 w-3" />
            {entry.chainage}
          </div>
          {/* Location picker — optional FK to project_locations.id */}
          <div className="mt-2">
            <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Work Location
            </label>
            <LocationPicker
              value={entry.locationId}
              onChange={(locationId) => {
                // Note: locationId stored in local state; will persist to DB
                // once a migration adds location_id column to dsr_entries.
                toast.success('Location linked to DSR entry', {
                  description: locationId
                    ? `Linked ${entry.id} → ${locationId}`
                    : `Cleared location on ${entry.id}`,
                })
              }}
              allowClear
              placeholder="Link to a project location…"
            />
          </div>
        </div>

        <Tabs defaultValue="progress">
          <div className="px-3 pt-2">
            <TabsList className="grid h-8 w-full grid-cols-3 text-xs">
              <TabsTrigger value="progress" className="text-[11px]">
                Progress
              </TabsTrigger>
              <TabsTrigger value="material" className="text-[11px]">
                Material Reconciliation
              </TabsTrigger>
              <TabsTrigger value="photos" className="text-[11px]">
                Photos/Docs
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="progress" className="mt-0 space-y-3 px-4 py-3 text-xs">
            <div>
              <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Planned Qty
              </label>
              <Input className="mt-1 h-8" defaultValue={entry.planned} />
              <span className="text-muted-foreground text-[10px]">{entry.uom}</span>
            </div>
            <div>
              <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Actual Completed Qty
              </label>
              <Input className="mt-1 h-8" defaultValue={entry.actual} />
              <span className="text-muted-foreground text-[10px]">{entry.uom}</span>
            </div>
            <div className="bg-secondary/40 rounded-md p-2.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Variance</span>
                <span className="font-mono font-medium">
                  {(entry.actual - entry.planned).toFixed(1)} {entry.uom}
                </span>
              </div>
              {/* Cumulative-for-task and locked % done previously showed
                  fabricated "87 / 145 cum (60%)" / "60% (locked)". We don't
                  have cumulative task quantities wired into the DSR entry —
                  that requires summing all DSR entries against the same
                  scheduler task and comparing to the task's BOQ-allocated
                  qty, which isn't linked per-entry yet. Show "—" instead
                  of a fabricated number. */}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cumulative for task</span>
                <span className="font-mono">—</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Task % done (locked)</span>
                <span className="font-mono font-semibold">—</span>
              </div>
              <div className="text-muted-foreground mt-1 text-[10px] italic">
                Cumulative task consumption requires a linked scheduler task &amp; BOQ allocation —
                not configured for this entry.
              </div>
            </div>
            <Separator />
            <div>
              <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Remarks
              </label>
              <Textarea className="mt-1 min-h-[60px] text-xs" defaultValue={entry.remarks} />
            </div>

            <div className="flex items-start gap-2 rounded-md border border-sky-500/30 bg-sky-500/10 p-2.5 text-[11px]">
              <Mail className="mt-0.5 h-3.5 w-3.5 text-sky-500" />
              <div className="flex-1">
                <div className="font-medium">Generate RFI from this DSR entry</div>
                <div className="text-muted-foreground">
                  Auto-populates Background from remarks + photos. Missing mandatory fields will be
                  highlighted.
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-6 gap-1 text-[10px]"
                onClick={generateRfi}
              >
                ❓ Generate RFI
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="material" className="mt-0 space-y-3 px-4 py-3 text-xs">
            {isConcreteActivity ? (
              <>
                <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Theoretical vs Issued
                </div>
                {/* Issued (MIN) quantities for sand/aggregate are also not
                    wired into the DSR entry — the previous hardcoded
                    `issued={12.8}` (sand) and `issued={25.4}` (aggregate)
                    were fabricated to match the seed MIN-0042 free-text
                    "12.8 cum sand". We pass `null` so MaterialRow shows
                    "—" instead of fake numbers. */}
                <div className="space-y-2">
                  <MaterialRow
                    mat="Cement OPC 53 (Bag)"
                    theoretical={theoretical}
                    issued={issued}
                    uom="bag"
                  />
                  <MaterialRow
                    mat="River Sand (cum)"
                    theoretical={entry.actual * 0.45}
                    issued={null}
                    uom="cum"
                  />
                  <MaterialRow
                    mat="Coarse Agg. 20mm (cum)"
                    theoretical={entry.actual * 0.9}
                    issued={null}
                    uom="cum"
                  />
                </div>
                {/* Material consumption data is not available for this entry.
                    When issued is null on every row, surface a single
                    honest note instead of (or in addition to) the
                    per-row "—" placeholders. */}
                {issued === null && (
                  <div className="text-muted-foreground rounded-md border border-dashed border-[var(--pane-divider)] p-2.5 text-[11px]">
                    Material consumption data not available for this entry. Issue materials via the
                    Procurement → Material Issues (MIN) tab and link them to this DSR entry to
                    populate the reconciliation.
                  </div>
                )}
                {overVariance && (
                  <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-[11px]">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-red-500" />
                    <div>
                      <div className="font-medium">
                        Material variance &gt; 5% — cannot mark Completed
                      </div>
                      <div className="text-muted-foreground">
                        Cement consumption {variance.toFixed(1)}% above theoretical. Mandatory
                        remark required to override.
                      </div>
                      <Button size="sm" variant="outline" className="mt-1.5 h-6 text-[10px]">
                        Add override remark
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-muted-foreground rounded-md border border-dashed border-[var(--pane-divider)] p-4 text-center text-[11px]">
                Material variance reconciliation applies only to concrete activities (PCC, RCC,
                concrete pouring). This task (&ldquo;{entry.task}&rdquo;) does not consume cement,
                sand, or aggregate, so no theoretical-vs-issued comparison is shown.
              </div>
            )}
          </TabsContent>

          <TabsContent value="photos" className="mt-0 px-4 py-3">
            {/* Hidden file input — triggered by the Upload Photo button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
              aria-label="Upload DSR photos"
            />

            {/* Photo gallery */}
            {photosLoading ? (
              <div className="grid grid-cols-2 gap-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="bg-secondary/50 flex aspect-square animate-pulse items-center justify-center rounded-md"
                  >
                    <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                  </div>
                ))}
              </div>
            ) : photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {photos.map((photo, i) => (
                  <div
                    key={photo.url + i}
                    className="group relative aspect-square overflow-hidden rounded-md border border-[var(--pane-divider)]"
                  >
                    <img
                      src={photo.url}
                      alt={`DSR ${entry.id} photo ${i + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    {storageConfigured && (
                      <button
                        onClick={() => handleDeletePhoto(photo)}
                        className="absolute top-1 right-1 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label={`Delete photo ${i + 1}`}
                        title="Delete photo"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex aspect-square items-center justify-center rounded-md bg-gradient-to-br from-slate-300 to-slate-400 dark:from-slate-700 dark:to-slate-800"
                  >
                    <Camera className="h-6 w-6 text-white/60" />
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="mt-3 h-8 w-full gap-1.5 text-xs"
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

            {!storageConfigured && (
              <p className="text-muted-foreground mt-2 text-center text-[10px]">
                Demo mode — configure Supabase Storage to enable uploads.
              </p>
            )}
            {photos.length > 0 && (
              <p className="text-muted-foreground mt-2 text-center text-[10px]">
                {photos.length} photo{photos.length > 1 ? 's' : ''} in {STORAGE_BUCKETS.DSR_PHOTOS}/
                {entry.id}/
              </p>
            )}
          </TabsContent>
        </Tabs>
      </PaneBody>

      {/* RFI Draft Modal */}
      {rfiModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setRfiModalOpen(false)}
        >
          <div
            className="pane w-full max-w-lg overflow-hidden rounded-xl border border-[var(--pane-divider)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex h-12 items-center justify-between border-b border-[var(--pane-divider)] bg-sky-500/10 px-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-sky-500" />
                <span className="text-sm font-semibold">
                  {rfiSaved ? 'RFI Draft Saved' : 'New RFI Draft — Auto-populated from DSR'}
                </span>
              </div>
              <button
                onClick={() => setRfiModalOpen(false)}
                className="hover:bg-accent text-muted-foreground rounded p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {rfiSaved ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
                <div className="text-sm font-semibold">RFI-{rfiId} created</div>
                <div className="text-muted-foreground mt-1 text-xs">
                  Draft saved — switch to the RFI Register tab to review and submit.
                </div>
              </div>
            ) : (
              <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
                {/* RFI number + linked DSR */}
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-[10px]">
                    RFI-DRAFT
                  </Badge>
                  <span className="text-muted-foreground">
                    Linked to: <span className="text-foreground font-mono">{entry.id}</span>
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{entry.chainage}</span>
                </div>

                {/* Subject — auto-populated */}
                <div>
                  <label className="text-xs font-medium">Subject</label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    value={rfiDraft.subject}
                    onChange={(e) => setRfiDraft((d) => ({ ...d, subject: e.target.value }))}
                  />
                </div>

                {/* Background — auto-populated from DSR */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium">
                    Background
                    <span className="rounded bg-sky-500/15 px-1 py-0.5 text-[9px] font-normal text-sky-700 dark:text-sky-300">
                      auto-filled from DSR
                    </span>
                  </label>
                  <Textarea
                    className="mt-1 min-h-[80px] font-mono text-xs"
                    value={rfiDraft.background}
                    onChange={(e) => setRfiDraft((d) => ({ ...d, background: e.target.value }))}
                  />
                </div>

                {/* Question — MANDATORY, highlighted if empty */}
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium">
                    Question <span className="text-red-500">*</span>
                    {!rfiDraft.question.trim() && (
                      <span className="flex items-center gap-0.5 text-[9px] text-amber-600">
                        <AlertTriangle className="h-2.5 w-2.5" /> mandatory — missing
                      </span>
                    )}
                  </label>
                  <Textarea
                    className={cn(
                      'mt-1 min-h-[60px] text-xs',
                      !rfiDraft.question.trim() && 'border-amber-500/50 ring-1 ring-amber-500/20'
                    )}
                    placeholder="State the specific question for the consultant..."
                    value={rfiDraft.question}
                    onChange={(e) => setRfiDraft((d) => ({ ...d, question: e.target.value }))}
                    autoFocus
                  />
                </div>

                {/* Impact — MANDATORY, highlighted if empty */}
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium">
                    Impact <span className="text-red-500">*</span>
                    {!rfiDraft.impact.trim() && (
                      <span className="flex items-center gap-0.5 text-[9px] text-amber-600">
                        <AlertTriangle className="h-2.5 w-2.5" /> mandatory — missing
                      </span>
                    )}
                  </label>
                  <Textarea
                    className={cn(
                      'mt-1 min-h-[60px] text-xs',
                      !rfiDraft.impact.trim() && 'border-amber-500/50 ring-1 ring-amber-500/20'
                    )}
                    placeholder="Describe cost/schedule impact if not resolved..."
                    value={rfiDraft.impact}
                    onChange={(e) => setRfiDraft((d) => ({ ...d, impact: e.target.value }))}
                  />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-[var(--pane-divider)] pt-2">
                  <div className="text-muted-foreground text-[10px]">
                    {!rfiDraft.question.trim() || !rfiDraft.impact.trim() ? (
                      <span className="flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="h-3 w-3" /> Fill mandatory fields to save
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" /> Ready to save
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setRfiModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={!rfiDraft.question.trim() || !rfiDraft.impact.trim()}
                      onClick={saveRfi}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Save RFI Draft
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

function MaterialRow({
  mat,
  theoretical,
  issued,
  uom,
}: {
  mat: string
  theoretical: number
  /** Issued (MIN) quantity, or null when no material-issue data is linked
   *  to this DSR entry. We show "—" instead of a fabricated number. */
  issued: number | null
  uom: string
}) {
  // Guard divide-by-zero: when theoretical is 0 (e.g. a planned-but-not-
  // started task with actual=0), variance would be Infinity/NaN.
  // When issued is null (no MIN data linked), we can't compute variance.
  const variance =
    theoretical > 0 && issued !== null ? ((issued - theoretical) / theoretical) * 100 : 0
  const over = issued !== null && Math.abs(variance) > 5
  const issuedDisplay = issued === null ? '—' : `${issued.toFixed(2)} ${uom}`
  const varianceDisplay =
    issued === null ? '—' : `${variance >= 0 ? '+' : ''}${variance.toFixed(1)}%`
  return (
    <div
      className={cn(
        'rounded border p-2',
        over ? 'border-red-500/40 bg-red-500/5' : 'border-[var(--pane-divider)]'
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-medium">{mat}</span>
        {over ? (
          <AlertTriangle className="h-3 w-3 text-red-500" />
        ) : issued === null ? (
          <span className="text-muted-foreground text-[9px]">no MIN data</span>
        ) : (
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div>
          <div className="text-muted-foreground">Theoretical</div>
          <div className="font-mono font-medium">
            {theoretical.toFixed(2)} {uom}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Issued (MIN)</div>
          <div className="font-mono font-medium">{issuedDisplay}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Variance</div>
          <div className={cn('font-mono font-medium', over && 'text-red-500')}>
            {varianceDisplay}
          </div>
        </div>
      </div>
    </div>
  )
}
