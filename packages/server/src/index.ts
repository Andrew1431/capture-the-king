import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { initialGameState } from '@ctk/engine'
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from './protocol.js'

const PORT = Number(process.env.PORT ?? 8080)

const httpServer = createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'ctk-server', pieces: initialGameState().board.filter(Boolean).length }))
    return
  }
  res.writeHead(404)
  res.end()
})

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  transports: ['websocket'],
  cors: { origin: process.env.WEB_ORIGIN ?? '*' },
})

io.on('connection', (socket) => {
  // M3 will verify the Firebase ID token here and populate socket.data.
  console.log(`socket connected: ${socket.id}`)
  socket.on('disconnect', (reason) => {
    console.log(`socket disconnected: ${socket.id} (${reason})`)
  })
})

httpServer.listen(PORT, () => {
  console.log(`ctk-server listening on :${PORT}`)
})
