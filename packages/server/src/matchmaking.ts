import type { Server } from 'socket.io'
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@ctk/protocol'
import { createGameRecord, snapshotFor } from './game.js'
import type { GameStore, QueueEntry } from './store.js'

export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

/** Seat a socket into a game: join the broadcast room and remember the game id. */
export function seatSocket(io: AppServer, socketId: string | null, gameId: string): void {
  if (!socketId) return
  const socket = io.sockets.sockets.get(socketId)
  if (!socket) return
  socket.data.gameId = gameId
  void socket.join(gameId)
}

/** Add a player to the queue and pair them with a waiting opponent if one exists. */
export async function joinQueue(io: AppServer, store: GameStore, entry: QueueEntry): Promise<void> {
  await store.queueJoin(entry)
  const pair = await store.queueShiftPair()
  if (!pair) {
    const position = await store.queuePosition(entry.uid)
    io.to(entry.socketId).emit('queue:waiting', { position })
    return
  }

  const record = createGameRecord(pair[0], pair[1])
  await store.createGame(record)

  for (const color of ['w', 'b'] as const) {
    const seat = record.players[color]
    seatSocket(io, seat.socketId, record.id)
    if (seat.socketId) io.to(seat.socketId).emit('game:start', snapshotFor(record, color))
  }
}

export async function leaveQueue(store: GameStore, uid: string): Promise<void> {
  await store.queueLeaveByUid(uid)
}
