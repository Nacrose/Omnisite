'use client'

import { useState, useRef, useEffect, ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import {
  Mail, Camera, X, AlertTriangle, CheckCircle2, MapPin, Loader2, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { DsrEntry } from './types'
import { uploadFile, deleteFile, listFiles, STORAGE_BUCKETS } from '@/lib/storage'
import { isSupabaseConfigured } from '@/lib/supabase'

interface StoredPhoto {
  name: string
  url: string
  path?: string
}

export function DsrInspector({ entry }: { entry: DsrEntry }) {
  // Theoretical cement consumption = 4.5 bags per cum of concrete.
  // Guard against divide-by-zero when entry.actual is 0 (e.g. a planned-
  // but-not-started task) — otherwise variance would be Infinity.
  const theoretical = entry.actual * 4.5 // bags per cum (cement)
  const issued = 132
  const variance = theoretical > 0 ? ((issued - theoretical) / theoretical) * 100 : 0
  const overVariance = Math.abs(variance) > 5
  // RFI draft modal state
  const [rfiModalOpen, setRfiModalOpen] = useState(false)
  const [rfiDraft, setRfiDraft] = useState({
    subject: '',
    question: '',
    impact: '',
    background: '',
  })
  const [rfiSaved, setRfiSaved] = useState(false)

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
      listFiles(STORAGE_BUCKETS.DSRR_PHOTOS, entry.id)
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
      const result = await uploadFile(STORAGE_BUCKETS.DSRR_PHOTOS, file, entry.id)
      if (result.url) {
        setPhotos(prev => [...prev, { name: file.name, url: result.url, path: result.path }])
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
        description: `Saved to ${STORAGE_BUCKETS.DSRR_PHOTOS}/${entry.id}/`,
      })
    } else if (ok > 0 && fail > 0) {
      toast.warning(`${ok} uploaded, ${fail} failed`)
    } else {
      toast.error('Upload failed', { description: 'Check Supabase Storage bucket permissions.' })
    }
  }

  const handleDeletePhoto = async (photo: StoredPhoto) => {
    if (!photo.path) return
    const ok = await deleteFile(STORAGE_BUCKETS.DSRR_PHOTOS, photo.path)
    if (ok) {
      setPhotos(prev => prev.filter(p => p.url !== photo.url))
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
      impact: '',   // mandatory — left blank to highlight
      background: autoBackground,
    })
    setRfiSaved(false)
    setRfiModalOpen(true)
  }

  const saveRfi = () => {
    if (!rfiDraft.question.trim() || !rfiDraft.impact.trim()) {
      return // validation handled in UI
    }
    setRfiSaved(true)
    setTimeout(() => setRfiModalOpen(false), 1200)
  }

  return (
    <>
      <PaneHeader title={`DSR Inspector · ${entry.id}`} />
      <PaneBody>
        <div className="p-4 border-b border-[var(--pane-divider)]">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px]">Source: {entry.source}</Badge>
            <Badge variant="secondary" className="text-[10px]">{entry.status}</Badge>
          </div>
          <div className="text-sm font-semibold leading-snug">{entry.task}</div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <MapPin className="w-3 h-3" />
            {entry.chainage}
          </div>
        </div>

        <Tabs defaultValue="progress">
          <div className="px-3 pt-2">
            <TabsList className="grid grid-cols-3 h-8 w-full text-xs">
              <TabsTrigger value="progress" className="text-[11px]">Progress</TabsTrigger>
              <TabsTrigger value="material" className="text-[11px]">Material Reconciliation</TabsTrigger>
              <TabsTrigger value="photos" className="text-[11px]">Photos/Docs</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="progress" className="mt-0 px-4 py-3 space-y-3 text-xs">
            <div>
              <label className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">Planned Qty</label>
              <Input className="mt-1 h-8" defaultValue={entry.planned} />
              <span className="text-[10px] text-muted-foreground">{entry.uom}</span>
            </div>
            <div>
              <label className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">Actual Completed Qty</label>
              <Input className="mt-1 h-8" defaultValue={entry.actual} />
              <span className="text-[10px] text-muted-foreground">{entry.uom}</span>
            </div>
            <div className="p-2.5 rounded-md bg-secondary/40">
              <div className="flex justify-between"><span className="text-muted-foreground">Variance</span><span className="font-mono font-medium">{(entry.actual - entry.planned).toFixed(1)} {entry.uom}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Cumulative for task</span><span className="font-mono">87 / 145 cum (60%)</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Task % done (locked)</span><span className="font-mono font-semibold">60%</span></div>
            </div>
            <Separator />
            <div>
              <label className="text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">Remarks</label>
              <Textarea className="mt-1 text-xs min-h-[60px]" defaultValue={entry.remarks} />
            </div>

            <div className="p-2.5 rounded-md bg-sky-500/10 border border-sky-500/30 text-[11px] flex items-start gap-2">
              <Mail className="w-3.5 h-3.5 text-sky-500 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium">Generate RFI from this DSR entry</div>
                <div className="text-muted-foreground">Auto-populates Background from remarks + photos. Missing mandatory fields will be highlighted.</div>
              </div>
              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={generateRfi}>❓ Generate RFI</Button>
            </div>
          </TabsContent>

          <TabsContent value="material" className="mt-0 px-4 py-3 space-y-3 text-xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Theoretical vs Issued</div>
            <div className="space-y-2">
              <MaterialRow mat="Cement OPC 53 (Bag)" theoretical={theoretical} issued={issued} uom="bag" />
              <MaterialRow mat="River Sand (cum)" theoretical={entry.actual * 0.45} issued={12.8} uom="cum" />
              <MaterialRow mat="Coarse Agg. 20mm (cum)" theoretical={entry.actual * 0.9} issued={25.4} uom="cum" />
            </div>
            {overVariance && (
              <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/30 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5" />
                <div>
                  <div className="font-medium">Material variance &gt; 5% — cannot mark Completed</div>
                  <div className="text-muted-foreground">Cement consumption {variance.toFixed(1)}% above theoretical. Mandatory remark required to override.</div>
                  <Button size="sm" variant="outline" className="h-6 mt-1.5 text-[10px]">Add override remark</Button>
                </div>
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
                {[1, 2].map(i => (
                  <div
                    key={i}
                    className="aspect-square rounded-md bg-secondary/50 animate-pulse flex items-center justify-center"
                  >
                    <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                  </div>
                ))}
              </div>
            ) : photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {photos.map((photo, i) => (
                  <div
                    key={photo.url + i}
                    className="relative group aspect-square rounded-md overflow-hidden border border-[var(--pane-divider)]"
                  >
                    <img
                      src={photo.url}
                      alt={`DSR ${entry.id} photo ${i + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {storageConfigured && (
                      <button
                        onClick={() => handleDeletePhoto(photo)}
                        className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Delete photo ${i + 1}`}
                        title="Delete photo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {[1, 2].map(i => (
                  <div
                    key={i}
                    className="aspect-square rounded-md bg-gradient-to-br from-slate-300 to-slate-400 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center"
                  >
                    <Camera className="w-6 h-6 text-white/60" />
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3 h-8 text-xs gap-1.5"
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

            {!storageConfigured && (
              <p className="mt-2 text-[10px] text-muted-foreground text-center">
                Demo mode — configure Supabase Storage to enable uploads.
              </p>
            )}
            {photos.length > 0 && (
              <p className="mt-2 text-[10px] text-muted-foreground text-center">
                {photos.length} photo{photos.length > 1 ? 's' : ''} in {STORAGE_BUCKETS.DSRR_PHOTOS}/{entry.id}/
              </p>
            )}
          </TabsContent>
        </Tabs>
      </PaneBody>

      {/* RFI Draft Modal */}
      {rfiModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setRfiModalOpen(false)}
        >
          <div
            className="w-full max-w-lg pane border border-[var(--pane-divider)] rounded-xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--pane-divider)] bg-sky-500/10">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-sky-500" />
                <span className="text-sm font-semibold">
                  {rfiSaved ? 'RFI Draft Saved' : 'New RFI Draft — Auto-populated from DSR'}
                </span>
              </div>
              <button onClick={() => setRfiModalOpen(false)} className="p-1 rounded hover:bg-accent text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {rfiSaved ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <div className="text-sm font-semibold">RFI-{Math.floor(Math.random() * 9000) + 1000} created</div>
                <div className="text-xs text-muted-foreground mt-1">Draft saved to Correspondence module. Consultant notified.</div>
              </div>
            ) : (
              <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
                {/* RFI number + linked DSR */}
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-[10px]">RFI-DRAFT</Badge>
                  <span className="text-muted-foreground">Linked to: <span className="font-mono text-foreground">{entry.id}</span></span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{entry.chainage}</span>
                </div>

                {/* Subject — auto-populated */}
                <div>
                  <label className="text-xs font-medium">Subject</label>
                  <Input
                    className="mt-1 h-8 text-xs"
                    value={rfiDraft.subject}
                    onChange={(e) => setRfiDraft(d => ({ ...d, subject: e.target.value }))}
                  />
                </div>

                {/* Background — auto-populated from DSR */}
                <div>
                  <label className="text-xs font-medium flex items-center gap-1.5">
                    Background
                    <span className="text-[9px] px-1 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 font-normal">auto-filled from DSR</span>
                  </label>
                  <Textarea
                    className="mt-1 text-xs min-h-[80px] font-mono"
                    value={rfiDraft.background}
                    onChange={(e) => setRfiDraft(d => ({ ...d, background: e.target.value }))}
                  />
                </div>

                {/* Question — MANDATORY, highlighted if empty */}
                <div>
                  <label className="text-xs font-medium flex items-center gap-1">
                    Question <span className="text-red-500">*</span>
                    {!rfiDraft.question.trim() && (
                      <span className="text-[9px] text-amber-600 flex items-center gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> mandatory — missing
                      </span>
                    )}
                  </label>
                  <Textarea
                    className={cn('mt-1 text-xs min-h-[60px]', !rfiDraft.question.trim() && 'border-amber-500/50 ring-1 ring-amber-500/20')}
                    placeholder="State the specific question for the consultant..."
                    value={rfiDraft.question}
                    onChange={(e) => setRfiDraft(d => ({ ...d, question: e.target.value }))}
                    autoFocus
                  />
                </div>

                {/* Impact — MANDATORY, highlighted if empty */}
                <div>
                  <label className="text-xs font-medium flex items-center gap-1">
                    Impact <span className="text-red-500">*</span>
                    {!rfiDraft.impact.trim() && (
                      <span className="text-[9px] text-amber-600 flex items-center gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> mandatory — missing
                      </span>
                    )}
                  </label>
                  <Textarea
                    className={cn('mt-1 text-xs min-h-[60px]', !rfiDraft.impact.trim() && 'border-amber-500/50 ring-1 ring-amber-500/20')}
                    placeholder="Describe cost/schedule impact if not resolved..."
                    value={rfiDraft.impact}
                    onChange={(e) => setRfiDraft(d => ({ ...d, impact: e.target.value }))}
                  />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--pane-divider)]">
                  <div className="text-[10px] text-muted-foreground">
                    {(!rfiDraft.question.trim() || !rfiDraft.impact.trim())
                      ? <span className="text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Fill mandatory fields to save</span>
                      : <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Ready to save</span>
                    }
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setRfiModalOpen(false)}>Cancel</Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={!rfiDraft.question.trim() || !rfiDraft.impact.trim()}
                      onClick={saveRfi}
                    >
                      <Mail className="w-3.5 h-3.5" />
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

function MaterialRow({ mat, theoretical, issued, uom }: { mat: string; theoretical: number; issued: number; uom: string }) {
  // Guard divide-by-zero: when theoretical is 0 (e.g. a planned-but-not-
  // started task with actual=0), variance would be Infinity/NaN.
  const variance = theoretical > 0 ? ((issued - theoretical) / theoretical) * 100 : 0
  const over = Math.abs(variance) > 5
  return (
    <div className={cn('p-2 rounded border', over ? 'border-red-500/40 bg-red-500/5' : 'border-[var(--pane-divider)]')}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium">{mat}</span>
        {over ? <AlertTriangle className="w-3 h-3 text-red-500" /> : <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div>
          <div className="text-muted-foreground">Theoretical</div>
          <div className="font-mono font-medium">{theoretical.toFixed(2)} {uom}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Issued (MIN)</div>
          <div className="font-mono font-medium">{issued.toFixed(2)} {uom}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Variance</div>
          <div className={cn('font-mono font-medium', over && 'text-red-500')}>{variance >= 0 ? '+' : ''}{variance.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  )
}
