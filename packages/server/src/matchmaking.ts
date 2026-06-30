import { customAlphabet } from 'nanoid'
import type { Server } from 'socket.io'
import type {
  ClientToServerEvents,
  InterServerEvents,
  InviteJoinResult,
  ServerToClientEvents,
  SocketData,
} from '@ctk/protocol'
import { createGameRecord, seatColor, snapshotFor } from './game.js'
import type { GameRecord, GameStore, QueueEntry } from './store.js'

export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

// Ambiguity-free alphabet (no O/0/I/1) so codes are easy to read out and type.
const makeCode = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 5)

/** Seat a socket into a game: join the broadcast room and remember the game id. */
export function seatSocket(io: AppServer, socketId: string | null, gameId: string): void {
  if (!socketId) return
  const socket = io.sockets.sockets.get(socketId)
  if (!socket) return
  socket.data.gameId = gameId
  void socket.join(gameId)
}

/**
 * Re-seat a socket into an existing game and resend its snapshot. Used both on
 * reconnect and to bounce a player who tries to start a second game.
 */
export async function resumeGame(
  io: AppServer,
  store: GameStore,
  game: GameRecord,
  uid: string,
  socketId: string,
): Promise<void> {
  const color = seatColor(game, uid)
  if (!color) return
  game.players[color].socketId = socketId
  await store.saveGame(game)
  seatSocket(io, socketId, game.id)
  io.to(socketId).emit('game:start', snapshotFor(game, color))
}

/** Create a game from two seated players and emit `game:start` to each. */
async function startGame(
  io: AppServer,
  store: GameStore,
  a: QueueEntry,
  b: QueueEntry,
): Promise<void> {
  const record = createGameRecord(a, b)
  await store.createGame(record)
  for (const color of ['w', 'b'] as const) {
    const seat = record.players[color]
    seatSocket(io, seat.socketId, record.id)
    if (seat.socketId) io.to(seat.socketId).emit('game:start', snapshotFor(record, color))
  }
}

/** True and already handled if the player has a live game (bounced back into it). */
async function bounceIfInGame(
  io: AppServer,
  store: GameStore,
  entry: QueueEntry,
): Promise<boolean> {
  const active = await store.findActiveGameByUid(entry.uid)
  if (!active) return false
  await resumeGame(io, store, active, entry.uid, entry.socketId)
  return true
}

/** Add a player to the queue and pair them with a waiting opponent if one exists. */
export async function joinQueue(io: AppServer, store: GameStore, entry: QueueEntry): Promise<void> {
  // One game at a time: a player with a live game is bounced back into it, not queued.
  if (await bounceIfInGame(io, store, entry)) return

  await store.inviteDeleteByHost(entry.uid)
  await store.queueJoin(entry)
  const pair = await store.queueShiftPair()
  if (!pair) {
    const position = await store.queuePosition(entry.uid)
    io.to(entry.socketId).emit('queue:waiting', { position })
    return
  }
  await startGame(io, store, pair[0], pair[1])
}

export async function leaveQueue(store: GameStore, uid: string): Promise<void> {
  await store.queueLeaveByUid(uid)
}

/** Open a private room and hand the host a shareable code. */
export async function createInvite(
  io: AppServer,
  store: GameStore,
  host: QueueEntry,
  ack: (res: { code: string }) => void,
): Promise<void> {
  // One game at a time: an in-game host is bounced back; no room, empty code.
  if (await bounceIfInGame(io, store, host)) return ack({ code: '' })

  await store.queueLeaveByUid(host.uid)
  await store.inviteDeleteByHost(host.uid)
  let code = makeCode()
  while (await store.inviteGet(code)) code = makeCode()
  await store.inviteCreate({ code, host, createdAt: Date.now() })
  ack({ code })
  io.to(host.socketId).emit('invite:waiting', { code })
}

/** Close a host's open room (host-initiated cancel or disconnect cleanup). */
export async function cancelInvite(store: GameStore, uid: string): Promise<void> {
  await store.inviteDeleteByHost(uid)
}

/** Join a friend's room by code, starting a game on success. */
export async function joinInvite(
  io: AppServer,
  store: GameStore,
  joiner: QueueEntry,
  rawCode: string,
  ack: (res: InviteJoinResult) => void,
): Promise<void> {
  // Already in a game: resumeGame's game:start takes them there; ack ok so the
  // client doesn't surface a join error on top of it.
  if (await bounceIfInGame(io, store, joiner)) return ack({ ok: true })

  const code = rawCode.trim().toUpperCase()
  // Don't consume your own room by scanning your own code.
  const peek = await store.inviteGet(code)
  if (peek && peek.host.uid === joiner.uid) return ack({ ok: false, reason: 'not-found' })

  const claim = await store.inviteClaim(code)
  if (!claim.ok) return ack({ ok: false, reason: claim.reason })

  ack({ ok: true })
  await store.queueLeaveByUid(joiner.uid)
  await startGame(io, store, claim.room.host, joiner)
}
