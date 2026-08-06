'use client'

import { useState, useRef, useEffect, ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Mail, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { DsrEntry } from './types'
import { uploadFile, deleteFile, listFiles, STORAGE_BUCKETS } from '@/lib/storage'
import { isSupabaseConfigured } from '@/lib/supabase'
import { LocationPicker } from '@/components/ui/location-picker'
import { MaterialRow } from './dsr-material-row'
import { computeReconciliation, type ReconciliationRow } from '@/lib/material-reconciliation'
import { DsrPhotoGallery } from './dsr-photo-gallery'
import { DsrRfiModal } from './dsr-rfi-modal'

interface StoredPhoto {
  name: string
  url: string
  path?: string
}

export function DsrInspector({
  entry,
  onUpdateLocation,
  onUpdate,
}: {
  entry: DsrEntry
  /**
   * Fired when the user picks (or clears) a work location in the
   * LocationPicker. The parent uses this to mutate its synced dsrEntries
   * state so the link persists to Supabase and is visible across modules.
   */
  onUpdateLocation?: (locationId: string | null) => void
  /**
   * Fired when the user edits a planned/actual/remarks field. The parent
   * mutates its synced dsrEntries store so edits persist to Supabase AND
   * re-render the inspector with updated variance/etc.
   */
  onUpdate?: (field: string, value: string | number) => void
}) {
  // Material variance reconciliation only applies to concrete-pouring
  // activities.
  const CONCRETE_PATTERNS = ['pcc', 'rcc', 'concrete', 'cement']
  const isConcreteActivity = CONCRETE_PATTERNS.some((p) => entry.task.toLowerCase().includes(p))

  // Compute material reconciliation via the service from
  // src/lib/material-reconciliation.ts. Uses standard DoR M15 coefficients
  // (4.5 bags cement, 0.45 cum sand, 0.9 cum aggregate per cum of concrete).
  const reconciliationRows: ReconciliationRow[] = isConcreteActivity && entry.actual > 0
    ? computeReconciliation({
        taskActualQty: entry.actual,
        boqItemUom: entry.uom,
        coefficients: {
          'M-CEM-OPC': { coefficient: 4.5, uom: 'bag', name: 'Cement OPC 53 (Bag)' },
          'M-SAND-R': { coefficient: 0.45, uom: 'cum', name: 'River Sand (cum)' },
          'M-AGG-20': { coefficient: 0.9, uom: 'cum', name: 'Coarse Agg. 20mm (cum)' },
        },
        actualIssued: {},
      })
    : []

  // RFI draft modal state
  const [rfiModalOpen, setRfiModalOpen] = useState(false)
  const [rfiInitialDraft, setRfiInitialDraft] = useState({
    subject: '',
    question: '',
    impact: '',
    background: '',
  })
  // Stable RFI ID — generated once per mount.
  const [rfiId] = useState(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  )

  // ─── Photo upload state ───────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<StoredPhoto[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const storageConfigured = isSupabaseConfigured()

  // Load existing photos whenever the entry changes.
  useEffect(() => {
    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) return
      setPhotos([])
      if (!storageConfigured) return
      setPhotosLoading(true)
      listFiles(STORAGE_BUCKETS.DSR_PHOTOS, entry.id)
        .then((files) => {
          if (cancelled) return
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
      setPhotos((prev) => prev.filter((p) => p.path !== photo.path))
      toast.success('Photo deleted')
    } else {
      toast.error('Delete failed')
    }
  }

  const generateRfi = () => {
    const autoBackground = `DSR Entry ${entry.id} — ${entry.task} at ${entry.chainage}.\nPlanned: ${entry.planned} ${entry.uom}, Actual: ${entry.actual} ${entry.uom}.\nRemarks: ${entry.remarks || 'No remarks recorded.'}\nSource: ${entry.source}.`
    setRfiInitialDraft({
      subject: `RFI re: ${entry.task} — ${entry.chainage}`,
      question: '',
      impact: '',
      background: autoBackground,
    })
    setRfiModalOpen(true)
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
          <Input
            className="h-8 text-sm font-semibold"
            value={entry.task}
            onChange={(e) => onUpdate?.('task', e.target.value)}
          />
          <div className="mt-2 flex items-center gap-1.5">
            <MapPin className="text-muted-foreground h-3 w-3" />
            <Input
              className="h-7 flex-1 text-xs"
              value={entry.chainage}
              onChange={(e) => onUpdate?.('chainage', e.target.value)}
            />
          </div>
          <div className="mt-2">
            <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Work Location
            </label>
            <LocationPicker
              value={entry.locationId}
              onChange={(locationId) => {
                onUpdateLocation?.(locationId)
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
              <Input
                className="mt-1 h-8"
                type="number"
                value={entry.planned === 0 ? '0' : entry.planned || ''}
                placeholder="0"
                onChange={(e) => {
                  const num = Number(e.target.value)
                  onUpdate?.('planned', Number.isFinite(num) ? num : 0)
                }}
              />
              <span className="text-muted-foreground text-[10px]">{entry.uom}</span>
            </div>
            <div>
              <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Actual Completed Qty
              </label>
              <Input
                className="mt-1 h-8"
                type="number"
                value={entry.actual === 0 ? '0' : entry.actual || ''}
                placeholder="0"
                onChange={(e) => {
                  const num = Number(e.target.value)
                  onUpdate?.('actual', Number.isFinite(num) ? num : 0)
                }}
              />
              <span className="text-muted-foreground text-[10px]">{entry.uom}</span>
            </div>
            <div>
              <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Unit of Measure
              </label>
              <Input
                className="mt-1 h-8 text-xs"
                value={entry.uom}
                onChange={(e) => onUpdate?.('uom', e.target.value)}
              />
            </div>
            <div>
              <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Status
              </label>
              <select
                className="mt-1 h-8 w-full rounded-md border border-[var(--pane-divider)] bg-transparent px-2 text-xs"
                value={entry.status}
                onChange={(e) => onUpdate?.('status', e.target.value)}
              >
                <option value="pending">Pending</option>
                <option value="in-progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <div className="bg-secondary/40 rounded-md p-2.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Variance</span>
                <span className="font-mono font-medium">
                  {(entry.actual - entry.planned).toFixed(1)} {entry.uom}
                </span>
              </div>
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
              <Textarea
                className="mt-1 min-h-[60px] text-xs"
                value={entry.remarks || ''}
                onChange={(e) => onUpdate?.('remarks', e.target.value)}
              />
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
                <Mail className="h-3 w-3" />
                Generate RFI
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="material" className="mt-0 space-y-3 px-4 py-3 text-xs">
            {isConcreteActivity ? (
              <>
                <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Theoretical vs Issued
                </div>
                <div className="space-y-2">
                  {reconciliationRows.map((row) => (
                    <MaterialRow
                      key={row.materialCode}
                      mat={row.materialName}
                      theoretical={row.theoreticalQty}
                      issued={row.actualIssuedQty}
                      uom={row.materialCode === 'M-CEM-OPC' ? 'bag' : 'cum'}
                    />
                  ))}
                </div>
                <div className="text-muted-foreground rounded-md border border-dashed border-[var(--pane-divider)] p-2.5 text-[11px]">
                  Material consumption data not available for this entry. Issue materials via the
                  Procurement → Material Issues (MIN) tab and link them to this DSR entry to
                  populate the reconciliation. Tolerance: ±5% variance before flagging.
                </div>
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
              aria-label="Upload DSR photos"
            />
            <DsrPhotoGallery
              entryId={entry.id}
              photos={photos}
              photosLoading={photosLoading}
              uploading={uploading}
              storageConfigured={storageConfigured}
              onTriggerFilePicker={triggerFilePicker}
              onDeletePhoto={handleDeletePhoto}
            />
          </TabsContent>
        </Tabs>
      </PaneBody>

      {/* RFI Draft Modal */}
      {rfiModalOpen && (
        <DsrRfiModal
          entry={entry}
          rfiId={rfiId}
          initialDraft={rfiInitialDraft}
          onClose={() => setRfiModalOpen(false)}
        />
      )}
    </>
  )
}
