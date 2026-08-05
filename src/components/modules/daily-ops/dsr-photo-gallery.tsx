'use client'

import { Button } from '@/components/ui/button'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { STORAGE_BUCKETS } from '@/lib/storage'

interface StoredPhoto {
  name: string
  url: string
  path?: string
}

interface DsrPhotoGalleryProps {
  /** DSR entry ID (used for the storage folder path + photo alt text). */
  entryId: string
  /** Photos loaded from Supabase Storage. */
  photos: StoredPhoto[]
  /** Whether photos are currently loading from storage. */
  photosLoading: boolean
  /** Whether an upload is in progress. */
  uploading: boolean
  /** Whether Supabase Storage is configured (enables delete buttons). */
  storageConfigured: boolean
  /** Trigger the hidden file input. */
  onTriggerFilePicker: () => void
  /** Delete a photo by its StoredPhoto object. */
  onDeletePhoto: (photo: StoredPhoto) => void
}

/**
 * Photo gallery for the DSR Inspector's "Photos/Docs" tab.
 *
 * Shows a 2-column grid of photos with delete buttons (when storage is
 * configured), a loading skeleton, an empty placeholder, and the Upload
 * Photo button.
 *
 * Extracted from dsr-inspector.tsx so the main component focuses on layout.
 */
export function DsrPhotoGallery({
  entryId,
  photos,
  photosLoading,
  uploading,
  storageConfigured,
  onTriggerFilePicker,
  onDeletePhoto,
}: DsrPhotoGalleryProps) {
  return (
    <>
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
          {photos.map((photo) => (
            <div
              key={photo.path || photo.url}
              className="group relative aspect-square overflow-hidden rounded-md border border-[var(--pane-divider)]"
            >
              <img
                src={photo.url}
                alt={`DSR ${entryId} photo`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {storageConfigured && (
                <button
                  onClick={() => onDeletePhoto(photo)}
                  className="absolute top-1 right-1 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Delete photo"
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
        onClick={onTriggerFilePicker}
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
          {entryId}/
        </p>
      )}
    </>
  )
}
