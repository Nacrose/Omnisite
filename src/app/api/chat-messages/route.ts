import { createCrudHandler } from '@/lib/crud-handler'
import { chatMessageSchema } from '@/lib/validation'
import type { AuthenticatedUser } from '@/lib/api-auth'

// GET /api/chat-messages — list messages (no pagination; ordered by created_at).
// POST /api/chat-messages — upsert a message. Sender identity is forced from
// the authenticated session so a client cannot impersonate another user.
// DELETE /api/chat-messages?id=... — delete via deleteWithAudit.
export const { GET, POST, DELETE } = createCrudHandler({
  table: 'chat_messages',
  schema: chatMessageSchema,
  orderField: 'created_at',
  transformBody: (body, user: AuthenticatedUser) => {
    body.sender_id = user.id
    // AuthenticatedUser has no `name` field (only id / email / role / token),
    // so derive a human-readable display name from the email's local part.
    // `arjun.sharma@omnisite.com` → `Arjun Sharma` — matches what the
    // client-side mapSupabaseUser() in auth.tsx already does, so the name
    // shown next to a freshly-posted message matches the name shown on
    // subsequent reloads. Previously this stored the raw email, which made
    // the chat UI read "arjun.sharma@omnisite.com:" next to every message.
    body.sender_name = user.email
      .split('@')[0]
      .split(/[._-]+/)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ')
  },
})
