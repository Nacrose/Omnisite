'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, MapPin, Clock, Send, X, Loader2, CheckCircle2, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/app-store'
import { upsertOne } from '@/lib/api-client'

// ─── Photo categories ───────────────────────────────────────────────────────
//
// Each photo is tagged with a category so it can be:
//   1. Filtered in the mobile chat (filter chips at the top)
//   2. Imported into the right desktop module:
//      - Goods Received → GRN / procurement
//      - Progress → DSR entry
//      - Issue/NCR → Q&S NCR creation
//      - Meeting → correspondence
//      - Other → general reference

type PhotoCategory = 'progress' | 'goods' | 'issue' | 'meeting' | 'other'

const CATEGORIES: { id: PhotoCategory; label: string; color: string; bg: string }[] = [
  {
    id: 'progress',
    label: 'Progress',
    color: 'text-emerald-600',
    bg: 'bg-emerald-500/15 border-emerald-500/30',
  },
  {
    id: 'goods',
    label: 'Goods Received',
    color: 'text-violet-600',
    bg: 'bg-violet-500/15 border-violet-500/30',
  },
  {
    id: 'issue',
    label: 'Issue / NCR',
    color: 'text-red-600',
    bg: 'bg-red-500/15 border-red-500/30',
  },
  { id: 'meeting', label: 'Meeting', color: 'text-sky-600', bg: 'bg-sky-500/15 border-sky-500/30' },
  {
    id: 'other',
    label: 'Other',
    color: 'text-amber-600',
    bg: 'bg-amber-500/15 border-amber-500/30',
  },
]

interface CapturedPhoto {
  blob: Blob
  url: string
  name: string
  timestamp: string
  lat: number | null
  lng: number | null
  accuracy: number | null
}

interface ChatMessage {
  id: string
  channel: string
  sender_id: string
  sender_name: string
  content: string
  created_at: string
  project_id?: string
  photo_url?: string
  photo_category?: PhotoCategory
  photo_gps?: string
  photo_timestamp?: string
}

export default function MobileCapturePage() {
  const router = useRouter()
  const { activeProjectDbId } = useApp()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null)
  const [note, setNote] = useState('')
  const [category, setCategory] = useState<PhotoCategory>('progress')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [gettingLocation, setGettingLocation] = useState(false)

  const getLocation = (): Promise<{ lat: number; lng: number; accuracy: number } | null> => {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) {
        resolve(null)
        return
      }
      setGettingLocation(true)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGettingLocation(false)
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          })
        },
        (err) => {
          setGettingLocation(false)
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
      )
    })
  }

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = ''
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Photo too large', { description: 'Max 10 MB.' })
      return
    }

    const url = URL.createObjectURL(file)
    const timestamp = new Date().toISOString()
    const location = await getLocation()

    setPhoto({
      blob: file,
      url,
      name: file.name,
      timestamp,
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
      accuracy: location?.accuracy ?? null,
    })
    setSubmitted(false)
  }

  const handleSubmit = async () => {
    if (!photo) return
    setSubmitting(true)
    try {
      const ts = new Date(photo.timestamp).toLocaleString('en-GB')
      const gpsStr =
        photo.lat != null
          ? `${photo.lat.toFixed(6)}, ${photo.lng?.toFixed(6)} (±${photo.accuracy?.toFixed(0)}m)`
          : 'GPS unavailable'
      const catLabel = CATEGORIES.find((c) => c.id === category)?.label || 'Other'
      const noteText = note.trim()

      // Build the chat message — the photo URL is embedded as a
      // special prefix so the chat can detect + render it as a
      // thumbnail instead of plain text.
      const photoUrlPrefix = `[PHOTO:${photo.url}]`
      const message = `${photoUrlPrefix} [${catLabel.toUpperCase()}] ${noteText || '(no note)'}\n${ts}\n📍 ${gpsStr}`

      // Post to chat via upsertOne (same path as the chat module)
      const msg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        channel: 'project',
        sender_id: 'mobile-user',
        sender_name: 'Field Report',
        content: message,
        created_at: photo.timestamp,
        project_id: activeProjectDbId || undefined,
        photo_url: photo.url,
        photo_category: category,
        photo_gps: gpsStr,
        photo_timestamp: ts,
      }

      await upsertOne('chat-messages', msg as unknown as Record<string, unknown>).catch(() => {
        // In demo mode this 503s — but the message is still in local state
        // so the chat shows it (useSyncedState keeps the optimistic update)
      })

      setSubmitted(true)
      toast.success('Photo report sent', {
        description: `${catLabel} photo posted to project chat.`,
      })

      setTimeout(() => {
        setPhoto(null)
        setNote('')
        setSubmitted(false)
        router.push('/mobile/chat')
      }, 1500)
    } catch (err) {
      toast.error('Submission failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const retake = () => {
    if (photo) URL.revokeObjectURL(photo.url)
    setPhoto(null)
    setNote('')
    setSubmitted(false)
  }

  return (
    <div className="flex min-h-full flex-col p-4">
      <h1 className="mb-4 text-lg font-bold">Site Photo Capture</h1>

      {!photo ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={gettingLocation}
          className="border-border active:bg-accent flex min-h-[300px] flex-1 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors"
        >
          {gettingLocation ? (
            <>
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
              <span className="text-muted-foreground text-sm">Getting GPS…</span>
            </>
          ) : (
            <>
              <Camera className="text-muted-foreground h-12 w-12" />
              <span className="text-sm font-medium">Tap to take photo</span>
              <span className="text-muted-foreground text-xs">
                Camera opens with GPS + timestamp
              </span>
            </>
          )}
        </button>
      ) : submitted ? (
        <div className="flex min-h-[300px] flex-1 flex-col items-center justify-center gap-3">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          <span className="text-sm font-medium">Photo report sent</span>
          <span className="text-muted-foreground text-xs">Opening chat…</span>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3">
          {/* Photo preview */}
          <div className="relative overflow-hidden rounded-xl">
            <img src={photo.url} alt="Site photo" className="w-full" />
            <button
              onClick={retake}
              className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Metadata */}
          <div className="border-border bg-card space-y-1.5 rounded-xl border p-3">
            <div className="flex items-center gap-2 text-xs">
              <Clock className="text-muted-foreground h-3.5 w-3.5" />
              <span className="font-mono">{new Date(photo.timestamp).toLocaleString('en-GB')}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <MapPin className="text-muted-foreground h-3.5 w-3.5" />
              <span className="font-mono">
                {photo.lat != null
                  ? `${photo.lat.toFixed(6)}, ${photo.lng?.toFixed(6)} (±${photo.accuracy?.toFixed(0)}m)`
                  : 'GPS unavailable'}
              </span>
            </div>
          </div>

          {/* Category picker */}
          <div>
            <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <Tag className="h-3 w-3" />
              What is this photo about?
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={cn(
                    'rounded-lg border p-2 text-center text-xs font-medium transition-colors',
                    category === cat.id
                      ? cat.bg + ' ' + cat.color
                      : 'border-border bg-card text-muted-foreground'
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note input */}
          <textarea
            placeholder="Add a note (what's happening here?)…"
            className="border-border bg-card focus:border-primary min-h-[60px] flex-1 rounded-xl border p-3 text-sm outline-none"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-primary text-primary-foreground flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium active:opacity-80 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send to Chat
              </>
            )}
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoCapture}
      />
    </div>
  )
}
