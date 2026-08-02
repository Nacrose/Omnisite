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
    body.sender_name = user.email
  },
})
