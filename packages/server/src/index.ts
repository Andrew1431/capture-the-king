import { createServer } from 'node:http'
import { Server } from 'socket.io'
import type { HandshakeAuth } from '@ctk/protocol'
import { initAuth, verifyToken } from './auth.js'
import { armFlag, endGame } from './clock.js'
import { applyPlayerMove, liveClock, seatColor } from './game.js'
import {
  cancelInvite,
  createInvite,
  joinInvite,
  joinQueue,
  leaveQueue,
  resumeGame,
  type AppServer,
} from './matchmaking.js'
import { MemoryStore, type GameRecord } from './store.js'

const PORT = Number(process.env.PORT ?? 8080)
const store = new MemoryStore()

// Force-close any socket that goes this long without sending a client event, so an
// abandoned/idle browser tab can't pin a Cloud Run instance (and keep billing)
// indefinitely. The timer resets on every inbound event (move, queue:join, …).
// disconnect(true) is server-initiated, so socket.io-client will NOT auto-reconnect
// while idle; the next user action reconnects and resumeGame() restores any game.
// Tune freely — lower is cheaper but cuts off longer think-times mid-game.
const IDLE_TIMEOUT_MS = 2 * 60_000

initAuth()

const httpServer = createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'ctk-server' }))
    return
  }
  res.writeHead(404)
  res.end()
})

const io: AppServer = new Server(httpServer, {
  transports: ['websocket'],
  cors: { origin: process.env.WEB_ORIGIN ?? '*' },
})

// Verify the Firebase ID token on the handshake; reject the socket if it's missing
// or invalid. uid/name on socket.data are the authority for everything downstream.
io.use(async (socket, next) => {
  const { token } = (socket.handshake.auth ?? {}) as Partial<HandshakeAuth>
  if (!token) return next(new Error('auth-required'))
  try {
    const user = await verifyToken(token)
    socket.data.uid = user.uid
    socket.data.name = user.name
    next()
  } catch {
    next(new Error('auth-invalid'))
  }
})

io.on('connection', async (socket) => {
  const { uid, name } = socket.data

  // Idle watchdog: rearm on any inbound event; fire => server-initiated close.
  let idleTimer: ReturnType<typeof setTimeout>
  const armIdle = () => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => socket.disconnect(true), IDLE_TIMEOUT_MS)
  }
  socket.onAny(armIdle)
  armIdle()

  // Reconnect: if this player has a live game, re-seat them and resend the state.
  const existing = await store.findActiveGameByUid(uid)
  if (existing) await resumeGame(io, store, existing, uid, socket.id)

  /** Load the game this socket is seated in, or null. */
  async function currentGame(): Promise<GameRecord | null> {
    const id = socket.data.gameId
    const game = id ? await store.getGame(id) : await store.findActiveGameByUid(uid)
    if (game) socket.data.gameId = game.id
    return game ?? null
  }

  socket.on('queue:join', () => {
    void joinQueue(io, store, { uid, name, socketId: socket.id })
  })

  socket.on('queue:leave', () => {
    void leaveQueue(store, uid)
  })

  socket.on('invite:create', (ack) => {
    void createInvite(io, store, { uid, name, socketId: socket.id }, ack)
  })

  socket.on('invite:cancel', () => {
    void cancelInvite(store, uid)
  })

  socket.on('invite:join', ({ code }, ack) => {
    void joinInvite(io, store, { uid, name, socketId: socket.id }, code, ack)
  })

  socket.on('move', async (payload) => {
    const game = await currentGame()
    if (!game) return socket.emit('error:msg', { message: 'No active game.' })

    const outcome = applyPlayerMove(game, uid, payload)
    if ('error' in outcome) return socket.emit('error:msg', { message: outcome.error })

    await store.saveGame(game)
    io.to(game.id).emit('state', { state: game.state, lastMove: game.lastMove, clock: liveClock(game) })
    if (outcome.over) await endGame(io, store, game, outcome.over)
    // Re-arm the flag for the opponent now on the clock (no-op for untimed games).
    else armFlag(io, store, game)
  })

  socket.on('resign', async () => {
    const game = await currentGame()
    if (!game) return
    const color = seatColor(game, uid)
    if (!color || game.state.status !== 'active') return
    await endGame(io, store, game, {
      winner: color === 'w' ? 'b' : 'w',
      reason: 'resign',
      status: color === 'w' ? 'b-wins' : 'w-wins',
    })
  })

  socket.on('disconnect', async () => {
    clearTimeout(idleTimer)
    await leaveQueue(store, uid)
    await cancelInvite(store, uid)
    // Keep the live game alive for a reconnect grace; just clear the socket binding.
    const game = await currentGame()
    if (!game) return
    const color = seatColor(game, uid)
    if (color) {
      game.players[color].socketId = null
      await store.saveGame(game)
    }
  })
})

httpServer.listen(PORT, () => {
  console.log(`ctk-server listening on :${PORT}`)
})
