'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Send,
  Camera,
  Loader2,
  MapPin,
  Clock,
  Paperclip,
  FileText,
  X,
  Image as ImageIcon,
  Check,
  CheckCheck,
} from 'lucide-react'
import { useSyncedState } from '@/lib/use-synced-state'
import { useAuth } from '@/lib/auth'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { upsertOne } from '@/lib/api-client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ─── Photo categories ───────────────────────────────────────────────────────
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

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

interface ChatMessage {
  id: string
  sender_id: string
  sender_name: string
  sender_initials?: string
  sender_color?: string
  channel_id?: string
  channel?: string
  content: string
  message_type?: string
  media_url?: string
  created_at: string
  project_id?: string
  photo_url?: string
  photo_category?: PhotoCategory
  photo_gps?: string
  photo_timestamp?: string
  doc_url?: string
  doc_name?: string
  doc_type?: string
  doc_expires?: string
}

export default function MobileChatPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [messages, setMessages, loading] = useSyncedState<ChatMessage[]>(
    'omnisite-chat-messages',
    'chat_messages',
    () => [] as ChatMessage[],
    { primaryKey: 'id' }
  )
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [filter, setFilter] = useState<PhotoCategory | 'all'>('all')
  const [showAttach, setShowAttach] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Parse messages: extract photo URL + category from content if present
  const parsedMessages = useMemo(() => {
    return (messages || []).map((msg) => {
      const photoMatch = msg.content?.match(/^\[PHOTO:(.*?)\]/)
      const categoryMatch = msg.content?.match(/\[(PROGRESS|GOODS|ISSUE|MEETING|OTHER)\]/i)
      const docMatch = msg.content?.match(/^\[DOC:(.*?)\]/)

      if (photoMatch) {
        const photoUrl = photoMatch[1]
        const cat = categoryMatch
          ? (categoryMatch[1].toLowerCase() as PhotoCategory)
          : msg.photo_category || 'other'
        const displayText = msg.content
          .replace(/^\[PHOTO:.*?\]\s*/, '')
          .replace(/^\[.*?\]\s*/, '')
          .trim()
        return {
          ...msg,
          _photoUrl: photoUrl as string,
          _photoCategory: cat,
          _displayText: displayText,
          _isPhoto: true,
          _isDoc: false,
          _docUrl: '',
        }
      }
      if (docMatch) {
        const docUrl = docMatch[1]
        const displayText = msg.content.replace(/^\[DOC:.*?\]\s*/, '').trim()
        return {
          ...msg,
          _docUrl: docUrl as string,
          _displayText: displayText,
          _isPhoto: false,
          _isDoc: true,
          _photoUrl: '',
          _photoCategory: 'other' as PhotoCategory,
        }
      }
      return {
        ...msg,
        _displayText: msg.content,
        _isPhoto: false,
        _isDoc: false,
        _photoUrl: '',
        _docUrl: '',
        _photoCategory: 'other' as PhotoCategory,
      }
    })
  }, [messages])

  const filteredMessages =
    filter === 'all' ? parsedMessages : parsedMessages.filter((m) => m._photoCategory === filter)

  const sendMessage = async (content: string) => {
    if (!content.trim()) return
    setSending(true)
    try {
      const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const newMsg: ChatMessage = {
        id: msgId,
        channel: 'general',
        channel_id: 'general',
        sender_id: user?.id || 'mobile-user',
        sender_name: user?.name || 'Field User',
        sender_initials: (user?.name || 'F').charAt(0).toUpperCase(),
        sender_color: '#3b82f6',
        content: content.trim(),
        message_type: 'text',
        created_at: new Date().toISOString(),
      }

      // Optimistic insert — message shows instantly
      setMessages((prev) => [...prev, newMsg])
      setInput('')

      // Try to persist (503 in demo mode — message stays in localStorage)
      if (isSupabaseConfigured()) {
        await upsertOne('chat-messages', newMsg as unknown as Record<string, unknown>).catch(
          () => {}
        )
      }
    } catch (err) {
      toast.error('Failed to send', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setSending(false)
    }
  }

  const handlePhotoSelect = () => {
    setShowAttach(false)
    router.push('/mobile/capture')
  }

  const handleDocSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = ''
    if (!file) return
    setShowAttach(false)

    // Check size (10 MB max for docs)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large', { description: 'Max 10 MB for documents.' })
      return
    }

    // Create a blob URL (in production this would upload to Storage with 7-day expiry)
    const url = URL.createObjectURL(file)
    const expiry = new Date(Date.now() + SEVEN_DAYS_MS).toISOString()
    const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE'
    const sizeKB = (file.size / 1024).toFixed(0)

    // Post as a document message
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const content = `[DOC:${url}] ${file.name}\n${ext} · ${sizeKB} KB · Expires ${new Date(expiry).toLocaleDateString('en-GB')}`

    const newMsg: ChatMessage = {
      id: msgId,
      channel: 'general',
      channel_id: 'general',
      sender_id: user?.id || 'mobile-user',
      sender_name: user?.name || 'Field User',
      sender_initials: (user?.name || 'F').charAt(0).toUpperCase(),
      sender_color: '#3b82f6',
      content,
      message_type: 'document',
      created_at: new Date().toISOString(),
      doc_url: url,
      doc_name: file.name,
      doc_type: ext,
      doc_expires: expiry,
    }

    setMessages((prev) => [...prev, newMsg])
    toast.success('Document shared', {
      description: `${file.name} · Auto-deletes in 7 days`,
    })
  }

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso)
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      if (d.toDateString() === today.toDateString()) return 'Today'
      if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return ''
    }
  }

  const isExpired = (expires?: string) => {
    if (!expires) return false
    return new Date(expires).getTime() < Date.now()
  }

  const daysUntilExpiry = (expires?: string) => {
    if (!expires) return null
    const ms = new Date(expires).getTime() - Date.now()
    if (ms <= 0) return 0
    return Math.ceil(ms / (24 * 60 * 60 * 1000))
  }

  // Group messages by date for date separators
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: typeof filteredMessages }[] = []
    let currentDate = ''
    for (const msg of filteredMessages) {
      const date = formatDate(msg.created_at)
      if (date !== currentDate) {
        groups.push({ date, messages: [] })
        currentDate = date
      }
      groups[groups.length - 1].messages.push(msg)
    }
    return groups
  }, [filteredMessages])

  // Count per category for filter badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const m of parsedMessages) {
      if (m._photoCategory) counts[m._photoCategory] = (counts[m._photoCategory] || 0) + 1
    }
    return counts
  }, [parsedMessages])

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
      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
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
          groupedMessages.map((group, gi) => (
            <div key={gi}>
              {/* Date separator */}
              <div className="flex items-center justify-center py-2">
                <span className="bg-secondary text-muted-foreground rounded-full px-3 py-0.5 text-[10px] font-medium">
                  {group.date}
                </span>
              </div>

              {group.messages.map((msg) => {
                const isMe = msg.sender_id === user?.id || msg.sender_id === 'mobile-user'
                const catStyle = msg._photoCategory ? CATEGORY_STYLES[msg._photoCategory] : null
                const expired = isExpired(msg.doc_expires)
                const daysLeft = daysUntilExpiry(msg.doc_expires)
                return (
                  <div
                    key={msg.id}
                    className={cn('mb-1 flex flex-col', isMe ? 'items-end' : 'items-start')}
                  >
                    {!isMe && (
                      <span className="text-muted-foreground mb-0.5 ml-2 text-[10px] font-medium">
                        {msg.sender_name}
                      </span>
                    )}
                    <div
                      className={cn(
                        'max-w-[85%] overflow-hidden rounded-2xl shadow-sm',
                        isMe
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-secondary text-foreground rounded-bl-md'
                      )}
                    >
                      {/* Photo message */}
                      {msg._isPhoto && msg._photoUrl && (
                        <div className="relative">
                          <img
                            src={msg._photoUrl}
                            alt="Site photo"
                            className="max-h-64 w-full object-cover"
                            loading="lazy"
                          />
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

                      {/* Document message */}
                      {msg._isDoc && (
                        <div className={cn('flex items-center gap-3 p-3', expired && 'opacity-50')}>
                          <div
                            className={cn(
                              'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
                              expired ? 'bg-muted' : 'bg-primary/15'
                            )}
                          >
                            <FileText
                              className={cn(
                                'h-5 w-5',
                                expired ? 'text-muted-foreground' : 'text-primary'
                              )}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {msg.doc_name || 'Document'}
                            </div>
                            <div className="text-[10px] opacity-70">
                              {msg.doc_type} ·{' '}
                              {expired
                                ? 'Expired'
                                : daysLeft !== null
                                  ? `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
                                  : ''}
                            </div>
                          </div>
                          {!expired && msg._docUrl && (
                            <a
                              href={msg._docUrl}
                              download={msg.doc_name}
                              className="bg-primary/15 text-primary flex h-8 w-8 items-center justify-center rounded-full"
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* Text content (below photo/doc, or standalone for text messages) */}
                      {msg._displayText && msg._displayText !== '(no note)' && (
                        <div className="p-2.5">
                          {!msg._isPhoto && !msg._isDoc && catStyle && (
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
                          <p className="text-sm break-words whitespace-pre-wrap">
                            {msg._displayText}
                          </p>
                          {/* GPS + timestamp for photo messages */}
                          {msg._isPhoto && (msg.photo_gps || msg.photo_timestamp) && (
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
                      )}

                      {/* Timestamp + read receipt */}
                      <div
                        className={cn(
                          'flex items-center justify-end gap-1 px-2.5 pb-1.5 text-[9px] opacity-60'
                        )}
                      >
                        {formatTime(msg.created_at)}
                        {isMe && <CheckCheck className="h-2.5 w-2.5" />}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment menu */}
      {showAttach && (
        <div className="border-border bg-popover absolute bottom-16 left-3 z-50 flex flex-col gap-1 rounded-2xl border p-2 shadow-xl">
          <button
            onClick={handlePhotoSelect}
            className="active:bg-accent flex w-48 items-center gap-3 rounded-xl p-2.5 text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-medium">Photo Report</div>
              <div className="text-muted-foreground text-[10px]">Capture + categorize + GPS</div>
            </div>
          </button>
          <button
            onClick={() => docInputRef.current?.click()}
            className="active:bg-accent flex w-48 items-center gap-3 rounded-xl p-2.5 text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
              <Paperclip className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-medium">Document</div>
              <div className="text-muted-foreground text-[10px]">PDF, image · 7-day expiry</div>
            </div>
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="border-border bg-background safe-area-bottom flex items-center gap-1.5 border-t p-2">
        <button
          onClick={() => setShowAttach((v) => !v)}
          className="text-muted-foreground active:bg-accent flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
        >
          {showAttach ? <X className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
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
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
        className="hidden"
        onChange={handleDocSelect}
      />
    </div>
  )
}
