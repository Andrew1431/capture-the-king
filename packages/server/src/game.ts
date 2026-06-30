import { initialGameState, makeMove } from '@ctk/engine'
import type { Color } from '@ctk/engine'
import type { GameOverPayload, GameSnapshot, MovePayload } from '@ctk/protocol'
import { nanoid } from 'nanoid'
import type { GameRecord, QueueEntry, Seat } from './store.js'

const seatToInfo = (seat: Seat) => ({ uid: seat.uid, name: seat.name })

/** Pair two players into a fresh game with randomly-assigned colors. */
export function createGameRecord(a: QueueEntry, b: QueueEntry): GameRecord {
  const [white, black] = Math.random() < 0.5 ? [a, b] : [b, a]
  const toSeat = (e: QueueEntry): Seat => ({ uid: e.uid, name: e.name, socketId: e.socketId })
  return {
    id: nanoid(10),
    players: { w: toSeat(white), b: toSeat(black) },
    state: initialGameState(),
    lastMove: null,
    moves: [],
    createdAt: Date.now(),
  }
}

/** Which seat a uid occupies, or null if they are not in this game. */
export function seatColor(record: GameRecord, uid: string): Color | null {
  if (record.players.w.uid === uid) return 'w'
  if (record.players.b.uid === uid) return 'b'
  return null
}

/** The full snapshot for the player on `color`. */
export function snapshotFor(record: GameRecord, color: Color): GameSnapshot {
  return {
    gameId: record.id,
    color,
    players: { w: seatToInfo(record.players.w), b: seatToInfo(record.players.b) },
    state: record.state,
    lastMove: record.lastMove,
    moves: record.moves,
  }
}

export type MoveOutcome =
  | { error: string }
  | { record: GameRecord; over: GameOverPayload | null }

/** Validate and apply a player's move, mutating the record's state in place. */
export function applyPlayerMove(record: GameRecord, uid: string, payload: MovePayload): MoveOutcome {
  const color = seatColor(record, uid)
  if (!color) return { error: 'You are not a player in this game.' }
  if (record.state.status !== 'active') return { error: 'This game is already over.' }
  if (record.state.turn !== color) return { error: 'It is not your turn.' }

  const result = makeMove(record.state, payload.from, payload.to, payload.promo)
  if (!result) return { error: 'Illegal move.' }

  record.state = result.state
  record.lastMove = result.move
  record.moves.push(result.move)
  return { record, over: gameOverPayload(record) }
}

/** Build a game-over payload from a finished record, or null if still active. */
export function gameOverPayload(record: GameRecord): GameOverPayload | null {
  const { status } = record.state
  if (status === 'active') return null
  if (status === 'draw') return { winner: null, reason: 'stalemate', status }
  return {
    winner: status === 'w-wins' ? 'w' : 'b',
    reason: 'king-captured',
    status,
  }
}
