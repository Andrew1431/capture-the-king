import { createServer } from 'node:http'
import { Server } from 'socket.io'
import type { GameOverPayload, HandshakeAuth } from '@ctk/protocol'
import { initAuth, verifyToken } from './auth.js'
import { applyPlayerMove, seatColor } from './game.js'
import {
  cancelInvite,
  createInvite,
  joinInvite,
  joinQueue,
  leaveQueue,
  resumeGame,
  type AppServer,
} from './matchmaking.js'
import { persistFinishedGame } from './persistence.js'
import { MemoryStore, type GameRecord } from './store.js'

const PORT = Number(process.env.PORT ?? 8080)
const store = new MemoryStore()

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

  async function endGame(game: GameRecord, payload: GameOverPayload): Promise<void> {
    io.to(game.id).emit('game:over', payload)
    // Persist before teardown; never let a Firestore error abort the game-over flow.
    try {
      await persistFinishedGame(game, payload)
    } catch (err) {
      console.error(`failed to persist game ${game.id}:`, err)
    }
    await store.deleteGame(game.id)
    io.in(game.id).socketsLeave(game.id)
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
    io.to(game.id).emit('state', { state: game.state, lastMove: game.lastMove })
    if (outcome.over) await endGame(game, outcome.over)
  })

  socket.on('resign', async () => {
    const game = await currentGame()
    if (!game) return
    const color = seatColor(game, uid)
    if (!color || game.state.status !== 'active') return
    await endGame(game, {
      winner: color === 'w' ? 'b' : 'w',
      reason: 'resign',
      status: color === 'w' ? 'b-wins' : 'w-wins',
    })
  })

  socket.on('disconnect', async () => {
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
