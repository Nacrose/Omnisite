'use client'

import { useState, useEffect, useRef } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Plus, Search, Send, Hash, Users, Paperclip, Smile, Phone,
  ArrowLeft, Image as ImageIcon, FileText, MoreVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { usePersistentState } from '@/lib/use-persistent-state'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  sender_id: string
  sender_name: string
  sender_initials: string
  sender_color: string
  channel_id: string
  content: string
  message_type: string
  media_url?: string
  reply_to?: string
  created_at: string
}

const CURRENT_USER = {
  id: 'u-arjun',
  name: 'Arjun Sharma',
  initials: 'AS',
  color: '#f97316',
}

const CHANNELS = [
  { id: 'general', name: 'general', desc: 'Project-wide announcements', icon: Hash },
  { id: 'site', name: 'site', desc: 'Site execution & daily ops', icon: Hash },
  { id: 'management', name: 'management', desc: 'PM & management discussions', icon: Hash },
]

const TEAM_MEMBERS = [
  { id: 'u-arjun', name: 'Arjun Sharma', initials: 'AS', color: '#f97316', role: 'Project Manager' },
  { id: 'u-bikash', name: 'Bikash Rai', initials: 'BR', color: '#3b82f6', role: 'Site Engineer' },
  { id: 'u-sita', name: 'Sita Gurung', initials: 'SG', color: '#10b981', role: 'Storekeeper' },
  { id: 'u-ram', name: 'Ram Bahadur', initials: 'RB', color: '#8b5cf6', role: 'Foreman' },
]

// ─── Main Module ─────────────────────────────────────────────────────────────

