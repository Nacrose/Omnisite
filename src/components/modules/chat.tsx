'use client'

import { useState, useEffect, useRef } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Plus,
  Search,
  Send,
  Hash,
  Users,
  Paperclip,
  Smile,
  Phone,
  ArrowLeft,
  Image as ImageIcon,
  FileText,
  MoreVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { upsertOne } from '@/lib/api-client'
import { useAuth } from '@/lib/auth'
import { usePersistentState } from '@/lib/use-persistent-state'
import { toast } from 'sonner'

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

/**
 * A chat channel shown in the sidebar's "Channels" group.
 *
 * `icon` is a lucide-react component so callers can override the icon when
 * supplying custom channels (e.g. an `Inbox` icon for a DM channel).
 */
export interface ChatChannel {
  id: string
  name: string
  desc: string
  icon: typeof Hash
}

/** A team member shown in the sidebar's "Team" group. */
export interface TeamMember {
  id: string
  name: string
  initials: string
  color: string
  role: string
}

// ─── Default channel + team seed data ───────────────────────────────────────
//
// Exported as `DEFAULT_CHANNELS` / `DEFAULT_TEAM_MEMBERS` so callers can
// import and extend them (e.g. add an org-specific channel list) or pass
// their own via the `ChatModule` props.

export const DEFAULT_CHANNELS: ChatChannel[] = [
  { id: 'general', name: 'general', desc: 'Project-wide announcements', icon: Hash },
  { id: 'site', name: 'site', desc: 'Site execution & daily ops', icon: Hash },
  { id: 'management', name: 'management', desc: 'PM & management discussions', icon: Hash },
]

export const DEFAULT_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'u-arjun',
    name: 'Site Engineer',
    initials: 'AS',
    color: '#f97316',
    role: 'Project Manager',
  },
  { id: 'u-bikash', name: 'Bikash Rai', initials: 'BR', color: '#3b82f6', role: 'Site Engineer' },
  { id: 'u-sita', name: 'Sita Gurung', initials: 'SG', color: '#10b981', role: 'Storekeeper' },
  { id: 'u-ram', name: 'Ram Bahadur', initials: 'RB', color: '#8b5cf6', role: 'Foreman' },
]

// ─── Main Module ─────────────────────────────────────────────────────────────

export interface ChatModuleProps {
  /** Override the default channel list. Defaults to `DEFAULT_CHANNELS`. */
  channels?: ChatChannel[]
  /** Override the default team member list. Defaults to `DEFAULT_TEAM_MEMBERS`. */
  teamMembers?: TeamMember[]
}

