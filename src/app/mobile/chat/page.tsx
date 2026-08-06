'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Camera, Loader2 } from 'lucide-react'
import { useSyncedState } from '@/lib/use-synced-state'
import { useAuth } from '@/lib/auth'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ChatMessage {
  id: string
  channel: string
  sender_id: string
  sender_name: string
  content: string
  created_at: string
}

export default function MobileChatPage() {
  const { user } = useAuth()
  const [messages, setMessages, loading] = useSyncedState<ChatMessage[]>(
    'omnisite-mobile-chat',
    'chat_messages',
    () => [] as ChatMessage[],
    { primaryKey: 'id' }
  )
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (content: string) => {
    if (!content.trim()) return
    setSending(true)
    try {
      const msg: ChatMessage = {
        id: `msg-${crypto.randomUUID()}`,
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
    // For now, just send a message that a photo was shared
    // (upload to Storage is deferred — the capture tab handles full photo reports)
    const msg = `📷 Shared a photo: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`
    sendMessage(msg)
  }

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Send className="text-muted-foreground/30 mb-2 h-8 w-8" />
            <span className="text-muted-foreground text-sm">No messages yet</span>
            <span className="text-muted-foreground/60 mt-1 text-xs">Start the conversation</span>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user?.id || msg.sender_id === 'mobile-user'
            return (
              <div key={msg.id} className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}>
                {!isMe && (
                  <span className="text-muted-foreground mb-0.5 ml-2 text-[10px] font-medium">
                    {msg.sender_name}
                  </span>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                    isMe
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-secondary text-foreground rounded-bl-md'
                  )}
                >
                  <p className="break-words whitespace-pre-wrap">{msg.content}</p>
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
