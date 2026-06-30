import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { nanoid } from 'nanoid'
import type { GameOverPayload, HandshakeAuth } from '@ctk/protocol'
import { applyPlayerMove, seatColor, snapshotFor } from './game.js'
import { joinQueue, leaveQueue, seatSocket, type AppServer } from './matchmaking.js'
import { MemoryStore, type GameRecord } from './store.js'

const PORT = Number(process.env.PORT ?? 8080)
const store = new MemoryStore()

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

/** Resolve a guest identity from the handshake (real auth arrives in M3). */
function identify(auth: Partial<HandshakeAuth> | undefined): HandshakeAuth {
  const uid = auth?.uid?.trim() || `guest-${nanoid(8)}`
  const name = auth?.name?.trim() || `Guest-${Math.floor(1000 + Math.random() * 9000)}`
  return { uid, name }
}

io.on('connection', async (socket) => {
  const { uid, name } = identify(socket.handshake.auth as Partial<HandshakeAuth>)
  socket.data.uid = uid
  socket.data.name = name

  // Reconnect: if this player has a live game, re-seat them and resend the state.
  const existing = await store.findActiveGameByUid(uid)
  if (existing) {
    const color = seatColor(existing, uid)!
    existing.players[color].socketId = socket.id
    await store.saveGame(existing)
    seatSocket(io, socket.id, existing.id)
    socket.emit('game:start', snapshotFor(existing, color))
  }

  /** Load the game this socket is seated in, or null. */
  async function currentGame(): Promise<GameRecord | null> {
    const id = socket.data.gameId
    const game = id ? await store.getGame(id) : await store.findActiveGameByUid(uid)
    if (game) socket.data.gameId = game.id
    return game ?? null
  }

  async function endGame(game: GameRecord, payload: GameOverPayload): Promise<void> {
    io.to(game.id).emit('game:over', payload)
    await store.deleteGame(game.id)
    io.in(game.id).socketsLeave(game.id)
  }

  socket.on('queue:join', () => {
    void joinQueue(io, store, { uid, name, socketId: socket.id })
  })

  socket.on('queue:leave', () => {
    void leaveQueue(store, uid)
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