export function ChatModule({ channels, teamMembers }: ChatModuleProps = {}) {
  const channelsList = channels ?? DEFAULT_CHANNELS
  const teamMembersList = teamMembers ?? DEFAULT_TEAM_MEMBERS
  const [activeChannel, setActiveChannel] = usePersistentState('omnisite-chat-channel', 'general')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [showMembers, setShowMembers] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()

  // Derive sender info from the authenticated user (falls back to a neutral
  // demo identity when there is no session yet — e.g. demo mode before sign-in).
  const currentUser = {
    id: user?.id ?? 'demo-user',
    name: user?.name ?? user?.email ?? 'Anonymous',
    initials:
      (user?.name || user?.email || 'A')
        .split(/\s|@|\./)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s.charAt(0).toUpperCase())
        .join('') || 'A',
    color: '#f97316',
  }

  // Load messages from Supabase
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      const t = setTimeout(() => setLoading(false), 0)
      return () => clearTimeout(t)
    }

    let mounted = true

    const load = async () => {
      const { data, error } = await supabase!
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
    const channel = supabase!
      .channel('chat-messages-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          if (!mounted) return
          const incoming = payload.new as unknown as ChatMessage
          // De-duplicate: sendMessage() already optimistically inserts the
          // returned row, so the realtime INSERT event for the same row
          // would otherwise render the message twice.
          setMessages((prev) =>
            prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
          )
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase!.removeChannel(channel)
    }
  }, [])

  // Auto-scroll to bottom on new messages OR when the active channel changes
  // (switching channels doesn't change `messages` since it's the full list,
  // so without `activeChannel` in the deps the scroll wouldn't fire).
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeChannel])

  const channelMessages = messages.filter((m) => m.channel_id === activeChannel)
  const activeChannelInfo = channelsList.find((c) => c.id === activeChannel) || channelsList[0]

  // Filter channels and team members by the search query (matches channel
  // name/desc/last-message or member name/role).
  const q = searchQuery.trim().toLowerCase()
  const visibleChannels = q
    ? channelsList.filter((ch) => {
        if (ch.name.toLowerCase().includes(q) || ch.desc.toLowerCase().includes(q)) return true
        return messages.some(
          (m) =>
            m.channel_id === ch.id &&
            (m.content.toLowerCase().includes(q) || m.sender_name.toLowerCase().includes(q))
        )
      })
    : channelsList
  const visibleTeamMembers = q
    ? teamMembersList.filter(
        (m) => m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q)
      )
    : teamMembersList

  const sendMessage = async () => {
    if (!input.trim()) return

    // Payload shape matches the chat-messages POST schema (id/created_at are
    // generated server-side). The server returns the full ChatMessage row.
    const newMsg = {
      sender_id: currentUser.id,
      sender_name: currentUser.name,
      sender_initials: currentUser.initials,
      sender_color: currentUser.color,
      channel_id: activeChannel,
      content: input.trim(),
      message_type: 'text' as const,
    }

    setInput('')

    if (isSupabaseConfigured()) {
      try {
        // The server returns the full row including id/created_at — cast to
        // the local ChatMessage type for state insertion.
        const saved = (await upsertOne('chat-messages', newMsg)) as unknown as
          ChatMessage | undefined
        if (saved) {
          // Real-time will also fire, but add locally too for instant feedback.
          setMessages((prev) => (prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]))
        }
      } catch (err) {
        toast.error('Failed to send message', {
          description: err instanceof Error ? err.message : String(err),
        })
      }
    } else {
      // Fallback (no Supabase): add locally with a fake ID using the auth user's info
      const localMsg: ChatMessage = {
        id: `local-${Date.now()}`,
        ...newMsg,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, localMsg])
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
      const date = new Date(msg.created_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
      })
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
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() =>
                toast.info(
                  'Channel creation coming soon — use the existing general/site/management channels.'
                )
              }
              title="New channel (coming soon)"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </PaneHeader>
          <div className="border-b border-[var(--pane-divider)] px-3 py-2">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                placeholder="Search messages…"
                className="h-8 pl-7 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <PaneBody className="py-2">
            {/* Channels */}
            <div className="text-muted-foreground/70 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
              Channels
            </div>
            {visibleChannels.map((ch) => {
              const Icon = ch.icon
              const count = messages.filter((m) => m.channel_id === ch.id).length
              const lastMsg = messages.filter((m) => m.channel_id === ch.id).pop()
              return (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch.id)}
                  className={cn(
                    'hover:bg-accent/50 flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors',
                    activeChannel === ch.id && 'bg-accent border-l-primary border-l-2'
                  )}
                >
                  <Icon className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{ch.name}</span>
                      {count > 0 && (
                        <span className="text-muted-foreground text-[10px]">{count}</span>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-0.5 truncate text-[10px]">
                      {lastMsg ? `${lastMsg.sender_initials}: ${lastMsg.content}` : ch.desc}
                    </div>
                  </div>
                </button>
              )
            })}

            {/* Team members */}
            <div className="text-muted-foreground/70 mt-3 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
              Team
            </div>
            {visibleTeamMembers.map((m) => (
              <button
                key={m.id}
                onClick={() =>
                  toast.info('Direct messages coming soon — use the project channels for now.')
                }
                title="Direct message (coming soon)"
                className="hover:bg-accent/50 flex w-full items-center gap-2.5 px-3 py-2 transition-colors"
              >
                <div className="relative flex-shrink-0">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                    style={{ background: m.color }}
                  >
                    {m.initials}
                  </div>
                  <div className="ring-background absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-1" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{m.name}</div>
                  <div className="text-muted-foreground truncate text-[10px]">{m.role}</div>
                </div>
              </button>
            ))}
          </PaneBody>
        </>
      }
      detailPane={
        <>
          {/* Chat header */}
          <div className="vibrancy flex h-12 flex-shrink-0 items-center gap-2 border-b border-[var(--pane-divider)] px-4">
            <Hash className="text-muted-foreground h-4 w-4" />
            <span className="text-sm font-semibold">{activeChannelInfo.name}</span>
            <Separator orientation="vertical" className="mx-1 h-5" />
            <span className="text-muted-foreground hidden text-xs sm:block">
              {activeChannelInfo.desc}
            </span>
            <div className="flex-1" />
            <button
              onClick={() => setShowMembers(!showMembers)}
              className={cn(
                'hover:bg-accent text-muted-transition rounded-md p-1.5',
                showMembers && 'bg-accent'
              )}
              title="Team members"
            >
              <Users className="h-4 w-4" />
            </button>
            <button
              onClick={() => toast.info('Voice/video calls not available — use external tools.')}
              className="hover:bg-accent text-muted-foreground rounded-md p-1.5"
              title="Call (coming soon)"
            >
              <Phone className="h-4 w-4" />
            </button>
            <button
              onClick={() => toast.info('Channel settings coming soon.')}
              className="hover:bg-accent text-muted-foreground rounded-md p-1.5"
              title="More (coming soon)"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>

          {/* Messages area */}
          <div
            className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
            aria-live="polite"
            aria-label="Chat messages"
          >
            {loading ? (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                Loading messages…
              </div>
            ) : channelMessages.length === 0 ? (
              <div className="text-muted-foreground flex h-full flex-col items-center justify-center">
                <Hash className="mb-3 h-10 w-10 opacity-20" />
                <div className="text-sm font-medium">No messages yet</div>
                <div className="mt-1 text-xs">Send the first message in #{activeChannel}</div>
              </div>
            ) : (
              <>
                {groupedMessages.map((group, gi) => (
                  <div key={gi}>
                    {/* Date separator */}
                    <div className="my-3 flex items-center gap-3">
                      <div className="h-px flex-1 bg-[var(--pane-divider)]" />
                      <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                        {group.date}
                      </span>
                      <div className="h-px flex-1 bg-[var(--pane-divider)]" />
                    </div>
                    {/* Messages */}
                    {group.messages.map((msg, mi) => {
                      const isOwn = msg.sender_id === currentUser.id
                      const prevMsg = mi > 0 ? group.messages[mi - 1] : null
                      const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id

                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            'mb-1 flex gap-2.5',
                            isOwn && 'flex-row-reverse',
                            showAvatar ? 'mt-3' : 'mt-0.5'
                          )}
                        >
                          {/* Avatar */}
                          <div className="w-8 flex-shrink-0">
                            {showAvatar && (
                              <div
                                className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                                style={{ background: msg.sender_color }}
                              >
                                {msg.sender_initials}
                              </div>
                            )}
                          </div>

                          {/* Message bubble */}
                          <div className={cn('flex max-w-[75%] flex-col', isOwn && 'items-end')}>
                            {showAvatar && (
                              <div
                                className={cn(
                                  'mb-0.5 flex items-center gap-2',
                                  isOwn && 'flex-row-reverse'
                                )}
                              >
                                <span className="text-xs font-medium">{msg.sender_name}</span>
                                <span className="text-muted-foreground text-[10px]">
                                  {new Date(msg.created_at).toLocaleTimeString('en-GB', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            )}
                            <div
                              className={cn(
                                'rounded-2xl px-3 py-2 text-sm break-words',
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
          <div className="flex-shrink-0 border-t border-[var(--pane-divider)] p-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  toast.info('File attachments coming soon — share file URLs as text messages.')
                }
                className="hover:bg-accent text-muted-foreground rounded-lg p-2"
                title="Attach file (coming soon)"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                onClick={() =>
                  toast.info('Image attachments coming soon — share image URLs as text messages.')
                }
                className="hover:bg-accent text-muted-foreground hidden rounded-lg p-2 sm:block"
                title="Attach image (coming soon)"
              >
                <ImageIcon className="h-4 w-4" />
              </button>
              <div className="bg-secondary flex flex-1 items-center gap-2 rounded-2xl px-3 py-1.5">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={`Message #${activeChannel}…`}
                  className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
                />
                <button
                  onClick={() => toast.info('Emoji picker coming soon.')}
                  className="text-muted-foreground hover:text-foreground rounded p-1"
                  title="Emoji (coming soon)"
                >
                  <Smile className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
                className={cn(
                  'flex-shrink-0 rounded-xl p-2.5 transition-colors',
                  input.trim()
                    ? 'bg-primary text-primary-foreground hover:opacity-90'
                    : 'bg-secondary text-muted-foreground/40 cursor-not-allowed'
                )}
                title="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="text-muted-foreground mt-1.5 px-2 text-[10px]">
              Press Enter to send · Shift+Enter for new line
            </div>
          </div>
        </>
      }
      listPaneWidth="260px"
    />
  )
}
