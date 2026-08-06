'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Camera, Loader2, MapPin, Clock } from 'lucide-react'
import { useSyncedState } from '@/lib/use-synced-state'
import { useAuth } from '@/lib/auth'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Photo categories (must match capture page) ──────────────────────────────
type PhotoCategory = 'progress' | 'goods' | 'issue' | 'meeting' | 'other'

const CATEGORY_STYLES: Record<PhotoCategory, { label: string; bg: string; text: string }> = {
  progress: { label: 'Progress', bg: 'bg-emerald-500/15', text: 'text-emerald-600' },
  goods: { label: 'Goods', bg: 'bg-violet-500/15', text: 'text-violet-600' },
  issue: { label: 'Issue', bg: 'bg-red-500/15', text: 'text-red-600' },
  meeting: { label: 'Meeting', bg: 'bg-sky-500/15', text: 'text-sky-600' },
  other: { label: 'Other', bg: 'bg-amber-500/15', text: 'text-amber-600' },
}

const FILTERS: { id: PhotoCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'progress', label: 'Progress' },
  { id: 'goods', label: 'Goods' },
  { id: 'issue', label: 'Issues' },
  { id: 'meeting', label: 'Meetings' },
  { id: 'other', label: 'Other' },
]

interface ChatMessage {
  id: string
  channel: string
  sender_id: string
  sender_name: string
  content: string
  created_at: string
  photo_url?: string
  photo_category?: PhotoCategory
  photo_gps?: string
  photo_timestamp?: string
}

export default function MobileChatPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [messages, setMessages, loading] = useSyncedState<ChatMessage[]>(
    'omnisite-mobile-chat',
    'chat_messages',
    () => [] as ChatMessage[],
    { primaryKey: 'id' }
  )
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [filter, setFilter] = useState<PhotoCategory | 'all'>('all')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Parse photo messages: messages with [PHOTO:url] [CATEGORY] prefix
  const parsedMessages = (messages || []).map((msg) => {
    const photoMatch = msg.content.match(/^\[PHOTO:(.*?)\]/)
    const categoryMatch = msg.content.match(/\[(PROGRESS|GOODS|ISSUE|MEETING|OTHER)\]/i)
    if (photoMatch) {
      const photoUrl = photoMatch[1]
      const cat = categoryMatch
        ? (categoryMatch[1].toLowerCase() as PhotoCategory)
        : msg.photo_category || 'other'
      // Strip the [PHOTO:...] and [CATEGORY] prefixes from the display text
      const displayText = msg.content
        .replace(/^\[PHOTO:.*?\]\s*/, '')
        .replace(/^\[.*?\]\s*/, '')
        .trim()
      return { ...msg, photoUrl, photoCategory: cat, displayText }
    }
    return { ...msg, photoUrl: null, photoCategory: null, displayText: msg.content }
  })

  const filteredMessages =
    filter === 'all' ? parsedMessages : parsedMessages.filter((m) => m.photoCategory === filter)

  const sendMessage = async (content: string) => {
    if (!content.trim()) return
    setSending(true)
    try {
      const msg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        channel: 'project',
        sender_id: user?.id || 'mobile-user',
        sender_name: user?.name || 'Field User',
        content: content.trim(),
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, msg])
      setInput('')
    } catch (err) {
      toast.error('Failed to send', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setSending(false)
    }
  }

  const handlePhotoShare = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = ''
    if (!file) return
    // Redirect to the capture page for proper photo categorization
    router.push('/mobile/capture')
  }

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  // Count photos per category for filter badges
  const categoryCounts = parsedMessages.reduce(
    (acc, m) => {
      if (m.photoCategory) {
        acc[m.photoCategory] = (acc[m.photoCategory] || 0) + 1
      }
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <div className="flex h-full flex-col">
      {/* Filter chips */}
      <div className="border-border flex flex-shrink-0 gap-1.5 overflow-x-auto border-b px-3 py-2">
        {FILTERS.map((f) => {
          const count = f.id === 'all' ? parsedMessages.length : categoryCounts[f.id] || 0
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'flex flex-shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                filter === f.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground'
              )}
            >
              {f.label}
              {count > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1 text-[9px]',
                    filter === f.id ? 'bg-primary-foreground/20' : 'bg-muted'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Send className="text-muted-foreground/30 mb-2 h-8 w-8" />
            <span className="text-muted-foreground text-sm">
              {filter === 'all' ? 'No messages yet' : `No ${filter} photos yet`}
            </span>
            <span className="text-muted-foreground/60 mt-1 text-xs">
              {filter === 'all'
                ? 'Send a message or capture a photo'
                : 'Capture a photo with this tag'}
            </span>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isMe = msg.sender_id === user?.id || msg.sender_id === 'mobile-user'
            const catStyle = msg.photoCategory ? CATEGORY_STYLES[msg.photoCategory] : null
            return (
              <div key={msg.id} className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}>
                {!isMe && (
                  <span className="text-muted-foreground mb-0.5 ml-2 text-[10px] font-medium">
                    {msg.sender_name}
                  </span>
                )}
                <div
                  className={cn(
                    'max-w-[85%] overflow-hidden rounded-2xl',
                    isMe
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-secondary text-foreground rounded-bl-md'
                  )}
                >
                  {/* Photo thumbnail */}
                  {msg.photoUrl && (
                    <div className="relative">
                      <img
                        src={msg.photoUrl}
                        alt="Site photo"
                        className="max-h-64 w-full object-cover"
                        loading="lazy"
                      />
                      {/* Category badge on photo */}
                      {catStyle && (
                        <span
                          className={cn(
                            'absolute top-2 left-2 rounded-full px-2 py-0.5 text-[9px] font-semibold backdrop-blur-sm',
                            catStyle.bg,
                            catStyle.text
                          )}
                        >
                          {catStyle.label}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Text content */}
                  <div className="p-2.5">
                    {/* Category badge for text-only display (when no photo) */}
                    {!msg.photoUrl && catStyle && (
                      <span
                        className={cn(
                          'mb-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold',
                          catStyle.bg,
                          catStyle.text
                        )}
                      >
                        {catStyle.label}
                      </span>
                    )}
                    <p className="text-sm break-words whitespace-pre-wrap">{msg.displayText}</p>
                    {/* GPS + timestamp for photo messages */}
                    {msg.photoUrl && (msg.photo_gps || msg.photo_timestamp) && (
                      <div className="mt-1.5 space-y-0.5 text-[9px] opacity-70">
                        {msg.photo_timestamp && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            <span className="font-mono">{msg.photo_timestamp}</span>
                          </div>
                        )}
                        {msg.photo_gps && msg.photo_gps !== 'GPS unavailable' && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5" />
                            <span className="font-mono">{msg.photo_gps}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-muted-foreground mx-2 mt-0.5 text-[9px]">
                  {formatTime(msg.created_at)}
                </span>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="border-border bg-background safe-area-bottom flex items-center gap-2 border-t p-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-secondary text-muted-foreground active:bg-accent flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
        >
          <Camera className="h-4 w-4" />
        </button>
        <input
          type="text"
          placeholder="Message…"
          className="border-border bg-card focus:border-primary flex-1 rounded-full border px-4 py-2 text-sm outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !sending) sendMessage(input)
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || sending}
          className="bg-primary text-primary-foreground flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full active:opacity-80 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoShare}
      />
    </div>
  )
}
