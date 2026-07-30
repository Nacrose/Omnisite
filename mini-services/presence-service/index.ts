import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  // Use default socket.io path — works both directly and through Caddy
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ─── Types ──────────────────────────────────────────────────────────────────

interface PresenceUser {
  id: string          // socket.id
  name: string        // display name, e.g. "Bikash Rai"
  initials: string    // 2-letter initials for the avatar
  color: string       // hex color for the cursor + avatar
  module: string      // which OmniSite module they're viewing
  cursor?: {          // cursor position on the Gantt canvas (percentage 0-100)
    x: number
    y: number
  }
  lastSeen: number    // timestamp of last activity
}

// ─── State ───────────────────────────────────────────────────────────────────

const users = new Map<string, PresenceUser>()

// Heartbeat: every 30s, prune inactive users (>60s no activity)
setInterval(() => {
  const now = Date.now()
  for (const [id, user] of users) {
    if (now - user.lastSeen > 60000) {
      users.delete(id)
      io.emit('presence:leave', { id })
      console.log(`Pruned inactive user ${user.name} (${id})`)
    }
  }
  broadcastPresence()
}, 30000)

function broadcastPresence() {
  const list = Array.from(users.values()).map(u => ({
    id: u.id,
    name: u.name,
    initials: u.initials,
    color: u.color,
    module: u.module,
    hasCursor: !!u.cursor,
    lastSeen: u.lastSeen,
  }))
  io.emit('presence:list', { users: list, count: list.length })
}

// ─── Connection handling ─────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`)
  let currentUser: PresenceUser | null = null

  // Client identifies itself on connect
  socket.on('presence:join', (data: {
    name: string
    initials: string
    color: string
    module: string
  }) => {
    currentUser = {
      id: socket.id,
      name: data.name || 'Anonymous',
      initials: data.initials || 'AN',
      color: data.color || '#64748b',
      module: data.module || 'dashboard',
      lastSeen: Date.now(),
    }
    users.set(socket.id, currentUser)

    // Notify everyone
    io.emit('presence:join', {
      id: currentUser.id,
      name: currentUser.name,
      initials: currentUser.initials,
      color: currentUser.color,
      module: currentUser.module,
    })

    broadcastPresence()
    console.log(`${currentUser.name} joined (${users.size} online)`)
  })

  // Client updates which module they're viewing
  socket.on('presence:module', (data: { module: string }) => {
    if (!currentUser) return
    currentUser.module = data.module
    currentUser.lastSeen = Date.now()
    users.set(socket.id, currentUser)
    io.emit('presence:module', {
      id: currentUser.id,
      module: currentUser.module,
    })
  })

  // Client broadcasts its cursor position on a canvas (Gantt, etc.)
  socket.on('presence:cursor', (data: { x: number; y: number; canvas?: string }) => {
    if (!currentUser) return
    currentUser.cursor = { x: data.x, y: data.y }
    currentUser.lastSeen = Date.now()
    users.set(socket.id, currentUser)

    // Broadcast to everyone EXCEPT the sender
    socket.broadcast.emit('presence:cursor', {
      id: currentUser.id,
      name: currentUser.name,
      initials: currentUser.initials,
      color: currentUser.color,
      x: data.x,
      y: data.y,
      canvas: data.canvas,
    })
  })

  // Client stopped moving cursor
  socket.on('presence:cursor-stop', () => {
    if (!currentUser) return
    currentUser.cursor = undefined
    users.set(socket.id, currentUser)
    socket.broadcast.emit('presence:cursor-stop', { id: currentUser.id })
  })

  // Heartbeat — client tells us it's still alive
  socket.on('presence:ping', () => {
    if (currentUser) {
      currentUser.lastSeen = Date.now()
      users.set(socket.id, currentUser)
    }
  })

  // Disconnect
  socket.on('disconnect', () => {
    if (currentUser) {
      users.delete(socket.id)
      io.emit('presence:leave', { id: socket.id })
      broadcastPresence()
      console.log(`${currentUser.name} left (${users.size} online)`)
    }
  })

  socket.on('error', (error) => {
    console.error(`Socket error (${socket.id}):`, error)
  })
})

// ─── Start ───────────────────────────────────────────────────────────────────

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`✓ OmniSite presence service running on port ${PORT}`)
  console.log(`  WebSocket path: /?XTransformPort=${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down presence service…')
  io.close(() => {
    httpServer.close(() => process.exit(0))
  })
})
process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down presence service…')
  io.close(() => {
    httpServer.close(() => process.exit(0))
  })
})