export function ChatModule() {
  const [activeChannel, setActiveChannel] = usePersistentState('omnisite-chat-channel', 'general')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [showMembers, setShowMembers] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load messages from Supabase
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      // Use setTimeout to avoid synchronous setState in effect
      const t = setTimeout(() => setLoading(false), 0)
      return () => clearTimeout(t)
    }

    let mounted = true

    const load = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })

      if (!error && data && mounted) {
        setMessages(data as unknown as ChatMessage[])
      }
      if (mounted) setLoading(false)
    }

    load()

    // Real-time subscription
    const channel = supabase
      .channel('chat-messages-rt')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          if (mounted) {
            setMessages(prev => [...prev, payload.new as unknown as ChatMessage])
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const channelMessages = messages.filter(m => m.channel_id === activeChannel)
  const activeChannelInfo = CHANNELS.find(c => c.id === activeChannel) || CHANNELS[0]

  const sendMessage = async () => {
    if (!input.trim()) return

    const newMsg = {
      sender_id: CURRENT_USER.id,
      sender_name: CURRENT_USER.name,
      sender_initials: CURRENT_USER.initials,
      sender_color: CURRENT_USER.color,
      channel_id: activeChannel,
      content: input.trim(),
      message_type: 'text',
    }

    setInput('')

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('chat_messages').insert(newMsg).select()
      if (!error && data) {
        // Real-time will handle the update, but add locally too for instant feedback
        setMessages(prev => [...prev, data[0] as unknown as ChatMessage])
      }
    } else {
      // Fallback: add locally with a fake ID
      const localMsg: ChatMessage = {
        id: `local-${Date.now()}`,
        ...newMsg,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, localMsg])
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Group messages by date
  const groupedMessages = (() => {
    const groups: { date: string; messages: ChatMessage[] }[] = []
    let currentDate = ''
    for (const msg of channelMessages) {
      const date = new Date(msg.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      if (date !== currentDate) {
        groups.push({ date, messages: [] })
        currentDate = date
      }
      groups[groups.length - 1].messages.push(msg)
    }
    return groups
  })()

  return (
    <Workspace2Pane
      listPane={
        <>
          <PaneHeader title="Messages">
            <Button variant="ghost" size="sm" className="h-7"><Plus className="w-3.5 h-3.5" /></Button>
          </PaneHeader>
          <div className="px-3 py-2 border-b border-[var(--pane-divider)]">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Search messages…" className="h-8 pl-7 text-xs" />
            </div>
          </div>
          <PaneBody className="py-2">
            {/* Channels */}
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Channels
            </div>
            {CHANNELS.map(ch => {
              const Icon = ch.icon
              const count = messages.filter(m => m.channel_id === ch.id).length
              const lastMsg = messages.filter(m => m.channel_id === ch.id).pop()
              return (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch.id)}
                  className={cn(
                    'w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-accent/50 transition-colors',
                    activeChannel === ch.id && 'bg-accent border-l-2 border-l-primary'
                  )}
                >
                  <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{ch.name}</span>
                      {count > 0 && <span className="text-[10px] text-muted-foreground">{count}</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {lastMsg ? `${lastMsg.sender_initials}: ${lastMsg.content}` : ch.desc}
                    </div>
                  </div>
                </button>
              )
            })}

            {/* Team members */}
            <div className="px-3 py-1.5 mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Team
            </div>
            {TEAM_MEMBERS.map(m => (
              <button
                key={m.id}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-accent/50 transition-colors"
              >
                <div className="relative flex-shrink-0">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
                    style={{ background: m.color }}
                  >
                    {m.initials}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-1 ring-background" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{m.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{m.role}</div>
                </div>
              </button>
            ))}
          </PaneBody>
        </>
      }
      detailPane={
        <>
          {/* Chat header */}
          <div className="h-12 flex-shrink-0 flex items-center gap-2 px-4 border-b border-[var(--pane-divider)] vibrancy">
            <Hash className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{activeChannelInfo.name}</span>
            <Separator orientation="vertical" className="h-5 mx-1" />
            <span className="text-xs text-muted-foreground hidden sm:block">{activeChannelInfo.desc}</span>
            <div className="flex-1" />
            <button
              onClick={() => setShowMembers(!showMembers)}
              className={cn('p-1.5 rounded-md hover:bg-accent text-muted-transition', showMembers && 'bg-accent')}
              title="Team members"
            >
              <Users className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded-md hover:bg-accent text-muted-foreground">
              <Phone className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded-md hover:bg-accent text-muted-foreground">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
            {loading ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading messages…</div>
            ) : channelMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Hash className="w-10 h-10 mb-3 opacity-20" />
                <div className="text-sm font-medium">No messages yet</div>
                <div className="text-xs mt-1">Send the first message in #{activeChannel}</div>
              </div>
            ) : (
              <>
                {groupedMessages.map((group, gi) => (
                  <div key={gi}>
                    {/* Date separator */}
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-[var(--pane-divider)]" />
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{group.date}</span>
                      <div className="flex-1 h-px bg-[var(--pane-divider)]" />
                    </div>
                    {/* Messages */}
                    {group.messages.map((msg, mi) => {
                      const isOwn = msg.sender_id === CURRENT_USER.id
                      const prevMsg = mi > 0 ? group.messages[mi - 1] : null
                      const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id

                      return (
                        <div
                          key={msg.id}
                          className={cn('flex gap-2.5 mb-1', isOwn && 'flex-row-reverse', showAvatar ? 'mt-3' : 'mt-0.5')}
                        >
                          {/* Avatar */}
                          <div className="w-8 flex-shrink-0">
                            {showAvatar && (
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
                                style={{ background: msg.sender_color }}
                              >
                                {msg.sender_initials}
                              </div>
                            )}
                          </div>

                          {/* Message bubble */}
                          <div className={cn('flex flex-col max-w-[75%]', isOwn && 'items-end')}>
                            {showAvatar && (
                              <div className={cn('flex items-center gap-2 mb-0.5', isOwn && 'flex-row-reverse')}>
                                <span className="text-xs font-medium">{msg.sender_name}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(msg.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            )}
                            <div
                              className={cn(
                                'px-3 py-2 rounded-2xl text-sm break-words',
                                isOwn
                                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                                  : 'bg-secondary text-foreground rounded-bl-sm'
                              )}
                            >
                              {msg.content}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Composer */}
          <div className="flex-shrink-0 p-3 border-t border-[var(--pane-divider)]">
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-accent text-muted-foreground" title="Attach file">
                <Paperclip className="w-4 h-4" />
              </button>
              <button className="p-2 rounded-lg hover:bg-accent text-muted-foreground hidden sm:block" title="Attach image">
                <ImageIcon className="w-4 h-4" />
              </button>
              <div className="flex-1 flex items-center gap-2 bg-secondary rounded-2xl px-3 py-1.5">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={`Message #${activeChannel}…`}
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                />
                <button className="p-1 rounded text-muted-foreground hover:text-foreground" title="Emoji">
                  <Smile className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
                className={cn(
                  'p-2.5 rounded-xl transition-colors flex-shrink-0',
                  input.trim()
                    ? 'bg-primary text-primary-foreground hover:opacity-90'
                    : 'bg-secondary text-muted-foreground/40 cursor-not-allowed'
                )}
                title="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1.5 px-2">
              Press Enter to send · Shift+Enter for new line
            </div>
          </div>
        </>
      }
      listPaneWidth="260px"
    />
  )
}
